/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    Bell,
    RefreshCw,
    Search,
    CheckCheck,
    Megaphone,
    BadgeCheck,
    CalendarClock,
    ExternalLink,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"
import { facultyMemberApi } from "@/api/faculty-member"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

type FilterKey = "all" | "schedule" | "announcement" | "approval"

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function unwrapUserLike(u: any) {
    if (!u) return null
    if (u?.$id || u?.id || u?.userId) return u
    if (u?.data && (u.data.$id || u.data.id || u.data.userId)) return u.data
    if (u?.user && (u.user.$id || u.user.id || u.user.userId)) return u.user
    return u
}

function resolveUserId(user: any) {
    const u = unwrapUserLike(user)
    return safeStr(u?.$id || u?.id || u?.userId || "")
}

function normalizeTypeKey(t: any): FilterKey | "other" {
    const s = safeStr(t).toLowerCase()
    if (!s) return "other"

    // ✅ flexible matching (supports multiple naming styles)
    if (s.includes("schedule") || s.includes("update") || s.includes("resched")) return "schedule"
    if (s.includes("announce") || s.includes("memo") || s.includes("notice")) return "announcement"
    if (s.includes("approval") || s.includes("approved") || s.includes("request")) return "approval"

    return "other"
}

function formatDate(iso: any) {
    const s = safeStr(iso)
    if (!s) return ""
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function pickIconByType(type: any) {
    const key = normalizeTypeKey(type)
    if (key === "schedule") return CalendarClock
    if (key === "announcement") return Megaphone
    if (key === "approval") return BadgeCheck
    return Bell
}

export default function FacultyNotificationsPage() {
    const navigate = useNavigate()
    const { user } = useSession()

    const userId = React.useMemo(() => resolveUserId(user), [user])

    const [loading, setLoading] = React.useState(false)
    const [items, setItems] = React.useState<any[]>([])

    const [tab, setTab] = React.useState<FilterKey>("all")
    const [search, setSearch] = React.useState("")
    const [unreadOnly, setUnreadOnly] = React.useState(false)

    const [open, setOpen] = React.useState(false)
    const [selected, setSelected] = React.useState<any | null>(null)

    const unreadCount = React.useMemo(() => {
        return items.filter((x) => x && x.isRead === false).length
    }, [items])

    const visibleItems = React.useMemo(() => {
        const q = safeStr(search).toLowerCase()

        return items
            .filter((x) => {
                if (!x) return false
                if (unreadOnly && x.isRead) return false

                if (tab !== "all") {
                    const key = normalizeTypeKey(x.type)
                    if (key !== tab) return false
                }

                if (!q) return true

                const hay = [
                    safeStr(x.title),
                    safeStr(x.message),
                    safeStr(x.type),
                ]
                    .join(" ")
                    .toLowerCase()

                return hay.includes(q)
            })
    }, [items, tab, search, unreadOnly])

    async function load() {
        if (!userId) return
        setLoading(true)

        try {
            const res = await facultyMemberApi.notifications.listMy({ userId })
            const rows = Array.isArray(res?.items) ? res.items : []
            setItems(rows)
        } catch (err: any) {
            toast.error("Failed to load notifications.")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    async function markRead(row: any) {
        const recipientRowId = safeStr(row?.recipientRowId)
        if (!userId || !recipientRowId) return

        try {
            await facultyMemberApi.notifications.markRead({
                userId,
                recipientRowId,
            })

            setItems((prev) =>
                prev.map((x) =>
                    safeStr(x?.recipientRowId) === recipientRowId
                        ? { ...x, isRead: true, readAt: new Date().toISOString() }
                        : x
                )
            )
        } catch (err) {
            toast.error("Failed to mark as read.")
            console.error(err)
        }
    }

    async function markAllRead() {
        if (!userId) return

        const hasUnread = items.some((x) => x && x.isRead === false)
        if (!hasUnread) return

        try {
            setLoading(true)
            const res = await facultyMemberApi.notifications.markAllRead({ userId })

            setItems((prev) =>
                prev.map((x) =>
                    x?.isRead
                        ? x
                        : { ...x, isRead: true, readAt: new Date().toISOString() }
                )
            )

            const count = Number(res?.updatedCount || 0)
            toast.success(count > 0 ? `Marked ${count} as read.` : "All notifications marked as read.")
        } catch (err) {
            toast.error("Failed to mark all as read.")
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    function openDetails(row: any) {
        setSelected(row)
        setOpen(true)

        // ✅ auto mark as read when opened
        if (row && row.isRead === false) {
            void markRead(row)
        }
    }

    function openLink(link: any) {
        const href = safeStr(link)
        if (!href) return

        // internal route
        if (href.startsWith("/")) {
            navigate(href)
            return
        }

        // external
        try {
            window.open(href, "_blank", "noopener,noreferrer")
        } catch {
            // ignore
        }
    }

    return (
        <DashboardLayout
            title="Notifications"
            subtitle="View schedule updates, announcements, and approvals"
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        <span className="ml-2">Refresh</span>
                    </Button>

                    <Button
                        onClick={() => void markAllRead()}
                        disabled={loading || unreadCount === 0}
                    >
                        <CheckCheck className="h-4 w-4" />
                        <span className="ml-2">Mark all read</span>
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-4">
                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="h-5 w-5" />
                                    Notifications
                                    {unreadCount > 0 ? (
                                        <Badge className="ml-2" variant="secondary">
                                            {unreadCount} unread
                                        </Badge>
                                    ) : null}
                                </CardTitle>
                                <CardDescription>
                                    Stay updated with changes made to schedules, announcements, and approvals.
                                </CardDescription>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Tabs value={tab} onValueChange={(v) => setTab(v as FilterKey)}>
                                <TabsList>
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                                    <TabsTrigger value="announcement">Announcements</TabsTrigger>
                                    <TabsTrigger value="approval">Approvals</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="flex items-center gap-3">
                                <div className="relative w-72 max-w-full">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search notifications..."
                                        className="pl-9"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={unreadOnly}
                                        onCheckedChange={(v) => setUnreadOnly(Boolean(v))}
                                    />
                                    <span className="text-sm text-muted-foreground">Unread only</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : visibleItems.length === 0 ? (
                            <Alert>
                                <AlertTitle>No notifications found</AlertTitle>
                                <AlertDescription>
                                    You currently have no notifications that match your filters.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-3">
                                {visibleItems.map((row) => {
                                    const Icon = pickIconByType(row?.type)
                                    const isUnread = row?.isRead === false
                                    const created = row?.createdAt || row?.$createdAt

                                    return (
                                        <Card
                                            key={safeStr(row?.recipientRowId) || safeStr(row?.notificationId)}
                                            className={cn(
                                                "transition",
                                                isUnread && "border-primary/50 bg-primary/5"
                                            )}
                                        >
                                            <CardContent className="p-3">
                                                <Button
                                                    variant="ghost"
                                                    className="h-auto w-full justify-start px-2 py-2 text-left"
                                                    onClick={() => openDetails(row)}
                                                >
                                                    <div className="flex w-full items-start gap-3">
                                                        <div className={cn(
                                                            "mt-1 rounded-md border p-2",
                                                            isUnread ? "border-primary/40 bg-primary/10" : "bg-muted"
                                                        )}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="truncate font-medium">
                                                                            {safeStr(row?.title) || "Untitled notification"}
                                                                        </p>

                                                                        {safeStr(row?.type) ? (
                                                                            <Badge variant="secondary" className="shrink-0">
                                                                                {safeStr(row?.type)}
                                                                            </Badge>
                                                                        ) : null}

                                                                        {isUnread ? (
                                                                            <Badge className="shrink-0">Unread</Badge>
                                                                        ) : null}
                                                                    </div>

                                                                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                                        {safeStr(row?.message) || "No message provided."}
                                                                    </p>
                                                                </div>

                                                                <div className="shrink-0 text-xs text-muted-foreground">
                                                                    {formatDate(created)}
                                                                </div>
                                                            </div>

                                                            {safeStr(row?.link) ? (
                                                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    <span className="truncate">{safeStr(row?.link)}</span>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selected ? (
                                <>
                                    {React.createElement(pickIconByType(selected?.type), { className: "h-5 w-5" })}
                                    <span className="truncate">{safeStr(selected?.title) || "Notification"}</span>
                                </>
                            ) : (
                                "Notification"
                            )}
                        </DialogTitle>

                        <DialogDescription>
                            {selected?.type ? (
                                <span className="inline-flex items-center gap-2">
                                    <Badge variant="secondary">{safeStr(selected?.type)}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(selected?.createdAt || selected?.$createdAt)}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(selected?.createdAt || selected?.$createdAt)}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <Card className="border-muted">
                            <CardContent className="p-4">
                                <div className="max-h-80 overflow-y-auto pr-2">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                        {safeStr(selected?.message) || "No message provided."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {safeStr(selected?.link) ? (
                            <Alert>
                                <AlertTitle>Related link</AlertTitle>
                                <AlertDescription className="break-all">
                                    {safeStr(selected?.link)}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>

                    <DialogFooter className="gap-2">
                        {selected?.isRead === false ? (
                            <Button onClick={() => selected && void markRead(selected)}>
                                <CheckCheck className="h-4 w-4" />
                                <span className="ml-2">Mark as read</span>
                            </Button>
                        ) : (
                            <Button variant="secondary" disabled>
                                <CheckCheck className="h-4 w-4" />
                                <span className="ml-2">Read</span>
                            </Button>
                        )}

                        {safeStr(selected?.link) ? (
                            <Button
                                variant="outline"
                                onClick={() => openLink(selected?.link)}
                            >
                                <ExternalLink className="h-4 w-4" />
                                <span className="ml-2">Open link</span>
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
