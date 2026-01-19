/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    RefreshCw,
    Search,
    Eye,
    Copy,
    Download,
    Filter,
    X,
    CalendarDays,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { databases, DATABASE_ID, COLLECTIONS, Query } from "@/lib/db"
import type { AuditLogDoc } from "@/model/schemaModel"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { ScrollArea } from "@/components/ui/scroll-area"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

function safeJsonParse(v: any) {
    try {
        if (v === null || v === undefined) return null
        if (typeof v === "object") return v
        const s = String(v).trim()
        if (!s) return null
        return JSON.parse(s)
    } catch {
        return null
    }
}

function prettyJson(v: any) {
    try {
        if (v === null || v === undefined) return ""
        if (typeof v === "string") {
            const parsed = safeJsonParse(v)
            if (parsed) return JSON.stringify(parsed, null, 2)
            return v
        }
        return JSON.stringify(v, null, 2)
    } catch {
        return String(v ?? "")
    }
}

function shortId(id: string, head = 6, tail = 4) {
    const s = String(id || "")
    if (s.length <= head + tail + 3) return s
    return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function toIsoDayEnd(d: Date) {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x.toISOString()
}

function toIsoDayStart(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x.toISOString()
}

function actionBadgeVariant(action: string) {
    const a = String(action || "").toLowerCase()
    if (a.includes("delete") || a.includes("remove")) return "destructive"
    if (a.includes("create") || a.includes("add") || a.includes("invite")) return "default"
    if (a.includes("update") || a.includes("edit") || a.includes("change")) return "secondary"
    if (a.includes("login") || a.includes("auth") || a.includes("status")) return "outline"
    return "secondary"
}

function humanTime(iso: string) {
    try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return iso
        return d.toLocaleString()
    } catch {
        return iso
    }
}

function chunkArray<T>(arr: T[], size: number) {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export default function AdminAuditLogsPage() {
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [items, setItems] = React.useState<AuditLogDoc[]>([])
    const [total, setTotal] = React.useState<number>(0)
    const [lastRefreshAt, setLastRefreshAt] = React.useState<string | null>(null)

    const [queryText, setQueryText] = React.useState("")
    const [actorFilter, setActorFilter] = React.useState("")
    const [actionFilter, setActionFilter] = React.useState<string>("all")
    const [entityTypeFilter, setEntityTypeFilter] = React.useState<string>("all")

    const [fromDate, setFromDate] = React.useState<Date | undefined>(undefined)
    const [toDate, setToDate] = React.useState<Date | undefined>(undefined)

    const [selected, setSelected] = React.useState<AuditLogDoc | null>(null)

    const [pageSize, setPageSize] = React.useState<number>(25)
    const [page, setPage] = React.useState<number>(1)

    // ✅ NEW: actorId -> name/email map (resolved from USER_PROFILES)
    const [actorNameMap, setActorNameMap] = React.useState<Record<string, string>>({})

    const canResetFilters =
        Boolean(queryText.trim()) ||
        Boolean(actorFilter.trim()) ||
        actionFilter !== "all" ||
        entityTypeFilter !== "all" ||
        Boolean(fromDate) ||
        Boolean(toDate)

    const uniqueActions = React.useMemo(() => {
        const set = new Set<string>()
        items.forEach((it) => {
            const v = String((it as any)?.action ?? "").trim()
            if (v) set.add(v)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [items])

    const uniqueEntityTypes = React.useMemo(() => {
        const set = new Set<string>()
        items.forEach((it) => {
            const v = String((it as any)?.entityType ?? "").trim()
            if (v) set.add(v)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [items])

    const resolveActorLabel = React.useCallback(
        (actorUserId: string) => {
            const id = String(actorUserId || "").trim()
            if (!id) return "—"
            if (id === "SYSTEM") return "System"
            return actorNameMap[id] || "Unknown"
        },
        [actorNameMap]
    )

    const hydrateActorNames = React.useCallback(
        async (logs: AuditLogDoc[]) => {
            try {
                const actorIds = Array.from(
                    new Set(
                        logs
                            .map((it) => String((it as any)?.actorUserId ?? "").trim())
                            .filter(Boolean)
                    )
                ).filter((id) => id !== "SYSTEM")

                if (actorIds.length === 0) return

                // fetch only unknown actors
                const unknown = actorIds.filter((id) => !(id in actorNameMap))
                if (unknown.length === 0) return

                const nextMap: Record<string, string> = {}

                // batch to avoid long queries
                for (const chunk of chunkArray(unknown, 100)) {
                    const res: any = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.USER_PROFILES,
                        [
                            Query.equal("userId", chunk),
                            Query.limit(200),
                        ]
                    )

                    const docs = (res?.documents ?? []) as any[]
                    for (const d of docs) {
                        const uid = String(d?.userId ?? "").trim()
                        if (!uid) continue
                        const name = String(d?.name ?? "").trim()
                        const email = String(d?.email ?? "").trim()

                        // ✅ show friendly name first, fallback to email
                        nextMap[uid] = name || email || uid
                    }
                }

                if (Object.keys(nextMap).length > 0) {
                    setActorNameMap((prev) => ({ ...prev, ...nextMap }))
                }
            } catch {
                // ignore silently
            }
        },
        [actorNameMap]
    )

    const filtered = React.useMemo(() => {
        const q = queryText.trim().toLowerCase()
        const actorSearch = actorFilter.trim().toLowerCase()

        return items.filter((it) => {
            const action = String((it as any)?.action ?? "")
            const entityType = String((it as any)?.entityType ?? "")
            const entityId = String((it as any)?.entityId ?? "")
            const actorUserId = String((it as any)?.actorUserId ?? "")
            const createdAt = String((it as any)?.$createdAt ?? "")

            const actorName = resolveActorLabel(actorUserId)

            if (actionFilter !== "all" && action !== actionFilter) return false
            if (entityTypeFilter !== "all" && entityType !== entityTypeFilter) return false

            // ✅ Actor supports search by ID OR Name now
            if (actorSearch) {
                const hayActor = `${actorUserId} ${actorName}`.toLowerCase()
                if (!hayActor.includes(actorSearch)) return false
            }

            // date range (system $createdAt)
            if (fromDate) {
                if (createdAt < toIsoDayStart(fromDate)) return false
            }
            if (toDate) {
                if (createdAt > toIsoDayEnd(toDate)) return false
            }

            if (!q) return true

            const hay = [
                action,
                entityType,
                entityId,
                actorUserId,
                actorName,
                String((it as any)?.meta ?? ""),
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [
        items,
        queryText,
        actorFilter,
        actionFilter,
        entityTypeFilter,
        fromDate,
        toDate,
        resolveActorLabel,
    ])

    const paged = React.useMemo(() => {
        const start = (page - 1) * pageSize
        const end = start + pageSize
        return filtered.slice(start, end)
    }, [filtered, page, pageSize])

    const pageCount = React.useMemo(() => {
        return Math.max(1, Math.ceil(filtered.length / pageSize))
    }, [filtered.length, pageSize])

    React.useEffect(() => {
        if (page > pageCount) setPage(pageCount)
        if (page < 1) setPage(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageCount])

    const load = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const queries: string[] = [Query.orderDesc("$createdAt"), Query.limit(500)]

            // ✅ NOTE:
            // Actor filter is now client-side so it can match BOTH:
            // - actorUserId
            // - actorName
            // (server query can't filter actorName)
            if (actionFilter !== "all") queries.push(Query.equal("action", actionFilter))
            if (entityTypeFilter !== "all") queries.push(Query.equal("entityType", entityTypeFilter))

            if (fromDate) queries.push(Query.greaterThanEqual("$createdAt", toIsoDayStart(fromDate)))
            if (toDate) queries.push(Query.lessThanEqual("$createdAt", toIsoDayEnd(toDate)))

            const res: any = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.AUDIT_LOGS,
                queries
            )

            const docs = (res?.documents ?? []) as AuditLogDoc[]
            setItems(docs)
            setTotal(Number(res?.total ?? docs.length))
            setLastRefreshAt(new Date().toISOString())

            // ✅ NEW: resolve actor names
            void hydrateActorNames(docs)

            if (docs.length === 0) {
                toast.message("Audit Logs", { description: "No logs found." })
            }
        } catch (e: any) {
            const msg = String(e?.message ?? "Failed to load audit logs.")
            setError(msg)
            toast.error("Failed to load audit logs", { description: msg })
        } finally {
            setLoading(false)
        }
    }, [actionFilter, entityTypeFilter, fromDate, toDate, hydrateActorNames])

    React.useEffect(() => {
        void load()
    }, [load])

    React.useEffect(() => {
        setPage(1)
    }, [queryText, actorFilter, actionFilter, entityTypeFilter, fromDate, toDate, pageSize])

    const clearFilters = () => {
        setQueryText("")
        setActorFilter("")
        setActionFilter("all")
        setEntityTypeFilter("all")
        setFromDate(undefined)
        setToDate(undefined)
        setPage(1)
        toast.message("Filters cleared")
    }

    const copyText = async (text: string, label = "Copied") => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success(label)
        } catch {
            toast.error("Copy failed")
        }
    }

    const exportCsv = () => {
        try {
            const rows = filtered.map((it) => {
                const t = String((it as any)?.$createdAt ?? "")
                const actorUserId = String((it as any)?.actorUserId ?? "")
                const actorName = resolveActorLabel(actorUserId)
                const action = String((it as any)?.action ?? "")
                const entityType = String((it as any)?.entityType ?? "")
                const entityId = String((it as any)?.entityId ?? "")
                return {
                    time: t,
                    actorName,
                    actorUserId,
                    action,
                    entityType,
                    entityId,
                }
            })

            const headers = ["time", "actorName", "actorUserId", "action", "entityType", "entityId"]
            const csv = [
                headers.join(","),
                ...rows.map((r) =>
                    headers
                        .map((h) => {
                            const v = String((r as any)[h] ?? "")
                            const safe = v.replace(/"/g, '""')
                            return `"${safe}"`
                        })
                        .join(",")
                ),
            ].join("\n")

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
            const url = URL.createObjectURL(blob)

            const a = document.createElement("a")
            a.href = url
            a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()

            URL.revokeObjectURL(url)

            toast.success("Exported CSV")
        } catch (e: any) {
            toast.error("Export failed", { description: String(e?.message ?? "") })
        }
    }

    const stats = React.useMemo(() => {
        const now = Date.now()
        const last24h = items.filter((it) => {
            const t = new Date(String((it as any)?.$createdAt ?? "")).getTime()
            return Number.isFinite(t) && now - t <= 24 * 60 * 60 * 1000
        }).length

        const deletes = items.filter((it) =>
            String((it as any)?.action ?? "").toLowerCase().includes("delete")
        ).length

        const updates = items.filter((it) => {
            const a = String((it as any)?.action ?? "").toLowerCase()
            return a.includes("update") || a.includes("edit") || a.includes("change")
        }).length

        return { last24h, deletes, updates }
    }, [items])

    return (
        <DashboardLayout
            title="Audit Logs"
            subtitle="Track changes made by users (schedule edits, load edits, account actions)."
            actions={
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Export</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={exportCsv}>
                                Export filtered as CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardDescription>Total Loaded</CardDescription>
                            <CardTitle className="text-2xl">
                                {loading ? <Skeleton className="h-7 w-16" /> : items.length}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                            Appwrite total:{" "}
                            <span className="font-medium text-foreground">
                                {loading ? "…" : total}
                            </span>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardDescription>Last 24 hours</CardDescription>
                            <CardTitle className="text-2xl">
                                {loading ? <Skeleton className="h-7 w-16" /> : stats.last24h}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                            Recent activity spikes are easy to spot.
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardDescription>Updates / Changes</CardDescription>
                            <CardTitle className="text-2xl">
                                {loading ? <Skeleton className="h-7 w-16" /> : stats.updates}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                            Includes update/edit/change actions.
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardDescription>Deletes</CardDescription>
                            <CardTitle className="text-2xl">
                                {loading ? <Skeleton className="h-7 w-16" /> : stats.deletes}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                            Critical actions to monitor closely.
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Filters
                        </CardTitle>
                        <CardDescription>
                            Narrow logs by actor, action, entity type, date range, or keyword.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-12">
                            <div className="lg:col-span-4 space-y-2">
                                <Label>Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={queryText}
                                        onChange={(e) => setQueryText(e.target.value)}
                                        placeholder="Search action, entity, actor, meta…"
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-2">
                                <Label>Actor (ID or Name)</Label>
                                <Input
                                    value={actorFilter}
                                    onChange={(e) => setActorFilter(e.target.value)}
                                    placeholder="e.g. Ibrahim or 65ab…"
                                />
                            </div>

                            <div className="lg:col-span-2 space-y-2">
                                <Label>Action</Label>
                                <Select value={actionFilter} onValueChange={setActionFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All actions</SelectItem>
                                        {uniqueActions.map((a) => (
                                            <SelectItem key={a} value={a}>
                                                {a}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="lg:col-span-2 space-y-2">
                                <Label>Entity Type</Label>
                                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All entity types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All entity types</SelectItem>
                                        {uniqueEntityTypes.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="lg:col-span-2 space-y-2 min-w-0">
                                <Label>Date Range</Label>

                                {/* ✅ FIX: prevent horizontal overflow (stack on small screens) */}
                                <div className="grid grid-cols gap-2 sm:grid-cols-1 min-w-0">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full min-w-0 justify-start gap-2"
                                            >
                                                <CalendarDays className="h-4 w-4 shrink-0" />
                                                <span className="truncate">
                                                    {fromDate ? fromDate.toLocaleDateString() : "From"}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-2" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={fromDate}
                                                onSelect={setFromDate}
                                                autoFocus
                                            />
                                        </PopoverContent>
                                    </Popover>

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full min-w-0 justify-start gap-2"
                                            >
                                                <CalendarDays className="h-4 w-4 shrink-0" />
                                                <span className="truncate">
                                                    {toDate ? toDate.toLocaleDateString() : "To"}
                                                </span>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-2" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={toDate}
                                                onSelect={setToDate}
                                                autoFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="secondary">
                                    Showing {filtered.length} / {items.length} loaded
                                </Badge>
                                {lastRefreshAt ? (
                                    <span className="text-xs">
                                        Updated: {humanTime(lastRefreshAt)}
                                    </span>
                                ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground">Page size</Label>
                                    <Select
                                        value={String(pageSize)}
                                        onValueChange={(v) => setPageSize(Number(v))}
                                    >
                                        <SelectTrigger className="h-9 w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 25, 50, 100].map((n) => (
                                                <SelectItem key={n} value={String(n)}>
                                                    {n}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={clearFilters}
                                    disabled={!canResetFilters}
                                >
                                    <X className="h-4 w-4" />
                                    Clear
                                </Button>
                            </div>
                        </div>

                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Failed to load audit logs</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}
                    </CardContent>
                </Card>

                {/* Table */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Activity</CardTitle>
                        <CardDescription>
                            Click a row to inspect the before/after payloads.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-full" />
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <Alert>
                                <AlertTitle>No audit logs found</AlertTitle>
                                <AlertDescription>
                                    Try clearing filters or changing the date range.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <div className="rounded-xl border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-48">Time</TableHead>
                                                <TableHead className="w-60">Actor</TableHead>
                                                <TableHead className="w-40">Action</TableHead>
                                                <TableHead className="w-40">Entity</TableHead>
                                                <TableHead>Entity ID</TableHead>
                                                <TableHead className="w-20 text-right">
                                                    Menu
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {paged.map((it) => {
                                                const action = String((it as any)?.action ?? "")
                                                const entityType = String((it as any)?.entityType ?? "")
                                                const entityId = String((it as any)?.entityId ?? "")
                                                const actorUserId = String(
                                                    (it as any)?.actorUserId ?? ""
                                                )
                                                const actorName = resolveActorLabel(actorUserId)
                                                const t = String((it as any)?.$createdAt ?? "")

                                                return (
                                                    <TableRow
                                                        key={it.$id}
                                                        className="cursor-pointer"
                                                        onClick={() => setSelected(it)}
                                                    >
                                                        <TableCell className="text-sm">
                                                            {humanTime(t)}
                                                        </TableCell>

                                                        {/* ✅ UPDATED: Actor shows NAME + ID */}
                                                        <TableCell className="text-sm">
                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className="font-medium truncate">
                                                                        {actorName}
                                                                    </span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="font-mono shrink-0"
                                                                    >
                                                                        {shortId(actorUserId)}
                                                                    </Badge>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground font-mono truncate">
                                                                    {actorUserId || "—"}
                                                                </span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <Badge
                                                                variant={
                                                                    actionBadgeVariant(action) as any
                                                                }
                                                            >
                                                                {action || "—"}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <Badge variant="secondary">
                                                                {entityType || "—"}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="text-sm">
                                                            <span className="font-mono">
                                                                {shortId(entityId)}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <span className="sr-only">
                                                                            Open menu
                                                                        </span>
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent
                                                                    align="end"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <DropdownMenuLabel>
                                                                        Actions
                                                                    </DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />

                                                                    <DropdownMenuItem
                                                                        onClick={() => setSelected(it)}
                                                                        className="gap-2"
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                        View details
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            void copyText(
                                                                                it.$id,
                                                                                "Log ID copied"
                                                                            )
                                                                        }
                                                                        className="gap-2"
                                                                    >
                                                                        <Copy className="h-4 w-4" />
                                                                        Copy Log ID
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            void copyText(
                                                                                entityId,
                                                                                "Entity ID copied"
                                                                            )
                                                                        }
                                                                        className="gap-2"
                                                                    >
                                                                        <Copy className="h-4 w-4" />
                                                                        Copy Entity ID
                                                                    </DropdownMenuItem>

                                                                    <DropdownMenuSeparator />

                                                                    <DropdownMenuItem
                                                                        onClick={() => {
                                                                            const payload = {
                                                                                ...it,
                                                                                before: safeJsonParse(
                                                                                    (it as any)?.before
                                                                                ),
                                                                                after: safeJsonParse(
                                                                                    (it as any)?.after
                                                                                ),
                                                                                meta: safeJsonParse(
                                                                                    (it as any)?.meta
                                                                                ),
                                                                            }
                                                                            void copyText(
                                                                                JSON.stringify(payload, null, 2),
                                                                                "Log payload copied"
                                                                            )
                                                                        }}
                                                                        className="gap-2"
                                                                    >
                                                                        <Copy className="h-4 w-4" />
                                                                        Copy payload JSON
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                <Separator />

                                {/* Pagination */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm text-muted-foreground">
                                        Page{" "}
                                        <span className="font-medium text-foreground">{page}</span>{" "}
                                        of{" "}
                                        <span className="font-medium text-foreground">
                                            {pageCount}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page <= 1}
                                        >
                                            Prev
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setPage((p) => Math.min(pageCount, p + 1))
                                            }
                                            disabled={page >= pageCount}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ✅ Details Dialog */}
            <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
                {/* ✅ NEW: Reduced height + vertical scrollbar */}
                <DialogContent className="max-w-4xl p-0">
                    <ScrollArea className="max-h-[85vh] p-6">
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">
                                Audit Log Details
                                {selected?.$id ? (
                                    <Badge variant="outline" className="font-mono">
                                        {shortId(selected.$id)}
                                    </Badge>
                                ) : null}
                            </DialogTitle>

                            <DialogDescription>
                                Inspect the data captured during the change.
                            </DialogDescription>
                        </DialogHeader>

                        {selected ? (
                            <div className="space-y-4 mt-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Event</CardTitle>
                                            <CardDescription>What happened</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Time</span>
                                                <span className="font-medium">
                                                    {humanTime(String((selected as any)?.$createdAt ?? ""))}
                                                </span>
                                            </div>

                                            {/* ✅ UPDATED: Actor shows name + id */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Actor</span>
                                                <span className="text-right">
                                                    <span className="font-medium block">
                                                        {resolveActorLabel(String((selected as any)?.actorUserId ?? ""))}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground font-mono block">
                                                        {String((selected as any)?.actorUserId ?? "")}
                                                    </span>
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Action</span>
                                                <Badge
                                                    variant={actionBadgeVariant(
                                                        String((selected as any)?.action ?? "")
                                                    ) as any}
                                                >
                                                    {String((selected as any)?.action ?? "—")}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Entity</span>
                                                <span className="font-medium">
                                                    {String((selected as any)?.entityType ?? "—")}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-muted-foreground">Entity ID</span>
                                                <span className="font-medium font-mono">
                                                    {String((selected as any)?.entityId ?? "")}
                                                </span>
                                            </div>

                                            <Separator />

                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() =>
                                                        void copyText(selected.$id, "Log ID copied")
                                                    }
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy Log ID
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() =>
                                                        void copyText(
                                                            String((selected as any)?.entityId ?? ""),
                                                            "Entity ID copied"
                                                        )
                                                    }
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy Entity ID
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Meta</CardTitle>
                                            <CardDescription>Extra context (optional)</CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            {/* ✅ Reduced height */}
                                            <ScrollArea className="h-48 rounded-xl border p-3">
                                                <pre className="text-xs whitespace-pre-wrap break-words">
                                                    {prettyJson((selected as any)?.meta ?? "") || "—"}
                                                </pre>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm">Payload</CardTitle>
                                        <CardDescription>Before / After snapshots</CardDescription>
                                    </CardHeader>

                                    <CardContent>
                                        <Tabs defaultValue="after" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2">
                                                <TabsTrigger value="before">Before</TabsTrigger>
                                                <TabsTrigger value="after">After</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="before" className="mt-3">
                                                {/* ✅ Reduced height + still scrollable */}
                                                <ScrollArea className="h-56 rounded-xl border p-3">
                                                    <pre className="text-xs whitespace-pre-wrap break-words">
                                                        {prettyJson((selected as any)?.before ?? "") || "—"}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>

                                            <TabsContent value="after" className="mt-3">
                                                {/* ✅ Reduced height + still scrollable */}
                                                <ScrollArea className="h-56 rounded-xl border p-3">
                                                    <pre className="text-xs whitespace-pre-wrap break-words">
                                                        {prettyJson((selected as any)?.after ?? "") || "—"}
                                                    </pre>
                                                </ScrollArea>
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
