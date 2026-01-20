/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"
import { departmentHeadApi } from "@/api/department-head"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    RefreshCw,
    Users,
    CalendarDays,
    Clock,
    Search,
    AlertTriangle,
    UserCircle2,
    Check,
} from "lucide-react"

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"

type AnyDoc = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

type FacultyRow = {
    userId: string
    name: string
    email?: string | null
    rank?: string | null
    maxUnits?: number | null
    maxHours?: number | null
    avatarUrl?: string | null
}

type AvailabilityRow = {
    $id: string
    termId: string
    userId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    preference: string
    notes?: string | null
    $updatedAt?: string
}

const DAYS: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const DAY_ORDER: Record<string, number> = DAYS.reduce((acc, d, i) => {
    acc[d.toLowerCase()] = i
    return acc
}, {} as Record<string, number>)

const PREFERENCE_OPTIONS = ["All", "Preferred", "Neutral", "Unavailable"] as const

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function normalizeDay(v: any): string {
    const s = safeStr(v)
    if (!s) return ""
    const lower = s.toLowerCase()

    // common abbreviations
    if (lower === "mon" || lower === "monday") return "Monday"
    if (lower === "tue" || lower === "tues" || lower === "tuesday") return "Tuesday"
    if (lower === "wed" || lower === "wednesday") return "Wednesday"
    if (lower === "thu" || lower === "thur" || lower === "thurs" || lower === "thursday") return "Thursday"
    if (lower === "fri" || lower === "friday") return "Friday"
    if (lower === "sat" || lower === "saturday") return "Saturday"
    if (lower === "sun" || lower === "sunday") return "Sunday"

    // fallback: capitalize first
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function normalizePreference(v: any): string {
    const s = safeStr(v)
    if (!s) return "Neutral"
    const lower = s.toLowerCase()
    if (lower.includes("unavail")) return "Unavailable"
    if (lower.includes("prefer")) return "Preferred"
    if (lower.includes("neutral")) return "Neutral"
    return s
}

function badgeVariantForPreference(pref: string) {
    const p = normalizePreference(pref).toLowerCase()
    if (p === "unavailable") return "destructive"
    if (p === "preferred") return "default"
    return "secondary"
}

function prettyTime(t: any) {
    const s = safeStr(t)
    return s || "—"
}

function sortAvail(a: AvailabilityRow, b: AvailabilityRow) {
    const ad = DAY_ORDER[normalizeDay(a.dayOfWeek).toLowerCase()] ?? 99
    const bd = DAY_ORDER[normalizeDay(b.dayOfWeek).toLowerCase()] ?? 99
    if (ad !== bd) return ad - bd

    const at = safeStr(a.startTime)
    const bt = safeStr(b.startTime)
    if (at !== bt) return at.localeCompare(bt)

    const ae = safeStr(a.endTime)
    const be = safeStr(b.endTime)
    return ae.localeCompare(be)
}

export default function FacultyAvailabilityPage() {
    const { user } = useSession()

    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)

    const [activeTerm, setActiveTerm] = React.useState<AnyDoc | null>(null)

    const [departmentId, setDepartmentId] = React.useState<string>("")
    const [departmentName, setDepartmentName] = React.useState<string>("") // ✅ NEW

    const [facultyRows, setFacultyRows] = React.useState<FacultyRow[]>([])
    const [availability, setAvailability] = React.useState<AvailabilityRow[]>([])

    const [selectedFacultyUserId, setSelectedFacultyUserId] = React.useState<string>("")
    const [search, setSearch] = React.useState<string>("")
    const [filterDay, setFilterDay] = React.useState<string>("All")
    const [filterPref, setFilterPref] = React.useState<string>("All")

    const userId = React.useMemo(() => safeStr(user?.$id || user?.id || user?.userId), [user])

    const facultyMap = React.useMemo(() => {
        const m = new Map<string, FacultyRow>()
        for (const f of facultyRows) m.set(f.userId, f)
        return m
    }, [facultyRows])

    const filteredAvailability = React.useMemo(() => {
        let rows = [...availability]

        if (selectedFacultyUserId) {
            rows = rows.filter((r) => safeStr(r.userId) === selectedFacultyUserId)
        }

        if (filterDay !== "All") {
            rows = rows.filter((r) => normalizeDay(r.dayOfWeek) === filterDay)
        }

        if (filterPref !== "All") {
            rows = rows.filter((r) => normalizePreference(r.preference) === filterPref)
        }

        const q = safeStr(search).toLowerCase()
        if (q) {
            rows = rows.filter((r) => {
                const facultyName = safeStr(facultyMap.get(safeStr(r.userId))?.name).toLowerCase()
                const notes = safeStr(r.notes).toLowerCase()
                const day = normalizeDay(r.dayOfWeek).toLowerCase()
                const pref = normalizePreference(r.preference).toLowerCase()
                const time = `${safeStr(r.startTime)}-${safeStr(r.endTime)}`.toLowerCase()
                return (
                    facultyName.includes(q) ||
                    notes.includes(q) ||
                    day.includes(q) ||
                    pref.includes(q) ||
                    time.includes(q)
                )
            })
        }

        rows.sort(sortAvail)
        return rows
    }, [availability, selectedFacultyUserId, filterDay, filterPref, search, facultyMap])

    const groupedByFaculty = React.useMemo(() => {
        const map = new Map<string, AvailabilityRow[]>()
        for (const r of availability) {
            const uid = safeStr(r.userId)
            if (!uid) continue
            const prev = map.get(uid) ?? []
            prev.push(r)
            map.set(uid, prev)
        }

        for (const [k, v] of map.entries()) {
            v.sort(sortAvail)
            map.set(k, v)
        }

        return map
    }, [availability])

    const facultyStats = React.useMemo(() => {
        const total = facultyRows.length
        const withPrefs = facultyRows.filter((f) => (groupedByFaculty.get(f.userId)?.length ?? 0) > 0).length
        const withoutPrefs = Math.max(0, total - withPrefs)

        const pct = total > 0 ? Math.round((withPrefs / total) * 100) : 0

        return {
            total,
            withPrefs,
            withoutPrefs,
            pct,
        }
    }, [facultyRows, groupedByFaculty])

    async function loadAll(showToast = false) {
        if (!userId) return

        try {
            const term = await departmentHeadApi.terms.getActive()
            setActiveTerm(term)

            const profile = await departmentHeadApi.profiles.getByUserId(userId)
            const deptId = safeStr(profile?.departmentId)
            setDepartmentId(deptId)

            // ✅ NEW: Fetch Department NAME by ID
            if (deptId) {
                try {
                    const dept = await departmentHeadApi.departments.getById(deptId)
                    const name =
                        safeStr(dept?.name) ||
                        safeStr(dept?.departmentName) ||
                        safeStr(dept?.title) ||
                        safeStr(dept?.code)
                    setDepartmentName(name)
                } catch {
                    setDepartmentName("")
                }
            } else {
                setDepartmentName("")
            }

            if (!term?.$id || !deptId) {
                setFacultyRows([])
                setAvailability([])
                if (showToast) toast.warning("Missing active term or department profile.")
                return
            }

            const facultyRes = await departmentHeadApi.faculty.listByDepartment(deptId)

            const users: AnyDoc[] = Array.isArray(facultyRes?.users) ? facultyRes.users : []
            const profiles: AnyDoc[] = Array.isArray(facultyRes?.profiles) ? facultyRes.profiles : []

            const facultyProfileMap = new Map<string, AnyDoc>()
            for (const p of profiles) {
                const uid = safeStr(p?.userId)
                if (uid) facultyProfileMap.set(uid, p)
            }

            const facRows: FacultyRow[] = users.map((u) => {
                const uid = safeStr(u?.userId)
                const prof = facultyProfileMap.get(uid)
                return {
                    userId: uid,
                    name: safeStr(u?.name) || "Unnamed Faculty",
                    email: safeStr(u?.email) || null,
                    avatarUrl: safeStr(u?.avatarUrl) || null,
                    rank: safeStr(prof?.rank) || null,
                    maxUnits: Number.isFinite(Number(prof?.maxUnits)) ? Number(prof?.maxUnits) : null,
                    maxHours: Number.isFinite(Number(prof?.maxHours)) ? Number(prof?.maxHours) : null,
                }
            })

            facRows.sort((a, b) => a.name.localeCompare(b.name))
            setFacultyRows(facRows)

            const allAvailDocs = await departmentHeadApi.facultyAvailability.listByTerm(term.$id)
            const docs: AnyDoc[] = Array.isArray(allAvailDocs) ? allAvailDocs : []

            const allowedUserIds = new Set(facRows.map((f) => f.userId))

            const rows: AvailabilityRow[] = docs
                .map((d) => {
                    const uid = safeStr(d?.userId)
                    return {
                        $id: safeStr(d?.$id),
                        termId: safeStr(d?.termId),
                        userId: uid,
                        dayOfWeek: normalizeDay(d?.dayOfWeek),
                        startTime: safeStr(d?.startTime),
                        endTime: safeStr(d?.endTime),
                        preference: normalizePreference(d?.preference),
                        notes: safeStr(d?.notes) || null,
                        $updatedAt: safeStr(d?.$updatedAt),
                    }
                })
                .filter((r) => r.$id && r.termId && r.userId && allowedUserIds.has(r.userId))

            rows.sort(sortAvail)
            setAvailability(rows)

            // auto-select first faculty if none selected
            if (!selectedFacultyUserId && facRows[0]?.userId) {
                setSelectedFacultyUserId(facRows[0].userId)
            }

            if (showToast) toast.success("Faculty availability loaded.")
        } catch (e: any) {
            toast.error(e?.message || "Failed to load faculty availability.")
        }
    }

    React.useEffect(() => {
        let alive = true

        const run = async () => {
            setLoading(true)
            try {
                await loadAll(false)
            } finally {
                if (alive) setLoading(false)
            }
        }

        if (userId) void run()

        return () => {
            alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    async function onRefresh() {
        setRefreshing(true)
        try {
            await loadAll(true)
        } finally {
            setRefreshing(false)
        }
    }

    const activeTermLabel = React.useMemo(() => {
        if (!activeTerm) return "No active term"
        const sy = safeStr(activeTerm?.schoolYear)
        const sem = safeStr(activeTerm?.semester)
        if (sy && sem) return `${sy} • ${sem}`
        return safeStr(activeTerm?.$id) || "Active Term"
    }, [activeTerm])

    const selectedFaculty = React.useMemo(() => {
        return facultyRows.find((f) => f.userId === selectedFacultyUserId) ?? null
    }, [facultyRows, selectedFacultyUserId])

    const selectedFacultyAvail = React.useMemo(() => {
        if (!selectedFacultyUserId) return []
        return groupedByFaculty.get(selectedFacultyUserId) ?? []
    }, [groupedByFaculty, selectedFacultyUserId])

    const facultyNoPrefs = React.useMemo(() => {
        return facultyRows.filter((f) => (groupedByFaculty.get(f.userId)?.length ?? 0) === 0)
    }, [facultyRows, groupedByFaculty])

    return (
        <DashboardLayout
            title="Faculty Availability"
            subtitle="View faculty submitted time preferences (Preferred / Neutral / Unavailable)."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={loading || refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-5">
                {/* Header cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CalendarDays className="h-4 w-4" />
                                Active Term
                            </CardTitle>
                            <CardDescription>{activeTermLabel}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-2">
                            {/* ✅ CHANGED: Department Name instead of Department ID */}
                            <div className="text-sm text-muted-foreground">
                                Department:{" "}
                                <span className="font-medium text-foreground">
                                    {departmentName || "—"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-4 w-4" />
                                Submission Coverage
                            </CardTitle>
                            <CardDescription>Who submitted availability preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Submitted</span>
                                <span className="font-medium">
                                    {facultyStats.withPrefs} / {facultyStats.total}
                                </span>
                            </div>
                            <Progress value={facultyStats.pct} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>With preferences</span>
                                <span>{facultyStats.pct}%</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="h-4 w-4" />
                                Total Entries
                            </CardTitle>
                            <CardDescription>Availability blocks in this term</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="text-3xl font-semibold">{availability.length}</div>
                            <div className="text-sm text-muted-foreground">
                                Unsubmitted:{" "}
                                <span className="font-medium text-foreground">{facultyStats.withoutPrefs}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-72" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : !activeTerm?.$id ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Active Term</AlertTitle>
                        <AlertDescription>
                            Please set an active academic term first so faculty availability can be viewed.
                        </AlertDescription>
                    </Alert>
                ) : !departmentId ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Missing Department Profile</AlertTitle>
                        <AlertDescription>
                            Your user profile does not have a department assigned. Please contact the administrator.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Tabs defaultValue="byFaculty" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="byFaculty">By Faculty</TabsTrigger>
                            <TabsTrigger value="allEntries">All Entries</TabsTrigger>
                        </TabsList>

                        {/* ====================== BY FACULTY ====================== */}
                        <TabsContent value="byFaculty" className="space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <UserCircle2 className="h-4 w-4" />
                                        Faculty Selector
                                    </CardTitle>
                                    <CardDescription>
                                        Select a faculty member to view their submitted preferences.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                        {/* Faculty combobox */}
                                        <div className="md:col-span-2">
                                            <div className="text-sm font-medium mb-2">Faculty</div>
                                            <FacultyCombobox
                                                items={facultyRows}
                                                value={selectedFacultyUserId}
                                                onChange={(v) => setSelectedFacultyUserId(v)}
                                            />
                                        </div>

                                        {/* ✅ ShadCN Select: Day */}
                                        <div>
                                            <div className="text-sm font-medium mb-2">Day</div>
                                            <Select value={filterDay} onValueChange={setFilterDay}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="All">All</SelectItem>
                                                    {DAYS.map((d) => (
                                                        <SelectItem key={d} value={d}>
                                                            {d}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* ✅ ShadCN Select: Preference */}
                                        <div>
                                            <div className="text-sm font-medium mb-2">Preference</div>
                                            <Select value={filterPref} onValueChange={setFilterPref}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PREFERENCE_OPTIONS.map((p) => (
                                                        <SelectItem key={p} value={p}>
                                                            {p}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search notes, time range, day, preference..."
                                            className="pl-9"
                                        />
                                    </div>

                                    <Separator />

                                    {/* Faculty info */}
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-1">
                                            <div className="text-sm text-muted-foreground">Selected Faculty</div>
                                            <div className="text-lg font-semibold">
                                                {selectedFaculty?.name || "—"}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {selectedFaculty?.rank ? `Rank: ${selectedFaculty.rank}` : "Rank: —"}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">Entries: {selectedFacultyAvail.length}</Badge>
                                            {selectedFacultyAvail.length === 0 ? (
                                                <Badge variant="outline">No submission</Badge>
                                            ) : (
                                                <Badge variant="default">Submitted</Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Table */}
                                    {selectedFacultyUserId && filteredAvailability.length === 0 ? (
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>No matching entries</AlertTitle>
                                            <AlertDescription>
                                                Try changing filters or search keyword.
                                            </AlertDescription>
                                        </Alert>
                                    ) : selectedFacultyUserId ? (
                                        <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-44">Day</TableHead>
                                                        <TableHead className="w-44">Time</TableHead>
                                                        <TableHead className="w-44">Preference</TableHead>
                                                        <TableHead>Notes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredAvailability.map((r) => (
                                                        <TableRow key={r.$id}>
                                                            <TableCell className="font-medium">
                                                                {normalizeDay(r.dayOfWeek) || "—"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {prettyTime(r.startTime)} - {prettyTime(r.endTime)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant={badgeVariantForPreference(r.preference) as any}
                                                                >
                                                                    {normalizePreference(r.preference)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {safeStr(r.notes) || "—"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>No faculty selected</AlertTitle>
                                            <AlertDescription>
                                                Please select a faculty member to view availability preferences.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Faculty without submission */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Faculty Without Submission</CardTitle>
                                    <CardDescription>
                                        These faculty have not submitted preferences for the active term.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {facultyNoPrefs.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            All faculty have submitted preferences ✅
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-48 rounded-md border">
                                            <div className="p-3 space-y-2">
                                                {facultyNoPrefs.map((f) => (
                                                    <div
                                                        key={f.userId}
                                                        className="flex items-center justify-between rounded-md border px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="font-medium truncate">{f.name}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {f.email || "—"}
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline">No submission</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ====================== ALL ENTRIES ====================== */}
                        <TabsContent value="allEntries" className="space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">All Availability Entries</CardTitle>
                                    <CardDescription>
                                        Browse all submitted availability blocks for faculty in your department.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                        <div className="md:col-span-2">
                                            <div className="text-sm font-medium mb-2">Search</div>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    placeholder="Search faculty name, notes, day, time..."
                                                    className="pl-9"
                                                />
                                            </div>
                                        </div>

                                        {/* ✅ ShadCN Select: Day */}
                                        <div>
                                            <div className="text-sm font-medium mb-2">Day</div>
                                            <Select value={filterDay} onValueChange={setFilterDay}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="All">All</SelectItem>
                                                    {DAYS.map((d) => (
                                                        <SelectItem key={d} value={d}>
                                                            {d}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* ✅ ShadCN Select: Preference */}
                                        <div>
                                            <div className="text-sm font-medium mb-2">Preference</div>
                                            <Select value={filterPref} onValueChange={setFilterPref}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PREFERENCE_OPTIONS.map((p) => (
                                                        <SelectItem key={p} value={p}>
                                                            {p}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Separator />

                                    {filteredAvailability.length === 0 ? (
                                        <Alert>
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>No entries found</AlertTitle>
                                            <AlertDescription>
                                                Try changing your filters or search keyword.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Faculty</TableHead>
                                                        <TableHead className="w-40">Day</TableHead>
                                                        <TableHead className="w-44">Time</TableHead>
                                                        <TableHead className="w-44">Preference</TableHead>
                                                        <TableHead>Notes</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredAvailability.map((r) => {
                                                        const faculty = facultyMap.get(safeStr(r.userId))
                                                        return (
                                                            <TableRow key={r.$id}>
                                                                <TableCell className="font-medium">
                                                                    {faculty?.name || "Unknown Faculty"}
                                                                </TableCell>
                                                                <TableCell>{normalizeDay(r.dayOfWeek) || "—"}</TableCell>
                                                                <TableCell>
                                                                    {prettyTime(r.startTime)} - {prettyTime(r.endTime)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant={badgeVariantForPreference(r.preference) as any}
                                                                    >
                                                                        {normalizePreference(r.preference)}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground">
                                                                    {safeStr(r.notes) || "—"}
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
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </DashboardLayout>
    )
}

/**
 * ✅ ShadCN Combobox (Popover + Command)
 * Uses only components from ui.shadcn.com/docs/components
 */
function FacultyCombobox(props: {
    items: FacultyRow[]
    value: string
    onChange: (value: string) => void
}) {
    const { items, value, onChange } = props
    const [open, setOpen] = React.useState(false)

    const selected = React.useMemo(() => {
        return items.find((i) => i.userId === value) ?? null
    }, [items, value])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    <span className="truncate">
                        {selected?.name ? selected.name : "Select faculty..."}
                    </span>
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search faculty..." />
                    <CommandList>
                        <CommandEmpty>No faculty found.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => {
                                const isSelected = item.userId === value
                                return (
                                    <CommandItem
                                        key={item.userId}
                                        onSelect={() => {
                                            onChange(item.userId)
                                            setOpen(false)
                                        }}
                                        className="flex items-center justify-between"
                                    >
                                        <span className="truncate">{item.name}</span>
                                        {isSelected ? <Check className="h-4 w-4 opacity-100" /> : null}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
