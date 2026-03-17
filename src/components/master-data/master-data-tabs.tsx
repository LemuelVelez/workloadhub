/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"
import { RecordMobileCards } from "./master-data-mobile-cards"
import { RecordsExcelActions } from "./records-excel-actions"
import { RecordsPdfActions } from "./records-pdf-actions"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription as ShadDialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type Props = {
    vm: MasterDataManagementVM
}

const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

const EMPTY_FACULTY_LOAD = {
    assignedRecordCount: 0,
    assignedSubjectCount: 0,
    totalUnits: 0,
    totalHours: 0,
} as const

function hasOwn(obj: any, key: string) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key)
}

function isUnknownLabel(v: any) {
    const s = String(v ?? "").trim().toLowerCase()
    return !s || s === "unknown" || s.includes("unknown term") || s.startsWith("unknown •") || s.startsWith("unknown ")
}

/**
 * Accepts:
 * - "08:00", "8:00", "08:00:00"
 * - "8:00 AM", "8 AM", "8:00PM", "12:15 pm"
 */
function parseTimeToMinutes(input: string): number | null {
    const raw = String(input ?? "").trim()
    if (!raw) return null

    const s = raw.toLowerCase().replace(/\s+/g, " ")

    // 12-hour format: "h", "h:mm" with AM/PM (with or without space)
    const twelve = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (twelve) {
        const hh = Number(twelve[1])
        const mm = Number(twelve[2] ?? "0")
        const mer = String(twelve[3]).toLowerCase()

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 1 || hh > 12) return null
        if (mm < 0 || mm > 59) return null

        let hour24 = hh % 12
        if (mer === "pm") hour24 += 12
        return hour24 * 60 + mm
    }

    // 24-hour format: "h:mm" or "hh:mm(:ss)"
    const twentyFour = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (twentyFour) {
        const hh = Number(twentyFour[1])
        const mm = Number(twentyFour[2])

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 0 || hh > 23) return null
        if (mm < 0 || mm > 59) return null

        return hh * 60 + mm
    }

    return null
}

function normalizeTimeInput(input: string): string | null {
    const mins = parseTimeToMinutes(input)
    if (mins == null) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatTimeAmPm(input: any): string {
    const mins = parseTimeToMinutes(String(input ?? "").trim())
    if (mins == null) return "—"
    const h24 = Math.floor(mins / 60)
    const m = mins % 60
    const period = h24 >= 12 ? "PM" : "AM"
    let h12 = h24 % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

function normalizeGroupKey(value: any) {
    return String(value ?? "").trim().toLowerCase()
}

function daySortIndex(day: any) {
    const idx = DAYS.findIndex((d) => d.toLowerCase() === String(day ?? "").trim().toLowerCase())
    return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

function safeTimeSortValue(value: any) {
    const mins = parseTimeToMinutes(String(value ?? "").trim())
    return mins == null ? Number.MAX_SAFE_INTEGER : mins
}

function normalizeLookupValue(value: any) {
    return String(value ?? "").trim()
}

function toFiniteNumber(value: any): number | null {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

function formatLoadNumber(value: number) {
    if (!Number.isFinite(value)) return "0"
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getSubjectHours(subject: any): number | null {
    const totalHours = toFiniteNumber(subject?.totalHours)
    if (totalHours != null) return totalHours

    const lectureHours = toFiniteNumber(subject?.lectureHours) ?? 0
    const labHours = toFiniteNumber(subject?.labHours) ?? 0

    if (lectureHours > 0 || labHours > 0) {
        return lectureHours + labHours
    }

    return null
}

function getRowDurationHours(row: any): number | null {
    const start = parseTimeToMinutes(String(row?.startTime ?? row?.start ?? "").trim())
    const end = parseTimeToMinutes(String(row?.endTime ?? row?.end ?? "").trim())

    if (start == null || end == null || end <= start) return null
    return (end - start) / 60
}

function findSubjectForRow(row: any, subjects: any[]) {
    const subjectId = normalizeLookupValue(
        row?.subjectId ?? row?.subject ?? row?.subjectDocId ?? row?.subjectID ?? ""
    )

    if (subjectId) {
        const byId = subjects.find((subject) => normalizeLookupValue(subject?.$id) === subjectId)
        if (byId) return byId
    }

    const subjectCode = normalizeGroupKey(row?.subjectCode ?? row?.code ?? "")
    if (subjectCode) {
        const byCode = subjects.find((subject) => normalizeGroupKey(subject?.code) === subjectCode)
        if (byCode) return byCode
    }

    return null
}

function buildFacultyAssignedLoad(facultyUserId: string, rows: any[], subjects: any[]) {
    const targetFacultyUserId = normalizeGroupKey(facultyUserId)

    if (!targetFacultyUserId) return EMPTY_FACULTY_LOAD

    let totalUnits = 0
    let totalHours = 0
    let assignedRecordCount = 0
    const subjectKeys = new Set<string>()

    for (const row of rows) {
        const rowFacultyUserId = normalizeGroupKey(
            row?.facultyUserId ?? row?.facultyId ?? row?.faculty ?? row?.userId ?? ""
        )

        if (!rowFacultyUserId || rowFacultyUserId !== targetFacultyUserId) continue

        assignedRecordCount += 1

        const subject = findSubjectForRow(row, subjects)
        const units = toFiniteNumber(subject?.units) ?? toFiniteNumber(row?.units) ?? 0
        const hours = getSubjectHours(subject) ?? getRowDurationHours(row) ?? 0

        totalUnits += units
        totalHours += hours

        const subjectKey = normalizeLookupValue(
            subject?.$id ?? row?.subjectId ?? row?.subjectCode ?? row?.subject ?? ""
        )
        if (subjectKey) {
            subjectKeys.add(subjectKey)
        }
    }

    return {
        assignedRecordCount,
        assignedSubjectCount: subjectKeys.size,
        totalUnits,
        totalHours,
    }
}

export function MasterDataTabs({ vm }: Props) {
    // ===================== RECORD EDIT (LOCAL DIALOG) =====================
    const [recordEditOpen, setRecordEditOpen] = React.useState(false)
    const [recordEditingRow, setRecordEditingRow] = React.useState<any | null>(null)
    const [savingRecord, setSavingRecord] = React.useState(false)

    const [recordTermId, setRecordTermId] = React.useState("")
    const [recordDay, setRecordDay] = React.useState<(typeof DAYS)[number]>("Monday")
    const [recordStartTime, setRecordStartTime] = React.useState("")
    const [recordEndTime, setRecordEndTime] = React.useState("")
    const [recordRoom, setRecordRoom] = React.useState("")
    const [recordFacultyValue, setRecordFacultyValue] = React.useState("") // could be userId or docId (based on stored field)
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

    const TAB_OPTIONS = React.useMemo(
        () => [
            { value: "colleges", label: "Colleges" },
            { value: "programs", label: "Programs/Courses" },
            { value: "subjects", label: "Subjects" },
            { value: "faculty", label: "Faculty" },
            { value: "sections", label: "Sections" },
            { value: "records", label: "List of Records" },
        ],
        []
    )

    const sourceRecordRows = React.useMemo(() => {
        const rawRecordRows = (vm as any).recordRows
        return Array.isArray(rawRecordRows) ? rawRecordRows : vm.filteredRecordRows
    }, [vm, vm.filteredRecordRows])

    const facultyAssignedLoadMap = React.useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildFacultyAssignedLoad>>()

        for (const faculty of vm.filteredFaculty) {
            map.set(
                normalizeGroupKey(faculty.userId),
                buildFacultyAssignedLoad(String(faculty.userId ?? ""), sourceRecordRows, vm.subjects)
            )
        }

        return map
    }, [sourceRecordRows, vm.filteredFaculty, vm.subjects])

    const openEditRecord = React.useCallback(
        (r: any) => {
            setRecordEditingRow(r)

            const termId =
                (r?.termId ?? r?.academicTermId ?? r?.term ?? r?.term_id ?? r?.termID ?? "") as string
            const day =
                (r?.dayOfWeek ?? r?.day ?? r?.dow ?? "Monday") as (typeof DAYS)[number]
            const start = (r?.startTime ?? r?.start ?? "") as string
            const end = (r?.endTime ?? r?.end ?? "") as string
            const room = (r?.roomLabel ?? r?.room ?? r?.roomName ?? "") as string

            // Faculty might be stored as userId OR facultyId depending on your schema.
            const facultyValue =
                (r?.facultyUserId ?? r?.facultyId ?? r?.faculty ?? r?.userId ?? "") as string

            const subjectId =
                (r?.subjectId ?? r?.subject ?? r?.subjectDocId ?? r?.subjectID ?? "") as string

            setRecordTermId(String(termId ?? ""))
            setRecordDay((DAYS as any).includes(day) ? day : "Monday")
            setRecordStartTime(String(start ?? ""))
            setRecordEndTime(String(end ?? ""))
            setRecordRoom(String(room ?? ""))
            setRecordFacultyValue(String(facultyValue ?? ""))
            setRecordSubjectId(String(subjectId ?? ""))

            setRecordEditOpen(true)
        },
        [setRecordEditOpen]
    )

    const resolveTermLabel = React.useCallback(
        (r: any) => {
            const termId =
                (r?.termId ?? r?.academicTermId ?? r?.term ?? r?.term_id ?? r?.termID ?? "") as string

            const computed = termId ? vm.termLabel(vm.terms, termId) : ""
            if (computed && !isUnknownLabel(computed)) return computed

            const fromRow = r?.termLabel ?? r?.term_name ?? r?.termText ?? ""
            if (fromRow && !isUnknownLabel(fromRow)) return String(fromRow)

            return "—"
        },
        [vm]
    )

    const recordSubjectFilterLabel = React.useMemo(() => {
        const v = String((vm as any).recordSubjectFilter ?? "__all__")
        if (!v || v === "__all__") return "All Subjects"
        const s = (vm.subjects ?? []).find((x: any) => String(x.$id) === v)
        if (!s) return "Selected Subject"
        return `${s.code} — ${s.title}`
    }, [vm])

    const recordUnitFilterLabel = React.useMemo(() => {
        const v = String((vm as any).recordUnitFilter ?? "__all__")
        if (!v || v === "__all__") return "All Units"
        const n = Number(v)
        if (!Number.isFinite(n)) return "Selected Units"
        return `${n} unit${n > 1 ? "s" : ""}`
    }, [vm])

    const groupedRecordRows = React.useMemo(() => {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

        const sortedRows = [...vm.filteredRecordRows].sort((a, b) => {
            const facultyCmp = collator.compare(
                String(a?.facultyLabel ?? ""),
                String(b?.facultyLabel ?? "")
            )
            if (facultyCmp !== 0) return facultyCmp

            const termCmp = collator.compare(resolveTermLabel(a), resolveTermLabel(b))
            if (termCmp !== 0) return termCmp

            const dayCmp = daySortIndex(a?.dayOfWeek) - daySortIndex(b?.dayOfWeek)
            if (dayCmp !== 0) return dayCmp

            const startCmp = safeTimeSortValue(a?.startTime) - safeTimeSortValue(b?.startTime)
            if (startCmp !== 0) return startCmp

            return collator.compare(
                String(a?.subjectCode ?? ""),
                String(b?.subjectCode ?? "")
            )
        })

        const groups = new Map<
            string,
            {
                key: string
                facultyLabel: string
                rows: any[]
                conflictCount: number
            }
        >()

        for (const row of sortedRows) {
            const key =
                normalizeGroupKey(row?.facultyUserId) ||
                normalizeGroupKey(row?.facultyLabel) ||
                "tba-faculty"

            const label = String(row?.facultyLabel ?? "").trim() || "TBA Faculty"
            const existing = groups.get(key)

            if (existing) {
                existing.rows.push(row)
                if (vm.conflictRecordIds.has(String(row?.id ?? "").trim())) {
                    existing.conflictCount += 1
                }
            } else {
                groups.set(key, {
                    key,
                    facultyLabel: label,
                    rows: [row],
                    conflictCount: vm.conflictRecordIds.has(String(row?.id ?? "").trim()) ? 1 : 0,
                })
            }
        }

        return Array.from(groups.values())
    }, [vm.filteredRecordRows, vm.conflictRecordIds, resolveTermLabel])

    const saveEditedRecord = React.useCallback(async () => {
        if (!recordEditingRow) return

        if (!recordsCollectionId) {
            toast.error("Records collection is not configured in COLLECTIONS.")
            return
        }

        const docId = String(
            recordEditingRow?.id ??
            recordEditingRow?.$id ??
            recordEditingRow?.recordId ??
            recordEditingRow?.record_id ??
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
            toast.error("Invalid time format. Use 8:00 AM / 1:30 PM or 08:00 / 13:30.")
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

        const payload: any = {}

        // Update only fields that already exist in the source object to avoid schema errors.
        // TERM
        if (hasOwn(recordEditingRow, "termId")) payload.termId = termId
        else if (hasOwn(recordEditingRow, "academicTermId")) payload.academicTermId = termId
        else if (hasOwn(recordEditingRow, "term")) payload.term = termId
        else if (hasOwn(recordEditingRow, "term_id")) payload.term_id = termId
        else if (hasOwn(recordEditingRow, "termID")) payload.termID = termId

        // DAY
        if (hasOwn(recordEditingRow, "dayOfWeek")) payload.dayOfWeek = recordDay
        else if (hasOwn(recordEditingRow, "day")) payload.day = recordDay
        else if (hasOwn(recordEditingRow, "dow")) payload.dow = recordDay

        // TIME (store normalized HH:mm for consistency)
        if (hasOwn(recordEditingRow, "startTime")) payload.startTime = startNorm
        else if (hasOwn(recordEditingRow, "start")) payload.start = startNorm

        if (hasOwn(recordEditingRow, "endTime")) payload.endTime = endNorm
        else if (hasOwn(recordEditingRow, "end")) payload.end = endNorm

        // ROOM
        if (hasOwn(recordEditingRow, "roomLabel")) payload.roomLabel = room
        else if (hasOwn(recordEditingRow, "room")) payload.room = room
        else if (hasOwn(recordEditingRow, "roomName")) payload.roomName = room

        // FACULTY
        if (hasOwn(recordEditingRow, "facultyUserId")) payload.facultyUserId = recordFacultyValue.trim()
        else if (hasOwn(recordEditingRow, "facultyId")) payload.facultyId = recordFacultyValue.trim()
        else if (hasOwn(recordEditingRow, "faculty")) payload.faculty = recordFacultyValue.trim()
        else if (hasOwn(recordEditingRow, "userId")) payload.userId = recordFacultyValue.trim()

        // SUBJECT
        if (hasOwn(recordEditingRow, "subjectId")) payload.subjectId = recordSubjectId.trim()
        else if (hasOwn(recordEditingRow, "subject")) payload.subject = recordSubjectId.trim()
        else if (hasOwn(recordEditingRow, "subjectDocId")) payload.subjectDocId = recordSubjectId.trim()
        else if (hasOwn(recordEditingRow, "subjectID")) payload.subjectID = recordSubjectId.trim()

        // UNITS (optional - if stored)
        if (hasOwn(recordEditingRow, "units")) {
            const subj = vm.subjects.find((s: any) => s.$id === recordSubjectId.trim()) ?? null
            const units = subj?.units
            if (units != null && String(units).trim() !== "") payload.units = units
        }

        if (Object.keys(payload).length === 0) {
            toast.error("No editable fields detected for this record schema.")
            return
        }

        setSavingRecord(true)
        try {
            await databases.updateDocument(DATABASE_ID, recordsCollectionId, docId, payload)
            toast.success("Record updated.")
            setRecordEditOpen(false)
            setRecordEditingRow(null)

            // Refresh everything (safe if exists)
            if (typeof (vm as any).refreshAll === "function") {
                await (vm as any).refreshAll()
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to update record.")
        } finally {
            setSavingRecord(false)
        }
    }, [
        recordEditingRow,
        recordsCollectionId,
        recordTermId,
        recordDay,
        recordStartTime,
        recordEndTime,
        recordRoom,
        recordFacultyValue,
        recordSubjectId,
        vm,
    ])

    return (
        <>
            <Alert>
                <AlertTitle>Master Data</AlertTitle>
                <AlertDescription>
                    These are system-wide datasets used by schedules, workloads, and validations.
                    Update carefully to avoid breaking references.
                </AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {vm.stats.map((s) => (
                    <Card key={s.label}>
                        <CardHeader className="pb-2">
                            <CardDescription>{s.label}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{s.value}</div>
                            <Badge variant="secondary">Total</Badge>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Manage Records</CardTitle>
                            <CardDescription>
                                Add, edit, and maintain Colleges, Programs, Subjects, Faculty, Sections, and List of Records.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Input
                                value={vm.search}
                                onChange={(e) => vm.setSearch(e.target.value)}
                                placeholder="Search code / name..."
                                className="sm:w-80"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    <Tabs value={vm.tab} onValueChange={(v: any) => vm.setTab(v)} className="w-full">
                        {/* ✅ Mobile (xs): dropdown selection */}
                        <div className="sm:hidden">
                            <Select value={vm.tab} onValueChange={(v) => vm.setTab(v as any)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TAB_OPTIONS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* ✅ Tablet/Desktop: tabs */}
                        <TabsList className="hidden w-full grid-cols-2 sm:grid lg:grid-cols-6">
                            <TabsTrigger value="colleges">Colleges</TabsTrigger>
                            <TabsTrigger value="programs">Programs/Courses</TabsTrigger>
                            <TabsTrigger value="subjects">Subjects</TabsTrigger>
                            <TabsTrigger value="faculty">Faculty</TabsTrigger>
                            <TabsTrigger value="sections">Sections</TabsTrigger>
                            <TabsTrigger value="records">List of Records</TabsTrigger>
                        </TabsList>

                        <Separator className="my-4" />

                        {/* ---------------- COLLEGES ---------------- */}
                        <TabsContent value="colleges" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Colleges</div>
                                    <div className="text-sm text-muted-foreground">Add/edit college records.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setCollegeEditing(null)
                                        vm.setCollegeOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add College
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredColleges.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No colleges found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-40 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredColleges.map((d) => (
                                                <TableRow key={d.$id}>
                                                    <TableCell className="font-medium">{d.code}</TableCell>
                                                    <TableCell>{d.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={d.isActive ? "default" : "secondary"}>
                                                            {d.isActive ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setCollegeEditing(d)
                                                                    vm.setCollegeOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "college", doc: d })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- PROGRAMS ---------------- */}
                        <TabsContent value="programs" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Programs / Courses</div>
                                    <div className="text-sm text-muted-foreground">Manage programs handled by colleges.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setProgramEditing(null)
                                        vm.setProgramOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Program
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredPrograms.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No programs found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-32">Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredPrograms.map((p) => (
                                                <TableRow key={p.$id}>
                                                    <TableCell className="font-medium">{p.code}</TableCell>
                                                    <TableCell>{p.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {vm.collegeLabel(vm.colleges, p.departmentId)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={p.isActive ? "default" : "secondary"}>
                                                            {p.isActive ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setProgramEditing(p)
                                                                    vm.setProgramOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "program", doc: p })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- SUBJECTS ---------------- */}
                        <TabsContent value="subjects" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Subjects</div>
                                    <div className="text-sm text-muted-foreground">Manage subject list, units, and hours.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setSubjectEditing(null)
                                        vm.setSubjectOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Subject
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredSubjects.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No subjects found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Code</TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead className="w-44">Units / Hours</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredSubjects.map((s) => (
                                                <TableRow key={s.$id}>
                                                    <TableCell className="font-medium">{s.code}</TableCell>
                                                    <TableCell>{s.title}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {vm.collegeLabel(vm.colleges, s.departmentId ?? null)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs text-muted-foreground">
                                                            Units: <span className="font-medium text-foreground">{s.units}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Lec {s.lectureHours} / Lab {s.labHours} ={" "}
                                                            <span className="font-medium text-foreground">
                                                                {Number.isFinite(Number(s.totalHours))
                                                                    ? s.totalHours
                                                                    : s.lectureHours + s.labHours}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setSubjectEditing(s)
                                                                    vm.setSubjectOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "subject", doc: s })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- FACULTY ---------------- */}
                        <TabsContent value="faculty" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Faculty</div>
                                    <div className="text-sm text-muted-foreground">
                                        Faculty info, rank, and auto-calculated teaching load based on assigned subjects.
                                    </div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setFacultyEditing(null)
                                        vm.setFacultyOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Faculty
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            ) : vm.filteredFaculty.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No faculty found.</div>
                            ) : (
                                <>
                                    <div className="space-y-3 sm:hidden">
                                        {vm.filteredFaculty.map((f) => {
                                            const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                                            const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"
                                            const collegeName = vm.collegeLabel(vm.colleges, f.departmentId)
                                            const load =
                                                facultyAssignedLoadMap.get(normalizeGroupKey(f.userId)) ??
                                                EMPTY_FACULTY_LOAD

                                            return (
                                                <Card key={f.$id}>
                                                    <CardHeader className="space-y-2">
                                                        <CardTitle className="text-base">{facultyName}</CardTitle>
                                                        <CardDescription>{collegeName}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        <div className="grid gap-2 text-sm">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Employee No</span>
                                                                <span className="font-medium">{f.employeeNo || "—"}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Rank</span>
                                                                <span className="font-medium text-right">{f.rank || "—"}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Subjects</span>
                                                                <span className="font-medium">{load.assignedSubjectCount}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Records</span>
                                                                <span className="font-medium">{load.assignedRecordCount}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Units</span>
                                                                <span className="font-medium">
                                                                    {formatLoadNumber(load.totalUnits)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-muted-foreground">Hours</span>
                                                                <span className="font-medium">
                                                                    {formatLoadNumber(load.totalHours)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                                            Teaching load is computed automatically from the faculty member&apos;s assigned subjects and records.
                                                        </div>

                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setFacultyEditing(f)
                                                                    vm.setFacultyOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>

                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "faculty", doc: f })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>

                                    <div className="hidden overflow-hidden rounded-md border sm:block">
                                        <Accordion type="single" collapsible className="w-full">
                                            {vm.filteredFaculty.map((f) => {
                                                const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                                                const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"
                                                const collegeName = vm.collegeLabel(vm.colleges, f.departmentId)
                                                const load =
                                                    facultyAssignedLoadMap.get(normalizeGroupKey(f.userId)) ??
                                                    EMPTY_FACULTY_LOAD

                                                return (
                                                    <AccordionItem key={f.$id} value={f.$id} className="px-4">
                                                        <AccordionTrigger className="hover:no-underline">
                                                            <div className="flex min-w-0 flex-1 flex-col text-left">
                                                                <div className="truncate text-sm font-semibold">
                                                                    {facultyName}
                                                                </div>

                                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                    <span>{collegeName}</span>
                                                                    <span>•</span>
                                                                    <span>{f.employeeNo || "No employee no"}</span>
                                                                    <span>•</span>
                                                                    <span>Subjects: {load.assignedSubjectCount}</span>
                                                                    <span>•</span>
                                                                    <span>Units: {formatLoadNumber(load.totalUnits)}</span>
                                                                    <span>•</span>
                                                                    <span>Hours: {formatLoadNumber(load.totalHours)}</span>
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>

                                                        <AccordionContent>
                                                            <div className="grid gap-4">
                                                                <div className="grid gap-4 lg:grid-cols-2">
                                                                    <div className="rounded-md border p-4">
                                                                        <div className="mb-3 text-sm font-medium">
                                                                            Faculty Details
                                                                        </div>

                                                                        <div className="grid gap-3 text-sm">
                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Faculty
                                                                                </div>
                                                                                <div className="wrap-break-word font-medium">
                                                                                    {facultyName}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    User ID
                                                                                </div>
                                                                                <div className="break-all text-muted-foreground">
                                                                                    {f.userId}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Employee No
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {f.employeeNo || "—"}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    College
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {collegeName}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Rank
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {f.rank || "—"}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Notes
                                                                                </div>
                                                                                <div className="whitespace-pre-wrap wrap-break-word text-muted-foreground">
                                                                                    {f.notes || "—"}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="rounded-md border p-4">
                                                                        <div className="mb-3 text-sm font-medium">
                                                                            Auto-Calculated Teaching Load
                                                                        </div>

                                                                        <div className="grid gap-3 text-sm">
                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Assigned Subjects
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {load.assignedSubjectCount}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Assigned Records
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {load.assignedRecordCount}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Total Units
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {formatLoadNumber(load.totalUnits)}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Total Hours
                                                                                </div>
                                                                                <div className="text-muted-foreground">
                                                                                    {formatLoadNumber(load.totalHours)}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid gap-1">
                                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                                    Source
                                                                                </div>
                                                                                <div className="whitespace-pre-wrap wrap-break-word text-muted-foreground">
                                                                                    Load is derived automatically from the faculty member&apos;s assigned subjects and records, so units and hours no longer need manual encoding in Faculty.
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            vm.setFacultyEditing(f)
                                                                            vm.setFacultyOpen(true)
                                                                        }}
                                                                    >
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        Edit
                                                                    </Button>

                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => vm.setDeleteIntent({ type: "faculty", doc: f })}
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )
                                            })}
                                        </Accordion>
                                    </div>
                                </>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Optional: Encode List of Faculties</CardTitle>
                                    <CardDescription>
                                        Useful when the same faculty roster repeats every semester.
                                        Format per line: userId,employeeNo,rank,maxUnits,maxHours,notes.
                                        Max units and max hours remain legacy optional caps, while the displayed teaching load is automatically computed from assigned subjects.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-medium">Default College</label>
                                            <Select value={vm.facBulkCollegeId} onValueChange={vm.setFacBulkCollegeId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select College" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {vm.colleges.map((d) => (
                                                        <SelectItem key={d.$id} value={d.$id}>
                                                            {d.code} — {d.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Textarea
                                        value={vm.facBulkText}
                                        onChange={(e) => vm.setFacBulkText(e.target.value)}
                                        placeholder={`faculty-user-id-1,2026-001,Instructor I,18,24,Regular load
faculty-user-id-2,2026-002,Assistant Professor,18,24,Thesis adviser`}
                                        className="min-h-40"
                                    />

                                    <div className="flex items-center justify-end">
                                        <Button onClick={() => void vm.saveFacultyBulkList()}>
                                            Encode Faculty List
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ---------------- SECTIONS ---------------- */}
                        <TabsContent value="sections" className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="font-medium">Sections</div>
                                    <div className="text-sm text-muted-foreground">
                                        Manage class sections per term (A–Z + Others), including year level and student count.
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                    <div className="w-full sm:w-80">
                                        <Select value={vm.selectedTermId} onValueChange={vm.setSelectedTermId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Academic Term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vm.terms.length === 0 ? (
                                                    <SelectItem value="__none__" disabled>
                                                        No academic terms found
                                                    </SelectItem>
                                                ) : (
                                                    vm.terms.map((t) => (
                                                        <SelectItem key={t.$id} value={t.$id}>
                                                            {vm.termLabel(vm.terms, t.$id)}{t.isActive ? " • Active" : ""}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            vm.setSectionEditing(null)
                                            vm.setSectionOpen(true)
                                        }}
                                        disabled={vm.terms.length === 0}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Section
                                    </Button>
                                </div>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.terms.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No academic terms found. Create an Academic Term first to manage Sections.
                                </div>
                            ) : vm.filteredSections.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No sections found for this term.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Section</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead>Program (optional)</TableHead>
                                                <TableHead className="w-32">Students</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-40 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredSections
                                                .slice()
                                                .sort((a, b) => {
                                                    const left = `${a.departmentId}-${a.yearLevel}-${a.name}`
                                                    const right = `${b.departmentId}-${b.yearLevel}-${b.name}`
                                                    return left.localeCompare(right)
                                                })
                                                .map((s) => (
                                                    <TableRow key={s.$id}>
                                                        <TableCell className="font-medium">
                                                            {`${String(s.yearLevel ?? "").trim()}${s.name ? ` - ${s.name}` : ""}`.trim() || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.collegeLabel(vm.colleges, s.departmentId)}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.programLabel(vm.programs, s.programId ?? null)}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {s.studentCount != null ? s.studentCount : "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={s.isActive ? "default" : "secondary"}>
                                                                {s.isActive ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        vm.setSectionEditing(s)
                                                                        vm.setSectionOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => vm.setDeleteIntent({ type: "section", doc: s })}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- LIST OF RECORDS ---------------- */}
                        <TabsContent value="records" className="space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <div className="font-medium">List of Records</div>
                                    <div className="text-sm text-muted-foreground">
                                        Conflict detection focuses on room + day/time overlap.
                                        Same subject across different faculty is allowed.
                                    </div>
                                </div>

                                <Alert>
                                    <AlertTitle>Conflict Rule in Use</AlertTitle>
                                    <AlertDescription>
                                        Detected conflict = same term + same room + same day + overlapping time.
                                        Faculty and subject repetition are allowed.
                                    </AlertDescription>
                                </Alert>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Subject</label>
                                        <Select
                                            value={vm.recordSubjectFilter}
                                            onValueChange={vm.setRecordSubjectFilter}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Subjects" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all__">All Subjects</SelectItem>
                                                {vm.subjects.map((s) => (
                                                    <SelectItem key={s.$id} value={s.$id}>
                                                        {s.code} — {s.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Units</label>
                                        <Select
                                            value={vm.recordUnitFilter}
                                            onValueChange={vm.setRecordUnitFilter}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Units" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__all__">All Units</SelectItem>
                                                {vm.recordUnitOptions.map((u) => (
                                                    <SelectItem key={u} value={String(u)}>
                                                        {u} unit{u > 1 ? "s" : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Showing{" "}
                                        <span className="font-medium text-foreground">
                                            {vm.filteredRecordRows.length}
                                        </span>{" "}
                                        record{vm.filteredRecordRows.length === 1 ? "" : "s"} •{" "}
                                        <span className="font-medium text-foreground">{recordSubjectFilterLabel}</span> •{" "}
                                        <span className="font-medium text-foreground">{recordUnitFilterLabel}</span>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        <RecordsExcelActions
                                            rows={vm.filteredRecordRows}
                                            resolveTermLabel={resolveTermLabel}
                                            conflictRecordIds={vm.conflictRecordIds}
                                            subjectFilterLabel={recordSubjectFilterLabel}
                                            unitFilterLabel={recordUnitFilterLabel}
                                            showBatchFacultyExport={false}
                                        />

                                        <RecordsPdfActions
                                            rows={vm.filteredRecordRows}
                                            resolveTermLabel={resolveTermLabel}
                                            conflictRecordIds={vm.conflictRecordIds}
                                            subjectFilterLabel={recordSubjectFilterLabel}
                                            unitFilterLabel={recordUnitFilterLabel}
                                            showBatchFacultyExport={false}
                                        />
                                    </div>
                                </div>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="h-16 w-full" />
                                </div>
                            ) : vm.filteredRecordRows.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No records found using current filters.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Accordion type="single" collapsible className="w-full">
                                        {groupedRecordRows.map((group, index) => (
                                            <AccordionItem
                                                key={`${group.key}-${index}`}
                                                value={`${group.key}-${index}`}
                                                className="px-3 sm:px-4"
                                            >
                                                <AccordionTrigger className="min-w-0 gap-2 py-3 text-left hover:no-underline sm:gap-4">
                                                    <div className="flex min-w-0 flex-1 flex-col pr-2 text-left">
                                                        <div className="wrap-break-word text-sm font-semibold leading-5 sm:truncate">
                                                            {group.facultyLabel}
                                                        </div>

                                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                                                            <span>
                                                                {group.rows.length} record{group.rows.length === 1 ? "" : "s"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                {group.conflictCount} conflict{group.conflictCount === 1 ? "" : "s"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="space-y-4 pb-4">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                                        <RecordsExcelActions
                                                            rows={group.rows}
                                                            resolveTermLabel={resolveTermLabel}
                                                            conflictRecordIds={vm.conflictRecordIds}
                                                            subjectFilterLabel={recordSubjectFilterLabel}
                                                            unitFilterLabel={recordUnitFilterLabel}
                                                            showBatchFacultyExport={false}
                                                        />

                                                        <RecordsPdfActions
                                                            rows={group.rows}
                                                            resolveTermLabel={resolveTermLabel}
                                                            conflictRecordIds={vm.conflictRecordIds}
                                                            subjectFilterLabel={recordSubjectFilterLabel}
                                                            unitFilterLabel={recordUnitFilterLabel}
                                                            showBatchFacultyExport={false}
                                                        />
                                                    </div>

                                                    <div className="sm:hidden">
                                                        <RecordMobileCards
                                                            rows={group.rows}
                                                            resolveTermLabel={resolveTermLabel}
                                                            conflictRecordIds={vm.conflictRecordIds}
                                                            onEdit={openEditRecord}
                                                        />
                                                    </div>

                                                    <div className="hidden rounded-md border sm:block">
                                                        <ScrollArea className="w-full">
                                                            <div className="min-w-max">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="w-48">Term</TableHead>
                                                                            <TableHead className="w-28">Day</TableHead>
                                                                            <TableHead className="w-36">Time</TableHead>
                                                                            <TableHead className="w-48">Room</TableHead>
                                                                            <TableHead className="w-80">Subject</TableHead>
                                                                            <TableHead className="w-20">Units</TableHead>
                                                                            <TableHead className="w-28">Conflict</TableHead>
                                                                            <TableHead className="w-32 text-right">Actions</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {group.rows.map((r) => {
                                                                            const hasConflict = vm.conflictRecordIds.has(r.id)
                                                                            const termText = resolveTermLabel(r)

                                                                            return (
                                                                                <TableRow key={r.id}>
                                                                                    <TableCell className="text-muted-foreground">
                                                                                        {termText}
                                                                                    </TableCell>
                                                                                    <TableCell>{r.dayOfWeek || "—"}</TableCell>
                                                                                    <TableCell>
                                                                                        {formatTimeAmPm(r.startTime)} - {formatTimeAmPm(r.endTime)}
                                                                                    </TableCell>
                                                                                    <TableCell>{r.roomLabel}</TableCell>
                                                                                    <TableCell>
                                                                                        <div className="font-medium">{r.subjectCode}</div>
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            {r.subjectTitle}
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell>{r.units ?? "—"}</TableCell>
                                                                                    <TableCell>
                                                                                        <Badge variant={hasConflict ? "destructive" : "secondary"}>
                                                                                            {hasConflict ? "Conflict" : "Clear"}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right">
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => openEditRecord(r)}
                                                                                        >
                                                                                            <Pencil className="mr-2 h-4 w-4" />
                                                                                            Edit
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            )
                                                                        })}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>

                                                            <ScrollBar orientation="horizontal" />
                                                        </ScrollArea>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* ===================== EDIT RECORD DIALOG ===================== */}
                    <Dialog open={recordEditOpen} onOpenChange={setRecordEditOpen}>
                        <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Edit Record</DialogTitle>
                                <ShadDialogDescription>
                                    Update term/day/time/room/faculty/subject for this record. Changes will reflect in conflict detection after refresh, and units will sync automatically from the selected subject when the record schema stores units.
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
                                                        {vm.termLabel(vm.terms, t.$id)}{t.isActive ? " • Active" : ""}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Day</label>
                                        <Select value={recordDay} onValueChange={(v: any) => setRecordDay(v)}>
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
                                        <Select value={recordFacultyValue} onValueChange={setRecordFacultyValue}>
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
                                                        const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                                                        const label = u ? vm.facultyDisplay(u) : String(f.userId)
                                                        return (
                                                            <SelectItem key={f.$id} value={String(f.userId)}>
                                                                {label}
                                                            </SelectItem>
                                                        )
                                                    })
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground">
                                            Note: This uses Faculty userId as the selection value (common schema).
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Subject</label>
                                        <Select value={recordSubjectId} onValueChange={setRecordSubjectId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vm.subjects.length === 0 ? (
                                                    <SelectItem value="__none__" disabled>
                                                        No subjects found
                                                    </SelectItem>
                                                ) : (
                                                    vm.subjects.map((s: any) => (
                                                        <SelectItem key={s.$id} value={s.$id}>
                                                            {s.code} — {s.title}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground">
                                            Units are taken automatically from the selected subject.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setRecordEditOpen(false)
                                        setRecordEditingRow(null)
                                    }}
                                    disabled={savingRecord}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={() => void saveEditedRecord()} disabled={savingRecord}>
                                    {savingRecord ? "Saving..." : "Save Changes"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
        </>
    )
}