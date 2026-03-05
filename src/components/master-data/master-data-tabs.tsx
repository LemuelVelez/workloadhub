/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"
import { RecordsExcelActions } from "./records-excel-actions"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

function hasOwn(obj: any, key: string) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key)
}

function isUnknownLabel(v: any) {
    const s = String(v ?? "").trim().toLowerCase()
    return !s || s === "unknown" || s.includes("unknown term") || s.startsWith("unknown •") || s.startsWith("unknown ")
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

        const start = recordStartTime.trim()
        const end = recordEndTime.trim()
        if (!start || !end) {
            toast.error("Start time and End time are required.")
            return
        }
        if (start >= end) {
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

        // TIME
        if (hasOwn(recordEditingRow, "startTime")) payload.startTime = start
        else if (hasOwn(recordEditingRow, "start")) payload.start = start

        if (hasOwn(recordEditingRow, "endTime")) payload.endTime = end
        else if (hasOwn(recordEditingRow, "end")) payload.end = end

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
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
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
                                        Faculty info, rank, and max load rules (if applicable).
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
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredFaculty.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No faculty found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Faculty</TableHead>
                                                <TableHead className="w-64">User ID</TableHead>
                                                <TableHead className="w-40">Employee No</TableHead>
                                                <TableHead>College</TableHead>
                                                <TableHead className="w-44">Max Load</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredFaculty.map((f) => {
                                                const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                                                return (
                                                    <TableRow key={f.$id}>
                                                        <TableCell className="font-medium">
                                                            {u ? vm.facultyDisplay(u) : "Unknown faculty"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{f.userId}</TableCell>
                                                        <TableCell className="text-muted-foreground">{f.employeeNo || "—"}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.collegeLabel(vm.colleges, f.departmentId)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-xs text-muted-foreground">
                                                                Units:{" "}
                                                                <span className="font-medium text-foreground">{f.maxUnits ?? "—"}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Hours:{" "}
                                                                <span className="font-medium text-foreground">{f.maxHours ?? "—"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
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
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Optional: Encode List of Faculties</CardTitle>
                                    <CardDescription>
                                        Useful when the same faculty roster repeats every semester.
                                        Format per line: userId,employeeNo,rank,maxUnits,maxHours,notes
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
                                                        <TableCell className="font-medium">{`Y${s.yearLevel} ${s.name}`}</TableCell>
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

                                {/* ✅ Excel Export + Preview actions */}
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

                                    <RecordsExcelActions
                                        rows={vm.filteredRecordRows}
                                        resolveTermLabel={resolveTermLabel}
                                        conflictRecordIds={vm.conflictRecordIds}
                                        subjectFilterLabel={recordSubjectFilterLabel}
                                        unitFilterLabel={recordUnitFilterLabel}
                                    />
                                </div>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredRecordRows.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No records found using current filters.</div>
                            ) : (
                                <div className="rounded-md border">
                                    {/* ✅ Both horizontal + vertical scrollbars (fix overflow) */}
                                    <ScrollArea className="h-[65vh] w-full">
                                        <div className="min-w-max">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-48">Term</TableHead>
                                                        <TableHead className="w-28">Day</TableHead>
                                                        <TableHead className="w-36">Time</TableHead>
                                                        <TableHead className="w-48">Room</TableHead>
                                                        <TableHead className="w-72">Faculty</TableHead>
                                                        <TableHead className="w-80">Subject</TableHead>
                                                        <TableHead className="w-20">Units</TableHead>
                                                        <TableHead className="w-28">Conflict</TableHead>
                                                        <TableHead className="w-32 text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {vm.filteredRecordRows.map((r) => {
                                                        const hasConflict = vm.conflictRecordIds.has(r.id)
                                                        const termText = resolveTermLabel(r)

                                                        return (
                                                            <TableRow key={r.id}>
                                                                <TableCell className="text-muted-foreground">{termText}</TableCell>
                                                                <TableCell>{r.dayOfWeek || "—"}</TableCell>
                                                                <TableCell>
                                                                    {r.startTime} - {r.endTime}
                                                                </TableCell>
                                                                <TableCell>{r.roomLabel}</TableCell>
                                                                <TableCell className="text-muted-foreground">{r.facultyLabel}</TableCell>
                                                                <TableCell>
                                                                    <div className="font-medium">{r.subjectCode}</div>
                                                                    <div className="text-xs text-muted-foreground">{r.subjectTitle}</div>
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
                                        <ScrollBar orientation="vertical" />
                                    </ScrollArea>
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
                                    Update term/day/time/room/faculty/subject for this record. Changes will reflect in conflict detection after refresh.
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
                                            placeholder="08:00"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">End Time</label>
                                        <Input
                                            value={recordEndTime}
                                            onChange={(e) => setRecordEndTime(e.target.value)}
                                            placeholder="09:00"
                                        />
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
                                                        // Use userId as selection value by default (common schema)
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