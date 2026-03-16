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
import { Document, Image, Page, PDFViewer, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"

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
import { fmtDate, formatTimeRange, meetingTypeLabel, roomTypeLabel, TIME_OPTIONS } from "./schedule-utils"

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

const PDF_LEFT_LOGO_SRC = "/logo.png"
const PDF_RIGHT_LOGO_SRC = "/CCS.png"

function getPdfAssetUrl(path: string) {
    if (!path) return ""
    if (typeof window === "undefined") return path

    try {
        return new URL(path, window.location.origin).toString()
    } catch {
        return path
    }
}

function formatTimeLabel(value?: string) {
    const normalized = String(value || "").trim()
    if (!normalized) return "—"

    return TIME_OPTIONS.find((option) => option.value === normalized)?.label || normalized
}

function formatPdfTimeText(startTime?: string, endTime?: string) {
    const start = formatTimeLabel(startTime)
    const end = formatTimeLabel(endTime)

    if (start === "—" && end === "—") return "—"
    if (start === "—") return end
    if (end === "—") return start

    return `${start} to ${end}`
}

function inferSectionTrackPrefix(values: Array<string | number | null | undefined>) {
    const normalizedValues = values
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)

    if (normalizedValues.length === 0) return ""

    const joined = normalizedValues.join(" ")
    const tokens = joined
        .split(/[\s/-]+/)
        .map((token) => token.trim())
        .filter(Boolean)

    if (
        tokens.includes("BSIS") ||
        tokens.includes("IS") ||
        /INFORMATION\s+SYSTEMS?/.test(joined)
    ) {
        return "IS"
    }

    if (
        tokens.includes("BSCS") ||
        tokens.includes("CS") ||
        /COMPUTER\s+SCIENCE/.test(joined)
    ) {
        return "CS"
    }

    return ""
}

function buildFormattedSectionLabel(rawValue: string, preferredPrefix?: string) {
    const normalized = String(rawValue || "").trim().replace(/\s+/g, " ")
    if (!normalized) return ""

    const compactMatch = normalized.match(/^([A-Z]{2,6})\s*([1-9]\d*)\s*-\s*(.+)$/i)
    if (compactMatch) {
        const resolvedPrefix =
            inferSectionTrackPrefix([compactMatch[1]]) || compactMatch[1].toUpperCase()

        return `${resolvedPrefix} ${compactMatch[2]} - ${compactMatch[3].trim()}`
    }

    const withoutProgramPrefix = normalized
        .replace(
            /^(?:BSCS|BSIS|BS\s+COMPUTER\s+SCIENCE|BS\s+INFORMATION\s+SYSTEMS?|COMPUTER\s+SCIENCE|INFORMATION\s+SYSTEMS?)\s*/i,
            ""
        )
        .trim()

    const yearSectionMatch = withoutProgramPrefix.match(/^Y?\s*([1-9]\d*)\s*-\s*(.+)$/i)
    if (yearSectionMatch) {
        const prefix = inferSectionTrackPrefix([normalized]) || preferredPrefix
        const core = `${yearSectionMatch[1]} - ${yearSectionMatch[2].trim()}`
        return prefix ? `${prefix} ${core}` : core
    }

    return ""
}

function formatSectionDisplayLabel({
    label,
    yearLevel,
    name,
    programCode,
    programName,
}: {
    label?: string | null
    yearLevel?: string | number | null
    name?: string | null
    programCode?: string | null
    programName?: string | null
}) {
    const rawLabel = String(label || "").trim()
    const rawName = String(name || "").trim()
    const preferredPrefix = inferSectionTrackPrefix([rawLabel, rawName, programCode, programName])

    const formattedFromLabel = buildFormattedSectionLabel(rawLabel, preferredPrefix)
    if (formattedFromLabel) return formattedFromLabel
    if (rawLabel) return rawLabel

    const formattedFromName = buildFormattedSectionLabel(rawName, preferredPrefix)
    if (formattedFromName) return formattedFromName

    const parsedYear = Number(yearLevel || 0)
    if (rawName && Number.isFinite(parsedYear) && parsedYear > 0) {
        const core = `${parsedYear} - ${rawName}`
        return preferredPrefix ? `${preferredPrefix} ${core}` : core
    }
    if (rawName) return rawName
    if (Number.isFinite(parsedYear) && parsedYear > 0) {
        return preferredPrefix ? `${preferredPrefix} ${parsedYear}` : `Year ${parsedYear}`
    }

    return "—"
}

function formatRowSectionDisplayLabel(row: ScheduleRow) {
    const rowAny = row as any

    return formatSectionDisplayLabel({
        label: row.sectionLabel,
        yearLevel: rowAny.sectionYearLevel ?? rowAny.yearLevel,
        name: rowAny.sectionName ?? rowAny.name,
        programCode: rowAny.sectionProgramCode ?? rowAny.programCode,
        programName: rowAny.sectionProgramName ?? rowAny.programName,
    })
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

    headerWrap: {
        paddingTop: 12,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: "#ffffff",
        borderBottomWidth: 1,
        borderBottomColor: "#dbeafe",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    logoWrap: {
        width: 60,
        height: 60,
        alignItems: "center",
        justifyContent: "center",
    },
    logo: {
        width: 48,
        height: 48,
        objectFit: "contain",
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    republicText: {
        fontSize: 7.2,
        color: "#475569",
        textAlign: "center",
        marginBottom: 1,
    },
    institutionText: {
        fontSize: 11.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        marginBottom: 1,
    },
    campusText: {
        fontSize: 7.8,
        color: "#475569",
        textAlign: "center",
        marginBottom: 4,
    },
    collegeText: {
        fontSize: 8.8,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        marginBottom: 2,
    },
    reportText: {
        fontSize: 8.6,
        textAlign: "center",
        color: "#0f766e",
        fontWeight: "bold",
    },

    hero: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: "#0f766e",
        borderBottomWidth: 1,
        borderBottomColor: "#115e59",
    },
    heroTitle: {
        fontSize: 15,
        color: "#ffffff",
        fontWeight: "bold",
        textAlign: "center",
    },
    heroSubTitle: {
        marginTop: 2,
        fontSize: 9,
        color: "#ccfbf1",
        textAlign: "center",
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
        backgroundColor: "#ffffff",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#0f172a",
        borderBottomWidth: 1,
        borderBottomColor: "#0b1220",
    },
    tableHeaderCell: {
        paddingVertical: 7,
        paddingHorizontal: 5,
        borderRightWidth: 1,
        borderRightColor: "#1e293b",
        justifyContent: "center",
    },
    tableHeaderCellLast: {
        borderRightWidth: 0,
    },
    tableHeaderText: {
        color: "#f8fafc",
        fontWeight: "bold",
        fontSize: 7.1,
        textAlign: "center",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    tableRowOdd: {
        backgroundColor: "#ffffff",
    },
    tableRowEven: {
        backgroundColor: "#f8fafc",
    },
    tableCell: {
        paddingVertical: 6,
        paddingHorizontal: 5,
        borderRightWidth: 1,
        borderRightColor: "#e2e8f0",
        justifyContent: "flex-start",
    },
    tableCellLast: {
        borderRightWidth: 0,
    },
    cellText: {
        fontSize: 7.1,
        color: "#0f172a",
        lineHeight: 1.24,
    },
    cellTextCenter: {
        textAlign: "center",
    },
    cellSubtle: {
        color: "#64748b",
        fontSize: 6.7,
    },
    timeText: {
        fontSize: 6.8,
        lineHeight: 1.18,
        textAlign: "center",
    },

    colDay: {
        width: "11%",
    },
    colTime: {
        width: "16%",
    },
    colSubject: {
        width: "23%",
    },
    colSection: {
        width: "11%",
    },
    colFaculty: {
        width: "17%",
    },
    colRoom: {
        width: "12%",
    },
    colType: {
        width: "10%",
    },

    typePill: {
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 6,
        alignSelf: "center",
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
        fontSize: 6.8,
        fontWeight: "bold",
        color: "#0f172a",
        textAlign: "center",
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
    const leftLogoSrc = getPdfAssetUrl(PDF_LEFT_LOGO_SRC)
    const rightLogoSrc = getPdfAssetUrl(PDF_RIGHT_LOGO_SRC)

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                <View style={styles.sheet}>
                    <View style={styles.headerWrap}>
                        <View style={styles.headerRow}>
                            <View style={styles.logoWrap}>
                                {leftLogoSrc ? <Image src={leftLogoSrc} style={styles.logo} /> : null}
                            </View>

                            <View style={styles.headerCenter}>
                                <Text style={styles.republicText}>Republic of the Philippines</Text>
                                <Text style={styles.institutionText}>JOSE RIZAL MEMORIAL STATE UNIVERSITY</Text>
                                <Text style={styles.campusText}>The Premier University in Zamboanga del Norte</Text>
                                <Text style={styles.collegeText}>COLLEGE OF COMPUTING STUDIES</Text>
                                <Text style={styles.reportText}>Schedule Planner Report</Text>
                            </View>

                            <View style={styles.logoWrap}>
                                {rightLogoSrc ? <Image src={rightLogoSrc} style={styles.logo} /> : null}
                            </View>
                        </View>
                    </View>

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
                                <View style={[styles.tableHeaderCell, styles.colDay]}>
                                    <Text style={styles.tableHeaderText}>Day</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colTime]}>
                                    <Text style={styles.tableHeaderText}>Time</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colSubject]}>
                                    <Text style={styles.tableHeaderText}>Subject</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colSection]}>
                                    <Text style={styles.tableHeaderText}>Section</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colFaculty]}>
                                    <Text style={styles.tableHeaderText}>Faculty</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colRoom]}>
                                    <Text style={styles.tableHeaderText}>Room</Text>
                                </View>
                                <View style={[styles.tableHeaderCell, styles.colType, styles.tableHeaderCellLast]}>
                                    <Text style={styles.tableHeaderText}>Type</Text>
                                </View>
                            </View>

                            {rows.length === 0 ? (
                                <Text style={styles.emptyState}>No schedule entries available for this export.</Text>
                            ) : (
                                rows.map((r, idx) => {
                                    const type = meetingTypeLabel(r.meetingType)
                                    const displayType = type === "LECTURE" ? "LEC" : type
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
                                            <View style={[styles.tableCell, styles.colDay]}>
                                                <Text style={styles.cellText}>{r.dayOfWeek || "—"}</Text>
                                            </View>

                                            <View style={[styles.tableCell, styles.colTime]}>
                                                <Text style={[styles.cellText, styles.timeText]}>
                                                    {formatPdfTimeText(r.startTime, r.endTime)}
                                                </Text>
                                            </View>

                                            <View style={[styles.tableCell, styles.colSubject]}>
                                                <Text style={styles.cellText}>{r.subjectLabel || "—"}</Text>
                                                <Text style={[styles.cellText, styles.cellSubtle]}>
                                                    Units: {r.subjectUnits ?? "—"}
                                                </Text>
                                            </View>

                                            <View style={[styles.tableCell, styles.colSection]}>
                                                <Text style={styles.cellText}>
                                                    {formatRowSectionDisplayLabel(r)}
                                                </Text>
                                            </View>

                                            <View style={[styles.tableCell, styles.colFaculty]}>
                                                <Text style={styles.cellText}>{r.facultyName || "—"}</Text>
                                                {r.isManualFaculty ? (
                                                    <Text style={[styles.cellText, styles.cellSubtle]}>Manual entry</Text>
                                                ) : null}
                                            </View>

                                            <View style={[styles.tableCell, styles.colRoom]}>
                                                <Text style={styles.cellText}>{r.roomLabel || "—"}</Text>
                                                <Text style={[styles.cellText, styles.cellSubtle]}>
                                                    {r.roomType ? roomTypeLabel(r.roomType) : "—"}
                                                </Text>
                                            </View>

                                            <View style={[styles.tableCell, styles.colType, styles.tableCellLast]}>
                                                <View style={[styles.typePill, typeStyle]}>
                                                    <Text style={styles.typePillText}>{displayType}</Text>
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
        return fmtDate(new Date().toISOString())
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
                            <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                Drag left or right anywhere in the table to scroll horizontally.
                            </div>

                            <Table dragScroll className="min-w-max table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-24 whitespace-normal wrap-break-word align-top">Day</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Time</TableHead>
                                        <TableHead className="w-56 whitespace-normal wrap-break-word align-top">Subject</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Section</TableHead>
                                        <TableHead className="w-56 whitespace-normal wrap-break-word align-top">Faculty</TableHead>
                                        <TableHead className="w-40 whitespace-normal wrap-break-word align-top">Room</TableHead>
                                        <TableHead className="w-24 whitespace-normal wrap-break-word align-top">Type</TableHead>
                                        <TableHead className="w-44 whitespace-normal wrap-break-word align-top">Conflicts</TableHead>
                                        <TableHead className="w-20 text-right whitespace-normal wrap-break-word align-top">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleRows.map((row) => {
                                        const flags = conflictFlagsByMeetingId.get(row.meetingId)

                                        return (
                                            <TableRow key={row.meetingId}>
                                                <TableCell className="font-medium whitespace-normal wrap-break-word align-top leading-relaxed">
                                                    {row.dayOfWeek || "—"}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm">
                                                    <div className="space-y-1 leading-snug">
                                                        <div className="font-medium">{formatTimeLabel(row.startTime)}</div>
                                                        <div className="text-xs text-muted-foreground">to {formatTimeLabel(row.endTime)}</div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm">
                                                    <div className="space-y-1 leading-relaxed">
                                                        <div className="font-medium">{row.subjectLabel}</div>
                                                        <div className="text-xs text-muted-foreground">Units: {row.subjectUnits ?? "—"}</div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm leading-relaxed">
                                                    {formatRowSectionDisplayLabel(row)}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm">
                                                    <div className="flex items-start gap-2">
                                                        <UserCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                        <div className="min-w-0 space-y-1 leading-relaxed">
                                                            <span className="block wrap-break-word">{row.facultyName}</span>
                                                            {row.isManualFaculty ? (
                                                                <Badge variant="secondary" className="rounded-lg">
                                                                    Manual
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm">
                                                    <div className="space-y-1 leading-relaxed">
                                                        <div className="font-medium">{row.roomLabel}</div>
                                                        <div className="text-xs text-muted-foreground">{roomTypeLabel(row.roomType)}</div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    <Badge variant="outline" className="rounded-lg">
                                                        {meetingTypeLabel(row.meetingType)}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    {renderConflictBadges(flags)}
                                                </TableCell>

                                                <TableCell className="align-top text-right">
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
                            <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                Drag left or right anywhere in the table to scroll horizontally.
                            </div>

                            <Table dragScroll className="min-w-max table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40 whitespace-normal wrap-break-word align-top">Laboratory Room</TableHead>
                                        <TableHead className="w-24 whitespace-normal wrap-break-word align-top">Day</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Time</TableHead>
                                        <TableHead className="w-56 whitespace-normal wrap-break-word align-top">Assigned Faculty</TableHead>
                                        <TableHead className="w-52 whitespace-normal wrap-break-word align-top">Subject</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Section</TableHead>
                                        <TableHead className="w-40 whitespace-normal wrap-break-word align-top">Conflicts</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {laboratoryRows.map((row) => {
                                        const flags = conflictFlagsByMeetingId.get(row.meetingId)
                                        return (
                                            <TableRow key={`lab-${row.meetingId}`}>
                                                <TableCell className="font-medium whitespace-normal wrap-break-word align-top leading-relaxed">
                                                    {row.roomLabel}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top leading-relaxed">
                                                    {row.dayOfWeek}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top text-sm">
                                                    <div className="space-y-1 leading-snug">
                                                        <div className="font-medium">{formatTimeLabel(row.startTime)}</div>
                                                        <div className="text-xs text-muted-foreground">to {formatTimeLabel(row.endTime)}</div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    <div className="flex items-start gap-2">
                                                        <UserCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                        <div className="min-w-0 space-y-1 leading-relaxed">
                                                            <span className="block wrap-break-word">{row.facultyName}</span>
                                                            {row.isManualFaculty ? (
                                                                <Badge variant="secondary" className="rounded-lg">
                                                                    Manual
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top leading-relaxed">
                                                    {row.subjectLabel}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top leading-relaxed">
                                                    {formatRowSectionDisplayLabel(row)}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    {renderConflictBadges(flags)}
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
                                            const sectionAny = s as any
                                            const name = String(s.name || "").trim() || s.$id
                                            const y = Number(s.yearLevel || 0)
                                            const sectionLabel = formatSectionDisplayLabel({
                                                label: String(sectionAny.label || sectionAny.sectionLabel || "").trim(),
                                                yearLevel: y,
                                                name,
                                                programCode: String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim(),
                                                programName: String(sectionAny.programName || sectionAny.sectionProgramName || "").trim(),
                                            })

                                            return (
                                                <SelectItem key={s.$id} value={s.$id}>
                                                    {sectionLabel}
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
                                                {t.label}
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
                                                {t.label}
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
                                                {c.row.subjectLabel} • {formatRowSectionDisplayLabel(c.row)} • {c.row.roomLabel}
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