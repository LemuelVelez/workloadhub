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
const SUBJECT_PROGRAM_KEYS = ["programId", "program", "program_id", "programID"] as const
const SUBJECT_PROGRAM_ARRAY_KEYS = ["programIds", "program_ids"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_KEYS = ["yearLevel", "sectionYearLevel", "sectionYear", "year_level"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS = ["yearLevels", "year_levels"] as const
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


function readStringArrayValues(
    source: Record<string, unknown> | null | undefined,
    arrayKeys: readonly string[],
    fallbackKeys: readonly string[] = []
) {
    const values: string[] = []

    for (const key of arrayKeys) {
        const value = source?.[key]

        if (Array.isArray(value)) {
            for (const item of value) {
                const normalized = String(item ?? "").trim()
                if (normalized) values.push(normalized)
            }
            continue
        }

        if (typeof value === "string" && value.trim()) {
            const parts = value.includes(",") ? value.split(",") : [value]
            for (const part of parts) {
                const normalized = String(part ?? "").trim()
                if (normalized) values.push(normalized)
            }
        }
    }

    if (values.length === 0) {
        for (const key of fallbackKeys) {
            const normalized = String(source?.[key] ?? "").trim()
            if (normalized) values.push(normalized)
        }
    }

    return Array.from(new Set(values))
}

function normalizeSectionYearLevelValue(value?: string | number | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function extractSubjectYearNumber(value?: string | number | null) {
    const normalized = normalizeSectionYearLevelValue(value)
    return normalized.match(/([1-9]\d*)$/)?.[1] ?? normalized
}

function resolveSubjectProgramIds(subject: LooseSubjectDoc) {
    return readStringArrayValues(subject, SUBJECT_PROGRAM_ARRAY_KEYS, SUBJECT_PROGRAM_KEYS)
}


function resolveSubjectYearLevels(subject: LooseSubjectDoc) {
    return Array.from(
        new Set(
            readStringArrayValues(
                subject,
                SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS,
                SUBJECT_SCOPE_YEAR_LEVEL_KEYS
            )
                .map((value) => extractSubjectYearNumber(value))
                .filter(Boolean)
        )
    )
}


function getSubjectScopeSortRank(
    subject: LooseSubjectDoc,
    selectedProgramId: string,
    selectedYearLevel: string
) {
    const subjectProgramIds = resolveSubjectProgramIds(subject)
    const subjectYearLevels = resolveSubjectYearLevels(subject)
    const selectedYearNumber = extractSubjectYearNumber(selectedYearLevel)

    const programMatches =
        !selectedProgramId || subjectProgramIds.length === 0 || subjectProgramIds.includes(selectedProgramId)
    const yearMatches =
        !selectedYearNumber || subjectYearLevels.length === 0 || subjectYearLevels.includes(selectedYearNumber)

    if (programMatches && yearMatches && subjectProgramIds.length > 0 && subjectYearLevels.length > 0) return 0
    if (programMatches && yearMatches) return 1
    if (programMatches || yearMatches) return 2
    return 3
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

    const selectedSectionContext = React.useMemo(() => {
        const sectionId = String(editingRow?.sectionId ?? editingRow?.section ?? "").trim()
        const matchedSection = sectionId
            ? vm.sections.find((section) => String(section.$id) === sectionId) ?? null
            : null

        const programId = String(
            editingRow?.sectionProgramId ?? matchedSection?.programId ?? editingRow?.programId ?? ""
        ).trim()

        const yearLevel = normalizeSectionYearLevelValue(
            editingRow?.sectionYearLevel ?? matchedSection?.yearLevel ?? ""
        )

        const sectionLabel = String(
            editingRow?.sectionLabel ??
                (matchedSection
                    ? `${matchedSection.yearLevel ?? ""}${matchedSection.name ? ` - ${matchedSection.name}` : ""}`
                    : "")
        ).trim()

        return {
            sectionId,
            programId,
            yearLevel,
            label: sectionLabel || "Current section",
        }
    }, [editingRow, vm.sections])

    const availableSubjectsForSelectedTerm = React.useMemo(() => {
        const selectedTermId = recordTermId.trim()
        const selectedProgramId = selectedSectionContext.programId
        const selectedYearLevel = selectedSectionContext.yearLevel
        const selectedYearNumber = extractSubjectYearNumber(selectedYearLevel)

        return [...(vm.subjects as LooseSubjectDoc[])]
            .filter((subject) => {
                if (selectedTermSemester) {
                    const subjectTermId = resolveSubjectTermId(subject)
                    if (selectedTermId && subjectTermId === selectedTermId) {
                        // exact term match is always allowed; continue to scope checks below
                    } else {
                        const subjectSemester = resolveSubjectSemester(subject, termMap)

                        // No explicit subject semester yet:
                        // allow it, then connect it to the selected term on save.
                        if (subjectSemester && subjectSemester !== selectedTermSemester) {
                            return false
                        }
                    }
                }

                const subjectProgramIds = resolveSubjectProgramIds(subject)
                if (
                    selectedProgramId &&
                    subjectProgramIds.length > 0 &&
                    !subjectProgramIds.includes(selectedProgramId)
                ) {
                    return false
                }

                const subjectYearLevels = resolveSubjectYearLevels(subject)
                if (
                    selectedYearNumber &&
                    subjectYearLevels.length > 0 &&
                    !subjectYearLevels.includes(selectedYearNumber)
                ) {
                    return false
                }

                return true
            })
            .sort((a, b) => {
                const termRankDelta =
                    getSubjectSortRank(a, selectedTermId, selectedTermSemester, termMap) -
                    getSubjectSortRank(b, selectedTermId, selectedTermSemester, termMap)

                if (termRankDelta !== 0) return termRankDelta

                const scopeRankDelta =
                    getSubjectScopeSortRank(a, selectedProgramId, selectedYearNumber) -
                    getSubjectScopeSortRank(b, selectedProgramId, selectedYearNumber)

                if (scopeRankDelta !== 0) return scopeRankDelta

                const aCode = String(a.code ?? "").toLowerCase()
                const bCode = String(b.code ?? "").toLowerCase()
                if (aCode !== bCode) return aCode.localeCompare(bCode)

                return String(a.title ?? "").localeCompare(String(b.title ?? ""))
            })
    }, [recordTermId, selectedSectionContext, selectedTermSemester, termMap, vm.subjects])

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

        const selectedSubjectProgramIds = resolveSubjectProgramIds(selectedSubject)
        const selectedSubjectYearLevels = resolveSubjectYearLevels(selectedSubject)
        const selectedSectionYearNumber = extractSubjectYearNumber(selectedSectionContext.yearLevel)

        if (
            selectedSectionContext.programId &&
            selectedSubjectProgramIds.length > 0 &&
            !selectedSubjectProgramIds.includes(selectedSectionContext.programId)
        ) {
            toast.error("Selected subject belongs to a different program than the current section.")
            return
        }

        if (
            selectedSectionYearNumber &&
            selectedSubjectYearLevels.length > 0 &&
            !selectedSubjectYearLevels.includes(selectedSectionYearNumber)
        ) {
            toast.error("Selected subject belongs to a different year level than the current section.")
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
        let subjectScopePatched = false

        try {
            const selectedSubjectTermId = resolveSubjectTermId(selectedSubject)
            const selectedSubjectProgramIds = resolveSubjectProgramIds(selectedSubject)
            const selectedSubjectYearLevels = resolveSubjectYearLevels(selectedSubject)
            const selectedSectionYearNumber = extractSubjectYearNumber(selectedSectionContext.yearLevel)
            const subjectScopePatch: Record<string, unknown> = {}

            if (!selectedSubjectTermId) {
                subjectScopePatch.termId = termId
            }

            if (!selectedSubjectSemester && selectedTermSemester) {
                subjectScopePatch.semester = selectedTermSemester
            }

            if (selectedSectionContext.programId && selectedSubjectProgramIds.length === 0) {
                subjectScopePatch.programId = selectedSectionContext.programId
                subjectScopePatch.programIds = [selectedSectionContext.programId]
            }

            if (selectedSectionYearNumber && selectedSubjectYearLevels.length === 0) {
                subjectScopePatch.yearLevel = selectedSectionContext.yearLevel
                subjectScopePatch.yearLevels = [selectedSectionYearNumber]
            }

            if (Object.keys(subjectScopePatch).length > 0) {
                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SUBJECTS,
                        String(selectedSubject.$id),
                        subjectScopePatch
                    )
                    subjectScopePatched = true
                } catch (subjectLinkError: any) {
                    toast.warning(
                        subjectLinkError?.message
                            ? `Record will still be saved, but the subject scope was not fully persisted yet: ${subjectLinkError.message}`
                            : "Record will still be saved, but the subject scope was not fully persisted yet."
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
                subjectScopePatched
                    ? "Record updated and subject scope linked to the selected section and term."
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
        selectedSectionContext,
        termMap,
        vm,
        closeDialog,
    ])

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit Record</DialogTitle>
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
                                ? `Showing ${selectedTermSemester} subjects for ${selectedSectionContext.label || "the current section"}.`
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
                                            const subjectProgramLabels = resolveSubjectProgramIds(subject)
                                                .map((programId) => vm.programLabel(vm.programs, programId))
                                                .filter((label) => label && label !== "Unknown Program")
                                            const subjectYearLevels = resolveSubjectYearLevels(subject)
                                            const scopeSuffixParts = [subjectSemester]

                                            if (subjectProgramLabels.length > 0) {
                                                scopeSuffixParts.push(subjectProgramLabels.join(", "))
                                            }

                                            if (subjectYearLevels.length > 0) {
                                                scopeSuffixParts.push(subjectYearLevels.join(", "))
                                            }

                                            if (!linkedTermId) {
                                                scopeSuffixParts.push("Inherit selected term")
                                            }

                                            const labelSuffix = scopeSuffixParts.filter(Boolean).join(" • ")

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