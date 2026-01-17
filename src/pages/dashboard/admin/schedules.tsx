/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CalendarDays,
    CheckCircle2,
    Clock,
    Eye,
    FileLock2,
    MoreHorizontal,
    Plus,
    RefreshCcw,
    ShieldCheck,
    ShieldX,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

type ScheduleStatus = "Draft" | "Active" | "Locked" | "Archived" | (string & {})

type ScheduleVersionDoc = {
    $id: string
    $createdAt: string
    $updatedAt: string

    termId: string
    departmentId: string

    version: number
    label?: string | null
    status: ScheduleStatus

    createdBy: string
    lockedBy?: string | null
    lockedAt?: string | null

    notes?: string | null
}

type DepartmentDoc = {
    $id: string
    name?: string | null
    code?: string | null
    isActive?: boolean
}

type AcademicTermDoc = {
    $id: string
    schoolYear?: string | null
    semester?: string | null
    startDate?: string | null
    endDate?: string | null
    isActive?: boolean
    isLocked?: boolean
}

type TabKey = "all" | "Draft" | "Active" | "Locked" | "Archived"

function shortId(id: string) {
    if (!id) return ""
    return id.length <= 10 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`
}

function fmtDate(iso?: string | null) {
    if (!iso) return "—"
    try {
        const d = new Date(iso)
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d)
    } catch {
        return "—"
    }
}

function statusBadgeVariant(status: string) {
    const s = String(status || "").toLowerCase()
    if (s === "active") return "default"
    if (s === "locked") return "secondary"
    if (s === "archived") return "outline"
    return "outline" // Draft, unknown
}

function statusIcon(status: string) {
    const s = String(status || "").toLowerCase()
    if (s === "active") return ShieldCheck
    if (s === "locked") return FileLock2
    if (s === "archived") return ShieldX
    return Clock
}

function termLabel(t?: AcademicTermDoc | null) {
    if (!t) return "—"
    const sy = (t.schoolYear || "").trim()
    const sem = (t.semester || "").trim()
    const base = [sy, sem].filter(Boolean).join(" • ")
    const suffix = t.isActive ? " (Active)" : ""
    return (base || t.$id) + suffix
}

function deptLabel(d?: DepartmentDoc | null) {
    if (!d) return "—"
    const code = (d.code || "").trim()
    const name = (d.name || "").trim()
    if (code && name) return `${code} • ${name}`
    return name || code || d.$id
}

export default function AdminSchedulesPage() {
    const { user } = useSession()

    const userId = String(user?.$id || user?.id || "").trim()

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [versions, setVersions] = React.useState<ScheduleVersionDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])

    const [tab, setTab] = React.useState<TabKey>("all")
    const [search, setSearch] = React.useState("")

    const [filterTermId, setFilterTermId] = React.useState<string>("all")
    const [filterDeptId, setFilterDeptId] = React.useState<string>("all")

    const [viewOpen, setViewOpen] = React.useState(false)
    const [active, setActive] = React.useState<ScheduleVersionDoc | null>(null)

    const [createOpen, setCreateOpen] = React.useState(false)
    const [createTermId, setCreateTermId] = React.useState<string>("")
    const [createDeptId, setCreateDeptId] = React.useState<string>("")
    const [createLabel, setCreateLabel] = React.useState<string>("")
    const [createNotes, setCreateNotes] = React.useState<string>("")
    const [createSetActive, setCreateSetActive] = React.useState<boolean>(false)
    const [saving, setSaving] = React.useState(false)

    const termMap = React.useMemo(() => {
        const m = new Map<string, AcademicTermDoc>()
        terms.forEach((t) => m.set(t.$id, t))
        return m
    }, [terms])

    const deptMap = React.useMemo(() => {
        const m = new Map<string, DepartmentDoc>()
        departments.forEach((d) => m.set(d.$id, d))
        return m
    }, [departments])

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [vRes, tRes, dRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
                    Query.orderAsc("name"),
                    Query.limit(200),
                ]),
            ])

            const vDocs = (vRes?.documents ?? []) as any[]
            const tDocs = (tRes?.documents ?? []) as any[]
            const dDocs = (dRes?.documents ?? []) as any[]

            setVersions(vDocs as ScheduleVersionDoc[])
            setTerms(tDocs as AcademicTermDoc[])
            setDepartments(dDocs as DepartmentDoc[])
        } catch (e: any) {
            setError(e?.message || "Failed to load schedules.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()

        return versions.filter((v) => {
            const tabOk = tab === "all" ? true : String(v.status) === tab
            if (!tabOk) return false

            const termOk = filterTermId === "all" ? true : String(v.termId) === filterTermId
            if (!termOk) return false

            const deptOk = filterDeptId === "all" ? true : String(v.departmentId) === filterDeptId
            if (!deptOk) return false

            if (!q) return true

            const hay = [
                v.$id,
                v.termId,
                v.departmentId,
                v.label ?? "",
                v.status,
                String(v.version ?? ""),
                v.createdBy ?? "",
                v.notes ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [versions, tab, search, filterTermId, filterDeptId])

    const stats = React.useMemo(() => {
        const total = versions.length
        const draft = versions.filter((x) => String(x.status) === "Draft").length
        const activeCount = versions.filter((x) => String(x.status) === "Active").length
        const locked = versions.filter((x) => String(x.status) === "Locked").length
        const archived = versions.filter((x) => String(x.status) === "Archived").length
        return { total, draft, active: activeCount, locked, archived }
    }, [versions])

    const openView = (it: ScheduleVersionDoc) => {
        setActive(it)
        setViewOpen(true)
    }

    const nextVersionNumber = React.useMemo(() => {
        if (!createTermId || !createDeptId) return 1
        const list = versions.filter(
            (v) => String(v.termId) === createTermId && String(v.departmentId) === createDeptId
        )
        const max = list.reduce((acc, v) => Math.max(acc, Number(v.version || 0)), 0)
        return max + 1
    }, [versions, createTermId, createDeptId])

    const resetCreateForm = () => {
        setCreateTermId("")
        setCreateDeptId("")
        setCreateLabel("")
        setCreateNotes("")
        setCreateSetActive(false)
    }

    const createVersion = async () => {
        if (!createTermId) {
            toast.error("Please select an Academic Term.")
            return
        }
        if (!createDeptId) {
            toast.error("Please select a Department.")
            return
        }
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            const payload: any = {
                termId: createTermId,
                departmentId: createDeptId,
                version: nextVersionNumber,
                label: createLabel.trim() || `Version ${nextVersionNumber}`,
                status: createSetActive ? "Active" : "Draft",
                createdBy: userId,
                notes: createNotes.trim() || null,
            }

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SCHEDULE_VERSIONS,
                ID.unique(),
                payload
            )

            toast.success("Schedule version created")
            setCreateOpen(false)
            resetCreateForm()
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to create schedule version.")
        } finally {
            setSaving(false)
        }
    }

    const setStatus = async (it: ScheduleVersionDoc, next: ScheduleStatus) => {
        if (!it?.$id) return
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            // ✅ If setting Active: best effort to deactivate other Actives in same term+dept
            if (next === "Active") {
                const others = versions.filter(
                    (x) =>
                        x.$id !== it.$id &&
                        String(x.termId) === String(it.termId) &&
                        String(x.departmentId) === String(it.departmentId) &&
                        String(x.status) === "Active"
                )

                for (const o of others) {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            COLLECTIONS.SCHEDULE_VERSIONS,
                            o.$id,
                            { status: "Draft" }
                        )
                    } catch {
                        // ignore best-effort
                    }
                }
            }

            const payload: any = {
                status: next,
            }

            if (next === "Locked") {
                payload.lockedBy = userId
                payload.lockedAt = new Date().toISOString()
            }

            if (next !== "Locked") {
                // keep existing locked fields as-is (do not erase automatically)
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHEDULE_VERSIONS,
                it.$id,
                payload
            )

            toast.success(`Schedule set to ${next}`)
            setViewOpen(false)
            setActive(null)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update schedule status.")
        } finally {
            setSaving(false)
        }
    }

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchAll()}
                disabled={loading || saving}
            >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>

            <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                disabled={loading || saving}
            >
                <Plus className="mr-2 size-4" />
                New Version
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Schedules"
            subtitle="Manage schedule versions by term and department (Admin perspective)."
            actions={HeaderActions}
        >
            <div className="p-6 space-y-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                            <CardDescription>All versions</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Draft</CardTitle>
                            <CardDescription>In progress</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.draft}</CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Active</CardTitle>
                            <CardDescription>Current run</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Locked</CardTitle>
                            <CardDescription>No edits</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.locked}</CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Archived</CardTitle>
                            <CardDescription>Historical</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.archived}</CardContent>
                    </Card>
                </div>

                {/* Filters + List */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle>Schedule Versions</CardTitle>
                        <CardDescription>
                            Filter by term/department, search, and manage status.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <Tabs
                                value={tab}
                                onValueChange={(v) => setTab(v as TabKey)}
                                className="w-full lg:w-auto"
                            >
                                <TabsList className="grid w-full grid-cols-5 lg:w-auto">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="Draft">Draft</TabsTrigger>
                                    <TabsTrigger value="Active">Active</TabsTrigger>
                                    <TabsTrigger value="Locked">Locked</TabsTrigger>
                                    <TabsTrigger value="Archived">Archived</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="w-full lg:max-w-xl">
                                <Label className="sr-only" htmlFor="search">
                                    Search
                                </Label>
                                <Input
                                    id="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by label, status, termId, departmentId..."
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1">
                                <Label>Academic Term</Label>
                                <Select value={filterTermId} onValueChange={setFilterTermId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="All terms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All terms</SelectItem>
                                        {terms.map((t) => (
                                            <SelectItem key={t.$id} value={t.$id}>
                                                {termLabel(t)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Department</Label>
                                <Select value={filterDeptId} onValueChange={setFilterDeptId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="All departments" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departments.map((d) => (
                                            <SelectItem key={d.$id} value={d.$id}>
                                                {deptLabel(d)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end gap-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => {
                                        setTab("all")
                                        setSearch("")
                                        setFilterTermId("all")
                                        setFilterDeptId("all")
                                    }}
                                    disabled={loading || saving}
                                >
                                    Reset Filters
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-5/6" />
                            </div>
                        ) : error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : filtered.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-8 text-center">
                                <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                    <CalendarDays className="size-5" />
                                </div>
                                <div className="mt-3 font-medium">No schedule versions found</div>
                                <div className="text-sm text-muted-foreground">
                                    Try adjusting filters or creating a new version.
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Label</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Term</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead className="text-right">Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((it) => {
                                            const Icon = statusIcon(String(it.status))
                                            const term = termMap.get(String(it.termId)) ?? null
                                            const dept = deptMap.get(String(it.departmentId)) ?? null

                                            return (
                                                <TableRow key={it.$id} className="align-top">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="size-4 text-muted-foreground" />
                                                            <span className="truncate">
                                                                v{Number(it.version || 0)}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground truncate max-w-md">
                                                            {shortId(it.$id)}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        <div className="font-medium truncate max-w-md">
                                                            {it.label || "—"}
                                                        </div>
                                                        {it.notes ? (
                                                            <div className="mt-1 text-xs text-muted-foreground truncate max-w-md">
                                                                {it.notes}
                                                            </div>
                                                        ) : null}
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant={statusBadgeVariant(String(it.status))}>
                                                            {String(it.status)}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {term ? termLabel(term) : it.termId}
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {dept ? deptLabel(dept) : it.departmentId}
                                                    </TableCell>

                                                    <TableCell className="text-right text-sm">
                                                        {fmtDate(it.$createdAt)}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="rounded-xl"
                                                                >
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>

                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem onClick={() => openView(it)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    View details
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Active")}
                                                                    disabled={saving || String(it.status) === "Active"}
                                                                >
                                                                    <ShieldCheck className="mr-2 size-4" />
                                                                    Set Active
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Locked")}
                                                                    disabled={saving || String(it.status) === "Locked"}
                                                                >
                                                                    <FileLock2 className="mr-2 size-4" />
                                                                    Lock
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Archived")}
                                                                    disabled={saving || String(it.status) === "Archived"}
                                                                >
                                                                    <ShieldX className="mr-2 size-4" />
                                                                    Archive
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
                        )}
                    </CardContent>
                </Card>

                {/* View Dialog */}
                <Dialog
                    open={viewOpen}
                    onOpenChange={(v) => {
                        if (!v) setActive(null)
                        setViewOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Schedule Version</DialogTitle>
                            <DialogDescription>
                                Review schedule version information and manage status.
                            </DialogDescription>
                        </DialogHeader>

                        {!active ? (
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-1/3" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Version</CardTitle>
                                            <CardDescription>Schedule version number</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-2xl font-semibold">
                                            v{Number(active.version || 0)}
                                        </CardContent>
                                        <CardFooter className="pt-0 text-xs text-muted-foreground">
                                            {shortId(active.$id)}
                                        </CardFooter>
                                    </Card>

                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Status</CardTitle>
                                            <CardDescription>Current state</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Badge variant={statusBadgeVariant(String(active.status))}>
                                                {String(active.status)}
                                            </Badge>
                                        </CardContent>
                                        <CardFooter className="pt-0 text-xs text-muted-foreground">
                                            Updated: {fmtDate(active.$updatedAt)}
                                        </CardFooter>
                                    </Card>
                                </div>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Metadata</CardTitle>
                                        <CardDescription>Term + Department</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Label</span>
                                            <span className="font-medium">{active.label || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Term</span>
                                            <span className="font-medium">
                                                {termLabel(termMap.get(String(active.termId)) ?? null)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Department</span>
                                            <span className="font-medium">
                                                {deptLabel(deptMap.get(String(active.departmentId)) ?? null)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Created</span>
                                            <span className="font-medium">{fmtDate(active.$createdAt)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Created By</span>
                                            <span className="font-medium">{active.createdBy || "—"}</span>
                                        </div>

                                        <Separator />

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Locked By</span>
                                            <span className="font-medium">{active.lockedBy || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Locked At</span>
                                            <span className="font-medium">{fmtDate(active.lockedAt)}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {active.notes ? (
                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Notes</CardTitle>
                                            <CardDescription>Admin notes</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-sm leading-relaxed">
                                            {active.notes}
                                        </CardContent>
                                    </Card>
                                ) : null}

                                {String(active.status) === "Locked" ? (
                                    <Alert>
                                        <AlertTitle>Locked schedule</AlertTitle>
                                        <AlertDescription>
                                            This version is locked. You can still archive it, or set a different
                                            version as active.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </div>
                        )}

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setViewOpen(false)}
                                disabled={saving}
                            >
                                Close
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!active || saving || String(active?.status) === "Active"}
                                    onClick={() => active && void setStatus(active, "Active")}
                                >
                                    <CheckCircle2 className="mr-2 size-4" />
                                    Set Active
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={!active || saving || String(active?.status) === "Locked"}
                                    onClick={() => active && void setStatus(active, "Locked")}
                                >
                                    <FileLock2 className="mr-2 size-4" />
                                    Lock
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!active || saving || String(active?.status) === "Archived"}
                                    onClick={() => active && void setStatus(active, "Archived")}
                                >
                                    <ShieldX className="mr-2 size-4" />
                                    Archive
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Dialog */}
                <Dialog
                    open={createOpen}
                    onOpenChange={(v) => {
                        if (!v) resetCreateForm()
                        setCreateOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create Schedule Version</DialogTitle>
                            <DialogDescription>
                                Create a new schedule version for a specific term and department.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Academic Term</Label>
                                    <Select value={createTermId} onValueChange={setCreateTermId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select term" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {terms.map((t) => (
                                                <SelectItem key={t.$id} value={t.$id}>
                                                    {termLabel(t)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Department</Label>
                                    <Select value={createDeptId} onValueChange={setCreateDeptId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d) => (
                                                <SelectItem key={d.$id} value={d.$id}>
                                                    {deptLabel(d)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Label</Label>
                                    <Input
                                        value={createLabel}
                                        onChange={(e) => setCreateLabel(e.target.value)}
                                        placeholder={`Version ${nextVersionNumber}`}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        If empty, it will default to <span className="font-medium">Version {nextVersionNumber}</span>.
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Version Number</Label>
                                    <Input value={`v${nextVersionNumber}`} disabled />
                                    <div className="text-xs text-muted-foreground">
                                        Auto-calculated from existing versions.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    placeholder="Add notes about what changed in this version..."
                                    className="min-h-24"
                                />
                            </div>

                            <div className="flex items-center gap-3 rounded-xl border p-3">
                                <Checkbox
                                    id="setActive"
                                    checked={createSetActive}
                                    onCheckedChange={(v) => setCreateSetActive(Boolean(v))}
                                />
                                <Label htmlFor="setActive" className="cursor-pointer">
                                    Set this version as <span className="font-medium">Active</span> after creating
                                </Label>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                onClick={() => void createVersion()}
                                disabled={saving || !createTermId || !createDeptId}
                                className={cn(saving && "opacity-90")}
                            >
                                {saving ? (
                                    <>
                                        <RefreshCcw className="mr-2 size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 size-4" />
                                        Create Version
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
