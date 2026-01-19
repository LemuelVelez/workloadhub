/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
    LayoutDashboard,
    RefreshCw,
    Users,
    Layers,
    BookOpen,
    CalendarDays,
    Megaphone,
    FileText,
    ClipboardList,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"
import { departmentHeadApi } from "@/api/department-head"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from "recharts"

type TermRow = AnyRow
type ProfileRow = AnyRow
type VersionRow = AnyRow
type ClassRow = AnyRow
type MeetingRow = AnyRow
type NotificationRow = AnyRow

type AnyRow = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

const CHART_COLORS = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
] as const

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function safeNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function toDateKey(iso: any) {
    const s = safeStr(iso)
    if (!s) return ""
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ""
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}

function formatShortDayLabel(dateKey: string) {
    const [y, m, d] = dateKey.split("-").map((x) => Number(x))
    if (!y || !m || !d) return dateKey
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" })
}

function normalizeDayOfWeek(v: any) {
    const raw = safeStr(v).toLowerCase()
    if (!raw) return "Unknown"

    const map: Record<string, string> = {
        mon: "Mon",
        monday: "Mon",
        tue: "Tue",
        tues: "Tue",
        tuesday: "Tue",
        wed: "Wed",
        wednesday: "Wed",
        thu: "Thu",
        thur: "Thu",
        thurs: "Thu",
        thursday: "Thu",
        fri: "Fri",
        friday: "Fri",
        sat: "Sat",
        saturday: "Sat",
        sun: "Sun",
        sunday: "Sun",
    }

    const key = raw.replace(/\./g, "").slice(0, 9)
    return map[key] ?? map[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
}

function pickActiveOrLatestVersion(rows: VersionRow[]) {
    const active = rows.find((r) => safeStr(r?.status) === "Active")
    if (active) return active
    return rows?.[0] ?? null
}

function getReadableTermLabel(term: TermRow | null) {
    if (!term) return "—"
    const name = safeStr(term?.name)
    const code = safeStr(term?.code)
    const year = safeStr(term?.schoolYear)
    const sem = safeStr(term?.semester)
    const pieces = [name || code, year || sem].filter(Boolean)
    return pieces.length ? pieces.join(" • ") : safeStr(term?.$id) || "—"
}

function getReadableVersionLabel(version: VersionRow | null) {
    if (!version) return "—"
    const v = safeNum(version?.version, 0)
    const label = safeStr(version?.label)
    const status = safeStr(version?.status) || "Draft"
    const left = label ? `v${v} • ${label}` : `v${v}`
    return `${left} • ${status}`
}

function RechartsTooltipCard({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: any[]
    label?: any
}) {
    if (!active || !payload?.length) return null

    return (
        <div className="rounded-lg border bg-popover p-2 text-popover-foreground shadow">
            <div className="text-xs text-muted-foreground">{safeStr(label)}</div>
            <div className="mt-1 space-y-1">
                {payload.slice(0, 4).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{safeStr(p?.name ?? p?.dataKey ?? "Value")}</span>
                        <span className="font-medium tabular-nums">{safeStr(p?.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function StatCard(props: {
    title: string
    value: React.ReactNode
    icon?: React.ElementType
    hint?: string
    badgeText?: string
    className?: string
}) {
    const Icon = props.icon
    return (
        <Card className={cn("min-w-0", props.className)}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                        <CardDescription className="truncate">{props.title}</CardDescription>
                        <CardTitle className="mt-1 text-2xl leading-none">{props.value}</CardTitle>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {props.badgeText ? (
                            <Badge variant="secondary" className="whitespace-nowrap">
                                {props.badgeText}
                            </Badge>
                        ) : null}

                        {Icon ? (
                            <div className="h-9 w-9 rounded-lg border bg-muted/30 flex items-center justify-center">
                                <Icon className="h-4 w-4" />
                            </div>
                        ) : null}
                    </div>
                </div>

                {props.hint ? (
                    <div className="pt-2 text-xs text-muted-foreground">{props.hint}</div>
                ) : null}
            </CardHeader>
        </Card>
    )
}

export default function DepartmentHeadOverviewPage() {
    const navigate = useNavigate()
    const { user } = useSession()

    const userId = React.useMemo(
        () => safeStr(user?.$id || user?.id || user?.userId),
        [user]
    )

    const [loading, setLoading] = React.useState(true)

    const [term, setTerm] = React.useState<TermRow | null>(null)
    const [profile, setProfile] = React.useState<ProfileRow | null>(null)

    const [versions, setVersions] = React.useState<VersionRow[]>([])
    const [activeVersion, setActiveVersion] = React.useState<VersionRow | null>(null)

    const [facultyUsers, setFacultyUsers] = React.useState<AnyRow[]>([])
    const [sections, setSections] = React.useState<AnyRow[]>([])
    const [subjects, setSubjects] = React.useState<AnyRow[]>([])
    const [classes, setClasses] = React.useState<ClassRow[]>([])
    const [meetings, setMeetings] = React.useState<MeetingRow[]>([])
    const [notifications, setNotifications] = React.useState<NotificationRow[]>([])
    const [changeRequests, setChangeRequests] = React.useState<AnyRow[]>([])

    const departmentId = React.useMemo(() => safeStr(profile?.departmentId), [profile])

    const load = React.useCallback(async () => {
        if (!userId) return

        setLoading(true)
        try {
            const [activeTerm, myProfile] = await Promise.all([
                departmentHeadApi.terms.getActive(),
                departmentHeadApi.profiles.getByUserId(userId),
            ])

            setTerm(activeTerm ?? null)
            setProfile(myProfile ?? null)

            const termId = safeStr(activeTerm?.$id)
            const deptId = safeStr(myProfile?.departmentId)

            if (!termId) {
                toast.error("No active academic term found.")
                setVersions([])
                setActiveVersion(null)
                setFacultyUsers([])
                setSections([])
                setSubjects([])
                setClasses([])
                setMeetings([])
                setNotifications([])
                setChangeRequests([])
                return
            }

            if (!deptId) {
                toast.error("Your profile has no department assigned.")
                setVersions([])
                setActiveVersion(null)
                setFacultyUsers([])
                setSections([])
                setSubjects([])
                setClasses([])
                setMeetings([])
                setNotifications([])
                setChangeRequests([])
                return
            }

            const versionRows = await departmentHeadApi.scheduleVersions.listByTermDepartment(termId, deptId)
            setVersions(versionRows ?? [])

            const selected = pickActiveOrLatestVersion(versionRows ?? [])
            setActiveVersion(selected)

            const versionId = safeStr(selected?.$id)

            const [
                facultyRes,
                sectionsRows,
                subjectRows,
                notificationRows,
                changeReqRows,
                classRows,
                meetingRows,
            ] = await Promise.all([
                departmentHeadApi.faculty.listByDepartment(deptId),
                departmentHeadApi.sections.listByTermDepartment(termId, deptId),
                departmentHeadApi.subjects.listByDepartment(deptId),
                departmentHeadApi.notifications.listByDepartmentTerm({ departmentId: deptId, termId }),
                departmentHeadApi.changeRequests.listByTermDepartment(termId, deptId),
                versionId ? departmentHeadApi.classes.listByVersion(termId, deptId, versionId) : Promise.resolve([]),
                versionId ? departmentHeadApi.classMeetings.listByVersion(versionId) : Promise.resolve([]),
            ])

            setFacultyUsers(Array.isArray(facultyRes?.users) ? facultyRes.users : [])
            setSections(Array.isArray(sectionsRows) ? sectionsRows : [])
            setSubjects(Array.isArray(subjectRows) ? subjectRows : [])
            setNotifications(Array.isArray(notificationRows) ? notificationRows : [])
            setChangeRequests(Array.isArray(changeReqRows) ? changeReqRows : [])
            setClasses(Array.isArray(classRows) ? classRows : [])
            setMeetings(Array.isArray(meetingRows) ? meetingRows : [])
        } catch (err: any) {
            toast.error(err?.message || "Failed to load Department Head overview.")
        } finally {
            setLoading(false)
        }
    }, [userId])

    React.useEffect(() => {
        void load()
    }, [load])

    const stats = React.useMemo(() => {
        const totalFaculty = facultyUsers.length
        const totalSections = sections.length
        const totalSubjects = subjects.length
        const totalClasses = classes.length
        const totalMeetings = meetings.length
        const totalNotifications = notifications.length
        const totalRequests = changeRequests.length

        const assigned = classes.filter((c) => safeStr(c?.facultyUserId)).length
        const unassigned = Math.max(0, totalClasses - assigned)

        const assignedPct = totalClasses > 0 ? Math.round((assigned / totalClasses) * 100) : 0

        return {
            totalFaculty,
            totalSections,
            totalSubjects,
            totalClasses,
            totalMeetings,
            totalNotifications,
            totalRequests,
            assigned,
            unassigned,
            assignedPct,
        }
    }, [facultyUsers, sections, subjects, classes, meetings, notifications, changeRequests])

    const assignedPieData = React.useMemo(() => {
        return [
            { name: "Assigned", value: stats.assigned },
            { name: "Unassigned", value: stats.unassigned },
        ]
    }, [stats.assigned, stats.unassigned])

    const meetingsByDayData = React.useMemo(() => {
        const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const map = new Map<string, number>()
        for (const m of meetings ?? []) {
            const k = normalizeDayOfWeek(m?.dayOfWeek)
            map.set(k, (map.get(k) ?? 0) + 1)
        }

        return order.map((d) => ({ day: d, meetings: map.get(d) ?? 0 }))
    }, [meetings])

    const notificationsTrendData = React.useMemo(() => {
        const days = 14
        const today = new Date()
        const keys: string[] = []

        for (let i = days - 1; i >= 0; i--) {
            const dt = new Date(today)
            dt.setDate(today.getDate() - i)
            const yyyy = dt.getFullYear()
            const mm = String(dt.getMonth() + 1).padStart(2, "0")
            const dd = String(dt.getDate()).padStart(2, "0")
            keys.push(`${yyyy}-${mm}-${dd}`)
        }

        const counts = new Map<string, number>()
        for (const n of notifications ?? []) {
            const k = toDateKey(n?.$createdAt || n?.createdAt)
            if (!k) continue
            counts.set(k, (counts.get(k) ?? 0) + 1)
        }

        return keys.map((k) => ({
            date: formatShortDayLabel(k),
            count: counts.get(k) ?? 0,
        }))
    }, [notifications])

    const topFacultyLoad = React.useMemo(() => {
        const nameByUserId = new Map<string, string>()
        for (const u of facultyUsers ?? []) {
            const id = safeStr(u?.userId || u?.$id)
            const name = safeStr(u?.name || u?.fullName || u?.email || id)
            if (id) nameByUserId.set(id, name)
        }

        const counts = new Map<string, number>()
        for (const c of classes ?? []) {
            const uid = safeStr(c?.facultyUserId)
            if (!uid) continue
            counts.set(uid, (counts.get(uid) ?? 0) + 1)
        }

        const items = Array.from(counts.entries())
            .map(([uid, count]) => ({
                userId: uid,
                name: nameByUserId.get(uid) ?? uid,
                classes: count,
            }))
            .sort((a, b) => b.classes - a.classes)
            .slice(0, 8)

        return items
    }, [classes, facultyUsers])

    const latestNotifications = React.useMemo(() => {
        const list = Array.isArray(notifications) ? notifications.slice(0, 8) : []
        return list
    }, [notifications])

    const termLabel = React.useMemo(() => getReadableTermLabel(term), [term])
    const versionLabel = React.useMemo(() => getReadableVersionLabel(activeVersion), [activeVersion])

    return (
        <DashboardLayout
            title="Department Head Overview"
            subtitle="Monitor scheduling progress, faculty workload distribution, and updates in one place."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => void load()} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6 min-w-0">
                {loading ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                        <div className="grid gap-4 lg:grid-cols-3">
                            <Skeleton className="h-80 w-full" />
                            <Skeleton className="h-80 w-full" />
                            <Skeleton className="h-80 w-full" />
                        </div>
                    </div>
                ) : (
                    <>
                        {!term ? (
                            <Alert>
                                <LayoutDashboard className="h-4 w-4" />
                                <AlertTitle>No active academic term</AlertTitle>
                                <AlertDescription>
                                    Please ask Admin to activate an academic term to enable scheduling modules.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {term && profile && !departmentId ? (
                            <Alert variant="destructive">
                                <AlertTitle>Missing Department Assignment</AlertTitle>
                                <AlertDescription>
                                    Your profile does not have a <span className="font-medium">departmentId</span>. Please contact Admin to fix your user profile.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        {/* ✅ Confirmation Row */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <CardTitle className="truncate">Current Context</CardTitle>
                                        <CardDescription className="truncate">
                                            Active term, selected version, and quick actions.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                        {safeStr(profile?.role) ? safeStr(profile?.role) : "Department Head"}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-0">
                                {/* ✅ FIXED: prevent overlap by giving actions more room on md */}
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    <div className="rounded-xl border bg-muted/20 p-4 min-w-0">
                                        <div className="text-xs text-muted-foreground">Active Term</div>
                                        <div className="mt-1 font-medium truncate">{termLabel}</div>
                                    </div>

                                    <div className="rounded-xl border bg-muted/20 p-4 min-w-0">
                                        <div className="text-xs text-muted-foreground">Active / Latest Version</div>
                                        <div className="mt-1 font-medium truncate">{versionLabel}</div>
                                    </div>

                                    {/* ✅ FIXED: wrap buttons + span full width on md, normal on lg */}
                                    <div className="flex flex-wrap items-center justify-start gap-2 md:col-span-2 lg:col-span-1 lg:justify-end">
                                        <Button
                                            variant="secondary"
                                            className="gap-2 w-full sm:w-auto"
                                            onClick={() => navigate("/dashboard/department-head/faculty-workload-assignment")}
                                        >
                                            <ClipboardList className="h-4 w-4" />
                                            Workload Assignment
                                        </Button>

                                        <Button
                                            className="gap-2 w-full sm:w-auto"
                                            onClick={() => navigate("/dashboard/department-head/class-scheduling")}
                                        >
                                            <CalendarDays className="h-4 w-4" />
                                            Class Scheduling
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="my-4" />

                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">Versions: {versions.length}</Badge>
                                    <Badge variant="outline">Classes: {stats.totalClasses}</Badge>
                                    <Badge variant="outline">Meetings: {stats.totalMeetings}</Badge>
                                    <Badge variant="outline">Assigned: {stats.assigned}</Badge>
                                    <Badge variant="outline">Unassigned: {stats.unassigned}</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ✅ Stats */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                title="Faculty Members"
                                value={stats.totalFaculty}
                                icon={Users}
                                hint="Faculty profiles detected in your department."
                            />
                            <StatCard
                                title="Active Sections"
                                value={stats.totalSections}
                                icon={Layers}
                                hint="Sections available for the active term."
                            />
                            <StatCard
                                title="Subjects"
                                value={stats.totalSubjects}
                                icon={BookOpen}
                                hint="Active subjects inside the department."
                            />
                            <StatCard
                                title="Classes Planned"
                                value={stats.totalClasses}
                                icon={CalendarDays}
                                hint={`${stats.assignedPct}% assigned to faculty`}
                                badgeText={activeVersion ? safeStr(activeVersion?.status) || "Draft" : "No Version"}
                            />
                        </div>

                        {/* ✅ Charts Row */}
                        <div className="grid gap-4 lg:grid-cols-3">
                            {/* Assigned vs Unassigned */}
                            <Card className="min-w-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Assignment Coverage</CardTitle>
                                    <CardDescription>Assigned vs unassigned classes</CardDescription>
                                </CardHeader>
                                <CardContent className="h-72">
                                    {stats.totalClasses === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                            No classes found for this version.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <RechartsTooltip content={<RechartsTooltipCard />} />
                                                <Pie
                                                    data={assignedPieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={3}
                                                >
                                                    {assignedPieData.map((_, idx) => (
                                                        <Cell
                                                            key={idx}
                                                            fill={idx === 0 ? CHART_COLORS[0] : CHART_COLORS[3]}
                                                            stroke="var(--color-border)"
                                                            strokeWidth={1}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Meetings by Day */}
                            <Card className="min-w-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Meetings by Day</CardTitle>
                                    <CardDescription>Distribution of class meetings</CardDescription>
                                </CardHeader>
                                <CardContent className="h-72">
                                    {meetingsByDayData.every((x) => x.meetings === 0) ? (
                                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                            No meetings scheduled yet.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={meetingsByDayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 4" />
                                                <XAxis dataKey="day" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                                                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} allowDecimals={false} />
                                                <RechartsTooltip content={<RechartsTooltipCard />} />
                                                <Bar dataKey="meetings" name="Meetings" fill={CHART_COLORS[1]} radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Notifications Trend */}
                            <Card className="min-w-0">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Announcements Trend</CardTitle>
                                    <CardDescription>Last 14 days notifications created</CardDescription>
                                </CardHeader>
                                <CardContent className="h-72">
                                    {notificationsTrendData.every((x) => x.count === 0) ? (
                                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                            No announcements sent recently.
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={notificationsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 4" />
                                                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                                                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} allowDecimals={false} />
                                                <RechartsTooltip content={<RechartsTooltipCard />} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="count"
                                                    name="Notifications"
                                                    stroke={CHART_COLORS[2]}
                                                    fill={CHART_COLORS[2]}
                                                    fillOpacity={0.18}
                                                    strokeWidth={2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* ✅ Bottom Row */}
                        <div className="grid gap-4 lg:grid-cols-2">
                            {/* Latest Announcements */}
                            <Card className="min-w-0">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-base">Latest Announcements</CardTitle>
                                            <CardDescription>Most recent updates sent to faculty</CardDescription>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="gap-2"
                                            onClick={() => navigate("/dashboard/department-head/announcements/notifications")}
                                        >
                                            <Megaphone className="h-4 w-4" />
                                            Open
                                        </Button>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-2">
                                    {latestNotifications.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            No announcements found for this department/term.
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-56 pr-3">
                                            <div className="space-y-3">
                                                {latestNotifications.map((n) => (
                                                    <div
                                                        key={n.$id}
                                                        className="rounded-xl border bg-muted/15 p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="font-medium truncate">
                                                                    {safeStr(n?.title) || "Untitled"}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {safeStr(n?.type) || "Announcement"} •{" "}
                                                                    {safeStr(n?.$createdAt)
                                                                        ? new Date(n.$createdAt as string).toLocaleString()
                                                                        : "—"}
                                                                </div>
                                                            </div>
                                                            <Badge variant="secondary" className="shrink-0">
                                                                {safeStr(n?.type) || "Notice"}
                                                            </Badge>
                                                        </div>

                                                        <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                                            {safeStr(n?.message) || "—"}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Faculty Load */}
                            <Card className="min-w-0">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <CardTitle className="text-base">Top Faculty Load</CardTitle>
                                            <CardDescription>Most assigned classes (current version)</CardDescription>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="gap-2"
                                            onClick={() => navigate("/dashboard/department-head/faculty-workload-assignment")}
                                        >
                                            <Users className="h-4 w-4" />
                                            Manage
                                        </Button>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-2 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline">Assigned: {stats.assigned}</Badge>
                                        <Badge variant="outline">Unassigned: {stats.unassigned}</Badge>
                                        <Badge variant="outline">Requests: {stats.totalRequests}</Badge>
                                        <Badge variant="outline">Notifications: {stats.totalNotifications}</Badge>
                                        <Badge variant="outline">Meetings: {stats.totalMeetings}</Badge>
                                    </div>

                                    {topFacultyLoad.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            No faculty assignments found yet.
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Faculty</TableHead>
                                                        <TableHead className="text-right">Classes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {topFacultyLoad.map((row) => (
                                                        <TableRow key={row.userId}>
                                                            <TableCell className="min-w-0">
                                                                <div className="truncate font-medium">{row.name}</div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {row.userId}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium tabular-nums">
                                                                {row.classes}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end">
                                        <Button
                                            variant="secondary"
                                            className="gap-2"
                                            onClick={() => navigate("/dashboard/department-head/reports")}
                                        >
                                            <FileText className="h-4 w-4" />
                                            Reports Module
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
