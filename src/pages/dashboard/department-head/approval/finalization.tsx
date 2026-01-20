/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"

import {
    Plus,
    RefreshCcw,
    MoreHorizontal,
    BadgeCheck,
    Lock,
    Archive,
    ArrowUpRight,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"
import { departmentHeadApi } from "@/api/department-head"

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
    DialogTrigger,
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

type AnyRow = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

type VersionStatus = "Draft" | "Active" | "Locked" | "Archived" | (string & {})

type VersionRow = AnyRow & {
    termId: string
    departmentId: string
    version: number
    label?: string | null
    status: VersionStatus
    createdBy?: string | null
    lockedBy?: string | null
    lockedAt?: string | null
    notes?: string | null
}

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

type RequestTabKey = "all" | "Pending" | "Approved" | "Rejected" | "Cancelled"

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function formatMaybeIso(iso: any) {
    const s = safeStr(iso)
    if (!s) return "-"
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString()
}

function statusBadgeVariant(status: string) {
    const s = safeStr(status)
    if (s === "Active") return "default"
    if (s === "Locked") return "destructive"
    if (s === "Archived") return "secondary"
    return "outline"
}

function reqBadgeVariant(status: string) {
    const s = safeStr(status).toLowerCase()
    if (s === "approved") return "default"
    if (s === "rejected") return "destructive"
    if (s === "cancelled") return "secondary"
    if (s === "pending") return "outline"
    return "outline"
}

function reqIcon(status: string) {
    const s = safeStr(status).toLowerCase()
    if (s === "approved") return CheckCircle2
    if (s === "rejected") return XCircle
    return Clock
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

/**
 * ✅ Fetch names for requestedBy / reviewedBy by loading Profiles collection.
 */
function getProfilesCollectionId() {
    const c: any = COLLECTIONS as any
    return (
        c.USER_PROFILES ??
        c.PROFILES ??
        c.USER_PROFILE ??
        c.FACULTY_PROFILES ??
        c.PROFILE ??
        ""
    )
}

const COPY_NONE = "__none__"

export default function DepartmentHeadFinalizationPage() {
    const { user } = useSession()

    const userId = React.useMemo(() => {
        return safeStr(user?.$id || user?.id || user?.userId)
    }, [user])

    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)

    const [activeTerm, setActiveTerm] = React.useState<AnyRow | null>(null)
    const [departmentId, setDepartmentId] = React.useState<string>("")

    // ✅ NEW: department row (to show name)
    const [departmentRow, setDepartmentRow] = React.useState<AnyRow | null>(null)

    const [versions, setVersions] = React.useState<VersionRow[]>([])
    const [search, setSearch] = React.useState("")

    // ✅ Change Requests
    const [reqLoading, setReqLoading] = React.useState(false)
    const [reqError, setReqError] = React.useState<string | null>(null)
    const [reqTab, setReqTab] = React.useState<RequestTabKey>("Pending")
    const [reqSearch, setReqSearch] = React.useState("")
    const [reqItems, setReqItems] = React.useState<ChangeRequestDoc[]>([])

    // ✅ map userId -> name
    const [userNameMap, setUserNameMap] = React.useState<Record<string, string>>({})

    // View / Review Request Dialog
    const [reqViewOpen, setReqViewOpen] = React.useState(false)
    const [activeReq, setActiveReq] = React.useState<ChangeRequestDoc | null>(null)
    const [reqNotes, setReqNotes] = React.useState("")
    const [reqSaving, setReqSaving] = React.useState(false)

    // Create Version Dialog
    const [createOpen, setCreateOpen] = React.useState(false)
    const [newLabel, setNewLabel] = React.useState("")
    const [newNotes, setNewNotes] = React.useState("")
    const [copyFromVersionId, setCopyFromVersionId] = React.useState<string>(COPY_NONE)
    const [setActiveAfterCreate, setSetActiveAfterCreate] = React.useState(true)

    type PendingAction =
        | null
        | { type: "activate" | "lock" | "archive"; versionId: string }

    const [actionOpen, setActionOpen] = React.useState(false)
    const [pending, setPending] = React.useState<PendingAction>(null)
    const [actionNotes, setActionNotes] = React.useState("")

    const termId = safeStr(activeTerm?.$id)
    const hasContext = Boolean(termId && departmentId && userId)

    const activeVersion = React.useMemo(() => {
        return versions.find((v) => safeStr(v.status) === "Active") ?? null
    }, [versions])

    const filteredVersions = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return versions

        return versions.filter((v) => {
            const hay = [
                String(v.version ?? ""),
                safeStr(v.label),
                safeStr(v.status),
                safeStr(v.notes),
                safeStr(v.$id),
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [versions, search])

    const filteredReqs = React.useMemo(() => {
        const q = reqSearch.trim().toLowerCase()

        return reqItems.filter((it) => {
            const statusOk = reqTab === "all" ? true : safeStr(it.status) === reqTab
            if (!statusOk) return false
            if (!q) return true

            const requestedByName = safeStr(userNameMap[safeStr(it.requestedBy)] || "")

            const hay = [
                it.$id,
                it.type,
                it.details,
                it.status,
                it.requestedBy,
                requestedByName,
                it.classId ?? "",
                it.meetingId ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [reqItems, reqTab, reqSearch, userNameMap])

    function resolveUserName(id: any) {
        const k = safeStr(id)
        if (!k) return "—"
        return userNameMap[k] || k
    }

    async function hydrateUserNames(changeReqDocs: ChangeRequestDoc[]) {
        const collectionId = getProfilesCollectionId()
        if (!collectionId) return

        const ids = Array.from(
            new Set(
                changeReqDocs
                    .flatMap((x) => [safeStr(x.requestedBy), safeStr(x.reviewedBy)])
                    .filter(Boolean)
            )
        )

        if (ids.length === 0) return

        const map: Record<string, string> = {}

        try {
            for (const part of chunk(ids, 50)) {
                const res = await databases.listDocuments(
                    DATABASE_ID,
                    collectionId,
                    [Query.equal("userId", part), Query.limit(200)]
                )

                for (const p of (res?.documents ?? []) as any[]) {
                    const uid = safeStr(p?.userId || p?.$id)
                    const name =
                        safeStr(p?.name) ||
                        safeStr(p?.fullName) ||
                        safeStr(p?.displayName) ||
                        safeStr(`${p?.firstName || ""} ${p?.lastName || ""}`)

                    if (uid) map[uid] = name || uid
                }
            }

            const missing = ids.filter((x) => !map[x])
            if (missing.length) {
                for (const part of chunk(missing, 50)) {
                    try {
                        const res2 = await databases.listDocuments(
                            DATABASE_ID,
                            collectionId,
                            [Query.equal("$id", part), Query.limit(200)]
                        )
                        for (const p of (res2?.documents ?? []) as any[]) {
                            const uid = safeStr(p?.userId || p?.$id)
                            const name =
                                safeStr(p?.name) ||
                                safeStr(p?.fullName) ||
                                safeStr(p?.displayName) ||
                                safeStr(`${p?.firstName || ""} ${p?.lastName || ""}`)
                            if (uid) map[uid] = name || uid
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            setUserNameMap((prev) => ({ ...prev, ...map }))
        } catch {
            // Ignore lookup errors
        }
    }

    async function loadChangeRequests(termIdParam: string, deptIdParam: string) {
        setReqLoading(true)
        setReqError(null)
        try {
            const res = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.CHANGE_REQUESTS,
                [
                    Query.equal("termId", termIdParam),
                    Query.equal("departmentId", deptIdParam),
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]
            )

            const docs = (res?.documents ?? []) as any[]
            setReqItems(docs as ChangeRequestDoc[])
            await hydrateUserNames(docs as ChangeRequestDoc[])
        } catch (e: any) {
            setReqItems([])
            setReqError(e?.message || "Failed to load change requests.")
        } finally {
            setReqLoading(false)
        }
    }

    async function load() {
        setLoading(true)
        try {
            const t = await departmentHeadApi.terms.getActive()
            setActiveTerm(t ?? null)

            const profile = await departmentHeadApi.profiles.getByUserId(userId)
            const deptId = safeStr(profile?.departmentId)
            setDepartmentId(deptId)

            // ✅ Fetch department row (for name)
            if (deptId) {
                const deptRow = await departmentHeadApi.departments.getById(deptId)
                setDepartmentRow(deptRow ?? null)
            } else {
                setDepartmentRow(null)
            }

            if (t?.$id && deptId) {
                const [list] = await Promise.all([
                    departmentHeadApi.scheduleVersions.listByTermDepartment(
                        safeStr(t.$id),
                        deptId
                    ),
                ])

                setVersions(Array.isArray(list) ? (list as VersionRow[]) : [])

                // ✅ Load faculty change requests for THIS term + department
                await loadChangeRequests(safeStr(t.$id), deptId)
            } else {
                setVersions([])
                setReqItems([])
            }
        } catch (err: any) {
            setVersions([])
            setReqItems([])
            toast.error(err?.message || "Failed to load schedule versions.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (!userId) return
        void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    function resetCreateForm() {
        setNewLabel("")
        setNewNotes("")
        setCopyFromVersionId(COPY_NONE)
        setSetActiveAfterCreate(true)
    }

    function openAction(type: "activate" | "lock" | "archive", versionId: string) {
        setPending({ type, versionId })
        setActionNotes("")
        setActionOpen(true)
    }

    const pendingVersion = React.useMemo(() => {
        const id = safeStr(pending?.versionId)
        if (!id) return null
        return versions.find((v) => safeStr(v.$id) === id) ?? null
    }, [pending, versions])

    async function onCreateVersion() {
        if (!hasContext) {
            toast.error("Missing term / department context.")
            return
        }

        setBusy(true)
        try {
            const label = newLabel.trim()
            const notes = newNotes.trim()

            const copyId =
                copyFromVersionId && copyFromVersionId !== COPY_NONE
                    ? safeStr(copyFromVersionId)
                    : ""

            const created = await departmentHeadApi.scheduleVersions.create({
                termId,
                departmentId,
                createdBy: userId,
                label: label || null,
                notes: notes || null,
                copyFromVersionId: copyId || null,
            })

            const newVersionId = safeStr(created?.$id)

            if (setActiveAfterCreate && newVersionId) {
                await departmentHeadApi.scheduleVersions.setActive({
                    termId,
                    departmentId,
                    versionId: newVersionId,
                })
            }

            toast.success("Schedule version created successfully.")
            setCreateOpen(false)
            resetCreateForm()
            await load()
        } catch (err: any) {
            toast.error(err?.message || "Failed to create schedule version.")
        } finally {
            setBusy(false)
        }
    }

    async function runPendingAction() {
        if (!pending || !pendingVersion) return
        if (!hasContext) return

        setBusy(true)
        try {
            const vId = safeStr(pendingVersion.$id)

            if (pending.type === "activate") {
                if (safeStr(pendingVersion.status) === "Locked") {
                    toast.error("Locked versions cannot be activated.")
                    return
                }
                if (safeStr(pendingVersion.status) === "Archived") {
                    toast.error("Archived versions cannot be activated.")
                    return
                }

                await departmentHeadApi.scheduleVersions.setActive({
                    termId,
                    departmentId,
                    versionId: vId,
                })

                toast.success("Version set to Active.")
            }

            if (pending.type === "lock") {
                if (safeStr(pendingVersion.status) !== "Active") {
                    toast.error("Only Active versions can be locked.")
                    return
                }

                await departmentHeadApi.scheduleVersions.lock({
                    versionId: vId,
                    lockedBy: userId,
                    notes: actionNotes?.trim() || null,
                })

                toast.success("Schedule approved & locked.")
            }

            if (pending.type === "archive") {
                if (safeStr(pendingVersion.status) === "Locked") {
                    toast.error("Locked versions cannot be archived.")
                    return
                }

                await departmentHeadApi.scheduleVersions.archive({
                    versionId: vId,
                })

                toast.success("Version archived.")
            }

            setActionOpen(false)
            setPending(null)
            setActionNotes("")
            await load()
        } catch (err: any) {
            toast.error(err?.message || "Action failed.")
        } finally {
            setBusy(false)
        }
    }

    const openReqView = (it: ChangeRequestDoc) => {
        setActiveReq(it)
        setReqNotes(safeStr(it?.resolutionNotes))
        setReqViewOpen(true)
    }

    async function updateReqStatus(next: ChangeRequestStatus) {
        if (!activeReq) return
        if (!userId) {
            toast.error("Missing user session")
            return
        }

        setReqSaving(true)
        try {
            const payload: any = {
                status: next,
                reviewedBy: userId || null,
                reviewedAt: new Date().toISOString(),
                resolutionNotes: safeStr(reqNotes) || null,
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.CHANGE_REQUESTS,
                activeReq.$id,
                payload
            )

            toast.success(`Request ${safeStr(next)}`)
            setReqViewOpen(false)
            setActiveReq(null)
            setReqNotes("")
            await loadChangeRequests(termId, departmentId)
        } catch (e: any) {
            toast.error(e?.message || "Failed to update request.")
        } finally {
            setReqSaving(false)
        }
    }

    const headerActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={() => void load()}
                disabled={loading || busy}
            >
                <RefreshCcw className="h-4 w-4" />
                Refresh
            </Button>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                    <Button disabled={loading || busy || !hasContext}>
                        <Plus className="h-4 w-4" />
                        New Version
                    </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Schedule Version</DialogTitle>
                        <DialogDescription>
                            Create a new schedule version for this term. You can optionally copy
                            data from an existing version.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="label">Label (optional)</Label>
                            <Input
                                id="label"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="e.g., Version 3 - Final Draft"
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                                placeholder="Add notes for this version..."
                                disabled={busy}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Copy From (optional)</Label>

                            <Select
                                value={copyFromVersionId}
                                onValueChange={(v) => setCopyFromVersionId(v)}
                                disabled={busy}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Do not copy" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value={COPY_NONE}>Do not copy</SelectItem>

                                    {versions
                                        .filter((v) => safeStr(v.status) !== "Archived")
                                        .map((v) => (
                                            <SelectItem key={v.$id} value={v.$id}>
                                                Version {v.version}
                                                {v.label ? ` — ${v.label}` : ""} ({v.status})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">Set Active after creation</div>
                                <div className="text-xs text-muted-foreground">
                                    Automatically make this version Active.
                                </div>
                            </div>
                            <Switch
                                checked={setActiveAfterCreate}
                                onCheckedChange={setSetActiveAfterCreate}
                                disabled={busy}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCreateOpen(false)
                                resetCreateForm()
                            }}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void onCreateVersion()}
                            disabled={busy || !hasContext}
                        >
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )

    const title = "Approval & Finalization"
    const subtitle = "Approve, activate, lock, and manage schedule versions and faculty change requests."

    const departmentName = safeStr(departmentRow?.name)

    return (
        <DashboardLayout title={title} subtitle={subtitle} actions={headerActions}>
            <div className="p-6 space-y-6">
                <Alert>
                    <BadgeCheck className="h-4 w-4" />
                    <AlertTitle>Finalization</AlertTitle>
                    <AlertDescription>
                        Set a schedule version to <b>Active</b> for editing. When ready, <b>Lock</b>{" "}
                        the Active version to finalize and prevent further changes. You can also{" "}
                        review and decide faculty <b>Change Requests</b>.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle>Current Context</CardTitle>
                        <CardDescription>
                            Active academic term and your department.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border p-3">
                                <div className="text-xs text-muted-foreground">Active Term</div>
                                <div className="mt-1 font-medium">
                                    {activeTerm
                                        ? `${safeStr(activeTerm?.schoolYear)} • ${safeStr(activeTerm?.semester)}`
                                        : "No active term"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {activeTerm
                                        ? `${safeStr(activeTerm?.startDate)} → ${safeStr(activeTerm?.endDate)}`
                                        : "Set an academic term first"}
                                </div>
                            </div>

                            {/* ✅ Department NAME (not ID) */}
                            <div className="rounded-lg border p-3">
                                <div className="text-xs text-muted-foreground">Department</div>
                                <div className="mt-1 font-medium">
                                    {departmentName ? departmentName : "Not assigned"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Loaded from your profile
                                </div>
                            </div>

                            <div className="rounded-lg border p-3">
                                <div className="text-xs text-muted-foreground">Active Version</div>
                                <div className="mt-1 font-medium">
                                    {activeVersion ? `Version ${activeVersion.version}` : "None"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {activeVersion?.label ? activeVersion.label : "—"}
                                </div>
                            </div>
                        </div>

                        {!hasContext ? (
                            <div className="text-sm text-muted-foreground">
                                Make sure you have an <b>active term</b> and your profile has a <b>departmentId</b>.
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                {/* Change Requests */}
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Change Requests</CardTitle>
                            <CardDescription>
                                Requests submitted by faculty from “Request Change” page.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (!termId || !departmentId) return
                                    void loadChangeRequests(termId, departmentId)
                                }}
                                disabled={reqLoading || !hasContext}
                            >
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <Tabs
                                value={reqTab}
                                onValueChange={(v) => setReqTab(v as RequestTabKey)}
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
                                <Label className="sr-only" htmlFor="reqSearch">
                                    Search
                                </Label>
                                <Input
                                    id="reqSearch"
                                    value={reqSearch}
                                    onChange={(e) => setReqSearch(e.target.value)}
                                    placeholder="Search by type, details, faculty name, classId..."
                                />
                            </div>
                        </div>

                        <Separator />

                        {reqLoading ? (
                            <div className="text-sm text-muted-foreground">Loading requests...</div>
                        ) : reqError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{reqError}</AlertDescription>
                            </Alert>
                        ) : filteredReqs.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-8 text-center">
                                <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                    <Clock className="size-5" />
                                </div>
                                <div className="mt-3 font-medium">No requests found</div>
                                <div className="text-sm text-muted-foreground">
                                    Try changing the tab or search query.
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Request</TableHead>
                                            <TableHead>Requested By</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Submitted</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filteredReqs.map((it) => {
                                            const Icon = reqIcon(String(it.status))
                                            const requester = resolveUserName(it.requestedBy)

                                            return (
                                                <TableRow key={it.$id} className="align-top">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className="size-4 text-muted-foreground" />
                                                            <span className="truncate">{safeStr(it.type) || "—"}</span>
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground truncate max-w-md">
                                                            {safeStr(it.details) || "—"}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-sm">{requester}</TableCell>

                                                    <TableCell>
                                                        <Badge variant={reqBadgeVariant(String(it.status)) as any}>
                                                            {safeStr(it.status) || "Pending"}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-right text-sm">
                                                        {formatMaybeIso(it.$createdAt)}
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

                                                                <DropdownMenuItem onClick={() => openReqView(it)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    View / Decide
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

                {/* Schedule Versions */}
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Schedule Versions</CardTitle>
                            <CardDescription>
                                Manage and finalize versions for this term.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search versions..."
                                className="w-full sm:w-72"
                            />
                        </div>
                    </CardHeader>

                    <CardContent>
                        <Separator className="mb-4" />

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-20">Version</TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead className="w-24">Status</TableHead>
                                        <TableHead className="w-52">Locked At</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="w-14 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="text-center py-10 text-muted-foreground"
                                            >
                                                Loading versions...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredVersions.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="text-center py-10 text-muted-foreground"
                                            >
                                                No schedule versions found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredVersions.map((v) => {
                                            const status = safeStr(v.status)
                                            const canActivate =
                                                status !== "Locked" && status !== "Archived"
                                            const canLock = status === "Active"
                                            const canArchive =
                                                status !== "Locked" && status !== "Archived"

                                            return (
                                                <TableRow key={v.$id}>
                                                    <TableCell className="font-medium">
                                                        {v.version}
                                                    </TableCell>

                                                    <TableCell className="min-w-60">
                                                        {v.label ? (
                                                            <div className="font-medium">{v.label}</div>
                                                        ) : (
                                                            <div className="text-muted-foreground">—</div>
                                                        )}
                                                        <div className="text-xs text-muted-foreground">
                                                            ID: {v.$id}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant={statusBadgeVariant(status) as any}>
                                                            {status || "Draft"}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {formatMaybeIso(v.lockedAt)}
                                                    </TableCell>

                                                    <TableCell className="min-w-60">
                                                        {v.notes ? (
                                                            <div className="text-sm">{v.notes}</div>
                                                        ) : (
                                                            <div className="text-sm text-muted-foreground">—</div>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={busy}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>

                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>
                                                                    Version {v.version}
                                                                </DropdownMenuLabel>
                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    disabled={!canActivate || busy}
                                                                    onClick={() => openAction("activate", v.$id)}
                                                                >
                                                                    <ArrowUpRight className="h-4 w-4" />
                                                                    Set Active
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    disabled={!canLock || busy}
                                                                    onClick={() => openAction("lock", v.$id)}
                                                                >
                                                                    <Lock className="h-4 w-4" />
                                                                    Approve & Lock
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    disabled={!canArchive || busy}
                                                                    onClick={() => openAction("archive", v.$id)}
                                                                >
                                                                    <Archive className="h-4 w-4" />
                                                                    Archive
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Dialog (Versions) */}
                <Dialog open={actionOpen} onOpenChange={setActionOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {pending?.type === "activate"
                                    ? "Set Version Active"
                                    : pending?.type === "lock"
                                        ? "Approve & Lock Schedule"
                                        : pending?.type === "archive"
                                            ? "Archive Version"
                                            : "Confirm Action"}
                            </DialogTitle>
                            <DialogDescription>
                                {pendingVersion ? (
                                    <>
                                        Version <b>{pendingVersion.version}</b>{" "}
                                        {pendingVersion.label ? `— ${pendingVersion.label}` : ""}
                                    </>
                                ) : (
                                    "Select a version to continue."
                                )}
                            </DialogDescription>
                        </DialogHeader>

                        {pending?.type === "lock" ? (
                            <div className="space-y-2">
                                <Label htmlFor="finalNotes">Finalization notes (optional)</Label>
                                <Textarea
                                    id="finalNotes"
                                    value={actionNotes}
                                    onChange={(e) => setActionNotes(e.target.value)}
                                    placeholder="Add notes for this final approval..."
                                    disabled={busy}
                                />
                                <div className="text-xs text-muted-foreground">
                                    Locking prevents further edits to this version.
                                </div>
                            </div>
                        ) : null}

                        {pending?.type === "archive" ? (
                            <div className="text-sm text-muted-foreground">
                                This will mark the version as archived and hide it from active workflow.
                            </div>
                        ) : null}

                        {pending?.type === "activate" ? (
                            <div className="text-sm text-muted-foreground">
                                This will set the version to <b>Active</b>. Any other Active version will be reverted to Draft.
                            </div>
                        ) : null}

                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setActionOpen(false)}
                                disabled={busy}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void runPendingAction()}
                                disabled={busy || !pendingVersion}
                            >
                                Confirm
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ✅ Request View / Decide Dialog (shorter + scroll) */}
                <Dialog
                    open={reqViewOpen}
                    onOpenChange={(v) => {
                        if (!v) {
                            setActiveReq(null)
                            setReqNotes("")
                        }
                        setReqViewOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Change Request Details</DialogTitle>
                            <DialogDescription>
                                Review the request and decide to approve or reject.
                            </DialogDescription>
                        </DialogHeader>

                        <ScrollArea className="h-96 pr-4">
                            {!activeReq ? (
                                <div className="text-sm text-muted-foreground">
                                    No request selected.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <Card className="rounded-2xl">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Status</CardTitle>
                                                <CardDescription>Current state</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <Badge variant={reqBadgeVariant(String(activeReq.status)) as any}>
                                                    {safeStr(activeReq.status) || "Pending"}
                                                </Badge>
                                            </CardContent>
                                        </Card>

                                        <Card className="rounded-2xl">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm">Requested By</CardTitle>
                                                <CardDescription>Faculty member</CardDescription>
                                            </CardHeader>
                                            <CardContent className="text-sm font-medium">
                                                {resolveUserName(activeReq.requestedBy)}
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
                                                <span className="font-medium">{safeStr(activeReq.type) || "—"}</span>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">Class ID</span>
                                                <span className="font-medium">{safeStr(activeReq.classId) || "—"}</span>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">Meeting ID</span>
                                                <span className="font-medium">{safeStr(activeReq.meetingId) || "—"}</span>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">Submitted</span>
                                                <span className="font-medium">{formatMaybeIso(activeReq.$createdAt)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Details</CardTitle>
                                            <CardDescription>What the requester wants to change</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {safeStr(activeReq.details) || "—"}
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-2">
                                        <Label htmlFor="reqNotes">Resolution Notes</Label>
                                        <Textarea
                                            id="reqNotes"
                                            value={reqNotes}
                                            onChange={(e) => setReqNotes(e.target.value)}
                                            placeholder="Add your notes / resolution (optional)"
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            This will be saved to{" "}
                                            <span className="font-medium">resolutionNotes</span>.
                                        </div>
                                    </div>

                                    {activeReq.reviewedAt ? (
                                        <Alert>
                                            <AlertTitle>Previously reviewed</AlertTitle>
                                            <AlertDescription>
                                                Reviewed at{" "}
                                                <span className="font-medium">{formatMaybeIso(activeReq.reviewedAt)}</span>
                                                {activeReq.reviewedBy ? (
                                                    <>
                                                        {" "}
                                                        by{" "}
                                                        <span className="font-medium">{resolveUserName(activeReq.reviewedBy)}</span>.
                                                    </>
                                                ) : null}
                                            </AlertDescription>
                                        </Alert>
                                    ) : null}
                                </div>
                            )}
                        </ScrollArea>

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReqViewOpen(false)}
                                disabled={reqSaving}
                            >
                                Close
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!activeReq || reqSaving || safeStr(activeReq?.status) !== "Pending"}
                                    onClick={() => void updateReqStatus("Rejected")}
                                >
                                    <XCircle className="mr-2 size-4" />
                                    Reject
                                </Button>

                                <Button
                                    type="button"
                                    disabled={!activeReq || reqSaving || safeStr(activeReq?.status) !== "Pending"}
                                    onClick={() => void updateReqStatus("Approved")}
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
