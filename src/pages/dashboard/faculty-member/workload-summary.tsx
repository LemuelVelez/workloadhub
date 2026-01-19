/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { RefreshCw, Search, BookOpen, Layers, Clock } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"
import { facultyMemberApi, type FacultyWorkloadSummaryItem } from "@/api/faculty-member"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function toNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function minutesToHours(mins: number) {
    const h = mins / 60
    if (!Number.isFinite(h)) return 0
    return h
}

function resolveUserId(user: any) {
    return safeStr(user?.$id || user?.id || user?.userId)
}

function fmtHours(v: number) {
    if (!Number.isFinite(v)) return "0"
    // show 2 decimals only if needed
    const rounded = Math.round(v * 100) / 100
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function badgeVariantForStatus(status: any): "default" | "secondary" | "destructive" | "outline" {
    const s = safeStr(status).toLowerCase()
    if (s.includes("final")) return "default"
    if (s.includes("planned")) return "secondary"
    if (s.includes("cancel")) return "destructive"
    return "outline"
}

export default function FacultyWorkloadSummaryPage() {
    const { user } = useSession()

    const userId = React.useMemo(() => resolveUserId(user), [user])

    const [loading, setLoading] = React.useState(false)
    const [data, setData] = React.useState<any | null>(null)
    const [query, setQuery] = React.useState("")

    const load = React.useCallback(async () => {
        const uid = safeStr(userId)
        if (!uid) return

        setLoading(true)
        try {
            const res = await facultyMemberApi.workloads.getMyWorkloadSummary({ userId: uid })
            setData(res)
        } catch (err: any) {
            console.error(err)
            toast.error("Failed to load workload summary.")
        } finally {
            setLoading(false)
        }
    }, [userId])

    React.useEffect(() => {
        if (!userId) return
        void load()
    }, [userId, load])

    const termLabel = React.useMemo(() => {
        const term = data?.term
        if (!term) return ""
        const sy = safeStr(term?.schoolYear)
        const sem = safeStr(term?.semester)
        if (sy && sem) return `${sy} • ${sem}`
        return sy || sem || ""
    }, [data])

    const versionLabel = React.useMemo(() => {
        const v = data?.version
        if (!v) return ""
        const label = safeStr(v?.label)
        const ver = safeStr(v?.version)
        const status = safeStr(v?.status)
        const left = label || (ver ? `Version ${ver}` : "")
        return [left, status].filter(Boolean).join(" • ")
    }, [data])

    const items: FacultyWorkloadSummaryItem[] = React.useMemo(() => {
        return Array.isArray(data?.items) ? data.items : []
    }, [data])

    const filtered = React.useMemo(() => {
        const q = safeStr(query).toLowerCase()
        if (!q) return items

        return items.filter((it) => {
            const hay = [
                it.subjectCode,
                it.subjectTitle,
                it.sectionLabel,
                it.classCode,
                it.deliveryMode,
                it.status,
            ]
                .map((x) => safeStr(x).toLowerCase())
                .join(" ")
            return hay.includes(q)
        })
    }, [items, query])

    const totals = React.useMemo(() => {
        const all = items

        const totalSubjects = all.length

        let totalUnits = 0
        let totalLec = 0
        let totalLab = 0
        let totalPlanned = 0
        let totalWeeklyMinutes = 0

        for (const it of all) {
            totalUnits += toNum(it.units)
            totalLec += toNum(it.lectureHours)
            totalLab += toNum(it.labHours)
            totalPlanned += toNum(it.totalHours)
            totalWeeklyMinutes += toNum(it.weeklyMinutes)
        }

        return {
            totalSubjects,
            totalUnits,
            totalLec,
            totalLab,
            totalPlanned,
            totalWeeklyHours: minutesToHours(totalWeeklyMinutes),
        }
    }, [items])

    const facultyLimits = React.useMemo(() => {
        const fp = data?.facultyProfile
        const maxUnits = toNum(fp?.maxUnits, 0)
        const maxHours = toNum(fp?.maxHours, 0)
        const rank = safeStr(fp?.rank || "")
        return { maxUnits, maxHours, rank }
    }, [data])

    const emptyState = !loading && items.length === 0

    return (
        <DashboardLayout
            title="My Workload Summary"
            subtitle="View assigned subjects/sections, units/hours, and totals for the active term."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void load()}
                        disabled={loading || !userId}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6 min-w-0">
                {/* Header badges */}
                <div className="flex flex-wrap items-center gap-2">
                    {termLabel ? (
                        <Badge variant="secondary">{termLabel}</Badge>
                    ) : (
                        <Badge variant="outline">No active term</Badge>
                    )}

                    {versionLabel ? (
                        <Badge variant="outline">{versionLabel}</Badge>
                    ) : (
                        <Badge variant="outline">No schedule version</Badge>
                    )}

                    {facultyLimits.rank ? (
                        <Badge variant="outline">Rank: {facultyLimits.rank}</Badge>
                    ) : null}
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Total Subjects
                            </CardTitle>
                            <CardDescription>Unique assigned classes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-24" />
                            ) : (
                                <div className="text-2xl font-semibold">{totals.totalSubjects}</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Total Units
                            </CardTitle>
                            <CardDescription>
                                {facultyLimits.maxUnits > 0 ? `Limit: ${facultyLimits.maxUnits}` : "Assigned units"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-28" />
                            ) : (
                                <div className="text-2xl font-semibold">
                                    {fmtHours(totals.totalUnits)}
                                    {facultyLimits.maxUnits > 0 ? (
                                        <span className="text-muted-foreground text-base font-normal">
                                            {" "}
                                            / {fmtHours(facultyLimits.maxUnits)}
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Planned Hours
                            </CardTitle>
                            <CardDescription>
                                Lecture + Lab hours (subject basis)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-36" />
                            ) : (
                                <div className="text-2xl font-semibold">
                                    {fmtHours(totals.totalPlanned)}
                                </div>
                            )}
                            {!loading ? (
                                <div className="mt-2 text-xs text-muted-foreground">
                                    Lec: {fmtHours(totals.totalLec)} • Lab: {fmtHours(totals.totalLab)}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="min-w-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Scheduled Hours
                            </CardTitle>
                            <CardDescription>
                                Based on current meetings
                                {facultyLimits.maxHours > 0 ? ` • Limit: ${facultyLimits.maxHours}` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Skeleton className="h-8 w-36" />
                            ) : (
                                <div className="text-2xl font-semibold">
                                    {fmtHours(totals.totalWeeklyHours)}
                                    {facultyLimits.maxHours > 0 ? (
                                        <span className="text-muted-foreground text-base font-normal">
                                            {" "}
                                            / {fmtHours(facultyLimits.maxHours)}
                                        </span>
                                    ) : null}
                                </div>
                            )}
                            {!loading ? (
                                <div className="mt-2 text-xs text-muted-foreground">
                                    Weekly (computed from meeting times)
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                <Card className="min-w-0">
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0">
                                <CardTitle className="truncate">Assigned Workload</CardTitle>
                                <CardDescription className="truncate">
                                    Subjects, sections, and computed totals.
                                </CardDescription>
                            </div>

                            <div className="w-full sm:w-80">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search subject, section, class code..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-11/12" />
                                <Skeleton className="h-10 w-10/12" />
                            </div>
                        ) : emptyState ? (
                            <Alert>
                                <AlertTitle>No workload assigned</AlertTitle>
                                <AlertDescription>
                                    You don’t have any assigned classes for the active term/version yet.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="w-full min-w-0 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap">Subject</TableHead>
                                            <TableHead className="whitespace-nowrap">Section</TableHead>
                                            <TableHead className="whitespace-nowrap">Class Code</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Units</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Lec</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Lab</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Planned</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Meetings</TableHead>
                                            <TableHead className="whitespace-nowrap text-right">Sched (hrs)</TableHead>
                                            <TableHead className="whitespace-nowrap">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center text-muted-foreground">
                                                    No results for “{query}”
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filtered.map((it) => {
                                                const subjectLine = [
                                                    safeStr(it.subjectCode),
                                                    safeStr(it.subjectTitle),
                                                ].filter(Boolean).join(" • ")

                                                const scheduledHours = minutesToHours(toNum(it.weeklyMinutes, 0))

                                                return (
                                                    <TableRow key={it.classId}>
                                                        <TableCell className="min-w-64">
                                                            <div className="font-medium truncate">{subjectLine || "—"}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {safeStr(it.deliveryMode) ? `Mode: ${safeStr(it.deliveryMode)}` : " "}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {safeStr(it.sectionLabel) || "—"}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {safeStr(it.classCode) || "—"}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {fmtHours(toNum(it.units, 0))}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {fmtHours(toNum(it.lectureHours, 0))}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {fmtHours(toNum(it.labHours, 0))}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {fmtHours(toNum(it.totalHours, 0))}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {toNum(it.meetingCount, 0)}
                                                        </TableCell>

                                                        <TableCell className="text-right whitespace-nowrap">
                                                            {fmtHours(scheduledHours)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            <Badge variant={badgeVariantForStatus(it.status)}>
                                                                {safeStr(it.status) || "—"}
                                                            </Badge>
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

                {/* Small note for clarity */}
                {!loading && items.length > 0 ? (
                    <div className="text-xs text-muted-foreground">
                        Note: <span className="font-medium">Planned Hours</span> come from the <span className="font-medium">Subject</span> (lecture+lab),
                        while <span className="font-medium">Scheduled Hours</span> are computed from actual meeting time blocks.
                    </div>
                ) : null}
            </div>
        </DashboardLayout>
    )
}
