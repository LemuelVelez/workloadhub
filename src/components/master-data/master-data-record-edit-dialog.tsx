"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { toast } from "sonner"

import type { AcademicTermDoc, SubjectDoc } from "../../../model/schemaModel"
import type { MasterDataManagementVM } from "./use-master-data"
import {
    DAYS,
    hasOwn,
    normalizeTimeInput,
    parseTimeToMinutes,
} from "./master-data-utils"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription as ShadDialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Props = {
    vm: MasterDataManagementVM
    open: boolean
    onOpenChange: (open: boolean) => void
    editingRow: any | null
    onEditingRowChange: (row: any | null) => void
}

type LooseSubjectDoc = SubjectDoc & Record<string, unknown>
type LooseAcademicTermDoc = AcademicTermDoc & Record<string, unknown>

const SUBJECT_TERM_KEYS = ["termId", "academicTermId", "term", "term_id", "termID"] as const
const SUBJECT_SEMESTER_KEYS = [
    "semester",
    "semesterLabel",
    "termSemester",
    "termSem",
] as const

function readFirstStringValue(
    source: Record<string, unknown> | null | undefined,
    keys: readonly string[]
) {
    for (const key of keys) {
        const value = source?.[key]
        if (typeof value === "string" && value.trim()) {
            return value.trim()
        }
    }
    return ""
}

function normalizeSemesterLabel(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim()
    if (!normalized) return ""
    if (normalized.includes("1st") || normalized.includes("first")) {
        return "1st Semester"
    }
    if (normalized.includes("2nd") || normalized.includes("second")) {
        return "2nd Semester"
    }
    if (normalized.includes("summer")) {
        return "Summer"
    }
    return value.trim()
}

function resolveSubjectTermId(subject: LooseSubjectDoc) {
    return readFirstStringValue(subject, SUBJECT_TERM_KEYS)
}

function resolveTermSemester(
    termMap: Map<string, LooseAcademicTermDoc>,
    termId: string
) {
    if (!termId) return ""
    const term = termMap.get(termId)
    return normalizeSemesterLabel(String(term?.semester ?? ""))
}

function resolveSubjectSemester(
    subject: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const linkedTermId = resolveSubjectTermId(subject)
    const linkedSemester = resolveTermSemester(termMap, linkedTermId)
    if (linkedSemester) return linkedSemester

    return normalizeSemesterLabel(readFirstStringValue(subject, SUBJECT_SEMESTER_KEYS))
}

function getSubjectSortRank(
    subject: LooseSubjectDoc,
    selectedTermId: string,
    selectedTermSemester: string,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const subjectTermId = resolveSubjectTermId(subject)
    if (selectedTermId && subjectTermId === selectedTermId) return 0

    const subjectSemester = resolveSubjectSemester(subject, termMap)
    if (selectedTermSemester && subjectSemester && subjectSemester === selectedTermSemester) {
        return 1
    }

    if (!subjectSemester) return 2

    return 3
}

export function MasterDataRecordEditDialog({
    vm,
    open,
    onOpenChange,
    editingRow,
    onEditingRowChange,
}: Props) {
    const [savingRecord, setSavingRecord] = React.useState(false)
    const [recordTermId, setRecordTermId] = React.useState("")
    const [recordDay, setRecordDay] = React.useState<(typeof DAYS)[number]>("Monday")
    const [recordStartTime, setRecordStartTime] = React.useState("")
    const [recordEndTime, setRecordEndTime] = React.useState("")
    const [recordRoom, setRecordRoom] = React.useState("")
    const [recordFacultyValue, setRecordFacultyValue] = React.useState("")
    const [recordSubjectId, setRecordSubjectId] = React.useState("")

    const recordsCollectionId = React.useMemo(() => {
        const anyCollections = COLLECTIONS as any
        return (
            anyCollections.LIST_OF_RECORDS ||
            anyCollections.RECORDS ||
            anyCollections.CLASS_RECORDS ||
            anyCollections.SCHEDULE_RECORDS ||
            anyCollections.WORKLOAD_RECORDS ||
            ""
        )
    }, [])

    const termMap = React.useMemo(() => {
        const map = new Map<string, LooseAcademicTermDoc>()
        for (const term of vm.terms as LooseAcademicTermDoc[]) {
            map.set(String(term.$id), term)
        }
        return map
    }, [vm.terms])

    const selectedTermSemester = React.useMemo(() => {
        return resolveTermSemester(termMap, recordTermId.trim())
    }, [recordTermId, termMap])

    const availableSubjectsForSelectedTerm = React.useMemo(() => {
        const selectedTermId = recordTermId.trim()

        return [...(vm.subjects as LooseSubjectDoc[])]
            .filter((subject) => {
                if (!selectedTermSemester) return true

                const subjectTermId = resolveSubjectTermId(subject)
                if (selectedTermId && subjectTermId === selectedTermId) return true

                const subjectSemester = resolveSubjectSemester(subject, termMap)

                // No explicit subject semester yet:
                // allow it, then connect it to the selected term on save.
                if (!subjectSemester) return true

                return subjectSemester === selectedTermSemester
            })
            .sort((a, b) => {
                const rankDelta =
                    getSubjectSortRank(a, selectedTermId, selectedTermSemester, termMap) -
                    getSubjectSortRank(b, selectedTermId, selectedTermSemester, termMap)

                if (rankDelta !== 0) return rankDelta

                const aCode = String(a.code ?? "").toLowerCase()
                const bCode = String(b.code ?? "").toLowerCase()
                if (aCode !== bCode) return aCode.localeCompare(bCode)

                return String(a.title ?? "").localeCompare(String(b.title ?? ""))
            })
    }, [recordTermId, selectedTermSemester, termMap, vm.subjects])

    React.useEffect(() => {
        if (!open || !editingRow) return

        const termId =
            (editingRow?.termId ??
                editingRow?.academicTermId ??
                editingRow?.term ??
                editingRow?.term_id ??
                editingRow?.termID ??
                "") as string

        const day =
            (editingRow?.dayOfWeek ?? editingRow?.day ?? editingRow?.dow ?? "Monday") as
                | (typeof DAYS)[number]
                | string

        const start = (editingRow?.startTime ?? editingRow?.start ?? "") as string
        const end = (editingRow?.endTime ?? editingRow?.end ?? "") as string
        const room = (editingRow?.roomLabel ?? editingRow?.room ?? editingRow?.roomName ?? "") as string
        const facultyValue =
            (editingRow?.facultyUserId ??
                editingRow?.facultyId ??
                editingRow?.faculty ??
                editingRow?.userId ??
                "") as string

        const subjectId =
            (editingRow?.subjectId ??
                editingRow?.subject ??
                editingRow?.subjectDocId ??
                editingRow?.subjectID ??
                "") as string

        setRecordTermId(String(termId ?? ""))
        setRecordDay((DAYS as readonly string[]).includes(day) ? (day as (typeof DAYS)[number]) : "Monday")
        setRecordStartTime(String(start ?? ""))
        setRecordEndTime(String(end ?? ""))
        setRecordRoom(String(room ?? ""))
        setRecordFacultyValue(String(facultyValue ?? ""))
        setRecordSubjectId(String(subjectId ?? ""))
    }, [open, editingRow])

    React.useEffect(() => {
        if (!recordSubjectId.trim()) return
        if (availableSubjectsForSelectedTerm.some((subject) => String(subject.$id) === recordSubjectId.trim())) {
            return
        }
        setRecordSubjectId("")
    }, [availableSubjectsForSelectedTerm, recordSubjectId])

    const closeDialog = React.useCallback(() => {
        onOpenChange(false)
        onEditingRowChange(null)
    }, [onOpenChange, onEditingRowChange])

    const handleOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            onOpenChange(nextOpen)
            if (!nextOpen) {
                onEditingRowChange(null)
            }
        },
        [onOpenChange, onEditingRowChange]
    )

    const saveEditedRecord = React.useCallback(async () => {
        if (!editingRow) return

        if (!recordsCollectionId) {
            toast.error("Records collection is not configured in COLLECTIONS.")
            return
        }

        const docId = String(
            editingRow?.id ??
                editingRow?.$id ??
                editingRow?.recordId ??
                editingRow?.record_id ??
                ""
        ).trim()

        if (!docId) {
            toast.error("Missing record document id.")
            return
        }

        const termId = recordTermId.trim()
        if (!termId) {
            toast.error("Term is required.")
            return
        }

        const startRaw = recordStartTime.trim()
        const endRaw = recordEndTime.trim()
        if (!startRaw || !endRaw) {
            toast.error("Start time and End time are required.")
            return
        }

        const startNorm = normalizeTimeInput(startRaw)
        const endNorm = normalizeTimeInput(endRaw)

        if (!startNorm || !endNorm) {
            toast.error(
                "Invalid time format. Use 8:00 AM / 1:30 PM or 08:00 / 13:30."
            )
            return
        }

        const startMin = parseTimeToMinutes(startNorm)
        const endMin = parseTimeToMinutes(endNorm)

        if (startMin == null || endMin == null) {
            toast.error("Invalid time value.")
            return
        }

        if (startMin >= endMin) {
            toast.error("Start time must be before End time.")
            return
        }

        const room = recordRoom.trim()
        if (!room) {
            toast.error("Room is required.")
            return
        }

        if (!recordSubjectId.trim()) {
            toast.error("Subject is required.")
            return
        }

        if (!recordFacultyValue.trim()) {
            toast.error("Faculty is required.")
            return
        }

        const selectedSubject =
            ((vm.subjects as LooseSubjectDoc[]).find(
                (subject) => String(subject.$id) === recordSubjectId.trim()
            ) as LooseSubjectDoc | undefined) ?? null

        if (!selectedSubject) {
            toast.error("Selected subject was not found.")
            return
        }

        const selectedSubjectSemester = resolveSubjectSemester(selectedSubject, termMap)
        if (
            selectedTermSemester &&
            selectedSubjectSemester &&
            selectedSubjectSemester !== selectedTermSemester
        ) {
            toast.error(
                `Selected subject belongs to ${selectedSubjectSemester}. Please choose a ${selectedTermSemester} subject.`
            )
            return
        }

        const payload: any = {}

        if (hasOwn(editingRow, "termId")) payload.termId = termId
        else if (hasOwn(editingRow, "academicTermId")) payload.academicTermId = termId
        else if (hasOwn(editingRow, "term")) payload.term = termId
        else if (hasOwn(editingRow, "term_id")) payload.term_id = termId
        else if (hasOwn(editingRow, "termID")) payload.termID = termId

        if (hasOwn(editingRow, "dayOfWeek")) payload.dayOfWeek = recordDay
        else if (hasOwn(editingRow, "day")) payload.day = recordDay
        else if (hasOwn(editingRow, "dow")) payload.dow = recordDay

        if (hasOwn(editingRow, "startTime")) payload.startTime = startNorm
        else if (hasOwn(editingRow, "start")) payload.start = startNorm

        if (hasOwn(editingRow, "endTime")) payload.endTime = endNorm
        else if (hasOwn(editingRow, "end")) payload.end = endNorm

        if (hasOwn(editingRow, "roomLabel")) payload.roomLabel = room
        else if (hasOwn(editingRow, "room")) payload.room = room
        else if (hasOwn(editingRow, "roomName")) payload.roomName = room

        if (hasOwn(editingRow, "facultyUserId")) {
            payload.facultyUserId = recordFacultyValue.trim()
        } else if (hasOwn(editingRow, "facultyId")) {
            payload.facultyId = recordFacultyValue.trim()
        } else if (hasOwn(editingRow, "faculty")) {
            payload.faculty = recordFacultyValue.trim()
        } else if (hasOwn(editingRow, "userId")) {
            payload.userId = recordFacultyValue.trim()
        }

        if (hasOwn(editingRow, "subjectId")) payload.subjectId = recordSubjectId.trim()
        else if (hasOwn(editingRow, "subject")) payload.subject = recordSubjectId.trim()
        else if (hasOwn(editingRow, "subjectDocId")) {
            payload.subjectDocId = recordSubjectId.trim()
        } else if (hasOwn(editingRow, "subjectID")) {
            payload.subjectID = recordSubjectId.trim()
        }

        if (hasOwn(editingRow, "units")) {
            const units = selectedSubject?.units
            if (units != null && String(units).trim() !== "") {
                payload.units = units
            }
        }

        if (Object.keys(payload).length === 0) {
            toast.error("No editable fields detected for this record schema.")
            return
        }

        setSavingRecord(true)
        let subjectLinkedToSelectedTerm = false

        try {
            const selectedSubjectTermId = resolveSubjectTermId(selectedSubject)

            if (!selectedSubjectTermId) {
                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SUBJECTS,
                        String(selectedSubject.$id),
                        { termId }
                    )
                    subjectLinkedToSelectedTerm = true
                } catch (subjectLinkError: any) {
                    toast.warning(
                        subjectLinkError?.message
                            ? `Record will still be saved, but the subject-term link was not persisted yet: ${subjectLinkError.message}`
                            : "Record will still be saved, but the subject-term link was not persisted yet."
                    )
                }
            }

            await databases.updateDocument(
                DATABASE_ID,
                recordsCollectionId,
                docId,
                payload
            )

            toast.success(
                subjectLinkedToSelectedTerm
                    ? "Record updated and subject linked to the selected term."
                    : "Record updated."
            )
            closeDialog()

            if (typeof (vm as any).refreshAll === "function") {
                await (vm as any).refreshAll()
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to update record.")
        } finally {
            setSavingRecord(false)
        }
    }, [
        editingRow,
        recordsCollectionId,
        recordTermId,
        recordDay,
        recordStartTime,
        recordEndTime,
        recordRoom,
        recordFacultyValue,
        recordSubjectId,
        selectedTermSemester,
        termMap,
        vm,
        closeDialog,
    ])

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Record</DialogTitle>
                    <ShadDialogDescription>
                        Update term/day/time/room/faculty/subject for this record.
                        Subject choices are now limited by the selected term semester,
                        and unlinked subjects can automatically inherit the selected
                        term when saved.
                    </ShadDialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Term</label>
                        <Select value={recordTermId} onValueChange={setRecordTermId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Term" />
                            </SelectTrigger>
                            <SelectContent>
                                {vm.terms.length === 0 ? (
                                    <SelectItem value="__none__" disabled>
                                        No academic terms found
                                    </SelectItem>
                                ) : (
                                    vm.terms.map((t) => (
                                        <SelectItem key={t.$id} value={t.$id}>
                                            {vm.termLabel(vm.terms, t.$id)}
                                            {t.isActive ? " • Active" : ""}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                            {selectedTermSemester
                                ? `Showing ${selectedTermSemester} subjects only for this record.`
                                : "Select a term to automatically segregate subjects by semester."}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Day</label>
                            <Select
                                value={recordDay}
                                onValueChange={(v) =>
                                    setRecordDay(v as (typeof DAYS)[number])
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((d) => (
                                        <SelectItem key={d} value={d}>
                                            {d}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Start Time</label>
                            <Input
                                value={recordStartTime}
                                onChange={(e) => setRecordStartTime(e.target.value)}
                                placeholder="8:00 AM"
                            />
                            <div className="text-xs text-muted-foreground">
                                Accepted: 8:00 AM / 1:30 PM or 08:00 / 13:30
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">End Time</label>
                            <Input
                                value={recordEndTime}
                                onChange={(e) => setRecordEndTime(e.target.value)}
                                placeholder="9:00 AM"
                            />
                            <div className="text-xs text-muted-foreground">
                                Accepted: 8:00 AM / 1:30 PM or 08:00 / 13:30
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Room</label>
                        <Input
                            value={recordRoom}
                            onChange={(e) => setRecordRoom(e.target.value)}
                            placeholder="e.g. Room 301 / AVR / Lab 2"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Faculty</label>
                            <Select
                                value={recordFacultyValue}
                                onValueChange={setRecordFacultyValue}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Faculty" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.filteredFaculty.length === 0 ? (
                                        <SelectItem value="__none__" disabled>
                                            No faculty found
                                        </SelectItem>
                                    ) : (
                                        vm.filteredFaculty.map((f: any) => {
                                            const user =
                                                vm.facultyUserMap.get(
                                                    String(f.userId ?? "").trim()
                                                ) ?? null
                                            const label = user
                                                ? vm.facultyDisplay(user)
                                                : String(f.userId)

                                            return (
                                                <SelectItem
                                                    key={f.$id}
                                                    value={String(f.userId)}
                                                >
                                                    {label}
                                                </SelectItem>
                                            )
                                        })
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                Note: This uses Faculty userId as the selection value
                                (common schema).
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Subject</label>
                            <Select
                                value={recordSubjectId}
                                onValueChange={setRecordSubjectId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSubjectsForSelectedTerm.length === 0 ? (
                                        <SelectItem value="__none__" disabled>
                                            No subjects found for the selected semester
                                        </SelectItem>
                                    ) : (
                                        availableSubjectsForSelectedTerm.map((subject) => {
                                            const linkedTermId = resolveSubjectTermId(subject)
                                            const subjectSemester =
                                                resolveSubjectSemester(subject, termMap) ||
                                                selectedTermSemester ||
                                                "No Semester"
                                            const labelSuffix = linkedTermId
                                                ? subjectSemester
                                                : `${subjectSemester} • Inherit selected term`

                                            return (
                                                <SelectItem
                                                    key={subject.$id}
                                                    value={subject.$id}
                                                >
                                                    {subject.code} — {subject.title} ({labelSuffix})
                                                </SelectItem>
                                            )
                                        })
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                Units are taken automatically from the selected subject.
                                Subjects without a direct term link will inherit the
                                selected term when possible.
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={closeDialog}
                        disabled={savingRecord}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void saveEditedRecord()}
                        disabled={savingRecord}
                    >
                        {savingRecord ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}