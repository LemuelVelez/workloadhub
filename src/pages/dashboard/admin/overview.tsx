/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
    ArrowRight,
    CalendarDays,
    Clock,
    Database,
    FileClock,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Users,
    AlertTriangle,
} from "lucide-react"
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
} from "recharts"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"
import { databases, DATABASE_ID, COLLECTIONS, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type CountSnapshot = {
    departments: number
    programs: number
    subjects: number
    rooms: number
    users: number
    schedules: number
    requests: number
    auditLogs: number
    notifications: number
}

type ActiveTerm = {
    id: string
    schoolYear?: string
    semester?: string
    isLocked?: boolean
}

type TrendPoint = { date: string; count: number }
type StatusPoint = { name: string; value: number }
type RolePoint = { role: string; value: number }
type AuditRow = { id: string; when: string; action?: string; entityType?: string; entityId?: string }

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
]

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function formatDay(isoLike: string) {
    // isoLike: YYYY-MM-DD
    const [y, m, d] = isoLike.split("-").map(Number)
    if (!y || !m || !d) return isoLike
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" })
}

function niceNumber(v: number) {
    try {
        return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v)
    } catch {
        return String(v)
    }
}

function SoftTooltip({
    active,
    payload,
    label,
    valueSuffix,
}: {
    active?: boolean
    payload?: any[]
    label?: string
    valueSuffix?: string
}) {
    if (!active || !payload?.length) return null

    const first = payload?.[0]
    const name = first?.name ?? "Value"
    const val = first?.value ?? 0

    return (
        <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-medium text-foreground">
                {name}: {niceNumber(val)}
                {valueSuffix ? <span className="text-muted-foreground"> {valueSuffix}</span> : null}
            </div>
        </div>
    )
}

function MetricCard({
    title,
    value,
    icon: Icon,
    hint,
    tone = "default",
    onClick,
    href,
}: {
    title: string
    value: string
    icon: React.ElementType
    hint?: string
    tone?: "default" | "success" | "warn"
    onClick?: () => void
    href?: string
}) {
    const Wrapper: any = href ? Link : "div"

    return (
        <Wrapper
            to={href}
            onClick={onClick}
            className={cn(
                "block min-w-0",
                href && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
            )}
        >
            <Card
                className={cn(
                    "h-full rounded-2xl transition hover:-translate-y-px hover:shadow-sm",
                    href && "cursor-pointer"
                )}
            >
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardDescription className="truncate">{title}</CardDescription>
                        <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
                        {hint ? (
                            <div className="mt-2 flex items-center gap-2">
                                <Badge
                                    variant={tone === "success" ? "default" : tone === "warn" ? "destructive" : "secondary"}
                                    className="rounded-full"
                                >
                                    {hint}
                                </Badge>
                            </div>
                        ) : null}
                    </div>

                    <div
                        className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-2xl border border-border",
                            tone === "success" && "bg-primary/10",
                            tone === "warn" && "bg-destructive/10"
                        )}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                </CardHeader>
            </Card>
        </Wrapper>
    )
}

async function countCollection(collectionId: string): Promise<number> {
    const res: any = await databases.listDocuments(DATABASE_ID, collectionId, [Query.limit(1)])
    const total = Number(res?.total)
    if (Number.isFinite(total)) return total
    const docs = Array.isArray(res?.documents) ? res.documents.length : 0
    return docs
}

function buildDateRange(days: number): string[] {
    const out: string[] = []
    const now = new Date()
    const start = new Date()
    start.setDate(now.getDate() - (days - 1))

    for (let i = 0; i < days; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        const iso = d.toISOString().slice(0, 10)
        out.push(iso)
    }
    return out
}

export default function AdminOverviewPage() {
    const navigate = useNavigate()

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [counts, setCounts] = React.useState<CountSnapshot>({
        departments: 0,
        programs: 0,
        subjects: 0,
        rooms: 0,
        users: 0,
        schedules: 0,
        requests: 0,
        auditLogs: 0,
        notifications: 0,
    })

    const [activeTerm, setActiveTerm] = React.useState<ActiveTerm | null>(null)

    const [scheduleTrend, setScheduleTrend] = React.useState<TrendPoint[]>([])
    const [requestStatus, setRequestStatus] = React.useState<StatusPoint[]>([])
    const [userRoles, setUserRoles] = React.useState<RolePoint[]>([])
    const [recentAudit, setRecentAudit] = React.useState<AuditRow[]>([])

    const [auditSearch, setAuditSearch] = React.useState("")
    const [openInsights, setOpenInsights] = React.useState(false)

    const filteredAudit = React.useMemo(() => {
        const q = auditSearch.trim().toLowerCase()
        if (!q) return recentAudit

        return recentAudit.filter((r) => {
            const hay = `${r.when} ${r.action ?? ""} ${r.entityType ?? ""} ${r.entityId ?? ""}`.toLowerCase()
            return hay.includes(q)
        })
    }, [auditSearch, recentAudit])

    const readinessScore = React.useMemo(() => {
        // quick meaningful score (safe even without deep backend data)
        const totalCore =
            counts.departments +
            counts.programs +
            counts.subjects +
            counts.rooms +
            counts.users +
            counts.schedules

        // scale 0..100
        const score = clamp(Math.round((totalCore / 120) * 100), 0, 100)
        return score
    }, [counts])

    const fetchAll = React.useCallback(async () => {
        setError(null)

        // Make refresh smoother (keep UI)
        setRefreshing(true)

        try {
            // ✅ Counts
            const [
                departments,
                programs,
                subjects,
                rooms,
                users,
                schedules,
                requests,
                auditLogs,
                notifications,
            ] = await Promise.all([
                countCollection(COLLECTIONS.DEPARTMENTS).catch(() => 0),
                countCollection(COLLECTIONS.PROGRAMS).catch(() => 0),
                countCollection(COLLECTIONS.SUBJECTS).catch(() => 0),
                countCollection(COLLECTIONS.ROOMS).catch(() => 0),
                countCollection(COLLECTIONS.USER_PROFILES).catch(() => 0),
                countCollection(COLLECTIONS.SCHEDULE_VERSIONS).catch(() => 0),
                countCollection(COLLECTIONS.CHANGE_REQUESTS).catch(() => 0),
                countCollection(COLLECTIONS.AUDIT_LOGS).catch(() => 0),
                countCollection(COLLECTIONS.NOTIFICATIONS).catch(() => 0),
            ])

            setCounts({
                departments,
                programs,
                subjects,
                rooms,
                users,
                schedules,
                requests,
                auditLogs,
                notifications,
            })

            // ✅ Active term (best effort)
            try {
                const termRes: any = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    [Query.equal("isActive", true), Query.limit(1)]
                )

                const t = termRes?.documents?.[0]
                if (t) {
                    setActiveTerm({
                        id: String(t?.$id),
                        schoolYear: t?.schoolYear,
                        semester: t?.semester,
                        isLocked: Boolean(t?.isLocked),
                    })
                } else {
                    setActiveTerm(null)
                }
            } catch {
                setActiveTerm(null)
            }

            // ✅ Schedule trend (last 14 days)
            try {
                const days = 14
                const range = buildDateRange(days)
                const fromIso = new Date(range[0] + "T00:00:00.000Z").toISOString()

                const sv: any = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.SCHEDULE_VERSIONS,
                    [Query.greaterThanEqual("$createdAt", fromIso), Query.orderAsc("$createdAt"), Query.limit(200)]
                )

                const map = new Map<string, number>()
                    ; (sv?.documents ?? []).forEach((d: any) => {
                        const day = String(d?.$createdAt ?? "").slice(0, 10)
                        if (!day) return
                        map.set(day, (map.get(day) ?? 0) + 1)
                    })

                setScheduleTrend(
                    range.map((date) => ({
                        date,
                        count: map.get(date) ?? 0,
                    }))
                )
            } catch {
                setScheduleTrend(buildDateRange(14).map((d) => ({ date: d, count: 0 })))
            }

            // ✅ Requests by status (best effort)
            try {
                const rr: any = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.CHANGE_REQUESTS,
                    [Query.orderDesc("$createdAt"), Query.limit(200)]
                )

                const map = new Map<string, number>()
                    ; (rr?.documents ?? []).forEach((d: any) => {
                        const status = String(d?.status ?? "Unknown").trim() || "Unknown"
                        map.set(status, (map.get(status) ?? 0) + 1)
                    })

                const rows = Array.from(map.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([name, value]) => ({ name, value }))

                setRequestStatus(rows.length ? rows : [{ name: "None", value: 0 }])
            } catch {
                setRequestStatus([{ name: "Unknown", value: 0 }])
            }

            // ✅ User role distribution (best effort)
            try {
                const ur: any = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.USER_PROFILES,
                    [Query.orderDesc("$createdAt"), Query.limit(250)]
                )

                const map = new Map<string, number>()
                    ; (ur?.documents ?? []).forEach((d: any) => {
                        const role = String(d?.role ?? "USER").trim() || "USER"
                        map.set(role, (map.get(role) ?? 0) + 1)
                    })

                const rows = Array.from(map.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([role, value]) => ({ role, value }))

                setUserRoles(rows.length ? rows : [{ role: "USER", value: 0 }])
            } catch {
                setUserRoles([{ role: "USER", value: 0 }])
            }

            // ✅ Recent audit log activity (best effort)
            try {
                const al: any = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.AUDIT_LOGS,
                    [Query.orderDesc("$createdAt"), Query.limit(10)]
                )

                const rows: AuditRow[] = (al?.documents ?? []).map((d: any) => ({
                    id: String(d?.$id),
                    when: String(d?.$createdAt ?? ""),
                    action: d?.action ? String(d.action) : undefined,
                    entityType: d?.entityType ? String(d.entityType) : undefined,
                    entityId: d?.entityId ? String(d.entityId) : undefined,
                }))

                setRecentAudit(rows)
            } catch {
                setRecentAudit([])
            }

            toast.success("Overview updated")
        } catch (e: any) {
            setError(e?.message ?? "Failed to load overview data")
            toast.error("Failed to load overview")
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    return (
        <DashboardLayout
            title="Admin Overview"
            subtitle="System readiness, scheduling activity, and operational snapshots."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        className="rounded-2xl"
                        onClick={() => setOpenInsights(true)}
                    >
                        <Sparkles className="h-4 w-4" />
                        Insights
                    </Button>

                    <Button
                        className="rounded-2xl"
                        onClick={() => void fetchAll()}
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <Dialog open={openInsights} onOpenChange={setOpenInsights}>
                <DialogContent className="rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>System Insights</DialogTitle>
                        <DialogDescription>
                            Quick interpretation of your current setup, based on available data.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="text-base">Readiness Score</CardTitle>
                                <CardDescription>Higher score means the system is more “setup-complete”.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">Current score</div>
                                    <Badge className="rounded-full">{readinessScore}%</Badge>
                                </div>
                                <Progress value={readinessScore} />
                                <div className="text-xs text-muted-foreground">
                                    Tip: increasing Master Data + Users + Schedules increases readiness.
                                </div>
                            </CardContent>
                        </Card>

                        <Alert className="rounded-2xl">
                            <ShieldCheck className="h-4 w-4" />
                            <AlertTitle>Admin Tip</AlertTitle>
                            <AlertDescription>
                                Keep your <span className="font-medium">Academic Term</span> active and locked before finalizing schedules,
                                so all changes are traceable in <span className="font-medium">Audit Logs</span>.
                            </AlertDescription>
                        </Alert>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="min-w-0 p-6 space-y-6">
                {/* ✅ Top Status Row */}
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                        Environment: Production-like
                    </Badge>

                    {activeTerm ? (
                        <>
                            <Badge className="rounded-full">
                                Term: {activeTerm.schoolYear ?? "—"} • {activeTerm.semester ?? "—"}
                            </Badge>
                            <Badge
                                variant={activeTerm.isLocked ? "default" : "destructive"}
                                className="rounded-full"
                            >
                                {activeTerm.isLocked ? "Locked" : "Not locked"}
                            </Badge>
                        </>
                    ) : (
                        <Badge variant="destructive" className="rounded-full">
                            No active academic term
                        </Badge>
                    )}
                </div>

                {error ? (
                    <Alert variant="destructive" className="rounded-2xl">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Unable to load overview</AlertTitle>
                        <AlertDescription className="wrap-break-word">{error}</AlertDescription>
                    </Alert>
                ) : null}

                {/* ✅ KPI Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {loading ? (
                        <>
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                            <Skeleton className="h-32 rounded-2xl" />
                        </>
                    ) : (
                        <>
                            <MetricCard
                                title="Users"
                                value={niceNumber(counts.users)}
                                icon={Users}
                                hint="Manage"
                                tone="success"
                                href="/dashboard/admin/users"
                            />
                            <MetricCard
                                title="Master Data"
                                value={niceNumber(counts.departments + counts.programs + counts.subjects + counts.rooms)}
                                icon={Database}
                                hint="Maintain"
                                href="/dashboard/admin/master-data-management"
                            />
                            <MetricCard
                                title="Schedule Versions"
                                value={niceNumber(counts.schedules)}
                                icon={CalendarDays}
                                hint="Review"
                                href="/dashboard/admin/schedules"
                            />
                            <MetricCard
                                title="Change Requests"
                                value={niceNumber(counts.requests)}
                                icon={Clock}
                                hint="Handle"
                                href="/dashboard/admin/requests"
                            />
                        </>
                    )}
                </div>

                <Separator />

                {/* ✅ Charts */}
                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Schedule Trend */}
                    <Card className="rounded-2xl lg:col-span-2">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="truncate">Scheduling Activity</CardTitle>
                                <CardDescription className="truncate">
                                    Schedule versions created in the last 14 days.
                                </CardDescription>
                            </div>

                            <Button
                                variant="secondary"
                                className="rounded-2xl"
                                onClick={() => navigate("/dashboard/admin/schedules")}
                            >
                                Open
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardHeader>

                        <CardContent>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={scheduleTrend} margin={{ left: 8, right: 8 }}>
                                        <defs>
                                            <linearGradient id="svFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                                                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>

                                        <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />

                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatDay}
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                            axisLine={{ stroke: "var(--border)" }}
                                            tickLine={{ stroke: "var(--border)" }}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                            axisLine={{ stroke: "var(--border)" }}
                                            tickLine={{ stroke: "var(--border)" }}
                                        />

                                        <RechartsTooltip
                                            content={(p: any) => (
                                                <SoftTooltip
                                                    active={p?.active}
                                                    payload={p?.payload}
                                                    label={p?.label ? formatDay(String(p.label)) : ""}
                                                    valueSuffix="versions"
                                                />
                                            )}
                                        />

                                        <Area
                                            type="monotone"
                                            dataKey="count"
                                            name="Versions"
                                            stroke="var(--chart-1)"
                                            strokeWidth={2}
                                            fill="url(#svFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Requests Status */}
                    <Card className="rounded-2xl">
                        <CardHeader>
                            <CardTitle>Requests Status</CardTitle>
                            <CardDescription>Distribution from latest requests.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={requestStatus} margin={{ left: 8, right: 8 }}>
                                        <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                                            axisLine={{ stroke: "var(--border)" }}
                                            tickLine={{ stroke: "var(--border)" }}
                                            interval={0}
                                            height={50}
                                            angle={-12}
                                            textAnchor="end"
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                                            axisLine={{ stroke: "var(--border)" }}
                                            tickLine={{ stroke: "var(--border)" }}
                                        />
                                        <RechartsTooltip
                                            content={(p: any) => (
                                                <SoftTooltip
                                                    active={p?.active}
                                                    payload={p?.payload}
                                                    label={p?.label ? String(p.label) : ""}
                                                    valueSuffix="requests"
                                                />
                                            )}
                                        />
                                        <Bar dataKey="value" name="Requests" radius={[10, 10, 0, 0]} fill="var(--chart-2)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ✅ Lower Panel */}
                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Roles Pie */}
                    <Card className="rounded-2xl">
                        <CardHeader>
                            <CardTitle>User Roles</CardTitle>
                            <CardDescription>Top roles from user profiles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <RechartsTooltip
                                            content={(p: any) => {
                                                if (!p?.active || !p?.payload?.length) return null
                                                const x = p.payload[0]?.payload
                                                return (
                                                    <SoftTooltip
                                                        active
                                                        payload={[{ name: x?.role ?? "Role", value: x?.value ?? 0 }]}
                                                        label="Role"
                                                        valueSuffix="users"
                                                    />
                                                )
                                            }}
                                        />
                                        <Pie
                                            data={userRoles}
                                            dataKey="value"
                                            nameKey="role"
                                            innerRadius={52}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            stroke="var(--border)"
                                            strokeWidth={1}
                                        >
                                            {userRoles.map((_, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-2">
                                {userRoles.slice(0, 5).map((r, i) => (
                                    <div key={r.role} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                            />
                                            <span className="truncate text-sm">{r.role}</span>
                                        </div>
                                        <Badge variant="secondary" className="rounded-full">
                                            {niceNumber(r.value)}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Audit */}
                    <Card className="rounded-2xl lg:col-span-2">
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="truncate">Recent Audit Activity</CardTitle>
                                <CardDescription className="truncate">
                                    Latest actions recorded in your system logs.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="grid gap-1">
                                    <Label htmlFor="auditSearch" className="text-xs text-muted-foreground">
                                        Search
                                    </Label>
                                    <Input
                                        id="auditSearch"
                                        value={auditSearch}
                                        onChange={(e) => setAuditSearch(e.target.value)}
                                        placeholder="e.g. DELETE, USER_PROFILES, settings..."
                                        className="h-9 rounded-2xl"
                                    />
                                </div>

                                <Button
                                    variant="secondary"
                                    className="rounded-2xl"
                                    onClick={() => navigate("/dashboard/admin/audit-logs")}
                                >
                                    <FileClock className="h-4 w-4" />
                                    Audit Logs
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 rounded-2xl" />
                                    <Skeleton className="h-10 rounded-2xl" />
                                    <Skeleton className="h-10 rounded-2xl" />
                                </div>
                            ) : filteredAudit.length === 0 ? (
                                <Alert className="rounded-2xl">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>No items</AlertTitle>
                                    <AlertDescription>
                                        No audit rows match your search (or no logs exist yet).
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="space-y-2">
                                    {filteredAudit.slice(0, 8).map((r) => {
                                        const whenShort =
                                            r.when && r.when.length > 10
                                                ? new Date(r.when).toLocaleString(undefined, {
                                                    month: "short",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })
                                                : r.when

                                        return (
                                            <div
                                                key={r.id}
                                                className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge className="rounded-full" variant="secondary">
                                                            {r.action ?? "ACTION"}
                                                        </Badge>
                                                        <span className="text-sm font-medium truncate">
                                                            {r.entityType ?? "ENTITY"}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground truncate">
                                                        {r.entityId ? `ID: ${r.entityId}` : "No entity id"}
                                                    </div>
                                                </div>

                                                <div className="text-xs text-muted-foreground">{whenShort}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ✅ Quick actions */}
                <Card className="rounded-2xl">
                    <CardHeader>
                        <CardTitle>Quick Admin Actions</CardTitle>
                        <CardDescription>Jump directly to your most used tools.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        <Button className="rounded-2xl" onClick={() => navigate("/dashboard/admin/users")}>
                            <Users className="h-4 w-4" />
                            Manage Users
                        </Button>

                        <Button
                            variant="secondary"
                            className="rounded-2xl"
                            onClick={() => navigate("/dashboard/admin/master-data-management")}
                        >
                            <Database className="h-4 w-4" />
                            Master Data
                        </Button>

                        <Button
                            variant="secondary"
                            className="rounded-2xl"
                            onClick={() => navigate("/dashboard/admin/academic-term-setup")}
                        >
                            <CalendarDays className="h-4 w-4" />
                            Academic Term
                        </Button>

                        <Button
                            variant="secondary"
                            className="rounded-2xl"
                            onClick={() => navigate("/dashboard/admin/requests")}
                        >
                            <Clock className="h-4 w-4" />
                            Requests
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
