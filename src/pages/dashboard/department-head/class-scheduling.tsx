/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CalendarDays,
    Plus,
    RefreshCcw,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Filter,
    School,
    Users,
    DoorOpen,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"

import { departmentHeadApi } from "@/api/department-head"

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

type AnyDoc = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

type ScheduleRow = {
    meetingId: string
    classId: string
    versionId: string

    sectionId: string
    subjectId: string
    facultyUserId: string | null

    dayOfWeek: string
    startTime: string
    endTime: string
    roomId: string | null
    meetingType: string

    // joined labels
    sectionName?: string
    subjectLabel?: string
    facultyName?: string
    roomLabel?: string
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function safeNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function resolveDepartmentIdFrom(profile: any, sessionUser: any) {
    const candidates = [
        profile?.departmentId,
        profile?.deptId,
        sessionUser?.departmentId,
        sessionUser?.profile?.departmentId,
        sessionUser?.prefs?.departmentId,
        sessionUser?.prefs?.deptId,
        sessionUser?.prefs?.department,
    ]

    for (const c of candidates) {
        const v = safeStr(c)
        if (v) return v
    }
    return ""
}

function timeToSortable(t: string) {
    // "HH:MM" -> number HHMM for sorting
    const s = safeStr(t)
    const m = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return Number.MAX_SAFE_INTEGER
    const hh = Math.max(0, Math.min(23, Number(m[1])))
    const mm = Math.max(0, Math.min(59, Number(m[2])))
    return hh * 100 + mm
}

function formatTimeRange(start: string, end: string) {
    const a = safeStr(start)
    const b = safeStr(end)
    if (!a && !b) return "-"
    if (a && !b) return a
    if (!a && b) return b
    return `${a} - ${b}`
}

function roleOrName(u: AnyDoc) {
    const name = safeStr(u?.name)
    const email = safeStr(u?.email)
    return name || email || u?.userId || u?.$id
}

/**
 * ✅ Section label shown in table:
 * "Year 1 - A"
 */
function sectionLabel(s: AnyDoc | undefined | null) {
    if (!s) return "—"
    const yl = safeNum(s?.yearLevel, 0)
    const nm = safeStr(s?.name)
    if (yl && nm) return `Year ${yl} - ${nm}`
    return nm || "—"
}

/**
 * ✅ Time Dropdown Options (ShadCN Select)
 * Stored value: "HH:MM" (24-hour)
 * Display label: "hh:mm AM/PM"
 */
function pad2(n: number) {
    return String(n).padStart(2, "0")
}

function timeLabel12h(value: string) {
    const s = safeStr(value)
    const m = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return s

    const hh24 = Number(m[1])
    const mm = m[2]

    const period = hh24 >= 12 ? "PM" : "AM"
    const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12
    return `${pad2(hh12)}:${mm} ${period}`
}

function buildTimeOptions(stepMinutes = 30) {
    const out: { value: string; label: string }[] = []
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += stepMinutes) {
            const value = `${pad2(h)}:${pad2(m)}`
            out.push({ value, label: timeLabel12h(value) })
        }
    }
    return out
}

const TIME_OPTIONS = buildTimeOptions(30)

export default function DepartmentHeadClassSchedulingPage() {
    const { user, loading: sessionLoading } = useSession()

    const userId = React.useMemo(() => {
        return safeStr(user?.$id || user?.id || user?.userId)
    }, [user])

    const [bootLoading, setBootLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [activeTerm, setActiveTerm] = React.useState<AnyDoc | null>(null)
    const [myProfile, setMyProfile] = React.useState<AnyDoc | null>(null)

    const departmentId = React.useMemo(() => resolveDepartmentIdFrom(myProfile, user), [myProfile, user])

    const [versions, setVersions] = React.useState<AnyDoc[]>([])
    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [subjects, setSubjects] = React.useState<AnyDoc[]>([])
    const [sections, setSections] = React.useState<AnyDoc[]>([])
    const [facultyUsers, setFacultyUsers] = React.useState<AnyDoc[]>([])
    const [rooms, setRooms] = React.useState<AnyDoc[]>([])

    const [offerings, setOfferings] = React.useState<AnyDoc[]>([])
    const [meetings, setMeetings] = React.useState<AnyDoc[]>([])

    // Filters
    const [search, setSearch] = React.useState("")
    const [filterSectionId, setFilterSectionId] = React.useState<string>("all")
    const [filterFacultyUserId, setFilterFacultyUserId] = React.useState<string>("all")
    const [filterDay, setFilterDay] = React.useState<string>("all")

    // Dialog / form
    const [open, setOpen] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [editing, setEditing] = React.useState<ScheduleRow | null>(null)

    const [form, setForm] = React.useState({
        classId: "",
        dayOfWeek: "Monday",
        startTime: "08:00",
        endTime: "09:00",
        roomId: "",
        meetingType: "LECTURE",
        notes: "",
    })

    const subjectsById = React.useMemo(() => {
        const map = new Map<string, AnyDoc>()
        subjects.forEach((s) => map.set(s.$id, s))
        return map
    }, [subjects])

    const sectionsById = React.useMemo(() => {
        const map = new Map<string, AnyDoc>()
        sections.forEach((s) => map.set(s.$id, s))
        return map
    }, [sections])

    const sortedSections = React.useMemo(() => {
        const copy = [...sections]
        copy.sort((a, b) => {
            const ya = safeNum(a?.yearLevel, 0)
            const yb = safeNum(b?.yearLevel, 0)
            if (ya !== yb) return ya - yb
            return safeStr(a?.name).localeCompare(safeStr(b?.name))
        })
        return copy
    }, [sections])

    const facultyByUserId = React.useMemo(() => {
        const map = new Map<string, AnyDoc>()
        facultyUsers.forEach((f) => {
            const uid = safeStr(f?.userId)
            const docId = safeStr(f?.$id)
            if (uid) map.set(uid, f)
            if (docId) map.set(docId, f)
        })
        return map
    }, [facultyUsers])

    const roomsById = React.useMemo(() => {
        const map = new Map<string, AnyDoc>()
        rooms.forEach((r) => map.set(r.$id, r))
        return map
    }, [rooms])

    const offeringsById = React.useMemo(() => {
        const map = new Map<string, AnyDoc>()
        offerings.forEach((o) => map.set(o.$id, o))
        return map
    }, [offerings])

    const selectedOffering = React.useMemo(() => {
        const cid = safeStr(form.classId)
        if (!cid) return null
        return offeringsById.get(cid) ?? null
    }, [offeringsById, form.classId])

    const selectedOfferingFacultyName = React.useMemo(() => {
        const uid = safeStr(selectedOffering?.facultyUserId)
        if (!uid) return "Unassigned"
        return roleOrName(facultyByUserId.get(uid) as any)
    }, [selectedOffering, facultyByUserId])

    const offeringSelectOptions = React.useMemo(() => {
        return offerings.map((o) => {
            const sectionId = safeStr(o?.sectionId)
            const subjectId = safeStr(o?.subjectId)

            const sectionDoc = sectionsById.get(sectionId)
            const sectionName = sectionDoc ? sectionLabel(sectionDoc) : (sectionId || "—")

            const subject = subjectsById.get(subjectId)
            const subjectLabel =
                safeStr(subject?.code) && safeStr(subject?.title)
                    ? `${safeStr(subject?.code)} - ${safeStr(subject?.title)}`
                    : safeStr(subject?.title || subject?.code || "—")

            const facultyUserId = safeStr(o?.facultyUserId)
            const facultyName = facultyUserId ? roleOrName(facultyByUserId.get(facultyUserId) as any) : "Unassigned"

            return {
                value: safeStr(o.$id),
                label: `${sectionName} • ${subjectLabel} • ${facultyName}`,
            }
        })
    }, [offerings, sectionsById, subjectsById, facultyByUserId])

    const rows: ScheduleRow[] = React.useMemo(() => {
        const out: ScheduleRow[] = []

        for (const m of meetings) {
            const meetingId = safeStr(m?.$id)
            const classId = safeStr(m?.classId)
            const versionId = safeStr(m?.versionId)

            const offering = offeringsById.get(classId)

            const sectionId = safeStr(offering?.sectionId)
            const subjectId = safeStr(offering?.subjectId)
            const facultyUserId = safeStr(offering?.facultyUserId) || null

            const dayOfWeek = safeStr(m?.dayOfWeek)
            const startTime = safeStr(m?.startTime)
            const endTime = safeStr(m?.endTime)
            const roomId = safeStr(m?.roomId) || null
            const meetingType = safeStr(m?.meetingType || "LECTURE")

            const sectionDoc = sectionsById.get(sectionId)
            const sectionName = sectionDoc ? sectionLabel(sectionDoc) : (sectionId || "—")

            const subject = subjectsById.get(subjectId)
            const subjectLabel =
                safeStr(subject?.code) && safeStr(subject?.title)
                    ? `${safeStr(subject?.code)} - ${safeStr(subject?.title)}`
                    : safeStr(subject?.title || subject?.code)

            const facultyName = facultyUserId ? roleOrName(facultyByUserId.get(facultyUserId) as any) : ""
            const roomDoc = roomId ? roomsById.get(roomId) : null
            const roomLabel = roomDoc ? `${safeStr(roomDoc?.code)}${safeStr(roomDoc?.name) ? ` • ${safeStr(roomDoc?.name)}` : ""}` : ""

            out.push({
                meetingId,
                classId,
                versionId,

                sectionId,
                subjectId,
                facultyUserId,

                dayOfWeek,
                startTime,
                endTime,
                roomId,
                meetingType,

                sectionName,
                subjectLabel,
                facultyName,
                roomLabel,
            })
        }

        out.sort((a, b) => {
            const d = safeStr(a.dayOfWeek).localeCompare(safeStr(b.dayOfWeek))
            if (d !== 0) return d
            return timeToSortable(a.startTime) - timeToSortable(b.startTime)
        })

        return out
    }, [meetings, offeringsById, sectionsById, subjectsById, facultyByUserId, roomsById])

    const filteredRows = React.useMemo(() => {
        const q = safeStr(search).toLowerCase()

        return rows.filter((r) => {
            if (filterSectionId !== "all" && r.sectionId !== filterSectionId) return false
            if (filterFacultyUserId !== "all" && safeStr(r.facultyUserId) !== filterFacultyUserId) return false
            if (filterDay !== "all" && safeStr(r.dayOfWeek) !== filterDay) return false

            if (!q) return true

            const hay = [
                r.sectionName,
                r.subjectLabel,
                r.facultyName,
                r.roomLabel,
                r.dayOfWeek,
                r.startTime,
                r.endTime,
                r.meetingType,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [rows, search, filterSectionId, filterFacultyUserId, filterDay])

    // Pagination (10/page)
    const pageSize = 10
    const [page, setPage] = React.useState(1)

    React.useEffect(() => {
        setPage(1)
    }, [search, filterSectionId, filterFacultyUserId, filterDay, selectedVersionId])

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    const pageRows = React.useMemo(() => {
        const start = (page - 1) * pageSize
        return filteredRows.slice(start, start + pageSize)
    }, [filteredRows, page])

    const scheduledClassIds = React.useMemo(() => new Set(meetings.map((m) => safeStr(m?.classId))), [meetings])
    const unscheduledCount = React.useMemo(() => {
        return offerings.filter((o) => !scheduledClassIds.has(o.$id)).length
    }, [offerings, scheduledClassIds])

    async function loadBase() {
        if (sessionLoading) return
        if (!userId) return

        setBootLoading(true)
        try {
            const [term, profile] = await Promise.all([
                departmentHeadApi.terms.getActive(),
                departmentHeadApi.profiles.getByUserId(userId),
            ])

            setActiveTerm(term)
            setMyProfile(profile)

            const termId = safeStr(term?.$id)
            const deptId = resolveDepartmentIdFrom(profile, user)

            if (!termId || !deptId) {
                setVersions([])
                setSelectedVersionId("")
                setSubjects([])
                setSections([])
                setFacultyUsers([])
                setRooms([])
                return
            }

            const [ver, subj, sec, fac, rms] = await Promise.all([
                departmentHeadApi.scheduleVersions.listByTermDepartment(termId, deptId),
                departmentHeadApi.subjects.listByDepartment(deptId),
                departmentHeadApi.sections.listByTermDepartment(termId, deptId),
                departmentHeadApi.faculty.listByDepartment(deptId),
                departmentHeadApi.rooms.listActive(),
            ])

            setVersions(Array.isArray(ver) ? ver : [])
            setSubjects(Array.isArray(subj) ? subj : [])
            setSections(Array.isArray(sec) ? sec : [])
            setFacultyUsers(Array.isArray((fac as any)?.users) ? (fac as any).users : [])
            setRooms(Array.isArray(rms) ? rms : [])

            // select latest version by default
            const firstVersionId = safeStr((ver as any)?.[0]?.$id)
            setSelectedVersionId((prev) => prev || firstVersionId)
        } catch (err: any) {
            toast.error(err?.message || "Failed to load scheduling data.")
        } finally {
            setBootLoading(false)
        }
    }

    async function loadVersionData(versionId: string) {
        const termId = safeStr(activeTerm?.$id)
        const deptId = safeStr(departmentId)
        const verId = safeStr(versionId)

        if (!termId || !deptId || !verId) {
            setOfferings([])
            setMeetings([])
            return
        }

        try {
            const [cls, mtg] = await Promise.all([
                departmentHeadApi.classes.listByVersion(termId, deptId, verId),
                departmentHeadApi.classMeetings.listByVersion(verId),
            ])

            setOfferings(Array.isArray(cls) ? cls : [])
            setMeetings(Array.isArray(mtg) ? mtg : [])
        } catch (err: any) {
            toast.error(err?.message || "Failed to load schedules.")
        }
    }

    React.useEffect(() => {
        void loadBase()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionLoading, userId])

    React.useEffect(() => {
        if (!selectedVersionId) return
        void loadVersionData(selectedVersionId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVersionId, activeTerm?.$id, departmentId])

    async function onRefresh() {
        setRefreshing(true)
        try {
            await loadBase()
            if (selectedVersionId) {
                await loadVersionData(selectedVersionId)
            }
            toast.success("Refreshed.")
        } catch {
            // handled inside loaders
        } finally {
            setRefreshing(false)
        }
    }

    function resetFormForCreate() {
        setEditing(null)
        setForm({
            classId: "",
            dayOfWeek: "Monday",
            startTime: "08:00",
            endTime: "09:00",
            roomId: "",
            meetingType: "LECTURE",
            notes: "",
        })
    }

    function openCreate() {
        resetFormForCreate()
        setOpen(true)
    }

    function openEdit(r: ScheduleRow) {
        setEditing(r)

        setForm({
            classId: safeStr(r.classId),
            dayOfWeek: r.dayOfWeek || "Monday",
            startTime: r.startTime || "08:00",
            endTime: r.endTime || "09:00",
            roomId: safeStr(r.roomId) || "",
            meetingType: r.meetingType || "LECTURE",
            notes: safeStr(meetings.find((m) => safeStr(m?.$id) === r.meetingId)?.notes),
        })

        setOpen(true)
    }

    async function onSave() {
        const termId = safeStr(activeTerm?.$id)
        const deptId = safeStr(departmentId)
        const versionId = safeStr(selectedVersionId)

        if (!termId || !deptId || !versionId) {
            toast.error("Missing term/department/version context.")
            return
        }

        const classId = safeStr(form.classId)
        const dayOfWeek = safeStr(form.dayOfWeek)
        const startTime = safeStr(form.startTime)
        const endTime = safeStr(form.endTime)
        const roomId = safeStr(form.roomId)
        const meetingType = safeStr(form.meetingType || "LECTURE")

        if (!classId) {
            toast.error("Please select a Class Offering first.")
            return
        }

        if (!dayOfWeek || !DAYS.includes(dayOfWeek as any)) {
            toast.error("Please select a valid day.")
            return
        }
        if (!startTime || !endTime) {
            toast.error("Please set start and end time.")
            return
        }
        if (timeToSortable(startTime) >= timeToSortable(endTime)) {
            toast.error("End time must be after start time.")
            return
        }

        setSaving(true)
        try {
            if (editing?.meetingId) {
                await departmentHeadApi.classMeetings.update(editing.meetingId, {
                    versionId,
                    classId,
                    dayOfWeek,
                    startTime,
                    endTime,
                    roomId: roomId || null,
                    meetingType: meetingType || "LECTURE",
                    notes: safeStr(form.notes) || null,
                })
            } else {
                await departmentHeadApi.classMeetings.create({
                    versionId,
                    classId,
                    dayOfWeek,
                    startTime,
                    endTime,
                    roomId: roomId || null,
                    meetingType: meetingType || "LECTURE",
                    notes: safeStr(form.notes) || null,
                })
            }

            toast.success(editing ? "Schedule updated." : "Schedule created.")
            setOpen(false)
            setEditing(null)

            await loadVersionData(versionId)
        } catch (err: any) {
            toast.error(err?.message || "Failed to save schedule.")
        } finally {
            setSaving(false)
        }
    }

    async function onDelete(r: ScheduleRow) {
        if (!r?.meetingId) return
        try {
            await departmentHeadApi.classMeetings.delete(r.meetingId)
            toast.success("Schedule deleted.")
            await loadVersionData(selectedVersionId)
        } catch (err: any) {
            toast.error(err?.message || "Failed to delete schedule.")
        }
    }

    const currentVersion = React.useMemo(() => {
        return versions.find((v) => safeStr(v.$id) === safeStr(selectedVersionId)) ?? null
    }, [versions, selectedVersionId])

    const noContext = !activeTerm?.$id || !departmentId

    return (
        <DashboardLayout
            title="Class Scheduling"
            subtitle="Create and manage meeting schedules (day/time/room) for existing class offerings (from Faculty Workload Assignment)."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={onRefresh} disabled={refreshing || bootLoading || sessionLoading}>
                        <RefreshCcw className={cn("mr-2 h-4 w-4", (refreshing || bootLoading) && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button
                        onClick={openCreate}
                        disabled={bootLoading || noContext || !selectedVersionId || offerings.length === 0}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        New Schedule
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6">
                {bootLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : (
                    <>
                        {noContext ? (
                            <Alert>
                                <AlertTitle>Missing Setup</AlertTitle>
                                <AlertDescription>
                                    Unable to load scheduling context. Please ensure:
                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                        <li>There is an <b>Active Academic Term</b></li>
                                        <li>Your account has a <b>User Profile</b> with a valid <b>departmentId</b></li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <School className="h-4 w-4" />
                                                Active Term
                                            </CardTitle>
                                            <CardDescription className="truncate">
                                                {safeStr(activeTerm?.schoolYear)} • {safeStr(activeTerm?.semester)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="text-xs text-muted-foreground">
                                                {safeStr(activeTerm?.startDate)} → {safeStr(activeTerm?.endDate)}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4" />
                                                Schedule Version
                                            </CardTitle>
                                            <CardDescription className="truncate">
                                                {safeStr(currentVersion?.label) || "—"}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">{safeStr(currentVersion?.status || "Draft")}</Badge>
                                                <span className="text-xs text-muted-foreground">v{safeStr(currentVersion?.version || "")}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                Scheduled Meetings
                                            </CardTitle>
                                            <CardDescription>Created schedules</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="text-2xl font-semibold">{meetings.length}</div>
                                            <div className="text-xs text-muted-foreground">Total scheduled entries</div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <DoorOpen className="h-4 w-4" />
                                                Unscheduled Offerings
                                            </CardTitle>
                                            <CardDescription>Needs scheduling</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="text-2xl font-semibold">{unscheduledCount}</div>
                                            <div className="text-xs text-muted-foreground">Offerings without meeting</div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {offerings.length === 0 ? (
                                    <Alert>
                                        <AlertTitle>No Class Offerings Found</AlertTitle>
                                        <AlertDescription>
                                            There are no class offerings to schedule yet.
                                            Please assign faculty workload first in <b>Faculty Workload Assignment</b>.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Filters</CardTitle>
                                        <CardDescription>Use these filters to find schedules faster.</CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                            <div className="space-y-2">
                                                <Label>Schedule Version</Label>
                                                <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                                                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                        <SelectValue placeholder="Select version" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {versions.length === 0 ? (
                                                            <SelectItem value="none" disabled>
                                                                No schedule versions
                                                            </SelectItem>
                                                        ) : (
                                                            versions.map((v) => (
                                                                <SelectItem key={v.$id} value={v.$id}>
                                                                    {safeStr(v?.label) || `Version ${safeStr(v?.version) || ""}`}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Section</Label>
                                                <Select value={filterSectionId} onValueChange={setFilterSectionId}>
                                                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                        <SelectValue placeholder="All sections" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All</SelectItem>
                                                        {sortedSections.map((s) => (
                                                            <SelectItem key={s.$id} value={s.$id}>
                                                                {sectionLabel(s)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Faculty</Label>
                                                <Select value={filterFacultyUserId} onValueChange={setFilterFacultyUserId}>
                                                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                        <SelectValue placeholder="All faculty" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All</SelectItem>
                                                        {facultyUsers.map((f) => (
                                                            <SelectItem key={safeStr(f?.userId || f?.$id)} value={safeStr(f?.userId || f?.$id)}>
                                                                {roleOrName(f)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Day</Label>
                                                <Select value={filterDay} onValueChange={setFilterDay}>
                                                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                        <SelectValue placeholder="All days" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All</SelectItem>
                                                        {DAYS.map((d) => (
                                                            <SelectItem key={d} value={d}>
                                                                {d}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div className="relative w-full md:max-w-md">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    placeholder="Search (section, subject, faculty, room, day, time...)"
                                                    className="pl-9"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="gap-2">
                                                    <Filter className="h-3.5 w-3.5" />
                                                    {filteredRows.length} result(s)
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Schedules</CardTitle>
                                        <CardDescription>
                                            Manage your scheduled meetings for the selected schedule version.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="min-w-40">Section</TableHead>
                                                        <TableHead className="min-w-72">Subject</TableHead>
                                                        <TableHead className="min-w-56">Faculty</TableHead>
                                                        <TableHead className="min-w-44">Day</TableHead>
                                                        <TableHead className="min-w-44">Time</TableHead>
                                                        <TableHead className="min-w-56">Room</TableHead>
                                                        <TableHead className="w-12 text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {pageRows.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                                No schedules found.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        pageRows.map((r) => (
                                                            <TableRow key={r.meetingId}>
                                                                <TableCell className="font-medium">
                                                                    {r.sectionName || "—"}
                                                                </TableCell>

                                                                <TableCell>
                                                                    <div className="min-w-0">
                                                                        <div className="truncate">{r.subjectLabel || "—"}</div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            <Badge variant="outline" className="mt-1">
                                                                                {safeStr(r.meetingType || "LECTURE")}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell>
                                                                    {r.facultyName ? (
                                                                        <span className="truncate">{r.facultyName}</span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Unassigned</span>
                                                                    )}
                                                                </TableCell>

                                                                <TableCell>{r.dayOfWeek || "—"}</TableCell>

                                                                <TableCell>
                                                                    <Badge variant="secondary">{formatTimeRange(r.startTime, r.endTime)}</Badge>
                                                                </TableCell>

                                                                <TableCell>
                                                                    {r.roomLabel ? (
                                                                        <span className="truncate">{r.roomLabel}</span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">—</span>
                                                                    )}
                                                                </TableCell>

                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon">
                                                                                <MoreHorizontal className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-44">
                                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => openEdit(r)}>
                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                Edit
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => onDelete(r)}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <div className="text-sm text-muted-foreground">
                                                Page <b>{page}</b> of <b>{pageCount}</b>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    disabled={page <= 1}
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    disabled={page >= pageCount}
                                                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* ✅ Create/Edit Dialog */}
                                <Dialog open={open} onOpenChange={setOpen}>
                                    <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>{editing ? "Edit Schedule" : "New Schedule"}</DialogTitle>
                                            <DialogDescription>
                                                Scheduling only manages <b>meeting time/day/room</b>.
                                                Section + Subject assignments are handled in <b>Faculty Workload Assignment</b>.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <ScrollArea className="max-h-[70vh] pr-3">
                                            <div className="space-y-5">
                                                <div className="space-y-2 min-w-0">
                                                    <Label>Class Offering (from Workload Assignment)</Label>
                                                    <Select
                                                        value={form.classId}
                                                        onValueChange={(v) => setForm((s) => ({ ...s, classId: v }))}
                                                        disabled={saving || Boolean(editing)}
                                                    >
                                                        <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                            <SelectValue placeholder="Select a class offering" />
                                                        </SelectTrigger>

                                                        <SelectContent
                                                            className="max-h-96 max-w-full"
                                                            style={{ width: "var(--radix-select-trigger-width)" }}
                                                        >
                                                            {offeringSelectOptions.length === 0 ? (
                                                                <SelectItem value="none" disabled>
                                                                    No offerings available
                                                                </SelectItem>
                                                            ) : (
                                                                offeringSelectOptions.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value} className="max-w-full">
                                                                        <span className="block max-w-full truncate">{opt.label}</span>
                                                                    </SelectItem>
                                                                ))
                                                            )}
                                                        </SelectContent>
                                                    </Select>

                                                    {editing ? (
                                                        <div className="text-xs text-muted-foreground">
                                                            Offering cannot be changed while editing. Delete & create a new schedule if needed.
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="space-y-2 min-w-0">
                                                    <Label>Faculty (auto from offering)</Label>
                                                    <Input value={selectedOfferingFacultyName} disabled />
                                                    {!selectedOffering ? (
                                                        <div className="text-xs text-muted-foreground">
                                                            ⚠ Select a class offering first.
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <Separator />

                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    <div className="space-y-2 min-w-0">
                                                        <Label>Meeting Type</Label>
                                                        <Select
                                                            value={form.meetingType}
                                                            onValueChange={(v) => setForm((s) => ({ ...s, meetingType: v }))}
                                                        >
                                                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="LECTURE">LECTURE</SelectItem>
                                                                <SelectItem value="LAB">LAB</SelectItem>
                                                                <SelectItem value="OTHER">OTHER</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2 min-w-0">
                                                        <Label>Day</Label>
                                                        <Select
                                                            value={form.dayOfWeek}
                                                            onValueChange={(v) => setForm((s) => ({ ...s, dayOfWeek: v }))}
                                                        >
                                                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                                <SelectValue placeholder="Select day" />
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

                                                    <div className="space-y-2 min-w-0">
                                                        <Label>Room</Label>
                                                        <Select
                                                            value={form.roomId}
                                                            onValueChange={(v) => setForm((s) => ({ ...s, roomId: v }))}
                                                        >
                                                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                                <SelectValue placeholder="Select room" />
                                                            </SelectTrigger>

                                                            <SelectContent
                                                                className="max-w-full"
                                                                style={{ width: "var(--radix-select-trigger-width)" }}
                                                            >
                                                                {rooms.map((r) => (
                                                                    <SelectItem key={r.$id} value={r.$id} className="max-w-full">
                                                                        <span className="block max-w-full truncate">
                                                                            {safeStr(r?.code)}{safeStr(r?.name) ? ` • ${safeStr(r?.name)}` : ""}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2 min-w-0">
                                                        <Label>Start Time</Label>
                                                        <Select
                                                            value={form.startTime}
                                                            onValueChange={(v) => setForm((s) => ({ ...s, startTime: v }))}
                                                        >
                                                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                                <SelectValue placeholder="Select start time" />
                                                            </SelectTrigger>

                                                            <SelectContent
                                                                className="max-h-80 max-w-full"
                                                                style={{ width: "var(--radix-select-trigger-width)" }}
                                                            >
                                                                {TIME_OPTIONS.map((t) => (
                                                                    <SelectItem key={t.value} value={t.value}>
                                                                        {t.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2 min-w-0">
                                                        <Label>End Time</Label>
                                                        <Select
                                                            value={form.endTime}
                                                            onValueChange={(v) => setForm((s) => ({ ...s, endTime: v }))}
                                                        >
                                                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                                                                <SelectValue placeholder="Select end time" />
                                                            </SelectTrigger>

                                                            <SelectContent
                                                                className="max-h-80 max-w-full"
                                                                style={{ width: "var(--radix-select-trigger-width)" }}
                                                            >
                                                                {TIME_OPTIONS.map((t) => (
                                                                    <SelectItem key={t.value} value={t.value}>
                                                                        {t.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <Separator />

                                                <div className="space-y-2 min-w-0">
                                                    <Label>Meeting Notes (Optional)</Label>
                                                    <Input
                                                        value={form.notes}
                                                        onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                                                        placeholder="Any notes for this meeting"
                                                    />
                                                </div>
                                            </div>
                                        </ScrollArea>

                                        <DialogFooter className="gap-2">
                                            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                                                Cancel
                                            </Button>
                                            <Button onClick={onSave} disabled={saving}>
                                                {saving ? "Saving..." : editing ? "Save Changes" : "Create Schedule"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
