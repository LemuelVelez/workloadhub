/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, RefreshCw, Pencil, Trash2, Search } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"

import { facultyMemberApi } from "@/api/faculty-member"
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
import { Separator } from "@/components/ui/separator"
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"

type AvailabilityRow = {
    $id: string
    $createdAt?: string
    $updatedAt?: string

    termId: string
    userId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    preference: string
    notes?: string | null
}

const DAY_OPTIONS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

const PREF_OPTIONS = ["Preferred", "Neutral", "Unavailable"] as const

const DAY_ORDER = new Map<string, number>(
    DAY_OPTIONS.map((d, i) => [d, i])
)

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function pad2(n: number) {
    return String(n).padStart(2, "0")
}

function timeToMinutes(t: any) {
    const s = safeStr(t)
    if (!s) return 0
    const parts = s.split(":").map((x) => Number(x))
    const hh = Number.isFinite(parts[0]) ? parts[0] : 0
    const mm = Number.isFinite(parts[1]) ? parts[1] : 0
    return hh * 60 + mm
}

function minutesToTime(m: number) {
    const clamped = Math.max(0, m)
    const hh = Math.floor(clamped / 60)
    const mm = clamped % 60
    return `${pad2(hh)}:${pad2(mm)}`
}

const TIME_OPTIONS = (() => {
    // ✅ ShadCN-only selection (NO native time picker)
    // 06:00 to 21:00 every 30 mins
    const out: string[] = []
    for (let h = 6; h <= 21; h++) {
        for (const m of [0, 30]) {
            if (h === 21 && m === 30) continue
            out.push(`${pad2(h)}:${pad2(m)}`)
        }
    }
    return out
})()

function nextTimeSlot(start: string, addMinutes = 60) {
    const next = timeToMinutes(start) + addMinutes
    const t = minutesToTime(next)
    return TIME_OPTIONS.includes(t) ? t : TIME_OPTIONS[TIME_OPTIONS.length - 1]
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const a1 = timeToMinutes(aStart)
    const a2 = timeToMinutes(aEnd)
    const b1 = timeToMinutes(bStart)
    const b2 = timeToMinutes(bEnd)
    if (a2 <= a1 || b2 <= b1) return false
    return a1 < b2 && b1 < a2
}

function badgeVariant(pref: string) {
    const p = safeStr(pref).toLowerCase()
    if (p.includes("unavail")) return "destructive"
    if (p.includes("prefer")) return "default"
    return "secondary"
}

export default function PreferenceSubmissionPage() {
    const { user } = useSession()

    const userId = React.useMemo(() => {
        return safeStr(user?.$id || user?.id || user?.userId)
    }, [user])

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [term, setTerm] = React.useState<any | null>(null)
    const [rows, setRows] = React.useState<AvailabilityRow[]>([])

    const [dayFilter, setDayFilter] = React.useState<string>("All")
    const [prefFilter, setPrefFilter] = React.useState<string>("All")
    const [search, setSearch] = React.useState<string>("")

    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [editing, setEditing] = React.useState<AvailabilityRow | null>(null)

    const [formDay, setFormDay] = React.useState<string>("Monday")
    const [formStart, setFormStart] = React.useState<string>("08:00")
    const [formEnd, setFormEnd] = React.useState<string>("09:00")
    const [formPref, setFormPref] = React.useState<string>("Preferred")
    const [formNotes, setFormNotes] = React.useState<string>("")
    const [formError, setFormError] = React.useState<string | null>(null)

    const resetForm = React.useCallback(() => {
        setEditing(null)
        setFormDay("Monday")
        setFormStart("08:00")
        setFormEnd("09:00")
        setFormPref("Preferred")
        setFormNotes("")
        setFormError(null)
    }, [])

    const openCreate = React.useCallback(() => {
        resetForm()
        setDialogOpen(true)
    }, [resetForm])

    const openEdit = React.useCallback((r: AvailabilityRow) => {
        setEditing(r)
        setFormDay(safeStr(r?.dayOfWeek) || "Monday")
        setFormStart(safeStr(r?.startTime) || "08:00")
        setFormEnd(safeStr(r?.endTime) || "09:00")
        setFormPref(safeStr(r?.preference) || "Preferred")
        setFormNotes(safeStr(r?.notes || ""))
        setFormError(null)
        setDialogOpen(true)
    }, [])

    // ✅ Keep end time valid if start time changes
    React.useEffect(() => {
        const s = safeStr(formStart)
        const e = safeStr(formEnd)

        if (!s || !e) return
        if (timeToMinutes(e) <= timeToMinutes(s)) {
            setFormEnd(nextTimeSlot(s, 60))
        }
    }, [formStart, formEnd])

    const load = React.useCallback(async () => {
        if (!userId) {
            setLoading(false)
            setTerm(null)
            setRows([])
            return
        }

        setLoading(true)
        try {
            const res = await facultyMemberApi.availability.listMy({ userId })
            setTerm(res?.term ?? null)
            setRows(Array.isArray(res?.items) ? res.items : [])
        } catch (err: any) {
            console.error(err)
            toast.error("Failed to load availability records.")
            setTerm(null)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [userId])

    const refresh = React.useCallback(async () => {
        if (!userId) return
        setRefreshing(true)
        try {
            const res = await facultyMemberApi.availability.listMy({ userId })
            setTerm(res?.term ?? null)
            setRows(Array.isArray(res?.items) ? res.items : [])
        } catch {
            toast.error("Failed to refresh availability.")
        } finally {
            setRefreshing(false)
        }
    }, [userId])

    React.useEffect(() => {
        void load()
    }, [load])

    const filtered = React.useMemo(() => {
        const s = safeStr(search).toLowerCase()

        const base = rows.filter((r) => {
            if (dayFilter !== "All" && safeStr(r.dayOfWeek) !== dayFilter) return false
            if (prefFilter !== "All" && safeStr(r.preference) !== prefFilter) return false

            if (!s) return true
            const hay = [
                safeStr(r.dayOfWeek),
                safeStr(r.startTime),
                safeStr(r.endTime),
                safeStr(r.preference),
                safeStr(r.notes),
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(s)
        })

        // ✅ Sort by day + time
        return base.slice().sort((a, b) => {
            const da = DAY_ORDER.get(safeStr(a.dayOfWeek)) ?? 99
            const db = DAY_ORDER.get(safeStr(b.dayOfWeek)) ?? 99
            if (da !== db) return da - db
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        })
    }, [rows, dayFilter, prefFilter, search])

    const summary = React.useMemo(() => {
        const total = rows.length
        const preferred = rows.filter((x) => safeStr(x.preference) === "Preferred").length
        const neutral = rows.filter((x) => safeStr(x.preference) === "Neutral").length
        const unavailable = rows.filter((x) => safeStr(x.preference) === "Unavailable").length
        return { total, preferred, neutral, unavailable }
    }, [rows])

    const validate = React.useCallback(() => {
        const day = safeStr(formDay)
        const start = safeStr(formStart)
        const end = safeStr(formEnd)
        const pref = safeStr(formPref)

        if (!day) return "Please select a day."
        if (!start) return "Please select a start time."
        if (!end) return "Please select an end time."
        if (timeToMinutes(end) <= timeToMinutes(start)) return "End time must be later than start time."
        if (!pref) return "Please select a preference."

        const candidateId = safeStr(editing?.$id)

        const hasOverlap = rows.some((r) => {
            if (safeStr(r?.dayOfWeek) !== day) return false
            if (candidateId && safeStr(r?.$id) === candidateId) return false
            return overlaps(start, end, safeStr(r?.startTime), safeStr(r?.endTime))
        })

        if (hasOverlap) return "This time slot overlaps with an existing entry on the same day."

        return null
    }, [formDay, formStart, formEnd, formPref, rows, editing])

    const submit = React.useCallback(async () => {
        if (!userId) {
            toast.error("User session not found.")
            return
        }

        const err = validate()
        if (err) {
            setFormError(err)
            return
        }

        setSaving(true)
        setFormError(null)

        try {
            if (editing?.$id) {
                await facultyMemberApi.availability.updateMy({
                    userId,
                    rowId: editing.$id,
                    dayOfWeek: formDay,
                    startTime: formStart,
                    endTime: formEnd,
                    preference: formPref,
                    notes: formNotes,
                })
                toast.success("Availability updated.")
            } else {
                await facultyMemberApi.availability.createMy({
                    userId,
                    dayOfWeek: formDay,
                    startTime: formStart,
                    endTime: formEnd,
                    preference: formPref,
                    notes: formNotes,
                })
                toast.success("Availability added.")
            }

            setDialogOpen(false)
            resetForm()
            await refresh()
        } catch (e: any) {
            console.error(e)
            toast.error("Failed to save availability.")
        } finally {
            setSaving(false)
        }
    }, [
        userId,
        validate,
        editing,
        formDay,
        formStart,
        formEnd,
        formPref,
        formNotes,
        refresh,
        resetForm,
    ])

    const remove = React.useCallback(
        async (rowId: string) => {
            if (!userId) return
            const id = safeStr(rowId)
            if (!id) return

            try {
                await facultyMemberApi.availability.deleteMy({ userId, rowId: id })
                toast.success("Entry deleted.")
                await refresh()
            } catch (e: any) {
                console.error(e)
                toast.error("Failed to delete entry.")
            }
        },
        [userId, refresh]
    )

    const termLabel = React.useMemo(() => {
        if (!term) return "No Active Term"
        const sy = safeStr(term?.schoolYear)
        const sem = safeStr(term?.semester)
        const out = [sy, sem].filter(Boolean).join(" • ")
        return out || "Active Term"
    }, [term])

    return (
        <DashboardLayout
            title="Availability Preferences"
            subtitle="Submit your preferred / neutral / unavailable time slots for scheduling."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void refresh()}
                        disabled={refreshing || loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin")} />
                        <span className="ml-2">Refresh</span>
                    </Button>

                    <Button onClick={openCreate} disabled={!userId}>
                        <Plus className="h-4 w-4" />
                        <span className="ml-2">Add Slot</span>
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-5">
                {!userId ? (
                    <Alert variant="destructive">
                        <AlertTitle>Session not found</AlertTitle>
                        <AlertDescription>
                            Please re-login to continue.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <Card className="rounded-2xl">
                    <CardHeader className="space-y-1">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <CardTitle className="truncate">My Availability</CardTitle>
                                <CardDescription className="truncate">
                                    {termLabel}
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 justify-end">
                                <Badge variant="outline">Total: {summary.total}</Badge>
                                <Badge variant="default">Preferred: {summary.preferred}</Badge>
                                <Badge variant="secondary">Neutral: {summary.neutral}</Badge>
                                <Badge variant="destructive">Unavailable: {summary.unavailable}</Badge>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {!term?.$id && !loading ? (
                            <Alert>
                                <AlertTitle>No Active Academic Term</AlertTitle>
                                <AlertDescription>
                                    Please contact the admin to set an active academic term before submitting availability.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-1 items-center gap-2 min-w-0">
                                <div className="relative w-full max-w-xl min-w-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Search day, time, preference, notes..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Select value={dayFilter} onValueChange={setDayFilter}>
                                    <SelectTrigger className="w-full sm:w-44">
                                        <SelectValue placeholder="Filter Day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Days</SelectItem>
                                        {DAY_OPTIONS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={prefFilter} onValueChange={setPrefFilter}>
                                    <SelectTrigger className="w-full sm:w-44">
                                        <SelectValue placeholder="Filter Preference" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Preferences</SelectItem>
                                        {PREF_OPTIONS.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDayFilter("All")
                                        setPrefFilter("All")
                                        setSearch("")
                                    }}
                                >
                                    Reset
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
                        ) : filtered.length === 0 ? (
                            <Alert>
                                <AlertTitle>No entries found</AlertTitle>
                                <AlertDescription>
                                    Add your time slots using <span className="font-medium">Add Slot</span> to help scheduling assign classes properly.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">Day</TableHead>
                                            <TableHead className="w-48">Time</TableHead>
                                            <TableHead className="w-44">Preference</TableHead>
                                            <TableHead>Notes</TableHead>
                                            <TableHead className="w-28 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.map((r) => (
                                            <TableRow key={r.$id}>
                                                <TableCell className="font-medium">
                                                    {safeStr(r.dayOfWeek)}
                                                </TableCell>

                                                <TableCell>
                                                    {safeStr(r.startTime)} - {safeStr(r.endTime)}
                                                </TableCell>

                                                <TableCell>
                                                    <Badge variant={badgeVariant(r.preference) as any}>
                                                        {safeStr(r.preference) || "Neutral"}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="text-muted-foreground">
                                                    {safeStr(r.notes) || "—"}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEdit(r)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>

                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>

                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will permanently remove the time slot from your availability preferences.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>

                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => void remove(r.$id)}
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ✅ Add/Edit Dialog */}
                <Dialog
                    open={dialogOpen}
                    onOpenChange={(v) => {
                        setDialogOpen(v)
                        if (!v) resetForm()
                    }}
                >
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {editing?.$id ? "Edit Availability Slot" : "Add Availability Slot"}
                            </DialogTitle>
                            <DialogDescription>
                                Submit your preferred/neutral/unavailable time slot for the active term.
                            </DialogDescription>
                        </DialogHeader>

                        {formError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Validation Error</AlertTitle>
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        ) : null}

                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Day</Label>
                                <Select value={formDay} onValueChange={setFormDay}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DAY_OPTIONS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Start Time</Label>
                                    <Select value={formStart} onValueChange={setFormStart}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select start time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_OPTIONS.map((t) => (
                                                <SelectItem key={t} value={t}>
                                                    {t}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>End Time</Label>
                                    <Select value={formEnd} onValueChange={setFormEnd}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select end time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_OPTIONS.map((t) => (
                                                <SelectItem key={t} value={t}>
                                                    {t}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Preference</Label>
                                <Select value={formPref} onValueChange={setFormPref}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select preference" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PREF_OPTIONS.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder="Add remarks like preferred time, constraints, etc."
                                    className="min-h-20"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false)
                                    resetForm()
                                }}
                                disabled={saving}
                                className="mr-2"
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                onClick={() => void submit()}
                                disabled={saving}
                            >
                                {saving ? "Saving..." : editing?.$id ? "Update" : "Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    )
}
