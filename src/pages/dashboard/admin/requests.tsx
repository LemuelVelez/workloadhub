/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CheckCircle2,
    Clock,
    Eye,
    MoreHorizontal,
    RefreshCcw,
    XCircle,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"

import { databases, DATABASE_ID, COLLECTIONS, Query } from "@/lib/db"

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

type ChangeRequestStatus =
    | "Pending"
    | "Approved"
    | "Rejected"
    | "Cancelled"
    | (string & {})

type ChangeRequestDoc = {
    $id: string
    $createdAt: string
    $updatedAt: string

    termId: string
    departmentId: string
    requestedBy: string

    classId?: string | null
    meetingId?: string | null

    type: string
    details: string
    status: ChangeRequestStatus

    reviewedBy?: string | null
    reviewedAt?: string | null
    resolutionNotes?: string | null
}

type TabKey = "all" | "Pending" | "Approved" | "Rejected" | "Cancelled"

function safeParsePrefs(prefs: any) {
    if (!prefs) return {}
    if (typeof prefs === "string") {
        try {
            const parsed = JSON.parse(prefs)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }
    if (typeof prefs === "object") return prefs
    return {}
}

function resolveRole(user: any) {
    const rawPrefs =
        user?.prefs ??
        user?.preferences ??
        user?.profile?.prefs ??
        user?.profile?.preferences ??
        {}

    const prefs = safeParsePrefs(rawPrefs)

    const roleCandidates: string[] = []
    const push = (v: any) => {
        if (typeof v === "string" && v.trim()) roleCandidates.push(v.trim())
    }

    push(prefs?.role)
    push(prefs?.userRole)
    push(user?.role)
    push(user?.userRole)

    const all = roleCandidates.join(" ").toLowerCase()
    if (all.includes("superadmin") || all.includes("admin")) return "admin"
    return "user"
}

function shortId(id: string) {
    if (!id) return ""
    return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`
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
    if (s === "approved") return "default"
    if (s === "rejected") return "destructive"
    if (s === "cancelled") return "secondary"
    return "outline"
}

function statusIcon(status: string) {
    const s = String(status || "").toLowerCase()
    if (s === "approved") return CheckCircle2
    if (s === "rejected") return XCircle
    return Clock
}

export default function AdminRequestsPage() {
    const { user } = useSession()
    const isAdmin = resolveRole(user) === "admin"

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [tab, setTab] = React.useState<TabKey>("Pending")
    const [search, setSearch] = React.useState("")

    const [items, setItems] = React.useState<ChangeRequestDoc[]>([])

    const [viewOpen, setViewOpen] = React.useState(false)
    const [active, setActive] = React.useState<ChangeRequestDoc | null>(null)

    const [resolutionNotes, setResolutionNotes] = React.useState("")
    const [saving, setSaving] = React.useState(false)

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()

        return items.filter((it) => {
            const statusOk = tab === "all" ? true : String(it.status) === tab

            if (!statusOk) return false
            if (!q) return true

            const hay = [
                it.$id,
                it.type,
                it.details,
                it.status,
                it.requestedBy,
                it.departmentId,
                it.termId,
                it.classId ?? "",
                it.meetingId ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [items, tab, search])

    const stats = React.useMemo(() => {
        const total = items.length
        const pending = items.filter((x) => String(x.status) === "Pending").length
        const approved = items.filter((x) => String(x.status) === "Approved").length
        const rejected = items.filter((x) => String(x.status) === "Rejected").length
        const cancelled = items.filter((x) => String(x.status) === "Cancelled").length

        return { total, pending, approved, rejected, cancelled }
    }, [items])

    const fetchRequests = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.CHANGE_REQUESTS,
                [Query.orderDesc("$createdAt"), Query.limit(200)]
            )

            const docs = (res?.documents ?? []) as any[]
            setItems(docs as ChangeRequestDoc[])
        } catch (e: any) {
            setError(e?.message || "Failed to load requests.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchRequests()
    }, [fetchRequests])

    const openView = (it: ChangeRequestDoc) => {
        setActive(it)
        setResolutionNotes(it?.resolutionNotes ?? "")
        setViewOpen(true)
    }

    const updateStatus = async (next: ChangeRequestStatus, notes?: string) => {
        if (!active) return
        if (!isAdmin) {
            toast.error("Only Admin can review requests.")
            return
        }

        setSaving(true)

        try {
            const payload: any = {
                status: next,
                reviewedBy: String(user?.$id || user?.id || "").trim() || null,
                reviewedAt: new Date().toISOString(),
                resolutionNotes: typeof notes === "string" ? notes : resolutionNotes,
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.CHANGE_REQUESTS,
                active.$id,
                payload
            )

            toast.success(`Request ${next}`)
            setViewOpen(false)
            setActive(null)
            await fetchRequests()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update request.")
        } finally {
            setSaving(false)
        }
    }

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchRequests()}
                disabled={loading}
            >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Requests"
            subtitle="Review schedule change requests submitted by faculty and schedulers."
            actions={HeaderActions}
        >
            <div className="p-6 space-y-6">
                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                            <CardDescription>All requests</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {stats.total}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Pending</CardTitle>
                            <CardDescription>Needs review</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {stats.pending}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Approved</CardTitle>
                            <CardDescription>Accepted</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {stats.approved}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                            <CardDescription>Declined</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {stats.rejected}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                            <CardDescription>Withdrawn</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {stats.cancelled}
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle>Change Requests</CardTitle>
                        <CardDescription>Filter, search, and review requests.</CardDescription>
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
                                    <TabsTrigger value="Pending">Pending</TabsTrigger>
                                    <TabsTrigger value="Approved">Approved</TabsTrigger>
                                    <TabsTrigger value="Rejected">Rejected</TabsTrigger>
                                    <TabsTrigger value="Cancelled">Cancelled</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="w-full lg:max-w-md">
                                <Label className="sr-only" htmlFor="search">
                                    Search
                                </Label>
                                <Input
                                    id="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by type, details, userId, term, department..."
                                />
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
                                    <Clock className="size-5" />
                                </div>
                                <div className="mt-3 font-medium">No requests found</div>
                                <div className="text-sm text-muted-foreground">
                                    Try switching tabs or changing your search query.
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Request</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Requested By</TableHead>
                                            <TableHead>Term</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead className="text-right">Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((it) => {
                                            const Icon = statusIcon(String(it.status))
                                            return (
                                                <TableRow key={it.$id} className="align-top">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="size-4 text-muted-foreground" />
                                                            <span className="truncate">{shortId(it.$id)}</span>
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground truncate max-w-md">
                                                            {it.details}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <span className="text-sm">{it.type || "—"}</span>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant={statusBadgeVariant(String(it.status))}>
                                                            {String(it.status)}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {it.requestedBy || "—"}
                                                    </TableCell>

                                                    <TableCell className="text-sm">{it.termId || "—"}</TableCell>

                                                    <TableCell className="text-sm">
                                                        {it.departmentId || "—"}
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
                                                            <DropdownMenuContent align="end" className="w-52">
                                                                <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem onClick={() => openView(it)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    View details
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setActive(it)
                                                                        setResolutionNotes(it?.resolutionNotes ?? "")
                                                                        setViewOpen(true)
                                                                    }}
                                                                    className={cn(
                                                                        !isAdmin && "opacity-50 pointer-events-none"
                                                                    )}
                                                                >
                                                                    <CheckCircle2 className="mr-2 size-4" />
                                                                    Review / Decide
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

                {/* View / Review Dialog */}
                <Dialog
                    open={viewOpen}
                    onOpenChange={(v) => {
                        if (!v) {
                            setActive(null)
                            setResolutionNotes("")
                        }
                        setViewOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Request Details</DialogTitle>
                            <DialogDescription>
                                Review the request information and take action (Admin only).
                            </DialogDescription>
                        </DialogHeader>

                        {!active ? (
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-1/2" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Request ID</CardTitle>
                                            <CardDescription>Appwrite document</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-sm font-medium">{active.$id}</CardContent>
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
                                    </Card>
                                </div>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Summary</CardTitle>
                                        <CardDescription>Request metadata</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Type</span>
                                            <span className="font-medium">{active.type || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Requested By</span>
                                            <span className="font-medium">{active.requestedBy || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Term</span>
                                            <span className="font-medium">{active.termId || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Department</span>
                                            <span className="font-medium">{active.departmentId || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Class ID</span>
                                            <span className="font-medium">{active.classId || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Meeting ID</span>
                                            <span className="font-medium">{active.meetingId || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Created</span>
                                            <span className="font-medium">{fmtDate(active.$createdAt)}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Details</CardTitle>
                                        <CardDescription>What the requester wants to change</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm leading-relaxed">{active.details || "—"}</CardContent>
                                </Card>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Resolution Notes</Label>
                                    <Input
                                        id="notes"
                                        value={resolutionNotes}
                                        onChange={(e) => setResolutionNotes(e.target.value)}
                                        placeholder="Add admin notes (optional)"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        This note will be saved to{" "}
                                        <span className="font-medium">resolutionNotes</span>.
                                    </div>
                                </div>

                                {active.reviewedAt ? (
                                    <Alert>
                                        <AlertTitle>Previously reviewed</AlertTitle>
                                        <AlertDescription>
                                            Reviewed at{" "}
                                            <span className="font-medium">{fmtDate(active.reviewedAt)}</span>
                                            {active.reviewedBy ? (
                                                <>
                                                    {" "}
                                                    by <span className="font-medium">{active.reviewedBy}</span>.
                                                </>
                                            ) : null}
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
                                    variant="destructive"
                                    disabled={!isAdmin || !active || saving}
                                    onClick={() => void updateStatus("Rejected")}
                                >
                                    <XCircle className="mr-2 size-4" />
                                    Reject
                                </Button>

                                <Button
                                    type="button"
                                    disabled={!isAdmin || !active || saving}
                                    onClick={() => void updateStatus("Approved")}
                                >
                                    <CheckCircle2 className="mr-2 size-4" />
                                    Approve
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
