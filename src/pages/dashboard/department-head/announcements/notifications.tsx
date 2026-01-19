/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Megaphone, RefreshCw, Search, Eye, Send, Copy } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { departmentHeadApi } from "@/api/department-head"
import { useSession } from "@/hooks/use-session"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function formatDate(iso: any) {
    const s = safeStr(iso)
    if (!s) return "—"
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString()
}

type NotifRow = {
    $id: string
    $createdAt?: string
    departmentId?: string | null
    termId?: string | null
    createdBy?: string
    type?: string
    title?: string
    message?: string
    link?: string | null
    [key: string]: any
}

type RecipientRow = {
    $id: string
    notificationId: string
    userId: string
    isRead: boolean
    readAt?: string | null
    [key: string]: any
}

export default function DepartmentHeadNotificationsPage() {
    const { user } = useSession()

    const userId = React.useMemo(
        () => safeStr(user?.$id || user?.id || user?.userId),
        [user]
    )

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [profile, setProfile] = React.useState<any | null>(null)
    const [activeTerm, setActiveTerm] = React.useState<any | null>(null)

    const departmentId = React.useMemo(() => safeStr(profile?.departmentId), [profile])

    const [facultyUsers, setFacultyUsers] = React.useState<any[]>([])
    const facultyMap = React.useMemo(() => {
        const m = new Map<string, any>()
        for (const u of facultyUsers) {
            const id = safeStr(u?.userId)
            if (id) m.set(id, u)
        }
        return m
    }, [facultyUsers])

    const [rows, setRows] = React.useState<NotifRow[]>([])

    // Filters
    const [search, setSearch] = React.useState("")
    const [typeFilter, setTypeFilter] = React.useState<string>("all")

    // Create dialog state
    const [openCreate, setOpenCreate] = React.useState(false)
    const [creating, setCreating] = React.useState(false)
    const [newType, setNewType] = React.useState("Announcement")
    const [newTitle, setNewTitle] = React.useState("")
    const [newMessage, setNewMessage] = React.useState("")
    const [newLink, setNewLink] = React.useState("")

    // Details dialog
    const [openDetails, setOpenDetails] = React.useState(false)
    const [selected, setSelected] = React.useState<NotifRow | null>(null)
    const [recipientsLoading, setRecipientsLoading] = React.useState(false)
    const [recipients, setRecipients] = React.useState<RecipientRow[]>([])

    const loadAll = React.useCallback(async () => {
        if (!userId) return

        setLoading(true)

        try {
            const [term, prof] = await Promise.all([
                departmentHeadApi.terms.getActive(),
                departmentHeadApi.profiles.getByUserId(userId),
            ])

            setActiveTerm(term ?? null)
            setProfile(prof ?? null)

            const deptId = safeStr(prof?.departmentId)

            if (deptId) {
                const f = await departmentHeadApi.faculty.listByDepartment(deptId)
                setFacultyUsers(Array.isArray(f?.users) ? f.users : [])

                const notifs = await departmentHeadApi.notifications.listByDepartmentTerm({
                    departmentId: deptId,
                    termId: safeStr(term?.$id) || null,
                })

                setRows(Array.isArray(notifs) ? (notifs as any) : [])
            } else {
                setRows([])
                setFacultyUsers([])
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to load notifications.")
            setRows([])
            setFacultyUsers([])
        } finally {
            setLoading(false)
        }
    }, [userId])

    React.useEffect(() => {
        void loadAll()
    }, [loadAll])

    async function onRefresh() {
        setRefreshing(true)
        try {
            await loadAll()
            toast.success("Refreshed")
        } catch {
            // loadAll handles error
        } finally {
            setRefreshing(false)
        }
    }

    const filteredRows = React.useMemo(() => {
        const q = safeStr(search).toLowerCase()
        return rows.filter((r) => {
            const t = safeStr(r?.type)
            const title = safeStr(r?.title).toLowerCase()
            const msg = safeStr(r?.message).toLowerCase()

            const typeOk = typeFilter === "all" ? true : t === typeFilter

            const searchOk = !q
                ? true
                : title.includes(q) || msg.includes(q) || safeStr(r?.$id).includes(q)

            return typeOk && searchOk
        })
    }, [rows, search, typeFilter])

    async function onCreate() {
        if (!departmentId) {
            toast.error("Missing department. Please check your profile.")
            return
        }

        const termId = safeStr(activeTerm?.$id)

        const title = safeStr(newTitle)
        const message = safeStr(newMessage)

        if (!title || !message) {
            toast.error("Title and message are required.")
            return
        }

        const recipientUserIds = facultyUsers.map((u) => safeStr(u?.userId)).filter(Boolean)

        if (recipientUserIds.length === 0) {
            toast.error("No faculty recipients found for your department.")
            return
        }

        setCreating(true)

        try {
            const res = await departmentHeadApi.notifications.createAndSend({
                departmentId,
                termId: termId || null,
                createdBy: userId,
                type: safeStr(newType) || "Announcement",
                title,
                message,
                link: safeStr(newLink) || null,
                recipientUserIds,
            })

            toast.success(
                `Sent to ${Number(res?.recipientsCreated || 0)} faculty member(s).`
            )

            setOpenCreate(false)
            setNewTitle("")
            setNewMessage("")
            setNewLink("")
            setNewType("Announcement")

            await loadAll()
        } catch (err: any) {
            toast.error(err?.message || "Failed to send notification.")
        } finally {
            setCreating(false)
        }
    }

    async function openRecipientsDialog(row: NotifRow) {
        setSelected(row)
        setRecipients([])
        setOpenDetails(true)

        const id = safeStr(row?.$id)
        if (!id) return

        setRecipientsLoading(true)
        try {
            const list = await departmentHeadApi.notifications.listRecipients(id)
            setRecipients(Array.isArray(list) ? (list as any) : [])
        } catch (err: any) {
            toast.error(err?.message || "Failed to load recipients.")
            setRecipients([])
        } finally {
            setRecipientsLoading(false)
        }
    }

    function copyText(text: string) {
        const v = safeStr(text)
        if (!v) return
        try {
            navigator.clipboard.writeText(v)
            toast.success("Copied")
        } catch {
            toast.error("Copy failed")
        }
    }

    const recipientStats = React.useMemo(() => {
        const total = recipients.length
        const read = recipients.filter((r) => Boolean(r?.isRead)).length
        const unread = Math.max(0, total - read)
        return { total, read, unread }
    }, [recipients])

    const typeOptions = React.useMemo(
        () => ["Announcement", "Reminder", "Schedule Update", "Policy", "General"],
        []
    )

    const termLabel = React.useMemo(() => {
        const sy = safeStr(activeTerm?.schoolYear)
        const sem = safeStr(activeTerm?.semester)
        if (!sy && !sem) return "—"
        if (sy && sem) return `${sy} • ${sem}`
        return sy || sem
    }, [activeTerm])

    return (
        <DashboardLayout
            title="Announcements & Notifications"
            subtitle="Send updates to faculty members"
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={loading || refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                        Refresh
                    </Button>

                    <Button onClick={() => setOpenCreate(true)} className="gap-2">
                        <Megaphone className="h-4 w-4" />
                        New Announcement
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-4">
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-72" />
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : !departmentId ? (
                    <Alert>
                        <AlertTitle>Missing Department</AlertTitle>
                        <AlertDescription>
                            Your profile does not have a department assigned. Please contact the Admin.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Context</CardTitle>
                                <CardDescription>
                                    Active term and recipient summary
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        Term: {termLabel}
                                    </Badge>
                                    <Badge variant="outline">
                                        Department ID: {departmentId}
                                    </Badge>
                                    <Badge>
                                        Faculty Recipients: {facultyUsers.length}
                                    </Badge>
                                </div>

                                <Separator />

                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                                    <div className="relative w-full sm:max-w-sm">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search title/message..."
                                            className="pl-9"
                                        />
                                    </div>

                                    <div className="w-full sm:max-w-xs">
                                        <Select
                                            value={typeFilter}
                                            onValueChange={(v) => setTypeFilter(v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filter type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Types</SelectItem>
                                                {typeOptions.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Sent Announcements</CardTitle>
                                <CardDescription>
                                    View history and check read status per recipient
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[160px]">Date</TableHead>
                                                <TableHead className="min-w-[140px]">Type</TableHead>
                                                <TableHead className="min-w-[220px]">Title</TableHead>
                                                <TableHead>Message</TableHead>
                                                <TableHead className="text-right min-w-[150px]">
                                                    Actions
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filteredRows.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                                        No announcements found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredRows.map((r) => (
                                                    <TableRow key={r.$id}>
                                                        <TableCell className="align-top">
                                                            <div className="text-sm">
                                                                {formatDate(r?.$createdAt || r?.$updatedAt)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                ID: {safeStr(r?.$id).slice(0, 10)}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <Badge variant="secondary">
                                                                {safeStr(r?.type) || "—"}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="font-medium leading-tight">
                                                                {safeStr(r?.title) || "—"}
                                                            </div>
                                                            {safeStr(r?.link) ? (
                                                                <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                                                                    Link: {safeStr(r?.link)}
                                                                </div>
                                                            ) : null}
                                                        </TableCell>

                                                        <TableCell className="align-top">
                                                            <div className="text-sm text-muted-foreground line-clamp-2">
                                                                {safeStr(r?.message) || "—"}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="align-top text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    onClick={() => openRecipientsDialog(r)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                    View
                                                                </Button>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    onClick={() =>
                                                                        copyText(
                                                                            `${safeStr(r?.title)}\n\n${safeStr(r?.message)}`
                                                                        )
                                                                    }
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                    Copy
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* ✅ CREATE ANNOUNCEMENT */}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5" />
                            New Announcement
                        </DialogTitle>
                        <DialogDescription>
                            This will be sent to all faculty members in your department.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={newType} onValueChange={setNewType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {typeOptions.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Recipients</Label>
                                <Input
                                    value={`${facultyUsers.length} faculty member(s)`}
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g., Faculty meeting on Friday"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Message</Label>
                            <Textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Write the announcement details here..."
                                className="min-h-40"
                            />
                            <div className="text-xs text-muted-foreground">
                                Tip: Keep it short and clear. Faculty will see this in their notifications.
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Optional Link</Label>
                            <Input
                                value={newLink}
                                onChange={(e) => setNewLink(e.target.value)}
                                placeholder="e.g., /dashboard/department-head/class-scheduling"
                            />
                        </div>

                        <div className="rounded-lg border p-3 bg-muted/30">
                            <div className="text-sm font-medium mb-1">Preview</div>
                            <div className="text-sm">{safeStr(newTitle) || "—"}</div>
                            <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {safeStr(newMessage) || "—"}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={onCreate} disabled={creating} className="gap-2">
                            <Send className="h-4 w-4" />
                            {creating ? "Sending..." : "Send Announcement"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ✅ DETAILS / RECIPIENTS */}
            <Dialog open={openDetails} onOpenChange={setOpenDetails}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Announcement Details</DialogTitle>
                        <DialogDescription>
                            Review recipient status for this message.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    {safeStr(selected?.title) || "—"}
                                </CardTitle>
                                <CardDescription className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">{safeStr(selected?.type) || "—"}</Badge>
                                    <Badge variant="outline">
                                        {formatDate(selected?.$createdAt || selected?.$updatedAt)}
                                    </Badge>
                                    <Badge>
                                        Total: {recipientStats.total}
                                    </Badge>
                                    <Badge variant="secondary">
                                        Read: {recipientStats.read}
                                    </Badge>
                                    <Badge variant="outline">
                                        Unread: {recipientStats.unread}
                                    </Badge>
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-2">
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                                    {safeStr(selected?.message) || "—"}
                                </div>

                                {safeStr(selected?.link) ? (
                                    <div className="text-xs text-muted-foreground">
                                        Link: {safeStr(selected?.link)}
                                    </div>
                                ) : null}

                                <div className="flex items-center gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() =>
                                            copyText(
                                                `${safeStr(selected?.title)}\n\n${safeStr(selected?.message)}`
                                            )
                                        }
                                    >
                                        <Copy className="h-4 w-4" />
                                        Copy Message
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Recipients</CardTitle>
                                <CardDescription>
                                    Faculty read status
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-0">
                                {recipientsLoading ? (
                                    <div className="p-4 space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="min-w-[220px]">Faculty</TableHead>
                                                    <TableHead className="min-w-[240px]">Email</TableHead>
                                                    <TableHead className="min-w-[120px]">Status</TableHead>
                                                    <TableHead className="min-w-[220px]">Read At</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {recipients.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                                            No recipients found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    recipients.map((r) => {
                                                        const u = facultyMap.get(safeStr(r?.userId))
                                                        const name = safeStr(u?.name) || safeStr(u?.email) || safeStr(r?.userId)
                                                        const email = safeStr(u?.email) || "—"

                                                        return (
                                                            <TableRow key={r.$id}>
                                                                <TableCell className="font-medium">
                                                                    {name}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {email}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {r?.isRead ? (
                                                                        <Badge>Read</Badge>
                                                                    ) : (
                                                                        <Badge variant="secondary">Unread</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {r?.isRead ? formatDate(r?.readAt) : "—"}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
