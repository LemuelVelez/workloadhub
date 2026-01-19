/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { RefreshCw, Search, X, Send, Eye, ClipboardList, CalendarDays } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { facultyMemberApi } from "@/api/faculty-member"
import type { FacultyScheduleItem, FacultyChangeRequestItem } from "@/api/faculty-member"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const REQUEST_TYPES = [
    "Conflict",
    "Swap",
    "Correction",
    "Time Change",
    "Room Change",
    "Load Adjustment",
    "Other",
] as const

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function formatTimeRange(a: string, b: string) {
    const s = safeStr(a)
    const e = safeStr(b)
    if (!s && !e) return "-"
    if (!s) return e
    if (!e) return s
    return `${s} - ${e}`
}

function formatDateTime(v: any) {
    const s = safeStr(v)
    if (!s) return "-"
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString()
}

function badgeVariantForStatus(status: string) {
    const s = safeStr(status).toLowerCase()
    if (s.includes("approved")) return "default"
    if (s.includes("rejected")) return "destructive"
    if (s.includes("cancel")) return "secondary"
    return "outline"
}

function buildScheduleTitle(it: FacultyScheduleItem) {
    const subj = safeStr(it.subjectCode || "")
    const title = safeStr(it.subjectTitle || "")
    if (!subj && !title) return "Untitled Schedule"
    if (!subj) return title
    if (!title) return subj
    return `${subj} - ${title}`
}

function buildScheduleSubLine(it: FacultyScheduleItem) {
    const sec = safeStr(it.sectionLabel || "")
    const code = safeStr(it.classCode || "")
    const parts: string[] = []
    if (sec) parts.push(sec)
    if (code) parts.push(`Class Code: ${code}`)
    return parts.length ? parts.join(" • ") : "—"
}

function buildScheduleMetaLine(it: FacultyScheduleItem) {
    const parts: string[] = []

    const day = safeStr(it.dayOfWeek || "")
    const time = formatTimeRange(it.startTime, it.endTime)
    const room = safeStr(it.roomCode || it.roomName || "")
    const mt = safeStr(it.meetingType || "")

    if (day) parts.push(day)
    parts.push(time)

    if (room) parts.push(`Room: ${room}`)
    if (mt) parts.push(`Type: ${mt}`)

    return parts.filter(Boolean).join(" • ")
}

export default function FacultyRequestChangePage() {
    const { user } = useSession()
    const userId = React.useMemo(
        () => safeStr(user?.$id || user?.id || user?.userId || ""),
        [user]
    )

    const [loading, setLoading] = React.useState(true)
    const [loadingSubmit, setLoadingSubmit] = React.useState(false)
    const [loadingCancelId, setLoadingCancelId] = React.useState<string | null>(null)

    const [term, setTerm] = React.useState<any | null>(null)
    const [profile, setProfile] = React.useState<any | null>(null)

    const [scheduleItems, setScheduleItems] = React.useState<FacultyScheduleItem[]>([])
    const [requests, setRequests] = React.useState<FacultyChangeRequestItem[]>([])

    const [schedulePickerOpen, setSchedulePickerOpen] = React.useState(false)
    const [requestViewOpen, setRequestViewOpen] = React.useState(false)
    const [activeRequest, setActiveRequest] = React.useState<FacultyChangeRequestItem | null>(null)

    const [scheduleSearch, setScheduleSearch] = React.useState("")
    const [selectedSchedule, setSelectedSchedule] = React.useState<FacultyScheduleItem | null>(null)

    const [requestType, setRequestType] = React.useState<string>("Conflict")
    const [details, setDetails] = React.useState<string>("")

    const refreshAll = React.useCallback(async () => {
        if (!userId) return

        setLoading(true)
        try {
            const [schedRes, reqRes] = await Promise.all([
                facultyMemberApi.schedules.getMySchedule({ userId }),
                facultyMemberApi.changeRequests.listMy({ userId }),
            ])

            setTerm(schedRes?.term ?? reqRes?.term ?? null)
            setProfile(schedRes?.profile ?? reqRes?.profile ?? null)

            setScheduleItems(Array.isArray(schedRes?.items) ? schedRes.items : [])
            setRequests(Array.isArray(reqRes?.items) ? reqRes.items : [])
        } catch (err: any) {
            toast.error("Failed to load data", {
                description: safeStr(err?.message || err) || "Please try again.",
            })
        } finally {
            setLoading(false)
        }
    }, [userId])

    React.useEffect(() => {
        void refreshAll()
    }, [refreshAll])

    const scheduleFiltered = React.useMemo(() => {
        const q = safeStr(scheduleSearch).toLowerCase()
        if (!q) return scheduleItems

        return scheduleItems.filter((it) => {
            const hay = [
                it.subjectCode,
                it.subjectTitle,
                it.sectionLabel,
                it.classCode,
                it.dayOfWeek,
                it.roomCode,
                it.roomName,
                it.meetingType,
                it.startTime,
                it.endTime,
            ]
                .map((x) => safeStr(x).toLowerCase())
                .join(" ")

            return hay.includes(q)
        })
    }, [scheduleItems, scheduleSearch])

    const selectedLabel = React.useMemo(() => {
        if (!selectedSchedule) return ""
        const title = buildScheduleTitle(selectedSchedule)
        const meta = buildScheduleMetaLine(selectedSchedule)
        const sub = buildScheduleSubLine(selectedSchedule)
        return [title, sub, meta].filter(Boolean).join(" • ")
    }, [selectedSchedule])

    async function submitRequest() {
        if (!userId) {
            toast.error("Missing user session")
            return
        }

        const type = safeStr(requestType)
        const msg = safeStr(details)

        if (!type) {
            toast.error("Request type is required")
            return
        }

        if (!msg || msg.length < 10) {
            toast.error("Please provide more details", {
                description: "Add at least 10 characters explaining your requested change.",
            })
            return
        }

        setLoadingSubmit(true)
        try {
            await facultyMemberApi.changeRequests.createMy({
                userId,
                type,
                details: msg,
                classId: selectedSchedule?.classId || undefined,
                meetingId: selectedSchedule?.meetingId || undefined,
            })

            toast.success("Request submitted", {
                description: "Your department head will review this request.",
            })

            setDetails("")
            setSelectedSchedule(null)

            await refreshAll()
        } catch (err: any) {
            toast.error("Failed to submit request", {
                description: safeStr(err?.message || err) || "Please try again.",
            })
        } finally {
            setLoadingSubmit(false)
        }
    }

    async function cancelRequest(rowId: string) {
        const rid = safeStr(rowId)
        if (!rid || !userId) return

        setLoadingCancelId(rid)
        try {
            await facultyMemberApi.changeRequests.cancelMy({ userId, rowId: rid })
            toast.success("Request cancelled")
            await refreshAll()
        } catch (err: any) {
            toast.error("Failed to cancel request", {
                description: safeStr(err?.message || err) || "Please try again.",
            })
        } finally {
            setLoadingCancelId(null)
        }
    }

    const pageActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshAll()}
                disabled={loading}
            >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Request Change"
            subtitle="Submit schedule/load change requests for department head approval."
            actions={pageActions}
        >
            <div className="p-6 space-y-6">
                {!userId ? (
                    <Alert variant="destructive">
                        <AlertTitle>Not signed in</AlertTitle>
                        <AlertDescription>Please login again.</AlertDescription>
                    </Alert>
                ) : null}

                {/* Request Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            Request Details
                        </CardTitle>
                        <CardDescription>
                            Choose a schedule item (optional), then describe your requested change.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-10 w-44" />
                            </div>
                        ) : (
                            <>
                                {/* Term + Faculty */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border p-3">
                                        <div className="text-xs text-muted-foreground">Active Term</div>
                                        <div className="font-medium">
                                            {safeStr(term?.schoolYear) || "-"}{" "}
                                            {safeStr(term?.semester) ? `(${safeStr(term?.semester)})` : ""}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border p-3">
                                        <div className="text-xs text-muted-foreground">Faculty</div>
                                        <div className="font-medium">
                                            {safeStr(profile?.name) || safeStr(user?.name) || "—"}
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Schedule picker */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="text-sm font-medium">Schedule Item (Optional)</div>
                                            <div className="text-xs text-muted-foreground">
                                                Attach the change request to a specific meeting/class.
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {selectedSchedule ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSelectedSchedule(null)}
                                                >
                                                    <X className="h-4 w-4 mr-2" />
                                                    Clear
                                                </Button>
                                            ) : null}

                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => setSchedulePickerOpen(true)}
                                            >
                                                <CalendarDays className="h-4 w-4 mr-2" />
                                                Pick from My Schedule
                                            </Button>
                                        </div>
                                    </div>

                                    {selectedSchedule ? (
                                        <div className="rounded-lg border p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-xs text-muted-foreground">Selected</div>
                                                    <div className="font-medium break-words">{selectedLabel}</div>
                                                </div>

                                                <Badge variant="secondary" className="shrink-0">
                                                    Linked
                                                </Badge>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                            No schedule item selected. You can still submit a general request.
                                        </div>
                                    )}
                                </div>

                                {/* Type + Details */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Request Type</Label>
                                        <Select value={requestType} onValueChange={(v) => setRequestType(v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select request type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REQUEST_TYPES.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="text-xs text-muted-foreground">
                                            Examples: conflict correction, schedule swap, room/time adjustments.
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Details / Reason</Label>
                                        <Textarea
                                            value={details}
                                            onChange={(e) => setDetails(e.target.value)}
                                            placeholder="Explain your requested change (include reason + preferred adjustment)..."
                                            className="min-h-24"
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            Be specific: what should change and what should it become.
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <Button onClick={() => void submitRequest()} disabled={loadingSubmit}>
                                        <Send className={cn("h-4 w-4 mr-2", loadingSubmit && "animate-pulse")} />
                                        Submit Request
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* My Requests */}
                <Card>
                    <CardHeader>
                        <CardTitle>My Requests</CardTitle>
                        <CardDescription>
                            Track your submitted requests and their approval status.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : requests.length === 0 ? (
                            <Alert>
                                <AlertTitle>No requests yet</AlertTitle>
                                <AlertDescription>
                                    Submit your first schedule/load change request above.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-3">
                                {requests.map((r) => {
                                    const rid = safeStr(r?.$id)
                                    const status = safeStr(r?.status || "Pending")
                                    const canCancel = status.toLowerCase() === "pending"

                                    return (
                                        <div key={rid} className="rounded-xl border p-3">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="font-medium">{safeStr(r?.type || "Request")}</div>
                                                        <Badge variant={badgeVariantForStatus(status) as any}>{status}</Badge>
                                                    </div>

                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Submitted: {formatDateTime(r?.$createdAt || r?.$updatedAt)}
                                                    </div>

                                                    <div className="mt-2 text-sm line-clamp-2">{safeStr(r?.details)}</div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setActiveRequest(r)
                                                            setRequestViewOpen(true)
                                                        }}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View
                                                    </Button>

                                                    {canCancel ? (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => void cancelRequest(rid)}
                                                            disabled={loadingCancelId === rid}
                                                        >
                                                            {loadingCancelId === rid ? "Cancelling..." : "Cancel"}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Schedule Picker Dialog */}
                <Dialog open={schedulePickerOpen} onOpenChange={setSchedulePickerOpen}>
                    <DialogContent className="max-w-5xl max-h-[80dvh] overflow-hidden flex flex-col">
                        <DialogHeader className="shrink-0">
                            <DialogTitle>Pick Schedule Item</DialogTitle>
                            <DialogDescription>
                                Select the class/meeting you want to request a change for.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="shrink-0 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={scheduleSearch}
                                    onChange={(e) => setScheduleSearch(e.target.value)}
                                    placeholder="Search subject / section / day / room..."
                                    className="pl-9"
                                />
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => setScheduleSearch("")}
                                disabled={!scheduleSearch}
                            >
                                Clear
                            </Button>
                        </div>

                        <Separator className="shrink-0" />

                        {/* ✅ Decreased dialog height + proper vertical scrollbar */}
                        <ScrollArea className="flex-1 min-h-0 pr-2">
                            {scheduleFiltered.length === 0 ? (
                                <Alert>
                                    <AlertTitle>No matches</AlertTitle>
                                    <AlertDescription>
                                        Try another keyword (subject code, section, day, room).
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="space-y-2">
                                    {scheduleFiltered.map((it) => {
                                        const key = `${safeStr(it.meetingId)}:${safeStr(it.classId)}`
                                        const selected =
                                            selectedSchedule?.meetingId === it.meetingId &&
                                            selectedSchedule?.classId === it.classId

                                        const title = buildScheduleTitle(it)
                                        const sub = buildScheduleSubLine(it)
                                        const meta = buildScheduleMetaLine(it)

                                        return (
                                            <Button
                                                key={key}
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setSelectedSchedule(it)
                                                    setSchedulePickerOpen(false)
                                                    toast.success("Schedule item linked")
                                                }}
                                                className={cn(
                                                    "w-full h-auto rounded-xl p-3 text-left justify-start items-start whitespace-normal",
                                                    "hover:bg-accent",
                                                    selected && "ring-2 ring-primary"
                                                )}
                                            >
                                                <div className="flex w-full items-start justify-between gap-3">
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="font-medium leading-snug break-words">{title}</div>

                                                        <div className="text-sm text-muted-foreground leading-snug break-words">
                                                            {sub}
                                                        </div>

                                                        <div className="text-xs text-muted-foreground leading-snug break-words">
                                                            {meta}
                                                        </div>
                                                    </div>

                                                    <Badge variant="secondary" className="shrink-0">
                                                        Select
                                                    </Badge>
                                                </div>
                                            </Button>
                                        )
                                    })}
                                </div>
                            )}

                            {/* ✅ Visible scrollbar */}
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>

                        <DialogFooter className="shrink-0">
                            <Button variant="outline" onClick={() => setSchedulePickerOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Request View Dialog */}
                <Dialog open={requestViewOpen} onOpenChange={setRequestViewOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Request Details</DialogTitle>
                            <DialogDescription>
                                Review request status and department head resolution notes.
                            </DialogDescription>
                        </DialogHeader>

                        {activeRequest ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-medium">{safeStr(activeRequest.type)}</div>
                                        <Badge variant={badgeVariantForStatus(safeStr(activeRequest.status)) as any}>
                                            {safeStr(activeRequest.status)}
                                        </Badge>
                                    </div>

                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Submitted: {formatDateTime(activeRequest.$createdAt || activeRequest.$updatedAt)}
                                    </div>

                                    <div className="mt-3 text-sm whitespace-pre-wrap">
                                        {safeStr(activeRequest.details)}
                                    </div>
                                </div>

                                <div className="rounded-xl border p-3">
                                    <div className="text-sm font-medium">Resolution Notes</div>
                                    <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                        {safeStr(activeRequest.resolutionNotes) || "—"}
                                    </div>

                                    <div className="mt-3 text-xs text-muted-foreground">
                                        Reviewed At: {formatDateTime(activeRequest.reviewedAt)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Alert>
                                <AlertTitle>No request selected</AlertTitle>
                                <AlertDescription>Select a request to view details.</AlertDescription>
                            </Alert>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRequestViewOpen(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
