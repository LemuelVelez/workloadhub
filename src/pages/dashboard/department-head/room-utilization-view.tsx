/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { RefreshCcw, DoorOpen, Search, AlertTriangle } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

type AnyDoc = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

type TimeSlot = {
    startTime: string
    endTime: string
    label: string
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
type DayKey = (typeof DAYS)[number] | "Other"

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function padTime(v: string) {
    const t = safeStr(v)
    if (!t) return ""
    // ensure HH:mm
    const m = t.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return t
    const hh = String(Number(m[1])).padStart(2, "0")
    const mm = String(Number(m[2])).padStart(2, "0")
    return `${hh}:${mm}`
}

function toMinutes(t: string) {
    const v = padTime(t)
    const [hh, mm] = v.split(":").map((n) => Number(n))
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
    return hh * 60 + mm
}

function normalizeDay(v: any): DayKey {
    const s = safeStr(v).toLowerCase()
    if (!s) return "Other"

    const map: Record<string, DayKey> = {
        mon: "Monday",
        monday: "Monday",
        tue: "Tuesday",
        tues: "Tuesday",
        tuesday: "Tuesday",
        wed: "Wednesday",
        wednesday: "Wednesday",
        thu: "Thursday",
        thur: "Thursday",
        thurs: "Thursday",
        thursday: "Thursday",
        fri: "Friday",
        friday: "Friday",
        sat: "Saturday",
        saturday: "Saturday",
    }

    return map[s] ?? "Other"
}

function formatRange(start: string, end: string) {
    const a = padTime(start)
    const b = padTime(end)
    if (!a || !b) return "—"
    return `${a} - ${b}`
}

function overlaps(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
    const aS = toMinutes(a.startTime)
    const aE = toMinutes(a.endTime)
    const bS = toMinutes(b.startTime)
    const bE = toMinutes(b.endTime)
    return aS < bE && bS < aE
}

function isStartWithinSlot(meetingStart: string, slot: TimeSlot) {
    const m = toMinutes(meetingStart)
    const s = toMinutes(slot.startTime)
    const e = toMinutes(slot.endTime)
    return m >= s && m < e
}

export default function DepartmentHeadRoomUtilizationViewPage() {
    const { user } = useSession()

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [activeTerm, setActiveTerm] = React.useState<AnyDoc | null>(null)
    const [departmentId, setDepartmentId] = React.useState<string>("")

    const [versions, setVersions] = React.useState<AnyDoc[]>([])
    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [rooms, setRooms] = React.useState<AnyDoc[]>([])
    const [selectedRoomId, setSelectedRoomId] = React.useState<string>("")

    const [timeSlots, setTimeSlots] = React.useState<TimeSlot[]>([])

    const [subjects, setSubjects] = React.useState<AnyDoc[]>([])
    const [sections, setSections] = React.useState<AnyDoc[]>([])
    const [classes, setClasses] = React.useState<AnyDoc[]>([])
    const [meetings, setMeetings] = React.useState<AnyDoc[]>([])

    const [search, setSearch] = React.useState("")
    const [dayFilter, setDayFilter] = React.useState<string>("ALL")
    const [showConflictsOnly, setShowConflictsOnly] = React.useState(false)

    const userId = React.useMemo(() => safeStr(user?.$id || user?.id || user?.userId), [user])

    const reload = React.useCallback(async () => {
        try {
            setError(null)
            setRefreshing(true)

            const term = await departmentHeadApi.terms.getActive()
            setActiveTerm(term)

            if (!userId) return

            const prof = await departmentHeadApi.profiles.getByUserId(userId)
            const deptId = safeStr(prof?.departmentId)
            setDepartmentId(deptId)

            if (!term?.$id || !deptId) return

            const [vDocs, roomDocs, subjDocs, secDocs, tbDocs] = await Promise.all([
                departmentHeadApi.scheduleVersions.listByTermDepartment(term.$id, deptId),
                departmentHeadApi.rooms.listActive(),
                departmentHeadApi.subjects.listByDepartment(deptId),
                departmentHeadApi.sections.listByTermDepartment(term.$id, deptId),
                departmentHeadApi.timeBlocks.listByTerm(term.$id),
            ])

            setVersions(Array.isArray(vDocs) ? vDocs : [])
            setRooms(Array.isArray(roomDocs) ? roomDocs : [])
            setSubjects(Array.isArray(subjDocs) ? subjDocs : [])
            setSections(Array.isArray(secDocs) ? secDocs : [])

            const bestVersion = Array.isArray(vDocs) && vDocs.length > 0 ? safeStr(vDocs[0]?.$id) : ""
            setSelectedVersionId((prev) => prev || bestVersion)

            const bestRoom = Array.isArray(roomDocs) && roomDocs.length > 0 ? safeStr(roomDocs[0]?.$id) : ""
            setSelectedRoomId((prev) => prev || bestRoom)

            // time slots from time blocks if present
            const rawTB = Array.isArray(tbDocs) ? tbDocs : []
            const unique = new Map<string, TimeSlot>()

            rawTB.forEach((t: any) => {
                const s = padTime(t?.startTime)
                const e = padTime(t?.endTime)
                if (!s || !e) return
                const key = `${s}-${e}`
                if (unique.has(key)) return
                unique.set(key, {
                    startTime: s,
                    endTime: e,
                    label: formatRange(s, e),
                })
            })

            let slots = Array.from(unique.values()).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))

            // fallback slots if none exist
            if (slots.length === 0) {
                const fallback: TimeSlot[] = []
                for (let h = 7; h <= 19; h += 1) {
                    const s = `${String(h).padStart(2, "0")}:00`
                    const e = `${String(h + 1).padStart(2, "0")}:00`
                    fallback.push({ startTime: s, endTime: e, label: formatRange(s, e) })
                }
                slots = fallback
            }

            setTimeSlots(slots)
        } catch (e: any) {
            setError(e?.message || "Failed to load room utilization data.")
            toast.error(e?.message || "Failed to load room utilization data.")
        } finally {
            setRefreshing(false)
        }
    }, [userId])

    React.useEffect(() => {
        let alive = true

        const run = async () => {
            setLoading(true)
            await reload()
            if (!alive) return
            setLoading(false)
        }

        void run()
        return () => {
            alive = false
        }
    }, [reload])

    // Load meetings/classes for selected version
    React.useEffect(() => {
        let alive = true

        const run = async () => {
            try {
                if (!activeTerm?.$id || !departmentId || !selectedVersionId) return

                const [classDocs, meetingDocs] = await Promise.all([
                    departmentHeadApi.classes.listByVersion(activeTerm.$id, departmentId, selectedVersionId),
                    departmentHeadApi.classMeetings.listByVersion(selectedVersionId),
                ])

                if (!alive) return
                setClasses(Array.isArray(classDocs) ? classDocs : [])
                setMeetings(Array.isArray(meetingDocs) ? meetingDocs : [])
            } catch (e: any) {
                if (!alive) return
                toast.error(e?.message || "Failed to load version meetings.")
            }
        }

        void run()
        return () => {
            alive = false
        }
    }, [activeTerm?.$id, departmentId, selectedVersionId])

    const roomMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        rooms.forEach((r) => m.set(safeStr(r?.$id), r))
        return m
    }, [rooms])

    const subjectMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        subjects.forEach((s) => m.set(safeStr(s?.$id), s))
        return m
    }, [subjects])

    const sectionMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        sections.forEach((s) => m.set(safeStr(s?.$id), s))
        return m
    }, [sections])

    const classMap = React.useMemo(() => {
        const m = new Map<string, AnyDoc>()
        classes.forEach((c) => m.set(safeStr(c?.$id), c))
        return m
    }, [classes])

    const selectedRoom = React.useMemo(() => roomMap.get(selectedRoomId) ?? null, [roomMap, selectedRoomId])

    const filteredMeetingsForRoom = React.useMemo(() => {
        const roomId = safeStr(selectedRoomId)
        if (!roomId) return []

        const q = safeStr(search).toLowerCase()

        const raw = meetings
            .filter((m) => safeStr(m?.roomId) === roomId)
            .map((m) => {
                const cls = classMap.get(safeStr(m?.classId))
                const subject = subjectMap.get(safeStr(cls?.subjectId))
                const section = sectionMap.get(safeStr(cls?.sectionId))

                const day = normalizeDay(m?.dayOfWeek)
                const startTime = padTime(m?.startTime)
                const endTime = padTime(m?.endTime)

                const subjectLabel = subject
                    ? `${safeStr(subject?.code)}${safeStr(subject?.title) ? ` - ${safeStr(subject?.title)}` : ""}`
                    : "Unknown Subject"

                const sectionLabel = section
                    ? `YL${safeStr(section?.yearLevel)}-${safeStr(section?.name)}`
                    : "Unknown Section"

                const classCode = safeStr(cls?.classCode)
                const meetingType = safeStr(m?.meetingType || "LECTURE")

                const labelParts = [
                    classCode,
                    sectionLabel,
                    subjectLabel,
                    meetingType,
                    safeStr(m?.notes),
                ]
                    .filter(Boolean)
                    .join(" ")

                const includesQuery = !q || labelParts.toLowerCase().includes(q)

                return {
                    ...m,
                    __day: day,
                    __startTime: startTime,
                    __endTime: endTime,
                    __subjectLabel: subjectLabel,
                    __sectionLabel: sectionLabel,
                    __classCode: classCode,
                    __meetingType: meetingType,
                    __searchHit: includesQuery,
                }
            })
            .filter((m) => m.__searchHit)

        const dayPick = safeStr(dayFilter)
        if (dayPick !== "ALL") {
            return raw.filter((m) => safeStr(m.__day) === dayPick)
        }

        return raw
    }, [meetings, selectedRoomId, search, dayFilter, classMap, subjectMap, sectionMap])

    const conflicts = React.useMemo(() => {
        const byDay = new Map<DayKey, any[]>()

        const perDay: Record<string, any[]> = {}
        filteredMeetingsForRoom.forEach((m: any) => {
            const day: DayKey = m.__day
            if (!perDay[day]) perDay[day] = []
            perDay[day].push(m)
        })

        Object.keys(perDay).forEach((d) => {
            const day = d as DayKey
            const list = perDay[day].slice().sort((a, b) => toMinutes(a.__startTime) - toMinutes(b.__startTime))
            const found: any[] = []

            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i]
                    const b = list[j]
                    if (overlaps({ startTime: a.__startTime, endTime: a.__endTime }, { startTime: b.__startTime, endTime: b.__endTime })) {
                        found.push({ a, b })
                    } else {
                        // optimization: if b starts after a ends, no more overlaps with a
                        if (toMinutes(b.__startTime) >= toMinutes(a.__endTime)) break
                    }
                }
            }

            if (found.length > 0) byDay.set(day, found)
        })

        return byDay
    }, [filteredMeetingsForRoom])

    const conflictCount = React.useMemo(() => {
        let n = 0
        conflicts.forEach((v) => (n += v.length))
        return n
    }, [conflicts])

    const conflictMeetingIds = React.useMemo(() => {
        const set = new Set<string>()
        conflicts.forEach((pairs) => {
            pairs.forEach((p: any) => {
                set.add(safeStr(p?.a?.$id))
                set.add(safeStr(p?.b?.$id))
            })
        })
        return set
    }, [conflicts])

    const cellMeetings = React.useCallback(
        (day: string, slot: TimeSlot) => {
            const filtered = filteredMeetingsForRoom.filter((m: any) => safeStr(m.__day) === day)
            const startsHere = filtered.filter((m: any) => isStartWithinSlot(m.__startTime, slot))

            if (!showConflictsOnly) return startsHere

            return startsHere.filter((m: any) => conflictMeetingIds.has(safeStr(m?.$id)))
        },
        [filteredMeetingsForRoom, showConflictsOnly, conflictMeetingIds]
    )

    const versionLabel = (v: AnyDoc) => {
        const version = safeStr(v?.version)
        const label = safeStr(v?.label)
        const status = safeStr(v?.status)
        const parts = [`v${version || "?"}`, label, status].filter(Boolean)
        return parts.join(" • ")
    }

    const roomLabel = (r: AnyDoc) => {
        const code = safeStr(r?.code)
        const name = safeStr(r?.name)
        return name ? `${code} • ${name}` : code || "Room"
    }

    const pageTitle = "Room Utilization View"
    const subtitle = "Room schedule grid to avoid double booking"

    if (loading) {
        return (
            <DashboardLayout title={pageTitle} subtitle={subtitle}>
                <div className="p-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Loading…</CardTitle>
                            <CardDescription>Please wait while we fetch room schedules.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout
            title={pageTitle}
            subtitle={subtitle}
            actions={
                <Button
                    variant="outline"
                    onClick={() => void reload()}
                    disabled={refreshing}
                    className="gap-2"
                >
                    <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                    Refresh
                </Button>
            }
        >
            <div className="p-6 space-y-6">
                {error ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Load error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {!activeTerm?.$id ? (
                    <Alert>
                        <AlertTitle>No active academic term</AlertTitle>
                        <AlertDescription>
                            Please ask the admin to set an active term before viewing room utilization.
                        </AlertDescription>
                    </Alert>
                ) : null}

                {!departmentId ? (
                    <Alert>
                        <AlertTitle>Missing department profile</AlertTitle>
                        <AlertDescription>
                            Your profile is missing a departmentId. Please contact the admin to fix your user profile.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex items-center gap-2">
                            <DoorOpen className="h-5 w-5" />
                            <CardTitle>Room Schedule Grid</CardTitle>
                        </div>
                        <CardDescription>
                            Select a schedule version and room to preview time usage and detect conflicts.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {/* Controls */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2 min-w-0">
                                <Label>Schedule Version</Label>
                                <Select
                                    value={selectedVersionId}
                                    onValueChange={(v) => setSelectedVersionId(safeStr(v))}
                                    disabled={versions.length === 0}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {versions.map((v) => (
                                            <SelectItem key={safeStr(v?.$id)} value={safeStr(v?.$id)}>
                                                {versionLabel(v)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 min-w-0">
                                <Label>Room</Label>
                                <Select
                                    value={selectedRoomId}
                                    onValueChange={(v) => setSelectedRoomId(safeStr(v))}
                                    disabled={rooms.length === 0}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map((r) => (
                                            <SelectItem key={safeStr(r?.$id)} value={safeStr(r?.$id)}>
                                                {roomLabel(r)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 min-w-0">
                                <Label>Day Filter</Label>
                                <Select value={dayFilter} onValueChange={(v) => setDayFilter(safeStr(v))}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="All days" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Days</SelectItem>
                                        {DAYS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 min-w-0">
                                <Label>Search</Label>
                                <div className="relative">
                                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search section / subject / code…"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary">
                                Meetings: {filteredMeetingsForRoom.length}
                            </Badge>

                            <Badge variant={conflictCount > 0 ? "destructive" : "outline"}>
                                Conflicts: {conflictCount}
                            </Badge>

                            <div className="flex items-center gap-2 ml-auto">
                                <Switch
                                    checked={showConflictsOnly}
                                    onCheckedChange={(v) => setShowConflictsOnly(Boolean(v))}
                                />
                                <span className="text-sm text-muted-foreground">Show conflicts only</span>
                            </div>
                        </div>

                        {/* Grid */}
                        {!selectedRoom ? (
                            <Alert>
                                <AlertTitle>No room selected</AlertTitle>
                                <AlertDescription>Please select a room to display the schedule grid.</AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border">
                                    <ScrollArea className="w-full">
                                        <div className="min-w-max">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-40">Time</TableHead>
                                                        {DAYS.map((d) => (
                                                            <TableHead key={d} className="min-w-48">
                                                                {d}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>

                                                <TableBody>
                                                    {timeSlots.map((slot) => (
                                                        <TableRow key={`${slot.startTime}-${slot.endTime}`}>
                                                            <TableCell className="align-top font-medium">
                                                                {slot.label}
                                                            </TableCell>

                                                            {DAYS.map((d) => {
                                                                const items = cellMeetings(d, slot)

                                                                return (
                                                                    <TableCell key={`${d}-${slot.label}`} className="align-top">
                                                                        <div className="flex flex-col gap-2">
                                                                            {items.length === 0 ? (
                                                                                <span className="text-xs text-muted-foreground">—</span>
                                                                            ) : (
                                                                                items.map((m: any) => {
                                                                                    const isConflict = conflictMeetingIds.has(safeStr(m?.$id))
                                                                                    const badgeVariant = isConflict ? "destructive" : "secondary"

                                                                                    return (
                                                                                        <HoverCard key={safeStr(m?.$id)}>
                                                                                            <HoverCardTrigger asChild>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="text-left"
                                                                                                >
                                                                                                    <Badge
                                                                                                        variant={badgeVariant as any}
                                                                                                        className="w-full justify-start whitespace-normal leading-4 py-1"
                                                                                                    >
                                                                                                        <span className="font-semibold">
                                                                                                            {m.__classCode || m.__sectionLabel}
                                                                                                        </span>
                                                                                                        <span className="ml-2 text-xs opacity-90">
                                                                                                            {padTime(m.__startTime)}-{padTime(m.__endTime)}
                                                                                                        </span>
                                                                                                    </Badge>
                                                                                                </button>
                                                                                            </HoverCardTrigger>

                                                                                            <HoverCardContent className="w-96 space-y-2">
                                                                                                <div className="space-y-1">
                                                                                                    <div className="text-sm font-semibold">
                                                                                                        {m.__subjectLabel}
                                                                                                    </div>
                                                                                                    <div className="text-xs text-muted-foreground">
                                                                                                        {m.__sectionLabel} • {m.__meetingType}
                                                                                                    </div>
                                                                                                    <div className="text-xs">
                                                                                                        <span className="font-medium">Time:</span>{" "}
                                                                                                        {formatRange(m.__startTime, m.__endTime)}
                                                                                                    </div>
                                                                                                    {safeStr(m?.notes) ? (
                                                                                                        <div className="text-xs">
                                                                                                            <span className="font-medium">Notes:</span>{" "}
                                                                                                            {safeStr(m?.notes)}
                                                                                                        </div>
                                                                                                    ) : null}
                                                                                                </div>

                                                                                                {isConflict ? (
                                                                                                    <Alert variant="destructive">
                                                                                                        <AlertTitle>Conflict detected</AlertTitle>
                                                                                                        <AlertDescription>
                                                                                                            This meeting overlaps with another schedule in the same room.
                                                                                                        </AlertDescription>
                                                                                                    </Alert>
                                                                                                ) : null}
                                                                                            </HoverCardContent>
                                                                                        </HoverCard>
                                                                                    )
                                                                                })
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                )
                                                            })}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>

                                {/* Conflicts Panel */}
                                {conflictCount > 0 ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Detected Conflicts</CardTitle>
                                            <CardDescription>
                                                Conflicts are overlaps in the same room for the selected version.
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            <Accordion type="multiple" className="w-full">
                                                {Array.from(conflicts.entries()).map(([day, pairs]) => (
                                                    <AccordionItem key={day} value={day}>
                                                        <AccordionTrigger>
                                                            <div className="flex items-center gap-2">
                                                                <span>{day}</span>
                                                                <Badge variant="destructive">{pairs.length}</Badge>
                                                            </div>
                                                        </AccordionTrigger>

                                                        <AccordionContent>
                                                            <div className="space-y-3">
                                                                {pairs.map((p: any, idx: number) => {
                                                                    const a = p?.a
                                                                    const b = p?.b

                                                                    return (
                                                                        <div
                                                                            key={`${day}-${idx}`}
                                                                            className="rounded-lg border p-3 space-y-1"
                                                                        >
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <Badge variant="destructive">Overlap</Badge>
                                                                                <span className="text-sm font-semibold">
                                                                                    {selectedRoom ? roomLabel(selectedRoom) : "Room"}
                                                                                </span>
                                                                            </div>

                                                                            <div className="text-xs text-muted-foreground">
                                                                                {formatRange(a?.__startTime, a?.__endTime)}{" "}
                                                                                overlaps with{" "}
                                                                                {formatRange(b?.__startTime, b?.__endTime)}
                                                                            </div>

                                                                            <div className="text-sm">
                                                                                <span className="font-medium">
                                                                                    {a?.__sectionLabel}
                                                                                </span>{" "}
                                                                                • {a?.__subjectLabel}
                                                                            </div>

                                                                            <div className="text-sm">
                                                                                <span className="font-medium">
                                                                                    {b?.__sectionLabel}
                                                                                </span>{" "}
                                                                                • {b?.__subjectLabel}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Alert>
                                        <AlertTitle>No conflicts detected</AlertTitle>
                                        <AlertDescription>
                                            This room has no overlapping schedules for the selected version.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
