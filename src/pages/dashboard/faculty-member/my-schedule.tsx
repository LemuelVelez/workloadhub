/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    CalendarDays,
    RefreshCw,
    Search,
    Clock,
    FileDown,
    Eye,
} from "lucide-react"

// ✅ PDF Viewer + Downloader (React PDF)
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    PDFViewer,
    PDFDownloadLink,
} from "@react-pdf/renderer"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"

import { useSession } from "@/hooks/use-session"
import { facultyMemberApi, type FacultyScheduleItem } from "@/api/faculty-member"

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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function timeToMinutes(t: any) {
    const s = safeStr(t)
    if (!s) return 0
    const parts = s.split(":").map((x) => Number(x))
    const hh = Number.isFinite(parts[0]) ? parts[0] : 0
    const mm = Number.isFinite(parts[1]) ? parts[1] : 0
    return hh * 60 + mm
}

function formatTimeLabel(start: string, end: string) {
    const s = safeStr(start)
    const e = safeStr(end)
    if (!s && !e) return "—"
    if (s && e) return `${s} - ${e}`
    return s || e
}

/** ✅ Compact time for narrow weekly cards (prevents overflow / overlap) */
function formatTimeLabelCompact(start: string, end: string) {
    const s = safeStr(start)
    const e = safeStr(end)
    if (!s && !e) return "—"
    if (s && e) return `${s}-${e}` // ✅ shorter than "08:00 - 09:00"
    return s || e
}

function matchesSearch(item: FacultyScheduleItem, q: string) {
    const query = safeStr(q).toLowerCase()
    if (!query) return true

    const hay = [
        item.subjectCode,
        item.subjectTitle,
        item.sectionLabel,
        item.roomCode,
        item.roomName,
        item.meetingType,
        item.dayOfWeek,
        item.classCode,
        item.startTime,
        item.endTime,
    ]
        .map((x) => safeStr(x).toLowerCase())
        .join(" ")

    return hay.includes(query)
}

function normalizePdfFileName(name: string) {
    const s = safeStr(name)
        .replace(/[^\w\s.-]+/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 120)
    return s || "my_schedule"
}

/** -----------------------------
 * ✅ PDF Document Component
 * ------------------------------*/
const pdfStyles = StyleSheet.create({
    page: {
        padding: 24,
        fontSize: 10,
        fontFamily: "Helvetica",
        lineHeight: 1.3,
    },
    header: {
        marginBottom: 14,
    },
    title: {
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 10,
        color: "#444",
        marginBottom: 2,
    },
    metaRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 6,
    },
    metaPill: {
        borderWidth: 1,
        borderColor: "#DDD",
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        fontSize: 9,
        color: "#222",
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 700,
        marginTop: 10,
        marginBottom: 6,
    },
    tableHeader: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#DDD",
        paddingBottom: 6,
        marginBottom: 6,
    },
    th: {
        fontSize: 9,
        fontWeight: 700,
        color: "#222",
    },
    row: {
        flexDirection: "row",
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F1F1",
    },
    cell: {
        fontSize: 9,
        color: "#111",
    },
    colTime: { width: 92 },
    colSubj: { flexGrow: 1, paddingRight: 10 },
    colSec: { width: 110 },
    colRoom: { width: 110 },
    colType: { width: 62 },
    footer: {
        marginTop: 14,
        fontSize: 8,
        color: "#666",
    },
})

function FacultySchedulePdfDoc(props: {
    facultyName: string
    termLabel: string
    versionLabel: string
    items: FacultyScheduleItem[]
}) {
    const facultyName = safeStr(props.facultyName) || "Faculty Member"
    const termLabel = safeStr(props.termLabel) || "Active Term"
    const versionLabel = safeStr(props.versionLabel) || "Schedule Version"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const items = Array.isArray(props.items) ? props.items : []

    const grouped = React.useMemo(() => {
        const map = new Map<string, FacultyScheduleItem[]>()
        for (const d of DAY_ORDER) map.set(d, [])
        for (const it of items) {
            const day = safeStr(it.dayOfWeek) || "Monday"
            if (!map.has(day)) map.set(day, [])
            map.get(day)!.push(it)
        }

        for (const [day, arr] of map.entries()) {
            arr.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            map.set(day, arr)
        }

        return map
    }, [items])

    return (
        <Document>
            <Page size="A4" style={pdfStyles.page}>
                <View style={pdfStyles.header}>
                    <Text style={pdfStyles.title}>My Schedule</Text>
                    <Text style={pdfStyles.subtitle}>Faculty: {facultyName}</Text>
                    <Text style={pdfStyles.subtitle}>Term: {termLabel}</Text>

                    <View style={pdfStyles.metaRow}>
                        <Text style={pdfStyles.metaPill}>{versionLabel}</Text>
                        <Text style={pdfStyles.metaPill}>{items.length} meeting(s)</Text>
                    </View>
                </View>

                {DAY_ORDER.map((day) => {
                    const list = grouped.get(day) ?? []
                    if (list.length === 0) return null

                    return (
                        <View key={day}>
                            <Text style={pdfStyles.sectionTitle}>{day}</Text>

                            <View style={pdfStyles.tableHeader}>
                                <View style={pdfStyles.colTime}>
                                    <Text style={pdfStyles.th}>Time</Text>
                                </View>
                                <View style={pdfStyles.colSubj}>
                                    <Text style={pdfStyles.th}>Subject</Text>
                                </View>
                                <View style={pdfStyles.colSec}>
                                    <Text style={pdfStyles.th}>Section</Text>
                                </View>
                                <View style={pdfStyles.colRoom}>
                                    <Text style={pdfStyles.th}>Room</Text>
                                </View>
                                <View style={pdfStyles.colType}>
                                    <Text style={pdfStyles.th}>Type</Text>
                                </View>
                            </View>

                            {list.map((it) => (
                                <View key={it.meetingId} style={pdfStyles.row}>
                                    <View style={pdfStyles.colTime}>
                                        <Text style={pdfStyles.cell}>
                                            {formatTimeLabel(it.startTime, it.endTime)}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colSubj}>
                                        <Text style={pdfStyles.cell}>
                                            {(safeStr(it.subjectCode) || "TBA") +
                                                (safeStr(it.subjectTitle)
                                                    ? ` — ${safeStr(it.subjectTitle)}`
                                                    : "")}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colSec}>
                                        <Text style={pdfStyles.cell}>
                                            {safeStr(it.sectionLabel) || "—"}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colRoom}>
                                        <Text style={pdfStyles.cell}>
                                            {safeStr(it.roomCode) || "TBA"}
                                        </Text>
                                    </View>

                                    <View style={pdfStyles.colType}>
                                        <Text style={pdfStyles.cell}>
                                            {safeStr(it.meetingType) || "—"}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )
                })}

                <Text style={pdfStyles.footer}>
                    Generated by WorkloadHub • {new Date().toLocaleString()}
                </Text>
            </Page>
        </Document>
    )
}

export default function FacultyMySchedulePage() {
    const { user } = useSession()

    const userId = React.useMemo(() => {
        return safeStr(user?.$id || user?.id || user?.userId)
    }, [user])

    const [loading, setLoading] = React.useState(true)
    const [items, setItems] = React.useState<FacultyScheduleItem[]>([])
    const [term, setTerm] = React.useState<any | null>(null)
    const [version, setVersion] = React.useState<any | null>(null)
    const [profile, setProfile] = React.useState<any | null>(null)

    const [query, setQuery] = React.useState("")
    const [meetingType, setMeetingType] = React.useState<string>("all")

    // ✅ PDF dialog
    const [pdfOpen, setPdfOpen] = React.useState(false)

    const load = React.useCallback(async () => {
        if (!userId) return
        setLoading(true)
        try {
            const res = await facultyMemberApi.schedules.getMySchedule({ userId })
            setTerm(res?.term ?? null)
            setVersion(res?.version ?? null)
            setProfile(res?.profile ?? null)
            setItems(Array.isArray(res?.items) ? res.items : [])
        } catch (err: any) {
            toast.error(err?.message || "Failed to load schedule.")
        } finally {
            setLoading(false)
        }
    }, [userId])

    React.useEffect(() => {
        void load()
    }, [load])

    const termLabel = React.useMemo(() => {
        const sy = safeStr(term?.schoolYear)
        const sem = safeStr(term?.semester)
        if (!sy && !sem) return "Active Term"
        return [sy, sem].filter(Boolean).join(" • ")
    }, [term])

    const versionLabel = React.useMemo(() => {
        const v = safeStr(version?.version)
        const status = safeStr(version?.status)
        const label = safeStr(version?.label)
        const parts = []
        if (v) parts.push(`v${v}`)
        if (label) parts.push(label)
        if (status) parts.push(status)
        return parts.length ? parts.join(" • ") : "Schedule Version"
    }, [version])

    const facultyName = React.useMemo(() => {
        return (
            safeStr(profile?.name) ||
            safeStr(user?.name) ||
            safeStr(user?.email) ||
            "Faculty Member"
        )
    }, [profile, user])

    const distinctMeetingTypes = React.useMemo(() => {
        const set = new Set<string>()
        for (const it of items) {
            const mt = safeStr(it.meetingType)
            if (mt) set.add(mt)
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [items])

    const filtered = React.useMemo(() => {
        const q = safeStr(query)
        return items.filter((it) => {
            if (!matchesSearch(it, q)) return false
            if (meetingType !== "all" && safeStr(it.meetingType) !== meetingType) return false
            return true
        })
    }, [items, query, meetingType])

    const groupedByDay = React.useMemo(() => {
        const map = new Map<string, FacultyScheduleItem[]>()
        for (const d of DAY_ORDER) map.set(d, [])

        for (const it of filtered) {
            const day = safeStr(it.dayOfWeek) || "Monday"
            if (!map.has(day)) map.set(day, [])
            map.get(day)!.push(it)
        }

        for (const [day, arr] of map.entries()) {
            arr.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            map.set(day, arr)
        }

        return map
    }, [filtered])

    const stats = React.useMemo(() => {
        const totalMeetings = filtered.length
        const totalSubjects = new Set(filtered.map((x) => safeStr(x.subjectCode)).filter(Boolean)).size
        return { totalMeetings, totalSubjects }
    }, [filtered])

    const pdfFileName = React.useMemo(() => {
        const base = normalizePdfFileName(`My_Schedule_${termLabel}`)
        return `${base}.pdf`
    }, [termLabel])

    const pdfDoc = React.useMemo(() => {
        return (
            <FacultySchedulePdfDoc
                facultyName={facultyName}
                termLabel={termLabel}
                versionLabel={versionLabel}
                items={filtered}
            />
        )
    }, [facultyName, termLabel, versionLabel, filtered])


    return (
        <DashboardLayout
            title="My Schedule"
            subtitle="View and print your weekly and term schedule."
            actions={
                <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setPdfOpen(true)}
                        disabled={loading || filtered.length === 0}
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View PDF
                    </Button>

                    <PDFDownloadLink document={pdfDoc} fileName={pdfFileName}>
                        {({ loading: pdfLoading }) => (
                            <Button
                                variant="secondary"
                                disabled={pdfLoading || loading || filtered.length === 0}
                            >
                                <FileDown className="h-4 w-4 mr-2" />
                                {pdfLoading ? "Preparing…" : "Download PDF"}
                            </Button>
                        )}
                    </PDFDownloadLink>
                </div>
            }
        >
            {/* ✅ PDF Viewer Dialog */}
            <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Schedule PDF Preview</DialogTitle>
                        <DialogDescription>
                            Preview your schedule and download as PDF.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border overflow-hidden h-[70vh]">
                        <PDFViewer width="100%" height="100%" showToolbar>
                            {pdfDoc}
                        </PDFViewer>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <PDFDownloadLink document={pdfDoc} fileName={pdfFileName}>
                            {({ loading: pdfLoading }) => (
                                <Button disabled={pdfLoading || loading || filtered.length === 0}>
                                    <FileDown className="h-4 w-4 mr-2" />
                                    {pdfLoading ? "Preparing…" : "Download"}
                                </Button>
                            )}
                        </PDFDownloadLink>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="p-6 space-y-6">
                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5" />
                                    <span className="truncate">{termLabel}</span>
                                </CardTitle>

                                <CardDescription className="mt-1">
                                    <span className="inline-flex items-center gap-2">
                                        <Badge variant="secondary">{versionLabel}</Badge>
                                        <Separator orientation="vertical" className="h-4" />
                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            {stats.totalMeetings} meeting(s)
                                        </span>
                                    </span>
                                </CardDescription>
                            </div>

                            <div className="flex items-center gap-2 print:hidden">
                                <Badge variant="outline">{stats.totalSubjects} subject(s)</Badge>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
                            <div className="relative w-full md:max-w-md">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search subject, section, room, day..."
                                    className="pl-9"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <Select value={meetingType} onValueChange={setMeetingType}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue placeholder="Meeting type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        {distinctMeetingTypes.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-40 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <Alert>
                                <AlertTitle>No schedule found</AlertTitle>
                                <AlertDescription>
                                    You have no assigned class meetings in the active schedule version.
                                    Ask your Department Head to assign subjects or activate a schedule version.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Tabs defaultValue="weekly" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="weekly">Weekly View</TabsTrigger>
                                    <TabsTrigger value="term">Term View</TabsTrigger>
                                </TabsList>

                                <TabsContent value="weekly" className="mt-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                                        {DAY_ORDER.map((day) => {
                                            const list = groupedByDay.get(day) ?? []
                                            const shouldScroll = list.length >= 3

                                            return (
                                                <Card key={day} className="min-w-0 w-full">
                                                    <CardHeader className="py-4">
                                                        <CardTitle className="text-sm font-semibold">
                                                            {day}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs">
                                                            {list.length} meeting(s)
                                                        </CardDescription>
                                                    </CardHeader>

                                                    <CardContent className="pt-0">
                                                        {list.length === 0 ? (
                                                            <div className="text-sm text-muted-foreground py-2">
                                                                No classes
                                                            </div>
                                                        ) : shouldScroll ? (
                                                            <ScrollArea className="h-80 w-full pr-2">
                                                                <div className="space-y-3 pb-1">
                                                                    {list.map((it) => (
                                                                        <MeetingCard key={it.meetingId} it={it} />
                                                                    ))}
                                                                </div>
                                                            </ScrollArea>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {list.map((it) => (
                                                                    <MeetingCard key={it.meetingId} it={it} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </TabsContent>

                                <TabsContent value="term" className="mt-4">
                                    <Card className="min-w-0">
                                        <CardHeader className="space-y-1">
                                            <CardTitle className="text-base">Term Schedule Table</CardTitle>
                                            <CardDescription>
                                                Complete list of your assigned class meetings.
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent>
                                            <div className="rounded-xl border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-36">Day</TableHead>
                                                            <TableHead className="w-40">Time</TableHead>
                                                            <TableHead>Subject</TableHead>
                                                            <TableHead className="w-44">Section</TableHead>
                                                            <TableHead className="w-44">Room</TableHead>
                                                            <TableHead className="w-28">Type</TableHead>
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
                                                        {filtered.map((it) => (
                                                            <TableRow key={it.meetingId}>
                                                                <TableCell className="font-medium">
                                                                    {safeStr(it.dayOfWeek) || "—"}
                                                                </TableCell>

                                                                <TableCell>
                                                                    <Badge variant="secondary" className="whitespace-nowrap">
                                                                        {formatTimeLabel(it.startTime, it.endTime)}
                                                                    </Badge>
                                                                </TableCell>

                                                                <TableCell>
                                                                    <div className="space-y-1 min-w-0">
                                                                        <div className="font-medium break-words">
                                                                            {safeStr(it.subjectCode) || "TBA"}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground break-words whitespace-normal">
                                                                            {safeStr(it.subjectTitle) || "No subject title"}
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="break-words whitespace-normal">
                                                                    {safeStr(it.sectionLabel) || "—"}
                                                                </TableCell>

                                                                <TableCell className="break-words whitespace-normal">
                                                                    {safeStr(it.roomCode) || "TBA"}
                                                                    {safeStr(it.roomName) ? ` • ${safeStr(it.roomName)}` : ""}
                                                                </TableCell>

                                                                <TableCell>
                                                                    {safeStr(it.meetingType) ? (
                                                                        <Badge variant="outline" className="whitespace-nowrap">
                                                                            {safeStr(it.meetingType)}
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">—</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}

/**
 * ✅ FIX: Time badge overlap on small width cards
 * - compact time format
 * - stacked layout on mobile
 * - truncate prevents spill
 */
function MeetingCard({ it }: { it: FacultyScheduleItem }) {
    const subjectCode = safeStr(it.subjectCode) || "TBA"
    const subjectTitle = safeStr(it.subjectTitle) || "No subject title"

    const meetingType = safeStr(it.meetingType)
    const sectionLabel = safeStr(it.sectionLabel) || "—"
    const roomLabel = safeStr(it.roomCode) || "TBA"
    const roomName = safeStr(it.roomName)
    const classCode = safeStr(it.classCode) || "—"

    const timeLabel = formatTimeLabelCompact(it.startTime, it.endTime)

    return (
        <div className="rounded-xl border p-3 space-y-3 min-w-0 w-full">
            {/* ✅ FIX: stack on mobile to avoid overlap/clipping */}
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Badge
                    variant="secondary"
                    className="w-full justify-center sm:w-auto sm:justify-start max-w-full truncate whitespace-nowrap"
                    title={timeLabel}
                >
                    {timeLabel}
                </Badge>

                {meetingType ? (
                    <Badge
                        variant="outline"
                        className="w-fit max-w-full truncate whitespace-nowrap"
                        title={meetingType}
                    >
                        {meetingType}
                    </Badge>
                ) : null}
            </div>

            <div className="space-y-1 min-w-0">
                <div className="font-semibold text-sm leading-tight break-words">
                    {subjectCode}
                </div>
                <div className="text-xs text-muted-foreground leading-snug break-words whitespace-normal">
                    {subjectTitle}
                </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-2">
                <div className="grid grid-cols-[70px,1fr] gap-2 min-w-0">
                    <span className="font-medium text-foreground">Section:</span>
                    <span className="break-words whitespace-normal">{sectionLabel}</span>
                </div>

                <div className="grid grid-cols-[70px,1fr] gap-2 min-w-0">
                    <span className="font-medium text-foreground">Room:</span>
                    <span className="break-words whitespace-normal">
                        {roomLabel}
                        {roomName ? ` • ${roomName}` : ""}
                    </span>
                </div>

                <div className="grid grid-cols-[70px,1fr] gap-2 min-w-0">
                    <span className="font-medium text-foreground">Class Code:</span>
                    <span className="break-words whitespace-normal">{classCode}</span>
                </div>
            </div>
        </div>
    )
}
