/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import {
    AlertTriangle,
    CalendarDays,
    Eye,
    FlaskConical,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCcw,
    Trash2,
    UserCircle2,
} from "lucide-react"
import { toast } from "sonner"
import { Document, Page, PDFViewer, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

import type {
    CandidateConflict,
    ConflictFlags,
    MeetingType,
    PlannerStats,
    RoomDoc,
    ScheduleRow,
    ScheduleVersionDoc,
    SectionDoc,
    SubjectDoc,
    UserProfileDoc,
    VersionSelectOption,
} from "./schedule-types"
import {
    DAY_OPTIONS,
    FACULTY_OPTION_MANUAL,
    FACULTY_OPTION_NONE,
} from "./schedule-types"
import { formatTimeRange, meetingTypeLabel, roomTypeLabel, TIME_OPTIONS } from "./schedule-utils"

type Props = {
    selectedVersion: ScheduleVersionDoc | null
    selectedVersionId: string
    onSelectedVersionChange: (id: string) => void
    versionSelectOptions: VersionSelectOption[]

    showConflictsOnly: boolean
    onShowConflictsOnlyChange: (v: boolean) => void

    entriesLoading: boolean
    entriesError: string | null
    entrySaving: boolean

    onReloadEntries: () => void
    onOpenCreateEntry: () => void
    onOpenEditEntry: (row: ScheduleRow) => void

    plannerStats: PlannerStats
    visibleRows: ScheduleRow[]
    laboratoryRows: ScheduleRow[]
    conflictFlagsByMeetingId: Map<string, ConflictFlags>

    // PDF labels
    selectedVersionLabel: string
    selectedTermLabel: string
    selectedDeptLabel: string

    // Entry dialog state
    entryDialogOpen: boolean
    setEntryDialogOpen: (v: boolean) => void
    editingRow: ScheduleRow | null
    setEditingRow: (v: ScheduleRow | null) => void

    formSectionId: string
    setFormSectionId: (v: string) => void
    formSubjectId: string
    setFormSubjectId: (v: string) => void
    formFacultyChoice: string
    setFormFacultyChoice: (v: string) => void
    formManualFaculty: string
    setFormManualFaculty: (v: string) => void
    formRoomId: string
    setFormRoomId: (v: string) => void
    formDayOfWeek: string
    setFormDayOfWeek: (v: string) => void
    formStartTime: string
    setFormStartTime: (v: string) => void
    formEndTime: string
    setFormEndTime: (v: string) => void
    formMeetingType: MeetingType
    setFormMeetingType: (v: MeetingType) => void
    formClassCode: string
    setFormClassCode: (v: string) => void
    formDeliveryMode: string
    setFormDeliveryMode: (v: string) => void
    formRemarks: string
    setFormRemarks: (v: string) => void
    formAllowConflictSave: boolean
    setFormAllowConflictSave: (v: boolean) => void

    candidateConflicts: CandidateConflict[]
    candidateConflictCounts: { room: number; faculty: number; section: number }
    manualFacultySuggestions: string[]

    sections: SectionDoc[]
    subjects: SubjectDoc[]
    facultyProfiles: UserProfileDoc[]
    rooms: RoomDoc[]

    onSaveEntry: () => Promise<void> | void

    deleteTarget: ScheduleRow | null
    setDeleteTarget: (v: ScheduleRow | null) => void
    deleting: boolean
    onConfirmDeleteEntry: () => Promise<void> | void
}

const styles = StyleSheet.create({
    page: {
        padding: 18,
        fontSize: 9,
        fontFamily: "Helvetica",
        color: "#0f172a",
        backgroundColor: "#f8fafc",
    },

    sheet: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#ffffff",
    },

    hero: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: "#0f766e",
        borderBottomWidth: 1,
        borderBottomColor: "#115e59",
    },
    heroTitle: {
        fontSize: 16,
        color: "#ffffff",
        fontWeight: "bold",
    },
    heroSubTitle: {
        marginTop: 2,
        fontSize: 9,
        color: "#ccfbf1",
    },

    section: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
    },

    infoCard: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        backgroundColor: "#f8fafc",
        padding: 10,
    },
    infoRow: {
        flexDirection: "row",
        marginBottom: 4,
    },
    infoLabel: {
        width: 78,
        color: "#475569",
        fontWeight: "bold",
    },
    infoValue: {
        flex: 1,
        color: "#0f172a",
    },

    statsWrap: {
        flexDirection: "row",
        marginTop: 10,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 9,
        marginRight: 8,
    },
    statCardLast: {
        marginRight: 0,
    },
    statTotal: {
        backgroundColor: "#ecfeff",
        borderColor: "#67e8f9",
    },
    statConflict: {
        backgroundColor: "#fef2f2",
        borderColor: "#fca5a5",
    },
    statLabs: {
        backgroundColor: "#eef2ff",
        borderColor: "#a5b4fc",
    },
    statLabel: {
        color: "#334155",
        marginBottom: 2,
        fontSize: 8,
    },
    statValue: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#0f172a",
    },

    tableWrap: {
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 8,
        overflow: "hidden",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#0f172a",
        borderBottomWidth: 1,
        borderBottomColor: "#0b1220",
        paddingVertical: 7,
        paddingHorizontal: 6,
    },
    tableHeaderText: {
        color: "#f8fafc",
        fontWeight: "bold",
        fontSize: 8.5,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        paddingVertical: 6,
        paddingHorizontal: 6,
    },
    tableRowOdd: {
        backgroundColor: "#ffffff",
    },
    tableRowEven: {
        backgroundColor: "#f8fafc",
    },
    cellText: {
        fontSize: 8.3,
        color: "#0f172a",
    },

    colDay: { width: "12%" },
    colTime: { width: "14%" },
    colSubject: { width: "22%" },
    colSection: { width: "12%" },
    colFaculty: { width: "18%" },
    colRoom: { width: "12%" },
    colType: { width: "10%" },

    typePill: {
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 6,
        alignSelf: "flex-start",
    },
    typePillLecture: {
        backgroundColor: "#e0f2fe",
    },
    typePillLab: {
        backgroundColor: "#ede9fe",
    },
    typePillOther: {
        backgroundColor: "#e2e8f0",
    },
    typePillText: {
        fontSize: 7.6,
        fontWeight: "bold",
        color: "#0f172a",
    },

    emptyState: {
        paddingVertical: 18,
        paddingHorizontal: 10,
        textAlign: "center",
        color: "#64748b",
        fontSize: 9,
    },

    footer: {
        marginTop: 10,
        fontSize: 8,
        color: "#64748b",
        textAlign: "right",
    },
})

function SchedulePdfDocument({
    rows,
    versionLabel,
    termLabel,
    deptLabel,
    generatedAt,
    stats,
    filteredByConflict,
}: {
    rows: ScheduleRow[]
    versionLabel: string
    termLabel: string
    deptLabel: string
    generatedAt: string
    stats: PlannerStats
    filteredByConflict: boolean
}) {
    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                <View style={styles.sheet}>
                    <View style={styles.hero}>
                        <Text style={styles.heroTitle}>Schedule Planner Report</Text>
                        <Text style={styles.heroSubTitle}>Modern export from Admin Schedules</Text>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Version:</Text>
                                <Text style={styles.infoValue}>{versionLabel || "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Term:</Text>
                                <Text style={styles.infoValue}>{termLabel || "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>College:</Text>
                                <Text style={styles.infoValue}>{deptLabel || "—"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Filter:</Text>
                                <Text style={styles.infoValue}>{filteredByConflict ? "Conflicts only" : "All entries"}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Generated:</Text>
                                <Text style={styles.infoValue}>{generatedAt}</Text>
                            </View>
                        </View>

                        <View style={styles.statsWrap}>
                            <View style={[styles.statCard, styles.statTotal]}>
                                <Text style={styles.statLabel}>Total Entries</Text>
                                <Text style={styles.statValue}>{stats.total}</Text>
                            </View>
                            <View style={[styles.statCard, styles.statConflict]}>
                                <Text style={styles.statLabel}>Conflicts</Text>
                                <Text style={styles.statValue}>{stats.conflicts}</Text>
                            </View>
                            <View style={[styles.statCard, styles.statLabs, styles.statCardLast]}>
                                <Text style={styles.statLabel}>Laboratory Entries</Text>
                                <Text style={styles.statValue}>{stats.labs}</Text>
                            </View>
                        </View>

                        <View style={styles.tableWrap}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.colDay, styles.tableHeaderText]}>Day</Text>
                                <Text style={[styles.colTime, styles.tableHeaderText]}>Time</Text>
                                <Text style={[styles.colSubject, styles.tableHeaderText]}>Subject</Text>
                                <Text style={[styles.colSection, styles.tableHeaderText]}>Section</Text>
                                <Text style={[styles.colFaculty, styles.tableHeaderText]}>Faculty</Text>
                                <Text style={[styles.colRoom, styles.tableHeaderText]}>Room</Text>
                                <Text style={[styles.colType, styles.tableHeaderText]}>Type</Text>
                            </View>

                            {rows.length === 0 ? (
                                <Text style={styles.emptyState}>No schedule entries available for this export.</Text>
                            ) : (
                                rows.map((r, idx) => {
                                    const type = meetingTypeLabel(r.meetingType)
                                    const typeStyle =
                                        type === "LAB"
                                            ? styles.typePillLab
                                            : type === "LECTURE"
                                                ? styles.typePillLecture
                                                : styles.typePillOther

                                    return (
                                        <View
                                            key={`pdf-row-${r.meetingId}`}
                                            style={[
                                                styles.tableRow,
                                                idx % 2 === 0 ? styles.tableRowOdd : styles.tableRowEven,
                                            ]}
                                            wrap={false}
                                        >
                                            <Text style={[styles.colDay, styles.cellText]}>{r.dayOfWeek || "—"}</Text>
                                            <Text style={[styles.colTime, styles.cellText]}>{formatTimeRange(r.startTime, r.endTime)}</Text>
                                            <Text style={[styles.colSubject, styles.cellText]}>{r.subjectLabel || "—"}</Text>
                                            <Text style={[styles.colSection, styles.cellText]}>{r.sectionLabel || "—"}</Text>
                                            <Text style={[styles.colFaculty, styles.cellText]}>{r.facultyName || "—"}</Text>
                                            <Text style={[styles.colRoom, styles.cellText]}>{r.roomLabel || "—"}</Text>
                                            <View style={styles.colType}>
                                                <View style={[styles.typePill, typeStyle]}>
                                                    <Text style={styles.typePillText}>{type}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    )
                                })
                            )}
                        </View>

                        <Text style={styles.footer}>Rows exported: {rows.length}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    )
}

export function PlannerManagementSection({
    selectedVersion,
    selectedVersionId,
    onSelectedVersionChange,
    versionSelectOptions,
    showConflictsOnly,
    onShowConflictsOnlyChange,
    entriesLoading,
    entriesError,
    entrySaving,
    onReloadEntries,
    onOpenCreateEntry,
    onOpenEditEntry,
    plannerStats,
    visibleRows,
    laboratoryRows,
    conflictFlagsByMeetingId,
    selectedVersionLabel,
    selectedTermLabel,
    selectedDeptLabel,
    entryDialogOpen,
    setEntryDialogOpen,
    editingRow,
    setEditingRow,
    formSectionId,
    setFormSectionId,
    formSubjectId,
    setFormSubjectId,
    formFacultyChoice,
    setFormFacultyChoice,
    formManualFaculty,
    setFormManualFaculty,
    formRoomId,
    setFormRoomId,
    formDayOfWeek,
    setFormDayOfWeek,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formMeetingType,
    setFormMeetingType,
    formClassCode,
    setFormClassCode,
    formDeliveryMode,
    setFormDeliveryMode,
    formRemarks,
    setFormRemarks,
    formAllowConflictSave,
    setFormAllowConflictSave,
    candidateConflicts,
    candidateConflictCounts,
    manualFacultySuggestions,
    sections,
    subjects,
    facultyProfiles,
    rooms,
    onSaveEntry,
    deleteTarget,
    setDeleteTarget,
    deleting,
    onConfirmDeleteEntry,
}: Props) {
    const [pdfPreviewOpen, setPdfPreviewOpen] = React.useState(false)

    const renderConflictBadges = (flags?: ConflictFlags) => {
        if (!flags || (!flags.room && !flags.faculty && !flags.section)) {
            return <Badge variant="outline">No Conflict</Badge>
        }

        return (
            <div className="flex flex-wrap items-center gap-1">
                {flags.room ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Room
                    </Badge>
                ) : null}
                {flags.faculty ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Faculty
                    </Badge>
                ) : null}
                {flags.section ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Section
                    </Badge>
                ) : null}
            </div>
        )
    }

    const generatedAt = React.useMemo(() => {
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date())
    }, [visibleRows.length, selectedVersionId, showConflictsOnly])

    const downloadPdf = async () => {
        if (!selectedVersion || visibleRows.length === 0) {
            toast.error("No schedule entries to export.")
            return
        }

        try {
            const documentNode = (
                <SchedulePdfDocument
                    rows={visibleRows}
                    versionLabel={selectedVersionLabel}
                    termLabel={selectedTermLabel}
                    deptLabel={selectedDeptLabel}
                    generatedAt={generatedAt}
                    stats={plannerStats}
                    filteredByConflict={showConflictsOnly}
                />
            )

            const blob = await pdf(documentNode).toBlob()
            const url = URL.createObjectURL(blob)

            const a = document.createElement("a")
            a.href = url
            a.download = `schedule-report-${selectedVersion.$id}-${new Date().toISOString().slice(0, 10)}.pdf`
            a.click()

            URL.revokeObjectURL(url)
            toast.success("Schedule PDF exported.")
        } catch (e: any) {
            toast.error(e?.message || "Failed to export PDF.")
        }
    }

    return (
        <>
            <Card className="rounded-2xl">
                <CardHeader className="pb-4">
                    <CardTitle>Schedule Planner & Conflict Manager</CardTitle>
                    <CardDescription>
                        Assign subject, faculty (dropdown or manual), and room (dropdown). Detect room/faculty/section conflicts in real time.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
                        <div className="min-w-0 space-y-1 md:col-span-2 xl:col-span-6">
                            <Label>Schedule Version</Label>
                            <Select
                                value={selectedVersionId || "__none__"}
                                onValueChange={(v) => onSelectedVersionChange(v === "__none__" ? "" : v)}
                            >
                                <SelectTrigger className="w-full rounded-xl">
                                    <SelectValue placeholder="Select version for schedule planning" />
                                </SelectTrigger>
                                <SelectContent>
                                    {versionSelectOptions.length === 0 ? (
                                        <SelectItem value="__none__">No versions available</SelectItem>
                                    ) : (
                                        versionSelectOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label} • {opt.meta}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="min-w-0 space-y-1 xl:col-span-2">
                            <Label>Conflict Filter</Label>
                            <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3">
                                <Checkbox
                                    id="showConflictsOnly"
                                    checked={showConflictsOnly}
                                    onCheckedChange={(v) => onShowConflictsOnlyChange(Boolean(v))}
                                />
                                <Label htmlFor="showConflictsOnly" className="cursor-pointer truncate text-sm leading-none">
                                    Show conflicts only
                                </Label>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end justify-start gap-2 md:justify-end xl:col-span-4">
                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={onReloadEntries}
                                disabled={!selectedVersion || entriesLoading || entrySaving}
                            >
                                <RefreshCcw className="mr-2 size-4" />
                                Reload Entries
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={() => setPdfPreviewOpen(true)}
                                disabled={!selectedVersion || visibleRows.length === 0}
                            >
                                <Eye className="mr-2 size-4" />
                                Preview PDF
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={() => void downloadPdf()}
                                disabled={!selectedVersion || visibleRows.length === 0}
                            >
                                Export PDF
                            </Button>

                            <Button
                                className="w-full rounded-xl sm:w-auto"
                                onClick={onOpenCreateEntry}
                                disabled={!selectedVersion || entriesLoading || entrySaving}
                            >
                                <Plus className="mr-2 size-4" />
                                New Entry
                            </Button>
                        </div>
                    </div>

                    {selectedVersion ? (
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                                    <CardDescription>All class meetings</CardDescription>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.total}</CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
                                    <CardDescription>Room / Faculty / Section</CardDescription>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.conflicts}</CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Laboratory Entries</CardTitle>
                                    <CardDescription>LAB meeting or LAB room</CardDescription>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.labs}</CardContent>
                            </Card>
                        </div>
                    ) : null}

                    <Separator />

                    {!selectedVersion ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <CalendarDays className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">Select a schedule version</div>
                            <div className="text-sm text-muted-foreground">
                                Choose a version above to manage schedule entries and conflict detection.
                            </div>
                        </div>
                    ) : entriesLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6" />
                        </div>
                    ) : entriesError ? (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{entriesError}</AlertDescription>
                        </Alert>
                    ) : visibleRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <CalendarDays className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No schedule entries found</div>
                            <div className="text-sm text-muted-foreground">
                                {showConflictsOnly ? "No conflicts detected for this version." : "Create your first schedule entry to begin."}
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Day</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Faculty</TableHead>
                                        <TableHead>Room</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Conflicts</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleRows.map((row) => {
                                        const flags = conflictFlagsByMeetingId.get(row.meetingId)

                                        return (
                                            <TableRow key={row.meetingId}>
                                                <TableCell className="font-medium">{row.dayOfWeek || "—"}</TableCell>
                                                <TableCell className="text-sm">{formatTimeRange(row.startTime, row.endTime)}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium">{row.subjectLabel}</div>
                                                    <div className="text-xs text-muted-foreground">Units: {row.subjectUnits ?? "—"}</div>
                                                </TableCell>
                                                <TableCell className="text-sm">{row.sectionLabel}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <UserCircle2 className="size-4 text-muted-foreground" />
                                                        <span>{row.facultyName}</span>
                                                        {row.isManualFaculty ? (
                                                            <Badge variant="secondary" className="rounded-lg">
                                                                Manual
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium">{row.roomLabel}</div>
                                                    <div className="text-xs text-muted-foreground">{roomTypeLabel(row.roomType)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="rounded-lg">
                                                        {meetingTypeLabel(row.meetingType)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{renderConflictBadges(flags)}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="rounded-xl">
                                                                <MoreHorizontal className="size-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56">
                                                            <DropdownMenuLabel>Entry Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => onOpenEditEntry(row)}>
                                                                <Pencil className="mr-2 size-4" />
                                                                Edit entry
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => setDeleteTarget(row)}
                                                                className="text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 size-4" />
                                                                Delete entry
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

            <Card className="rounded-2xl">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="size-5" />
                        Laboratory Assignments
                    </CardTitle>
                    <CardDescription>View who is assigned in laboratories and their scheduled time.</CardDescription>
                </CardHeader>

                <CardContent>
                    {!selectedVersion ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Select a schedule version to view laboratory assignments.
                        </div>
                    ) : entriesLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6" />
                        </div>
                    ) : laboratoryRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No laboratory assignments found for this version.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Laboratory Room</TableHead>
                                        <TableHead>Day</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Assigned Faculty</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Conflicts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {laboratoryRows.map((row) => {
                                        const flags = conflictFlagsByMeetingId.get(row.meetingId)
                                        return (
                                            <TableRow key={`lab-${row.meetingId}`}>
                                                <TableCell className="font-medium">{row.roomLabel}</TableCell>
                                                <TableCell>{row.dayOfWeek}</TableCell>
                                                <TableCell>{formatTimeRange(row.startTime, row.endTime)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <UserCircle2 className="size-4 text-muted-foreground" />
                                                        <span>{row.facultyName}</span>
                                                        {row.isManualFaculty ? (
                                                            <Badge variant="secondary" className="rounded-lg">
                                                                Manual
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{row.subjectLabel}</TableCell>
                                                <TableCell>{row.sectionLabel}</TableCell>
                                                <TableCell>{renderConflictBadges(flags)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* PDF Preview Dialog */}
            <Dialog open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
                <DialogContent className="h-[82vh] max-h-[82vh] overflow-y-auto p-4 sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Schedule PDF Preview</DialogTitle>
                        <DialogDescription>
                            Preview the generated PDF before export.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-[66vh] overflow-hidden rounded-xl border">
                        <PDFViewer style={{ width: "100%", height: "100%" }}>
                            <SchedulePdfDocument
                                rows={visibleRows}
                                versionLabel={selectedVersionLabel}
                                termLabel={selectedTermLabel}
                                deptLabel={selectedDeptLabel}
                                generatedAt={generatedAt}
                                stats={plannerStats}
                                filteredByConflict={showConflictsOnly}
                            />
                        </PDFViewer>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>
                            Close
                        </Button>
                        <Button onClick={() => void downloadPdf()} disabled={!selectedVersion || visibleRows.length === 0}>
                            Export PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Entry create/edit dialog */}
            <Dialog
                open={entryDialogOpen}
                onOpenChange={(v) => {
                    setEntryDialogOpen(v)
                    if (!v) {
                        setEditingRow(null)
                        setFormAllowConflictSave(false)
                    }
                }}
            >
                <DialogContent className="max-h-[78vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingRow ? "Edit Schedule Entry" : "Create Schedule Entry"}</DialogTitle>
                        <DialogDescription>
                            Use dropdowns for section, subject, faculty, and room. Optional manual faculty entry is supported.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Section</Label>
                                <Select value={formSectionId} onValueChange={setFormSectionId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((s) => {
                                            const name = String(s.name || "").trim() || s.$id
                                            const y = Number(s.yearLevel || 0)
                                            return (
                                                <SelectItem key={s.$id} value={s.$id}>
                                                    Y{y || "?"} - {name}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Subject</Label>
                                <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.map((s) => {
                                            const code = String(s.code || "").trim()
                                            const title = String(s.title || "").trim()
                                            const units = s.units != null ? ` (${s.units}u)` : ""
                                            const label = [code, title].filter(Boolean).join(" • ") || s.$id
                                            return (
                                                <SelectItem key={s.$id} value={s.$id}>
                                                    {label}
                                                    {units}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Faculty / Instructor</Label>
                                <Select value={formFacultyChoice} onValueChange={setFormFacultyChoice}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select faculty" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={FACULTY_OPTION_NONE}>Unassigned</SelectItem>
                                        <SelectItem value={FACULTY_OPTION_MANUAL}>Manual encode faculty</SelectItem>
                                        {facultyProfiles.map((f) => {
                                            const key = String(f.userId || f.$id || "").trim()
                                            const name = String(f.name || "").trim()
                                            const email = String(f.email || "").trim()
                                            const label = name || email || key
                                            if (!key) return null
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Room</Label>
                                <Select value={formRoomId} onValueChange={setFormRoomId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map((r) => {
                                            const code = String(r.code || "").trim()
                                            const name = String(r.name || "").trim()
                                            const rType = roomTypeLabel(String(r.type || ""))
                                            const label = [code, name].filter(Boolean).join(" • ") || r.$id
                                            return (
                                                <SelectItem key={r.$id} value={r.$id}>
                                                    {label} ({rType})
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formFacultyChoice === FACULTY_OPTION_MANUAL ? (
                            <div className="space-y-2 rounded-xl border p-3">
                                <div className="space-y-1">
                                    <Label>Manual Faculty Name</Label>
                                    <Input
                                        value={formManualFaculty}
                                        onChange={(e) => setFormManualFaculty(e.target.value)}
                                        placeholder="Enter faculty/instructor name manually"
                                    />
                                </div>

                                {manualFacultySuggestions.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="text-xs text-muted-foreground">
                                            Quick pick from previously used manual names:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {manualFacultySuggestions.slice(0, 12).map((name) => (
                                                <Button
                                                    key={name}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg"
                                                    onClick={() => setFormManualFaculty(name)}
                                                >
                                                    {name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                                <Label>Day</Label>
                                <Select value={formDayOfWeek} onValueChange={setFormDayOfWeek}>
                                    <SelectTrigger className="rounded-xl">
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

                            <div className="space-y-1">
                                <Label>Start Time</Label>
                                <Select value={formStartTime} onValueChange={setFormStartTime}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select start time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIME_OPTIONS.map((t) => (
                                            <SelectItem key={`st-${t.value}`} value={t.value}>
                                                {t.label} ({t.value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>End Time</Label>
                                <Select value={formEndTime} onValueChange={setFormEndTime}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select end time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIME_OPTIONS.map((t) => (
                                            <SelectItem key={`et-${t.value}`} value={t.value}>
                                                {t.label} ({t.value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Meeting Type</Label>
                                <Select value={formMeetingType} onValueChange={(v) => setFormMeetingType(v as MeetingType)}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LECTURE">LECTURE</SelectItem>
                                        <SelectItem value="LAB">LAB</SelectItem>
                                        <SelectItem value="OTHER">OTHER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Class Code (optional)</Label>
                                <Input
                                    value={formClassCode}
                                    onChange={(e) => setFormClassCode(e.target.value)}
                                    placeholder="e.g. CCS-3A-IT-DB1"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label>Delivery Mode (optional)</Label>
                                <Input
                                    value={formDeliveryMode}
                                    onChange={(e) => setFormDeliveryMode(e.target.value)}
                                    placeholder="e.g. Face-to-face, Hybrid, Online"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label>Remarks (optional)</Label>
                            <Textarea
                                value={formRemarks}
                                onChange={(e) => setFormRemarks(e.target.value)}
                                placeholder="Additional notes..."
                                className="min-h-20"
                            />
                        </div>

                        {candidateConflicts.length > 0 ? (
                            <Alert variant="destructive">
                                <AlertTitle className="flex items-center gap-2">
                                    <AlertTriangle className="size-4" />
                                    Conflict detected
                                </AlertTitle>
                                <AlertDescription className="space-y-2">
                                    <div className="text-sm">
                                        Room: <span className="font-medium">{candidateConflictCounts.room}</span> • Faculty:{" "}
                                        <span className="font-medium">{candidateConflictCounts.faculty}</span> • Section:{" "}
                                        <span className="font-medium">{candidateConflictCounts.section}</span>
                                    </div>
                                    <ul className="list-disc space-y-1 pl-4 text-xs">
                                        {candidateConflicts.slice(0, 6).map((c, idx) => (
                                            <li key={`${c.type}-${c.row.meetingId}-${idx}`}>
                                                [{c.type.toUpperCase()}] {c.row.dayOfWeek} {formatTimeRange(c.row.startTime, c.row.endTime)} •{" "}
                                                {c.row.subjectLabel} • {c.row.sectionLabel} • {c.row.roomLabel}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex items-center gap-2 pt-1">
                                        <Checkbox
                                            id="allowConflictSave"
                                            checked={formAllowConflictSave}
                                            onCheckedChange={(v) => setFormAllowConflictSave(Boolean(v))}
                                        />
                                        <Label htmlFor="allowConflictSave" className="cursor-pointer text-sm">
                                            Override and save anyway
                                        </Label>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert>
                                <AlertTitle>No conflict detected</AlertTitle>
                                <AlertDescription>
                                    Current entry does not overlap with existing room, faculty, or section schedule.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)} disabled={entrySaving}>
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void onSaveEntry()}
                            disabled={entrySaving}
                            className={cn(entrySaving && "opacity-90")}
                        >
                            {entrySaving ? (
                                <>
                                    <RefreshCcw className="mr-2 size-4 animate-spin" />
                                    Saving...
                                </>
                            ) : editingRow ? (
                                <>
                                    <Pencil className="mr-2 size-4" />
                                    Update Entry
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    Create Entry
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete entry confirm dialog */}
            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete schedule entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the selected class meeting. If no meetings remain for the class, the class record will also be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                void onConfirmDeleteEntry()
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
