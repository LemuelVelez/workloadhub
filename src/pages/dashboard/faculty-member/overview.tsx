/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import {
    RefreshCw,
    CalendarDays,
    ClipboardList,
    Bell,
    Clock,
    TrendingUp,
    BarChart3,
    PieChart as PieChartIcon,
} from "lucide-react"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

import { facultyMemberApi } from "@/api/faculty-member"
import type {
    FacultyScheduleItem,
    FacultyWorkloadSummaryItem,
    FacultyAvailabilityItem,
    FacultyChangeRequestItem,
    FacultyNotificationItem,
} from "@/api/faculty-member"

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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
]

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function toNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function timeToMinutes(t: any) {
    const s = safeStr(t)
    if (!s) return 0
    const parts = s.split(":").map((x) => Number(x))
    const hh = Number.isFinite(parts[0]) ? parts[0] : 0
    const mm = Number.isFinite(parts[1]) ? parts[1] : 0
    return hh * 60 + mm
}

function durationMinutes(start: any, end: any) {
    const a = timeToMinutes(start)
    const b = timeToMinutes(end)
    const diff = b - a
    return diff > 0 ? diff : 0
}

function formatMinutes(mins: number) {
    const m = Math.max(0, Math.floor(mins))
    const h = Math.floor(m / 60)
    const r = m % 60
    if (h <= 0) return `${r} min`
    if (r <= 0) return `${h} hr`
    return `${h} hr ${r} min`
}

function formatHours(mins: number) {
    const hours = mins / 60
    if (!Number.isFinite(hours)) return "0.0"
    return hours.toFixed(1)
}

function clampPercent(v: number) {
    if (!Number.isFinite(v)) return 0
    return Math.max(0, Math.min(100, v))
}

function StatusBadge({ status }: { status: string }) {
    const s = safeStr(status || "Pending")
    const lower = s.toLowerCase()

    const variant =
        lower.includes("approve") || lower === "approved"
            ? "default"
            : lower.includes("reject") || lower === "rejected"
                ? "destructive"
                : lower.includes("cancel")
                    ? "secondary"
                    : "outline"

    return (
        <Badge variant={variant as any} className="whitespace-nowrap">
            {s || "Pending"}
        </Badge>
    )
}

function NiceTooltip(props: any) {
    const { active, payload, label } = props
    if (!active || !payload || payload.length === 0) return null

    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
            {label ? <div className="text-sm font-medium">{label}</div> : null}
            <div className="mt-1 space-y-1">
                {payload.slice(0, 6).map((p: any, idx: number) => (
                    <div
                        key={`${p?.dataKey || p?.name || idx}`}
                        className="flex items-center justify-between gap-4 text-xs"
                    >
                        <span className="text-muted-foreground">
                            {safeStr(p?.name || p?.dataKey || "Value")}
                        </span>
                        <span className="font-medium">{safeStr(p?.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function PieNiceTooltip(props: any) {
    const { active, payload } = props
    if (!active || !payload || payload.length === 0) return null

    const p = payload[0]
    const name = safeStr(p?.name || "")
    const value = safeStr(p?.value ?? "")

    return (
        <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
            <div className="text-sm font-medium">{name || "Item"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
                Count: <span className="font-medium text-foreground">{value}</span>
            </div>
        </div>
    )
}

export default function FacultyOverviewPage() {
    const { user } = useSession()

    const userId = React.useMemo(() => {
        return safeStr(user?.$id || user?.id || user?.userId || "")
    }, [user])

    const [loading, setLoading] = React.useState(true)

    const [term, setTerm] = React.useState<any>(null)
    const [version, setVersion] = React.useState<any>(null)

    const [profile, setProfile] = React.useState<any>(null)
    const [facultyProfile, setFacultyProfile] = React.useState<any>(null)

    const [scheduleItems, setScheduleItems] = React.useState<FacultyScheduleItem[]>([])
    const [workloadItems, setWorkloadItems] = React.useState<FacultyWorkloadSummaryItem[]>([])
    const [availabilityItems, setAvailabilityItems] = React.useState<FacultyAvailabilityItem[]>([])
    const [requestItems, setRequestItems] = React.useState<FacultyChangeRequestItem[]>([])
    const [notificationItems, setNotificationItems] = React.useState<FacultyNotificationItem[]>([])

    const [lastUpdated, setLastUpdated] = React.useState<string>("")

    const refresh = React.useCallback(async () => {
        if (!userId) {
            setLoading(false)
            return
        }

        setLoading(true)

        try {
            const results = await Promise.allSettled([
                facultyMemberApi.workloads.getMyWorkloadSummary({ userId }),
                facultyMemberApi.schedules.getMySchedule({ userId }),
                facultyMemberApi.notifications.listMy({ userId }),
                facultyMemberApi.availability.listMy({ userId }),
                facultyMemberApi.changeRequests.listMy({ userId }),
            ])

            const workloadRes = results[0].status === "fulfilled" ? results[0].value : null
            const scheduleRes = results[1].status === "fulfilled" ? results[1].value : null
            const notifRes = results[2].status === "fulfilled" ? results[2].value : null
            const availRes = results[3].status === "fulfilled" ? results[3].value : null
            const reqRes = results[4].status === "fulfilled" ? results[4].value : null

            const effectiveTerm = workloadRes?.term ?? scheduleRes?.term ?? availRes?.term ?? notifRes?.term ?? reqRes?.term ?? null
            const effectiveVersion = workloadRes?.version ?? scheduleRes?.version ?? null

            const effectiveProfile = workloadRes?.profile ?? scheduleRes?.profile ?? notifRes?.profile ?? reqRes?.profile ?? profile ?? null
            const effectiveFacultyProfile = workloadRes?.facultyProfile ?? facultyProfile ?? null

            setTerm(effectiveTerm)
            setVersion(effectiveVersion)

            setProfile(effectiveProfile)
            setFacultyProfile(effectiveFacultyProfile)

            setWorkloadItems(Array.isArray(workloadRes?.items) ? workloadRes.items : [])
            setScheduleItems(Array.isArray(scheduleRes?.items) ? scheduleRes.items : [])

            setNotificationItems(Array.isArray(notifRes?.items) ? notifRes.items : [])
            setAvailabilityItems(Array.isArray(availRes?.items) ? availRes.items : [])
            setRequestItems(Array.isArray(reqRes?.items) ? reqRes.items : [])

            setLastUpdated(new Date().toISOString())
        } catch (err: any) {
            toast.error(err?.message || "Failed to load overview data.")
        } finally {
            setLoading(false)
        }
    }, [userId, profile, facultyProfile])

    React.useEffect(() => {
        refresh()
    }, [refresh])

    const termLabel = React.useMemo(() => {
        const t = term
        return (
            safeStr(t?.name) ||
            safeStr(t?.title) ||
            safeStr(t?.label) ||
            safeStr(t?.termName) ||
            "Active Term"
        )
    }, [term])

    const versionLabel = React.useMemo(() => {
        const v = version
        const raw =
            safeStr(v?.version) ||
            safeStr(v?.name) ||
            safeStr(v?.label) ||
            safeStr(v?.status) ||
            ""
        if (!raw) return "—"
        if (/^\d+$/.test(raw)) return `v${raw}`
        return raw
    }, [version])

    const displayName = React.useMemo(() => {
        return (
            safeStr(profile?.name) ||
            safeStr(user?.name) ||
            safeStr(user?.prefs?.name) ||
            "Faculty"
        )
    }, [profile, user])

    const totalClasses = workloadItems.length

    const totals = React.useMemo(() => {
        const totalUnits = workloadItems.reduce((sum, it) => sum + toNum(it?.units, 0), 0)
        const weeklyMinutes = workloadItems.reduce((sum, it) => sum + toNum(it?.weeklyMinutes, 0), 0)
        const meetingCount = workloadItems.reduce((sum, it) => sum + toNum(it?.meetingCount, 0), 0)

        return { totalUnits, weeklyMinutes, meetingCount }
    }, [workloadItems])

    const scheduleTotals = React.useMemo(() => {
        const meetingMinutes = scheduleItems.reduce(
            (sum, it) => sum + durationMinutes(it?.startTime, it?.endTime),
            0
        )
        return {
            meetingItems: scheduleItems.length,
            weeklyMinutesFromMeetings: meetingMinutes,
        }
    }, [scheduleItems])

    const maxUnits = React.useMemo(() => {
        return toNum(facultyProfile?.maxUnits, 0)
    }, [facultyProfile])

    const maxHours = React.useMemo(() => {
        return toNum(facultyProfile?.maxHours, 0)
    }, [facultyProfile])

    const unitUsagePct = React.useMemo(() => {
        if (!maxUnits || maxUnits <= 0) return 0
        return clampPercent((totals.totalUnits / maxUnits) * 100)
    }, [totals.totalUnits, maxUnits])

    const hoursUsagePct = React.useMemo(() => {
        const weeklyHours = totals.weeklyMinutes / 60
        if (!maxHours || maxHours <= 0) return 0
        return clampPercent((weeklyHours / maxHours) * 100)
    }, [totals.weeklyMinutes, maxHours])

    const unreadCount = React.useMemo(() => {
        return notificationItems.filter((n) => !n?.isRead).length
    }, [notificationItems])

    const pendingRequests = React.useMemo(() => {
        return requestItems.filter((r) => safeStr(r?.status).toLowerCase() === "pending").length
    }, [requestItems])

    const dayMinutesChart = React.useMemo(() => {
        const map = new Map<string, number>()
        for (const d of DAY_ORDER) map.set(d, 0)

        for (const it of scheduleItems) {
            const day = safeStr(it?.dayOfWeek)
            const dur = durationMinutes(it?.startTime, it?.endTime)
            if (!day) continue
            const prev = map.get(day) ?? 0
            map.set(day, prev + dur)
        }

        return DAY_ORDER.map((d) => ({
            day: d.slice(0, 3),
            minutes: map.get(d) ?? 0,
        }))
    }, [scheduleItems])

    const subjectUnitsChart = React.useMemo(() => {
        const map = new Map<string, number>()

        for (const it of workloadItems) {
            const code = safeStr(it?.subjectCode) || "N/A"
            const units = toNum(it?.units, 0)
            map.set(code, (map.get(code) ?? 0) + units)
        }

        const entries = Array.from(map.entries())
            .map(([subject, units]) => ({ subject, units }))
            .sort((a, b) => b.units - a.units)

        // Keep top 8, group remainder as Others
        const top = entries.slice(0, 8)
        const rest = entries.slice(8)
        const others = rest.reduce((sum, x) => sum + x.units, 0)

        const out = [...top]
        if (others > 0) out.push({ subject: "Others", units: others })

        return out
    }, [workloadItems])

    const availabilityPrefChart = React.useMemo(() => {
        const base = new Map<string, number>()
        base.set("Preferred", 0)
        base.set("Neutral", 0)
        base.set("Unavailable", 0)

        for (const it of availabilityItems) {
            const pref = safeStr(it?.preference || "Neutral")
            const key = pref.toLowerCase().includes("prefer")
                ? "Preferred"
                : pref.toLowerCase().includes("unavail")
                    ? "Unavailable"
                    : "Neutral"
            base.set(key, (base.get(key) ?? 0) + 1)
        }

        return Array.from(base.entries()).map(([name, value]) => ({ name, value }))
    }, [availabilityItems])

    const requestStatusChart = React.useMemo(() => {
        const map = new Map<string, number>()
        for (const it of requestItems) {
            const s = safeStr(it?.status || "Pending")
            map.set(s, (map.get(s) ?? 0) + 1)
        }

        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [requestItems])

    const recentNotifications = React.useMemo(() => {
        return notificationItems.slice(0, 6)
    }, [notificationItems])

    const recentRequests = React.useMemo(() => {
        return requestItems.slice(0, 6)
    }, [requestItems])

    const compactSchedule = React.useMemo(() => {
        return scheduleItems.slice(0, 10)
    }, [scheduleItems])

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ml-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <h1 className="text-xl font-semibold tracking-tight">
                                Overview
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Welcome back, <span className="font-medium text-foreground">{displayName}</span>. Here’s your snapshot for{" "}
                            <span className="font-medium text-foreground">{termLabel}</span>.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                <span>Term: {termLabel}</span>
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>Version: {versionLabel}</span>
                            </Badge>
                            {lastUpdated ? (
                                <Badge variant="outline" className="gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Updated</span>
                                </Badge>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={refresh}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button asChild>
                            <Link to="/dashboard/faculty/my-schedule" className="gap-2">
                                <CalendarDays className="h-4 w-4" />
                                My Schedule
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Missing term warning */}
                {!loading && !term ? (
                    <Alert>
                        <AlertTitle>No active academic term</AlertTitle>
                        <AlertDescription>
                            Your dashboard can’t compute schedule/workload summaries because there is no active term configured.
                            Please contact the admin or department head.
                        </AlertDescription>
                    </Alert>
                ) : null}

                {/* Stat cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Assigned Classes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <div className="text-2xl font-semibold">{totalClasses}</div>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                                Unique class assignments for the active schedule version
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Units
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <div className="text-2xl font-semibold">{totals.totalUnits}</div>
                            )}
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Usage</span>
                                    <span className="font-medium text-foreground">
                                        {maxUnits ? `${totals.totalUnits}/${maxUnits}` : "—"}
                                    </span>
                                </div>
                                <Progress value={unitUsagePct} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Weekly Load (Hours)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <div className="text-2xl font-semibold">
                                    {formatHours(totals.weeklyMinutes)}
                                </div>
                            )}
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Usage</span>
                                    <span className="font-medium text-foreground">
                                        {maxHours ? `${formatHours(totals.weeklyMinutes)} / ${maxHours}` : "—"}
                                    </span>
                                </div>
                                <Progress value={hoursUsagePct} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Unread Notifications
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-2xl font-semibold">{unreadCount}</div>
                                    <Badge
                                        variant={unreadCount > 0 ? "default" : "secondary"}
                                        className="gap-1"
                                    >
                                        <Bell className="h-3.5 w-3.5" />
                                        {unreadCount > 0 ? "Action" : "Clear"}
                                    </Badge>
                                </div>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                                Schedule updates, announcements, approvals
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="min-w-0">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-primary" />
                                        Weekly Meeting Minutes by Day
                                    </CardTitle>
                                    <CardDescription>
                                        Total time based on your scheduled class meetings
                                    </CardDescription>
                                </div>

                                {!loading ? (
                                    <Badge variant="outline" className="gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {formatMinutes(scheduleTotals.weeklyMinutesFromMeetings)}
                                    </Badge>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-56" />
                                    <Skeleton className="h-72 w-full" />
                                </div>
                            ) : (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dayMinutesChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                axisLine={{ stroke: "var(--border)" }}
                                                tickLine={{ stroke: "var(--border)" }}
                                            />
                                            <YAxis
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                axisLine={{ stroke: "var(--border)" }}
                                                tickLine={{ stroke: "var(--border)" }}
                                            />
                                            <ReTooltip content={<NiceTooltip />} cursor={{ fill: "var(--accent)" }} />
                                            <Legend
                                                wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
                                            />
                                            <Bar
                                                dataKey="minutes"
                                                name="Minutes"
                                                fill={CHART_COLORS[0]}
                                                radius={[8, 8, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChartIcon className="h-4 w-4 text-primary" />
                                Units Distribution by Subject
                            </CardTitle>
                            <CardDescription>
                                How your assigned units are spread across subjects
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-56" />
                                    <Skeleton className="h-72 w-full" />
                                </div>
                            ) : subjectUnitsChart.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No workload data yet</AlertTitle>
                                    <AlertDescription>
                                        Once you are assigned classes, your unit distribution will appear here.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={subjectUnitsChart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="subject"
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                axisLine={{ stroke: "var(--border)" }}
                                                tickLine={{ stroke: "var(--border)" }}
                                                interval={0}
                                                angle={-15}
                                                height={50}
                                            />
                                            <YAxis
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                                axisLine={{ stroke: "var(--border)" }}
                                                tickLine={{ stroke: "var(--border)" }}
                                            />
                                            <ReTooltip content={<NiceTooltip />} cursor={{ fill: "var(--accent)" }} />
                                            <Legend wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }} />
                                            <Bar
                                                dataKey="units"
                                                name="Units"
                                                radius={[8, 8, 0, 0]}
                                            >
                                                {subjectUnitsChart.map((_, idx) => (
                                                    <Cell
                                                        key={`cell-${idx}`}
                                                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="min-w-0 lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChartIcon className="h-4 w-4 text-primary" />
                                Availability Preferences
                            </CardTitle>
                            <CardDescription>Breakdown of your submitted preference blocks</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-44" />
                                    <Skeleton className="h-72 w-full" />
                                </div>
                            ) : availabilityItems.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No preferences submitted</AlertTitle>
                                    <AlertDescription>
                                        Submit your availability preferences to help generate a conflict-free schedule.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <ReTooltip content={<PieNiceTooltip />} />
                                            <Legend wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }} />
                                            <Pie
                                                data={availabilityPrefChart}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={52}
                                                outerRadius={92}
                                                paddingAngle={2}
                                            >
                                                {availabilityPrefChart.map((_, idx) => (
                                                    <Cell
                                                        key={`pref-${idx}`}
                                                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                    />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0 lg:col-span-2">
                        <CardHeader>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4 text-primary" />
                                        Change Requests Summary
                                    </CardTitle>
                                    <CardDescription>Track your submitted requests and approvals</CardDescription>
                                </div>

                                {!loading ? (
                                    <Badge
                                        variant={pendingRequests > 0 ? "default" : "secondary"}
                                        className="gap-1"
                                    >
                                        <Clock className="h-3.5 w-3.5" />
                                        {pendingRequests} Pending
                                    </Badge>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-64" />
                                    <Skeleton className="h-72 w-full" />
                                </div>
                            ) : requestItems.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No change requests yet</AlertTitle>
                                    <AlertDescription>
                                        When you submit a request, its status will appear here.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <ReTooltip content={<PieNiceTooltip />} />
                                                <Legend wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }} />
                                                <Pie
                                                    data={requestStatusChart}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={52}
                                                    outerRadius={92}
                                                    paddingAngle={2}
                                                >
                                                    {requestStatusChart.map((_, idx) => (
                                                        <Cell
                                                            key={`req-${idx}`}
                                                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="flex min-w-0 flex-col">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium">Recent Requests</div>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link to="/dashboard/faculty/request-change">View all</Link>
                                            </Button>
                                        </div>

                                        <Separator className="my-3" />

                                        <ScrollArea className="h-64 pr-3">
                                            <div className="space-y-3">
                                                {recentRequests.map((r) => (
                                                    <div
                                                        key={r.$id}
                                                        className="rounded-lg border bg-card p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium">
                                                                    {safeStr(r?.type || "Request")}
                                                                </div>
                                                                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                                    {safeStr(r?.details || "")}
                                                                </div>
                                                            </div>
                                                            <StatusBadge status={safeStr(r?.status || "Pending")} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom: schedule table + notifications */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="min-w-0">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-primary" />
                                        My Weekly Schedule (Preview)
                                    </CardTitle>
                                    <CardDescription>
                                        First 10 meetings for quick reference
                                    </CardDescription>
                                </div>

                                {!loading ? (
                                    <Badge variant="outline" className="gap-1">
                                        <ClipboardList className="h-3.5 w-3.5" />
                                        {scheduleTotals.meetingItems} meetings
                                    </Badge>
                                ) : null}
                            </div>
                        </CardHeader>

                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-56" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            ) : compactSchedule.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No schedule found</AlertTitle>
                                    <AlertDescription>
                                        You may not have any class meetings assigned yet for the active term/version.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <ScrollArea className="h-64 pr-3">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-23">Day</TableHead>
                                                <TableHead className="w-35">Time</TableHead>
                                                <TableHead>Subject</TableHead>
                                                <TableHead className="w-40">Section</TableHead>
                                                <TableHead className="w-35">Room</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {compactSchedule.map((it) => {
                                                const subject = safeStr(it?.subjectCode || "") || "—"
                                                const section = safeStr(it?.sectionLabel || "") || "—"
                                                const room = safeStr(it?.roomCode || "") || "—"
                                                const day = safeStr(it?.dayOfWeek || "") || "—"
                                                const time = `${safeStr(it?.startTime)} - ${safeStr(it?.endTime)}`

                                                return (
                                                    <TableRow key={it.meetingId}>
                                                        <TableCell className="font-medium">
                                                            {day.slice(0, 3)}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {time}
                                                        </TableCell>
                                                        <TableCell className="min-w-0">
                                                            <div className="truncate font-medium">{subject}</div>
                                                            <div className="truncate text-xs text-muted-foreground">
                                                                {safeStr(it?.subjectTitle || "") || "—"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {section}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {room}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}

                            <div className="mt-3 flex justify-end">
                                <Button variant="outline" asChild>
                                    <Link to="/dashboard/faculty/my-schedule" className="gap-2">
                                        <CalendarDays className="h-4 w-4" />
                                        Open full schedule
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-primary" />
                                        Recent Notifications
                                    </CardTitle>
                                    <CardDescription>
                                        Unread appear first, then newest
                                    </CardDescription>
                                </div>

                                {!loading ? (
                                    <Badge
                                        variant={unreadCount > 0 ? "default" : "secondary"}
                                        className="gap-1"
                                    >
                                        {unreadCount > 0 ? "Unread" : "All read"}: {unreadCount}
                                    </Badge>
                                ) : null}
                            </div>
                        </CardHeader>

                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-56" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            ) : recentNotifications.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No notifications</AlertTitle>
                                    <AlertDescription>
                                        You’ll see announcements and schedule updates here.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <ScrollArea className="h-64 pr-3">
                                    <div className="space-y-3">
                                        {recentNotifications.map((n) => {
                                            const isUnread = !n?.isRead
                                            const title = safeStr(n?.title || "Notification")
                                            const msg = safeStr(n?.message || "")
                                            const link = safeStr(n?.link || "")
                                            const type = safeStr(n?.type || "")

                                            return (
                                                <div
                                                    key={`${n.notificationId}:${n.recipientRowId}`}
                                                    className={cn(
                                                        "rounded-lg border bg-card p-3",
                                                        isUnread && "ring-1 ring-ring"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="truncate text-sm font-medium">
                                                                    {title}
                                                                </div>
                                                                {type ? (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {type}
                                                                    </Badge>
                                                                ) : null}
                                                                {isUnread ? (
                                                                    <Badge className="text-xs">Unread</Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        Read
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                                {msg || "—"}
                                                            </div>

                                                            {link ? (
                                                                <div className="mt-2">
                                                                    <Button variant="outline" size="sm" asChild>
                                                                        <Link to={link}>Open</Link>
                                                                    </Button>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            )}

                            <div className="mt-3 flex justify-end">
                                <Button variant="outline" asChild>
                                    <Link to="/dashboard/faculty/notifications" className="gap-2">
                                        <Bell className="h-4 w-4" />
                                        Open notifications
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Footer quick hints */}
                {!loading ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Quick Insights</CardTitle>
                            <CardDescription>
                                Helpful indicators based on your current data
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-lg border bg-card p-3">
                                <div className="text-sm font-medium">Total weekly minutes</div>
                                <div className="mt-1 text-2xl font-semibold">
                                    {formatMinutes(totals.weeklyMinutes)}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    From workload summary aggregation
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card p-3">
                                <div className="text-sm font-medium">Meetings count</div>
                                <div className="mt-1 text-2xl font-semibold">
                                    {scheduleTotals.meetingItems}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Total class meetings in your weekly schedule
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card p-3">
                                <div className="text-sm font-medium">Pending actions</div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <div className="text-2xl font-semibold">
                                        {pendingRequests + unreadCount}
                                    </div>
                                    <Badge
                                        variant={pendingRequests + unreadCount > 0 ? "default" : "secondary"}
                                    >
                                        {pendingRequests + unreadCount > 0 ? "Review" : "All clear"}
                                    </Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Unread notifications + pending requests
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </DashboardLayout>
    )
}
