/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
    AlertTriangle,
    RefreshCw,
    Search,
    Users,
    DoorOpen,
    Layers,
    Eye,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

type ConflictKind = "Faculty" | "Room" | "Section"
type FilterKind = "all" | "faculty" | "room" | "section"

type AnyDoc = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

type ScheduleEntry = {
    meetingId: string
    classId: string

    dayOfWeek: string
    startTime: string
    endTime: string
    startMin: number
    endMin: number

    meetingType?: string | null
    roomId?: string | null

    subjectId?: string | null
    sectionId?: string | null
    facultyUserId?: string | null

    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null
}

type ConflictRecord = {
    id: string
    kind: ConflictKind
    resourceId: string
    resourceLabel: string

    dayOfWeek: string
    windowStartMin: number
    windowEndMin: number

    entries: ScheduleEntry[]
}

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function normalizeDay(v: any) {
    const s = safeStr(v).toLowerCase()
    if (!s) return "unknown"

    if (s.startsWith("mon")) return "monday"
    if (s.startsWith("tue")) return "tuesday"
    if (s.startsWith("wed")) return "wednesday"
    if (s.startsWith("thu")) return "thursday"
    if (s.startsWith("fri")) return "friday"
    if (s.startsWith("sat")) return "saturday"
    if (s.startsWith("sun")) return "sunday"

    if (s === "monday") return "monday"
    if (s === "tuesday") return "tuesday"
    if (s === "wednesday") return "wednesday"
    if (s === "thursday") return "thursday"
    if (s === "friday") return "friday"
    if (s === "saturday") return "saturday"
    if (s === "sunday") return "sunday"

    return s
}

function dayOrderKey(day: string) {
    const d = normalizeDay(day)
    const order: Record<string, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 7,
        unknown: 99,
    }
    return order[d] ?? 50
}

function prettyDay(day: string) {
    const d = normalizeDay(day)
    if (!d || d === "unknown") return "Unknown"
    return d.slice(0, 1).toUpperCase() + d.slice(1)
}

function timeToMin(t: any) {
    const s = safeStr(t)
    if (!s) return NaN

    const m = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return NaN

    const hh = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN
    if (hh < 0 || hh > 23) return NaN
    if (mm < 0 || mm > 59) return NaN
    return hh * 60 + mm
}

function minToTime(mins: number) {
    if (!Number.isFinite(mins) || mins < 0) return "—"
    const hh = Math.floor(mins / 60)
    const mm = mins % 60
    const hh2 = String(hh).padStart(2, "0")
    const mm2 = String(mm).padStart(2, "0")
    return `${hh2}:${mm2}`
}

function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr))
}

export default function ConflictCheckerPage() {
    const navigate = useNavigate()
    const { user } = useSession()

    const userId = React.useMemo(() => {
        const id = safeStr(user?.$id || user?.id || user?.userId)
        return id
    }, [user])

    const [bootLoading, setBootLoading] = React.useState(true)
    const [runLoading, setRunLoading] = React.useState(false)

    const [activeTerm, setActiveTerm] = React.useState<AnyDoc | null>(null)
    const [profile, setProfile] = React.useState<AnyDoc | null>(null)

    const [versions, setVersions] = React.useState<AnyDoc[]>([])
    const [versionId, setVersionId] = React.useState<string>("")

    const [filterKind, setFilterKind] = React.useState<FilterKind>("all")
    const [search, setSearch] = React.useState("")

    const [conflicts, setConflicts] = React.useState<ConflictRecord[]>([])
    const [lastRunAt, setLastRunAt] = React.useState<string | null>(null)

    const [facultyNameById, setFacultyNameById] = React.useState<Record<string, string>>({})
    const [roomLabelById, setRoomLabelById] = React.useState<Record<string, string>>({})
    const [sectionLabelById, setSectionLabelById] = React.useState<Record<string, string>>({})
    const [subjectLabelById, setSubjectLabelById] = React.useState<Record<string, string>>({})

    const [open, setOpen] = React.useState(false)
    const [activeConflict, setActiveConflict] = React.useState<ConflictRecord | null>(null)

    const departmentId = safeStr(profile?.departmentId)

    async function boot() {
        if (!userId) return

        setBootLoading(true)
        try {
            const [term, prof] = await Promise.all([
                departmentHeadApi.terms.getActive(),
                departmentHeadApi.profiles.getByUserId(userId),
            ])

            setActiveTerm(term)
            setProfile(prof)

            const termId = safeStr(term?.$id)
            const deptId = safeStr(prof?.departmentId)

            if (!termId || !deptId) {
                setVersions([])
                setVersionId("")
                return
            }

            const vers = await departmentHeadApi.scheduleVersions.listByTermDepartment(termId, deptId)
            setVersions(Array.isArray(vers) ? vers : [])

            const defaultVersionId = safeStr(vers?.[0]?.$id)
            setVersionId(defaultVersionId)
        } catch (e: any) {
            toast.error(e?.message || "Failed to load conflict checker.")
        } finally {
            setBootLoading(false)
        }
    }

    React.useEffect(() => {
        if (!userId) {
            setBootLoading(false)
            return
        }
        void boot()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    async function loadLookups(termId: string, deptId: string) {
        try {
            const [facultyRes, rooms, sections, subjects] = await Promise.all([
                departmentHeadApi.faculty.listByDepartment(deptId),
                departmentHeadApi.rooms.listActive(),
                departmentHeadApi.sections.listByTermDepartment(termId, deptId),
                departmentHeadApi.subjects.listByDepartment(deptId),
            ])

            const facultyMap: Record<string, string> = {}
            const facultyUsers = Array.isArray(facultyRes?.users) ? facultyRes.users : []
            facultyUsers.forEach((u: any) => {
                const id = safeStr(u?.userId || u?.$id || u?.id)
                const name = safeStr(u?.name || u?.email || id)
                if (id) facultyMap[id] = name
            })
            setFacultyNameById(facultyMap)

            const roomMap: Record<string, string> = {}
            const roomsArr = Array.isArray(rooms) ? rooms : []
            roomsArr.forEach((r: any) => {
                const id = safeStr(r?.$id)
                const code = safeStr(r?.code)
                const name = safeStr(r?.name)
                roomMap[id] = name ? `${code} • ${name}` : (code || id)
            })
            setRoomLabelById(roomMap)

            const secMap: Record<string, string> = {}
            const sectionsArr = Array.isArray(sections) ? sections : []
            sectionsArr.forEach((s: any) => {
                const id = safeStr(s?.$id)
                const yr = s?.yearLevel
                const nm = safeStr(s?.name)
                if (id) {
                    const yLabel = Number.isFinite(Number(yr)) ? `Y${Number(yr)}` : "Y?"
                    secMap[id] = `${yLabel} • ${nm || id}`
                }
            })
            setSectionLabelById(secMap)

            const subjMap: Record<string, string> = {}
            const subjectsArr = Array.isArray(subjects) ? subjects : []
            subjectsArr.forEach((sub: any) => {
                const id = safeStr(sub?.$id)
                const code = safeStr(sub?.code)
                const title = safeStr(sub?.title)
                subjMap[id] = title ? `${code} • ${title}` : (code || id)
            })
            setSubjectLabelById(subjMap)
        } catch (e: any) {
            console.warn("lookup load failed:", e?.message)
        }
    }

    function resourceLabel(kind: ConflictKind, resourceId: string) {
        if (!resourceId) return "—"
        if (kind === "Faculty") return facultyNameById[resourceId] ?? resourceId
        if (kind === "Room") return roomLabelById[resourceId] ?? resourceId
        if (kind === "Section") return sectionLabelById[resourceId] ?? resourceId
        return resourceId
    }

    function classRowLabel(entry: ScheduleEntry) {
        const subj = entry.subjectId ? subjectLabelById[entry.subjectId] : ""
        const sec = entry.sectionId ? sectionLabelById[entry.sectionId] : ""
        const fac = entry.facultyUserId ? facultyNameById[entry.facultyUserId] : ""
        const room = entry.roomId ? roomLabelById[entry.roomId] : ""

        const parts: string[] = []
        if (entry.classCode) parts.push(entry.classCode)
        if (subj) parts.push(subj)
        if (sec) parts.push(sec)

        const meta: string[] = []
        if (fac) meta.push(fac)
        if (room) meta.push(room)

        return {
            main: parts.filter(Boolean).join(" • ") || entry.classId,
            meta: meta.filter(Boolean).join(" • "),
        }
    }

    function computeConflicts(kind: ConflictKind, entries: ScheduleEntry[]): ConflictRecord[] {
        const groups = new Map<string, ScheduleEntry[]>()

        for (const e of entries) {
            let resourceId = ""

            if (kind === "Faculty") resourceId = safeStr(e.facultyUserId)
            if (kind === "Room") resourceId = safeStr(e.roomId)
            if (kind === "Section") resourceId = safeStr(e.sectionId)

            if (!resourceId) continue

            const day = normalizeDay(e.dayOfWeek)
            const key = `${resourceId}__${day}`

            const list = groups.get(key) ?? []
            list.push(e)
            groups.set(key, list)
        }

        const out: ConflictRecord[] = []

        groups.forEach((list, key) => {
            const [resourceId, day] = key.split("__")

            const sorted = [...list].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

            let cluster: ScheduleEntry[] = []
            let maxEnd = -1

            const flush = () => {
                if (cluster.length > 1) {
                    const windowStartMin = Math.min(...cluster.map((x) => x.startMin))
                    const windowEndMin = Math.max(...cluster.map((x) => x.endMin))

                    out.push({
                        id: `${kind}:${resourceId}:${day}:${windowStartMin}:${windowEndMin}:${cluster
                            .map((x) => x.meetingId)
                            .join(",")}`,
                        kind,
                        resourceId,
                        resourceLabel: resourceLabel(kind, resourceId),
                        dayOfWeek: day,
                        windowStartMin,
                        windowEndMin,
                        entries: [...cluster].sort((a, b) => a.startMin - b.startMin),
                    })
                }
                cluster = []
                maxEnd = -1
            }

            for (const e of sorted) {
                if (cluster.length === 0) {
                    cluster = [e]
                    maxEnd = e.endMin
                    continue
                }

                if (e.startMin < maxEnd) {
                    cluster.push(e)
                    maxEnd = Math.max(maxEnd, e.endMin)
                } else {
                    flush()
                    cluster = [e]
                    maxEnd = e.endMin
                }
            }

            flush()
        })

        out.sort((a, b) => {
            const sevA = a.entries.length
            const sevB = b.entries.length
            if (sevA !== sevB) return sevB - sevA

            const dayA = dayOrderKey(a.dayOfWeek)
            const dayB = dayOrderKey(b.dayOfWeek)
            if (dayA !== dayB) return dayA - dayB

            if (a.windowStartMin !== b.windowStartMin) return a.windowStartMin - b.windowStartMin
            return a.resourceLabel.localeCompare(b.resourceLabel)
        })

        return out
    }

    async function runCheck() {
        const termId = safeStr(activeTerm?.$id)
        const deptId = safeStr(profile?.departmentId)
        const verId = safeStr(versionId)

        if (!termId) {
            toast.error("No active Academic Term found.")
            return
        }
        if (!deptId) {
            toast.error("No department assigned to your profile.")
            return
        }
        if (!verId) {
            toast.error("Select a schedule version first.")
            return
        }

        setRunLoading(true)

        try {
            await loadLookups(termId, deptId)

            const [classes, meetings] = await Promise.all([
                departmentHeadApi.classes.listByVersion(termId, deptId, verId),
                departmentHeadApi.classMeetings.listByVersion(verId),
            ])

            const classArr = Array.isArray(classes) ? classes : []
            const meetingArr = Array.isArray(meetings) ? meetings : []

            const classById = new Map<string, AnyDoc>()
            classArr.forEach((c: AnyDoc) => {
                const id = safeStr(c?.$id)
                if (id) classById.set(id, c)
            })

            const entries: ScheduleEntry[] = []

            for (const m of meetingArr) {
                const meetingId = safeStr(m?.$id)
                const classId = safeStr(m?.classId)
                if (!meetingId || !classId) continue

                const cls = classById.get(classId)
                if (!cls) continue

                const dayOfWeek = safeStr(m?.dayOfWeek)
                const startTime = safeStr(m?.startTime)
                const endTime = safeStr(m?.endTime)

                const startMin = timeToMin(startTime)
                const endMin = timeToMin(endTime)

                if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue
                if (endMin <= startMin) continue

                entries.push({
                    meetingId,
                    classId,
                    dayOfWeek,
                    startTime,
                    endTime,
                    startMin,
                    endMin,

                    meetingType: m?.meetingType ?? null,
                    roomId: m?.roomId ?? null,

                    subjectId: cls?.subjectId ?? null,
                    sectionId: cls?.sectionId ?? null,
                    facultyUserId: cls?.facultyUserId ?? null,

                    classCode: cls?.classCode ?? null,
                    deliveryMode: cls?.deliveryMode ?? null,
                    status: cls?.status ?? null,
                })
            }

            const facultyConflicts = computeConflicts("Faculty", entries)
            const roomConflicts = computeConflicts("Room", entries)
            const sectionConflicts = computeConflicts("Section", entries)

            const all = [...facultyConflicts, ...roomConflicts, ...sectionConflicts]

            setConflicts(all)
            setLastRunAt(new Date().toISOString())

            if (all.length === 0) {
                toast.success("No conflicts detected ✅")
            } else {
                toast.warning(`Found ${all.length} potential conflicts.`)
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to run conflict checker.")
        } finally {
            setRunLoading(false)
        }
    }

    React.useEffect(() => {
        if (bootLoading) return
        if (!versionId) return
        void runCheck()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versionId, bootLoading])

    const facultyCount = React.useMemo(
        () => conflicts.filter((c) => c.kind === "Faculty").length,
        [conflicts]
    )
    const roomCount = React.useMemo(
        () => conflicts.filter((c) => c.kind === "Room").length,
        [conflicts]
    )
    const sectionCount = React.useMemo(
        () => conflicts.filter((c) => c.kind === "Section").length,
        [conflicts]
    )

    const filteredConflicts = React.useMemo(() => {
        const s = search.trim().toLowerCase()

        let base = conflicts

        if (filterKind !== "all") {
            const map: Record<Exclude<FilterKind, "all">, ConflictKind> = {
                faculty: "Faculty",
                room: "Room",
                section: "Section",
            }
            base = base.filter((c) => c.kind === map[filterKind])
        }

        if (!s) return base

        return base.filter((c) => {
            const hay = [
                c.kind,
                c.resourceLabel,
                c.dayOfWeek,
                minToTime(c.windowStartMin),
                minToTime(c.windowEndMin),
                ...c.entries.map((e) => e.classCode || ""),
                ...c.entries.map((e) => (e.subjectId ? subjectLabelById[e.subjectId] : "")),
                ...c.entries.map((e) => (e.sectionId ? sectionLabelById[e.sectionId] : "")),
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(s)
        })
    }, [conflicts, filterKind, search, subjectLabelById, sectionLabelById])

    const activeVersionLabel = React.useMemo(() => {
        const v = versions.find((x) => safeStr(x?.$id) === safeStr(versionId))
        const num = v?.version
        const label = safeStr(v?.label)
        if (label) return label
        if (Number.isFinite(Number(num))) return `Version ${Number(num)}`
        return safeStr(v?.$id) ? `Version (${safeStr(v?.$id).slice(0, 6)}...)` : "—"
    }, [versions, versionId])

    const headerActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="secondary"
                onClick={() => navigate("/dashboard/department-head/class-scheduling")}
            >
                Open Class Scheduling
            </Button>

            <Button onClick={runCheck} disabled={bootLoading || runLoading}>
                {runLoading ? (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                    </>
                ) : (
                    <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </>
                )}
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Conflict Checker"
            subtitle="Detect overlaps across faculty, rooms, and sections."
            actions={headerActions}
        >
            <div className="p-6 space-y-6">
                {bootLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-72" />
                        <div className="grid gap-4 md:grid-cols-3">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : (
                    <>
                        {!activeTerm ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>No Active Academic Term</AlertTitle>
                                <AlertDescription>
                                    Please set an active term first in Admin → Academic Term Setup.
                                </AlertDescription>
                            </Alert>
                        ) : !departmentId ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Missing Department</AlertTitle>
                                <AlertDescription>
                                    Your profile has no departmentId assigned. Please update your user profile.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                Faculty Conflicts
                                            </CardTitle>
                                            <CardDescription>Same faculty overlapping time.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between">
                                                <div className="text-3xl font-semibold">{facultyCount}</div>
                                                <Badge variant={facultyCount > 0 ? "destructive" : "secondary"}>
                                                    {facultyCount > 0 ? "Needs Review" : "OK"}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2">
                                                <DoorOpen className="h-4 w-4" />
                                                Room Conflicts
                                            </CardTitle>
                                            <CardDescription>Same room booked at the same time.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between">
                                                <div className="text-3xl font-semibold">{roomCount}</div>
                                                <Badge variant={roomCount > 0 ? "destructive" : "secondary"}>
                                                    {roomCount > 0 ? "Needs Review" : "OK"}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2">
                                                <Layers className="h-4 w-4" />
                                                Section Conflicts
                                            </CardTitle>
                                            <CardDescription>Same section scheduled with overlap.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between">
                                                <div className="text-3xl font-semibold">{sectionCount}</div>
                                                <Badge variant={sectionCount > 0 ? "destructive" : "secondary"}>
                                                    {sectionCount > 0 ? "Needs Review" : "OK"}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Filters</CardTitle>
                                        <CardDescription>
                                            Active Term:{" "}
                                            <span className="font-medium">
                                                {safeStr(activeTerm?.schoolYear)} • {safeStr(activeTerm?.semester)}
                                            </span>
                                            {"  "}•{"  "}
                                            Selected Version:{" "}
                                            <span className="font-medium">{activeVersionLabel}</span>
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label>Schedule Version</Label>
                                                <Select
                                                    value={versionId || ""}
                                                    onValueChange={(v) => setVersionId(v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select version..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {versions.length === 0 ? (
                                                            <SelectItem value="__none" disabled>
                                                                No versions found
                                                            </SelectItem>
                                                        ) : (
                                                            versions.map((v) => {
                                                                const id = safeStr(v?.$id)
                                                                const verNo = v?.version
                                                                const label = safeStr(v?.label)
                                                                const title = label
                                                                    ? label
                                                                    : Number.isFinite(Number(verNo))
                                                                        ? `Version ${Number(verNo)}`
                                                                        : `Version (${id.slice(0, 6)}...)`

                                                                return (
                                                                    <SelectItem key={id} value={id}>
                                                                        {title}
                                                                    </SelectItem>
                                                                )
                                                            })
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Conflict Type</Label>
                                                <Select
                                                    value={filterKind}
                                                    onValueChange={(v) => setFilterKind(v as FilterKind)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="All types" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All</SelectItem>
                                                        <SelectItem value="faculty">Faculty</SelectItem>
                                                        <SelectItem value="room">Room</SelectItem>
                                                        <SelectItem value="section">Section</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Search</Label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        value={search}
                                                        onChange={(e) => setSearch(e.target.value)}
                                                        placeholder="Faculty / Room / Section / Subject..."
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-sm text-muted-foreground">
                                                {lastRunAt ? (
                                                    <>
                                                        Last run:{" "}
                                                        <span className="font-medium">
                                                            {new Date(lastRunAt).toLocaleString()}
                                                        </span>
                                                    </>
                                                ) : (
                                                    "Not yet checked."
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">
                                                    Results: {filteredConflicts.length}
                                                </Badge>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSearch("")
                                                        setFilterKind("all")
                                                    }}
                                                >
                                                    Reset
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Detected Conflicts</CardTitle>
                                        <CardDescription>
                                            These are potential overlaps. Please review and adjust schedules if needed.
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        {runLoading ? (
                                            <div className="space-y-3">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                            </div>
                                        ) : filteredConflicts.length === 0 ? (
                                            <Alert>
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>No conflicts found</AlertTitle>
                                                <AlertDescription>
                                                    Your current schedule version looks clean ✅
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <div className="w-full overflow-x-auto">
                                                <Table className="min-w-225">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Type</TableHead>
                                                            <TableHead>Resource</TableHead>
                                                            <TableHead>Day</TableHead>
                                                            <TableHead>Time Window</TableHead>
                                                            <TableHead className="text-right">Overlaps</TableHead>
                                                            <TableHead>Affected Classes</TableHead>
                                                            <TableHead className="text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
                                                        {filteredConflicts.map((c) => {
                                                            const classCodes = uniq(
                                                                c.entries
                                                                    .map((e) => e.classCode || "")
                                                                    .filter(Boolean)
                                                            )

                                                            const affectedCount = c.entries.length

                                                            return (
                                                                <TableRow key={c.id}>
                                                                    <TableCell>
                                                                        <Badge
                                                                            variant="destructive"
                                                                            className="whitespace-nowrap"
                                                                        >
                                                                            {c.kind}
                                                                        </Badge>
                                                                    </TableCell>

                                                                    <TableCell className="font-medium">
                                                                        {c.resourceLabel}
                                                                    </TableCell>

                                                                    <TableCell className="whitespace-nowrap">
                                                                        {prettyDay(c.dayOfWeek)}
                                                                    </TableCell>

                                                                    <TableCell className="whitespace-nowrap">
                                                                        {minToTime(c.windowStartMin)} -{" "}
                                                                        {minToTime(c.windowEndMin)}
                                                                    </TableCell>

                                                                    <TableCell className="text-right">
                                                                        <Badge variant="secondary">
                                                                            {affectedCount}
                                                                        </Badge>
                                                                    </TableCell>

                                                                    <TableCell className="max-w-105">
                                                                        <div className="space-y-1">
                                                                            {classCodes.length > 0 ? (
                                                                                classCodes.slice(0, 3).map((cc) => (
                                                                                    <div
                                                                                        key={cc}
                                                                                        className="truncate text-sm"
                                                                                    >
                                                                                        {cc}
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <div className="truncate text-sm">
                                                                                    {uniq(
                                                                                        c.entries.map((e) => e.classId)
                                                                                    )
                                                                                        .slice(0, 3)
                                                                                        .join(", ")}
                                                                                </div>
                                                                            )}

                                                                            {classCodes.length > 3 ? (
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    +{classCodes.length - 3} more
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </TableCell>

                                                                    <TableCell className="text-right">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={() => {
                                                                                setActiveConflict(c)
                                                                                setOpen(true)
                                                                            }}
                                                                        >
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            View
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Dialog open={open} onOpenChange={setOpen}>
                                    <DialogContent className="max-w-3xl">
                                        <DialogHeader>
                                            <DialogTitle>
                                                {activeConflict?.kind ?? "Conflict"} Details
                                            </DialogTitle>
                                            <DialogDescription>
                                                {activeConflict ? (
                                                    <>
                                                        <span className="font-medium">
                                                            {activeConflict.resourceLabel}
                                                        </span>{" "}
                                                        • {prettyDay(activeConflict.dayOfWeek)} •{" "}
                                                        {minToTime(activeConflict.windowStartMin)} -{" "}
                                                        {minToTime(activeConflict.windowEndMin)}
                                                    </>
                                                ) : (
                                                    "—"
                                                )}
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="space-y-3">
                                            <div className="rounded-lg border p-3">
                                                <div className="text-sm text-muted-foreground">
                                                    Affected schedules
                                                </div>

                                                <div className="mt-3 w-full overflow-x-auto">
                                                    <Table className="min-w-225">
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Class</TableHead>
                                                                <TableHead>Day</TableHead>
                                                                <TableHead>Time</TableHead>
                                                                <TableHead>Meeting</TableHead>
                                                                <TableHead>Faculty</TableHead>
                                                                <TableHead>Room</TableHead>
                                                            </TableRow>
                                                        </TableHeader>

                                                        <TableBody>
                                                            {(activeConflict?.entries ?? []).map((e) => {
                                                                const row = classRowLabel(e)
                                                                const fac = e.facultyUserId
                                                                    ? facultyNameById[e.facultyUserId]
                                                                    : ""
                                                                const room = e.roomId
                                                                    ? roomLabelById[e.roomId]
                                                                    : ""

                                                                return (
                                                                    <TableRow key={e.meetingId}>
                                                                        <TableCell className="max-w-90">
                                                                            <div className="truncate font-medium">
                                                                                {row.main}
                                                                            </div>
                                                                            {row.meta ? (
                                                                                <div className="truncate text-xs text-muted-foreground">
                                                                                    {row.meta}
                                                                                </div>
                                                                            ) : null}
                                                                        </TableCell>

                                                                        <TableCell className="whitespace-nowrap">
                                                                            {prettyDay(e.dayOfWeek)}
                                                                        </TableCell>

                                                                        <TableCell className="whitespace-nowrap">
                                                                            {e.startTime} - {e.endTime}
                                                                        </TableCell>

                                                                        <TableCell className="whitespace-nowrap">
                                                                            <Badge variant="secondary">
                                                                                {safeStr(e.meetingType || "LECTURE")}
                                                                            </Badge>
                                                                        </TableCell>

                                                                        <TableCell className="truncate">
                                                                            {fac || "—"}
                                                                        </TableCell>

                                                                        <TableCell className="truncate">
                                                                            {room || "—"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>

                                        <DialogFooter className="gap-2 sm:gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => setOpen(false)}
                                            >
                                                Close
                                            </Button>

                                            <Button
                                                onClick={() => {
                                                    setOpen(false)
                                                    navigate("/dashboard/department-head/class-scheduling")
                                                }}
                                            >
                                                Fix in Class Scheduling
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
