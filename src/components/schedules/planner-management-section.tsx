/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
    AlertTriangle,
    ArrowRight,
    ArrowUpDown,
    CalendarDays,
    Eye,
    FlaskConical,
    PencilLine,
    Plus,
    Printer,
    RefreshCcw,
    Search,
    SlidersHorizontal,
    Trash2,
    UserCircle2,
    X,
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
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
import {
    dayExpressionsOverlap,
    dayOrder,
    fmtDate,
    formatDayDisplayLabel,
    formatTimeRange,
    meetingTypeLabel,
    roomTypeLabel,
    TIME_OPTIONS,
} from "./schedule-utils"

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

    plannerStats: PlannerStats
    visibleRows: ScheduleRow[]
    laboratoryRows: ScheduleRow[]
    conflictFlagsByMeetingId: Map<string, ConflictFlags>

    selectedVersionLabel: string
    selectedTermLabel: string
    selectedDeptLabel: string

    entryDialogOpen: boolean
    setEntryDialogOpen: (v: boolean) => void
    editingEntry: ScheduleRow | null

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

    onEditEntry: (row: ScheduleRow) => void
    onSaveEntry: () => Promise<void> | void
    onDeleteEntry: () => Promise<void> | void
}

type SectionDisplayLookup = Record<string, string>
type PlannerSortKey = "day" | "time" | "subject" | "section" | "faculty" | "room" | "type" | "conflicts"
type PlannerSortDirection = "asc" | "desc"

type PlannerSectionAccordionGroup = {
    key: string
    label: string
    rowCount: number
    conflictedCount: number
    rows: ScheduleRow[]
}

type PlannerCourseAccordionGroup = {
    key: string
    code: string
    name: string
    label: string
    rowCount: number
    conflictedCount: number
    rows: ScheduleRow[]
    sectionGroups: PlannerSectionAccordionGroup[]
}

type PlannerFacultyAccordionGroup = {
    key: string
    label: string
    rowCount: number
    conflictedCount: number
    rows: ScheduleRow[]
    courseGroups: PlannerCourseAccordionGroup[]
}

const PLANNER_SORT_OPTIONS: Array<{ value: PlannerSortKey; label: string }> = [
    { value: "day", label: "Day" },
    { value: "time", label: "Time" },
    { value: "subject", label: "Subject" },
    { value: "section", label: "Section" },
    { value: "faculty", label: "Faculty" },
    { value: "room", label: "Room" },
    { value: "type", label: "Meeting Type" },
    { value: "conflicts", label: "Conflict Count" },
]

function comparePlannerText(a?: string | number | null, b?: string | number | null) {
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
    })
}

function countConflictFlags(flags?: ConflictFlags) {
    return Number(Boolean(flags?.room)) + Number(Boolean(flags?.faculty)) + Number(Boolean(flags?.section))
}

function splitSubjectLabelParts(subjectLabel?: string | null) {
    const normalized = String(subjectLabel || "").trim()
    if (!normalized) {
        return {
            code: "—",
            descriptiveTitle: "—",
        }
    }

    const parts = normalized
        .split(" • ")
        .map((part) => part.trim())
        .filter(Boolean)

    if (parts.length === 0) {
        return {
            code: "—",
            descriptiveTitle: normalized,
        }
    }

    if (parts.length === 1) {
        return {
            code: parts[0],
            descriptiveTitle: parts[0],
        }
    }

    return {
        code: parts[0],
        descriptiveTitle: parts.slice(1).join(" • "),
    }
}

function inferCourseCodeFromSectionDisplay(sectionDisplayLabel: string) {
    const normalized = String(sectionDisplayLabel || "")
        .trim()
        .toUpperCase()

    if (normalized.startsWith("CS ")) return "BSCS"
    if (normalized.startsWith("IS ")) return "BSIS"

    return ""
}

function inferCourseNameFromCode(courseCode: string) {
    const normalized = String(courseCode || "")
        .trim()
        .toUpperCase()

    if (normalized === "BSCS") return "Computer Science"
    if (normalized === "BSIS") return "Information Systems"

    return ""
}

function resolveRowCourseMeta(row: ScheduleRow, sectionDisplayLookup: SectionDisplayLookup) {
    const rowAny = row as any
    const sectionDisplayLabel = getRowSectionDisplayLabel(row, sectionDisplayLookup)
    const explicitCode = String(row.sectionProgramCode ?? rowAny.sectionProgramCode ?? rowAny.programCode ?? "").trim()
    const inferredCode = inferCourseCodeFromSectionDisplay(sectionDisplayLabel)
    const courseCode = explicitCode || inferredCode || "UNSPECIFIED"

    const explicitName = String(row.sectionProgramName ?? rowAny.sectionProgramName ?? rowAny.programName ?? "").trim()
    const inferredName = inferCourseNameFromCode(courseCode)
    const courseName = explicitName || inferredName || "Unspecified Course"
    const courseLabel = courseCode === "UNSPECIFIED" ? courseName : `COURSE: ${courseCode}`

    return {
        courseCode,
        courseName,
        courseLabel,
        sectionDisplayLabel,
    }
}

const PDF_LEFT_LOGO_SRC = "/logo.png"
const PDF_RIGHT_LOGO_SRC = "/CCS.png"
const ROOMS_AND_FACILITIES_ROUTE = "/dashboard/admin/rooms-and-facilities"
const ENTRY_DIALOG_SELECT_CONTENT_CLASS = "z-[200]"

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

function normalizeSectionYearLevelDisplay(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    if (/^(CS|IS)\s+[1-9]\d*$/.test(normalized)) {
        return normalized
    }

    const prefixedMatch = normalized.match(/^(CS|IS)\s*([1-9]\d*)$/)
    if (prefixedMatch) {
        return `${prefixedMatch[1]} ${prefixedMatch[2]}`
    }

    const plainNumberMatch = normalized.match(/^([1-9]\d*)$/)
    if (plainNumberMatch) {
        return plainNumberMatch[1]
    }

    const legacyYearMatch = normalized.match(/^(?:Y|YEAR)\s*([1-9]\d*)$/)
    if (legacyYearMatch) {
        return legacyYearMatch[1]
    }

    const ordinalYearMatch = normalized.match(/^([1-9]\d*)(?:ST|ND|RD|TH)?(?:\s+YEAR)?$/)
    if (ordinalYearMatch) {
        return ordinalYearMatch[1]
    }

    return ""
}

function normalizeSectionNameDisplay(value?: string | null) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^[—–-]\s*/, "")
}

function isUnknownSectionYearMarker(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return false
    if (normalized === "?") return true
    if (/^(?:Y|YEAR|LEVEL)\s*\?$/.test(normalized)) return true
    if (/^(?:Y|YEAR|LEVEL)\s*[—–-]?$/.test(normalized)) return true

    return false
}

function buildFormattedSectionLabel(rawValue: string) {
    const normalized = String(rawValue || "").trim().replace(/\s+/g, " ")
    if (!normalized) return ""

    const withoutProgramPrefix = normalized
        .replace(
            /^(?:BSCS|BSIS|BS\s+COMPUTER\s+SCIENCE|BS\s+INFORMATION\s+SYSTEMS?|COMPUTER\s+SCIENCE|INFORMATION\s+SYSTEMS?)\s*/i,
            ""
        )
        .trim()

    const hyphenParts = withoutProgramPrefix
        .split(/\s*-\s*/)
        .map((part) => part.trim())
        .filter(Boolean)

    if (hyphenParts.length >= 2) {
        const leftPart = hyphenParts[0]
        const rightPart = normalizeSectionNameDisplay(hyphenParts.slice(1).join(" - "))
        const normalizedLeftYear = normalizeSectionYearLevelDisplay(leftPart)

        if (normalizedLeftYear && rightPart) {
            return `${normalizedLeftYear} - ${rightPart}`
        }

        if (rightPart && isUnknownSectionYearMarker(leftPart)) {
            return rightPart
        }
    }

    const yearOnlyMatch = withoutProgramPrefix.match(/^(CS|IS)\s+[1-9]\d*$/i)
    if (yearOnlyMatch) {
        return yearOnlyMatch[0].toUpperCase().replace(/\s+/g, " ")
    }

    const normalizedWholeYear = normalizeSectionYearLevelDisplay(withoutProgramPrefix)
    if (normalizedWholeYear) {
        return normalizedWholeYear
    }

    if (isUnknownSectionYearMarker(withoutProgramPrefix)) {
        return ""
    }

    return withoutProgramPrefix
}

function formatSectionDisplayLabel({
    label,
    yearLevel,
    name,
}: {
    label?: string | null
    yearLevel?: string | number | null
    name?: string | null
    programCode?: string | null
    programName?: string | null
}) {
    const rawLabel = String(label || "").trim()
    const rawName = String(name || "").trim()
    const normalizedYearLevel = normalizeSectionYearLevelDisplay(yearLevel)
    const normalizedName = normalizeSectionNameDisplay(name)
    const labelYearToken = rawLabel.split(/\s*-\s*/)[0] || rawLabel

    if (normalizedYearLevel && normalizedName) {
        return `${normalizedYearLevel} - ${normalizedName}`
    }

    if (normalizedYearLevel) {
        return normalizedYearLevel
    }

    if (
        normalizedName &&
        (isUnknownSectionYearMarker(yearLevel) || isUnknownSectionYearMarker(labelYearToken))
    ) {
        return normalizedName
    }

    const formattedFromLabel = buildFormattedSectionLabel(rawLabel)
    if (formattedFromLabel) {
        return formattedFromLabel
    }

    const formattedFromName = buildFormattedSectionLabel(rawName)
    if (formattedFromName) {
        return formattedFromName
    }

    if (normalizedName) {
        return normalizedName
    }

    return "—"
}

function formatRowSectionDisplayLabel(row: ScheduleRow) {
    const rowAny = row as any

    return formatSectionDisplayLabel({
        label: row.sectionLabel,
        yearLevel: row.sectionYearLevel ?? rowAny.sectionYearLevel ?? rowAny.yearLevel,
        name: row.sectionName ?? rowAny.sectionName ?? rowAny.name,
        programCode: row.sectionProgramCode ?? rowAny.sectionProgramCode ?? rowAny.programCode,
        programName: row.sectionProgramName ?? rowAny.sectionProgramName ?? rowAny.programName,
    })
}

function buildSectionDisplayLookup(sections: SectionDoc[]): SectionDisplayLookup {
    const lookup: SectionDisplayLookup = {}

    for (const section of sections) {
        const sectionAny = section as any
        const name = String(section.name || sectionAny.sectionName || "").trim() || section.$id
        const yearLevel = section.yearLevel ?? sectionAny.yearLevel ?? null

        lookup[section.$id] = formatSectionDisplayLabel({
            label: String(sectionAny.label || sectionAny.sectionLabel || "").trim(),
            yearLevel,
            name,
            programCode: String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim(),
            programName: String(sectionAny.programName || sectionAny.sectionProgramName || "").trim(),
        })
    }

    return lookup
}

function getRowSectionDisplayLabel(row: ScheduleRow, sectionDisplayLookup: SectionDisplayLookup) {
    const sectionId = String(row.sectionId || "").trim()
    if (sectionId && sectionDisplayLookup[sectionId]) {
        return sectionDisplayLookup[sectionId]
    }

    return formatRowSectionDisplayLabel(row)
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
    sectionDisplayLookup,
    scopeLabel,
}: {
    rows: ScheduleRow[]
    versionLabel: string
    termLabel: string
    deptLabel: string
    generatedAt: string
    stats: PlannerStats
    filteredByConflict: boolean
    sectionDisplayLookup: SectionDisplayLookup
    scopeLabel?: string
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
                            {scopeLabel ? (
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Scope:</Text>
                                    <Text style={styles.infoValue}>{scopeLabel}</Text>
                                </View>
                            ) : null}
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
                                                <Text style={styles.cellText}>{formatDayDisplayLabel(r.dayOfWeek)}</Text>
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
                                                    {getRowSectionDisplayLabel(r, sectionDisplayLookup)}
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
    plannerStats,
    visibleRows,
    laboratoryRows,
    conflictFlagsByMeetingId,
    selectedVersionLabel,
    selectedTermLabel,
    selectedDeptLabel,
    entryDialogOpen,
    setEntryDialogOpen,
    editingEntry,
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
    onEditEntry,
    onSaveEntry,
    onDeleteEntry,
}: Props) {
    const navigate = useNavigate()
    const [pdfPreviewOpen, setPdfPreviewOpen] = React.useState(false)
    const [plannerSearch, setPlannerSearch] = React.useState("")
    const [plannerDayFilter, setPlannerDayFilter] = React.useState("all")
    const [plannerMeetingTypeFilter, setPlannerMeetingTypeFilter] = React.useState("all")
    const [plannerRoomTypeFilter, setPlannerRoomTypeFilter] = React.useState("all")
    const [plannerFacultyFilter, setPlannerFacultyFilter] = React.useState("all")
    const [plannerSortKey, setPlannerSortKey] = React.useState<PlannerSortKey>("day")
    const [plannerSortDirection, setPlannerSortDirection] = React.useState<PlannerSortDirection>("asc")

    const sectionDisplayLookup = React.useMemo(() => buildSectionDisplayLookup(sections), [sections])

    const selectedSection = React.useMemo(
        () => sections.find((section) => section.$id === formSectionId) ?? null,
        [sections, formSectionId]
    )

    const selectedSectionPreviewLabel = React.useMemo(() => {
        if (!selectedSection) return "—"
        return sectionDisplayLookup[selectedSection.$id] || "—"
    }, [selectedSection, sectionDisplayLookup])

    const hasConflict = React.useCallback((flags?: ConflictFlags) => {
        return Boolean(flags?.room || flags?.faculty || flags?.section)
    }, [])

    const goToRoomsAndFacilities = React.useCallback(() => {
        navigate(ROOMS_AND_FACILITIES_ROUTE)
    }, [navigate])

    const resetPlannerViewControls = React.useCallback(() => {
        setPlannerSearch("")
        setPlannerDayFilter("all")
        setPlannerMeetingTypeFilter("all")
        setPlannerRoomTypeFilter("all")
        setPlannerFacultyFilter("all")
        setPlannerSortKey("day")
        setPlannerSortDirection("asc")
    }, [])

    React.useEffect(() => {
        resetPlannerViewControls()
    }, [selectedVersionId, resetPlannerViewControls])

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

    const plannerMeetingTypeOptions = React.useMemo(() => {
        return Array.from(new Set(visibleRows.map((row) => meetingTypeLabel(row.meetingType)).filter(Boolean))).sort(
            comparePlannerText
        )
    }, [visibleRows])

    const plannerRoomTypeOptions = React.useMemo(() => {
        return Array.from(new Set(visibleRows.map((row) => roomTypeLabel(row.roomType)).filter(Boolean))).sort(
            comparePlannerText
        )
    }, [visibleRows])

    const displayedPlannerRows = React.useMemo(() => {
        const query = plannerSearch.trim().toLowerCase()
        const direction = plannerSortDirection === "asc" ? 1 : -1

        const filteredRows = visibleRows.filter((row) => {
            const flags = conflictFlagsByMeetingId.get(row.meetingId)
            const rowMeetingType = meetingTypeLabel(row.meetingType)
            const rowRoomType = roomTypeLabel(row.roomType)
            const sectionLabel = getRowSectionDisplayLabel(row, sectionDisplayLookup)
            const facultyMode = row.isManualFaculty ? "manual" : row.facultyUserId ? "assigned" : "unassigned"
            const searchText = [
                row.dayOfWeek,
                formatDayDisplayLabel(row.dayOfWeek),
                formatTimeLabel(row.startTime),
                formatTimeLabel(row.endTime),
                row.subjectLabel,
                sectionLabel,
                row.facultyName,
                row.roomLabel,
                rowMeetingType,
                rowRoomType,
                row.classCode,
                row.deliveryMode,
                row.classRemarks,
                flags?.room ? "room conflict" : "",
                flags?.faculty ? "faculty conflict" : "",
                flags?.section ? "section conflict" : "",
            ]
                .join(" ")
                .toLowerCase()

            if (query && !searchText.includes(query)) return false
            if (plannerDayFilter !== "all" && !dayExpressionsOverlap(row.dayOfWeek, plannerDayFilter)) return false
            if (plannerMeetingTypeFilter !== "all" && rowMeetingType !== plannerMeetingTypeFilter) return false
            if (plannerRoomTypeFilter !== "all" && rowRoomType !== plannerRoomTypeFilter) return false
            if (plannerFacultyFilter !== "all" && facultyMode !== plannerFacultyFilter) return false

            return true
        })

        const sortedRows = filteredRows.slice().sort((a, b) => {
            const aFlags = conflictFlagsByMeetingId.get(a.meetingId)
            const bFlags = conflictFlagsByMeetingId.get(b.meetingId)
            let result = 0

            switch (plannerSortKey) {
                case "time":
                    result = comparePlannerText(a.startTime, b.startTime)
                    if (result === 0) {
                        result = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
                    }
                    break
                case "subject":
                    result = comparePlannerText(a.subjectLabel, b.subjectLabel)
                    break
                case "section":
                    result = comparePlannerText(
                        getRowSectionDisplayLabel(a, sectionDisplayLookup),
                        getRowSectionDisplayLabel(b, sectionDisplayLookup)
                    )
                    break
                case "faculty":
                    result = comparePlannerText(a.facultyName, b.facultyName)
                    break
                case "room":
                    result = comparePlannerText(a.roomLabel, b.roomLabel)
                    break
                case "type":
                    result = comparePlannerText(meetingTypeLabel(a.meetingType), meetingTypeLabel(b.meetingType))
                    break
                case "conflicts":
                    result = countConflictFlags(aFlags) - countConflictFlags(bFlags)
                    break
                case "day":
                default:
                    result = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
                    if (result === 0) {
                        result = comparePlannerText(a.startTime, b.startTime)
                    }
                    break
            }

            if (result === 0) {
                const fallbackDay = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
                if (fallbackDay !== 0) return fallbackDay * direction

                const fallbackTime = comparePlannerText(a.startTime, b.startTime)
                if (fallbackTime !== 0) return fallbackTime * direction

                return comparePlannerText(a.subjectLabel, b.subjectLabel) * direction
            }

            return result * direction
        })

        return sortedRows
    }, [
        visibleRows,
        plannerSearch,
        plannerDayFilter,
        plannerMeetingTypeFilter,
        plannerRoomTypeFilter,
        plannerFacultyFilter,
        plannerSortKey,
        plannerSortDirection,
        conflictFlagsByMeetingId,
        sectionDisplayLookup,
    ])

    const plannerAccordionGroups = React.useMemo<PlannerFacultyAccordionGroup[]>(() => {
        const facultyMap = new Map<
            string,
            {
                key: string
                label: string
                rowCount: number
                conflictedCount: number
                rows: ScheduleRow[]
                courseMap: Map<
                    string,
                    {
                        key: string
                        code: string
                        name: string
                        label: string
                        rowCount: number
                        conflictedCount: number
                        rows: ScheduleRow[]
                        sectionMap: Map<
                            string,
                            {
                                key: string
                                label: string
                                rowCount: number
                                conflictedCount: number
                                rows: ScheduleRow[]
                            }
                        >
                    }
                >
            }
        >()

        for (const row of displayedPlannerRows) {
            const facultyLabel = String(row.facultyName || "Unassigned").trim() || "Unassigned"
            const facultyKey = String(row.facultyKey || `faculty:${facultyLabel.toLowerCase()}`).trim()
            const rowHasConflict = hasConflict(conflictFlagsByMeetingId.get(row.meetingId))
            const { courseCode, courseName, courseLabel, sectionDisplayLabel } = resolveRowCourseMeta(
                row,
                sectionDisplayLookup
            )

            let facultyGroup = facultyMap.get(facultyKey)
            if (!facultyGroup) {
                facultyGroup = {
                    key: facultyKey,
                    label: facultyLabel,
                    rowCount: 0,
                    conflictedCount: 0,
                    rows: [],
                    courseMap: new Map(),
                }
                facultyMap.set(facultyKey, facultyGroup)
            }

            facultyGroup.rowCount += 1
            if (rowHasConflict) facultyGroup.conflictedCount += 1
            facultyGroup.rows.push(row)

            const courseKey = `${facultyKey}::${courseCode}::${courseName}`
            let courseGroup = facultyGroup.courseMap.get(courseKey)
            if (!courseGroup) {
                courseGroup = {
                    key: courseKey,
                    code: courseCode,
                    name: courseName,
                    label: courseLabel,
                    rowCount: 0,
                    conflictedCount: 0,
                    rows: [],
                    sectionMap: new Map(),
                }
                facultyGroup.courseMap.set(courseKey, courseGroup)
            }

            courseGroup.rowCount += 1
            if (rowHasConflict) courseGroup.conflictedCount += 1
            courseGroup.rows.push(row)

            const sectionKey = `${courseKey}::${sectionDisplayLabel}`
            let sectionGroup = courseGroup.sectionMap.get(sectionKey)
            if (!sectionGroup) {
                sectionGroup = {
                    key: sectionKey,
                    label: sectionDisplayLabel,
                    rowCount: 0,
                    conflictedCount: 0,
                    rows: [],
                }
                courseGroup.sectionMap.set(sectionKey, sectionGroup)
            }

            sectionGroup.rowCount += 1
            if (rowHasConflict) sectionGroup.conflictedCount += 1
            sectionGroup.rows.push(row)
        }

        return Array.from(facultyMap.values()).map((facultyGroup) => ({
            key: facultyGroup.key,
            label: facultyGroup.label,
            rowCount: facultyGroup.rowCount,
            conflictedCount: facultyGroup.conflictedCount,
            rows: facultyGroup.rows,
            courseGroups: Array.from(facultyGroup.courseMap.values()).map((courseGroup) => ({
                key: courseGroup.key,
                code: courseGroup.code,
                name: courseGroup.name,
                label: courseGroup.label,
                rowCount: courseGroup.rowCount,
                conflictedCount: courseGroup.conflictedCount,
                rows: courseGroup.rows,
                sectionGroups: Array.from(courseGroup.sectionMap.values()).map((sectionGroup) => ({
                    key: sectionGroup.key,
                    label: sectionGroup.label,
                    rowCount: sectionGroup.rowCount,
                    conflictedCount: sectionGroup.conflictedCount,
                    rows: sectionGroup.rows,
                })),
            })),
        }))
    }, [displayedPlannerRows, conflictFlagsByMeetingId, hasConflict, sectionDisplayLookup])

    const generatedAt = React.useMemo(() => {
        return fmtDate(new Date().toISOString())
    }, [
        displayedPlannerRows.length,
        selectedVersionId,
        showConflictsOnly,
        plannerSearch,
        plannerDayFilter,
        plannerMeetingTypeFilter,
        plannerRoomTypeFilter,
        plannerFacultyFilter,
        plannerSortKey,
        plannerSortDirection,
    ])

    const activeSortLabel = React.useMemo(() => {
        return PLANNER_SORT_OPTIONS.find((option) => option.value === plannerSortKey)?.label || "Day"
    }, [plannerSortKey])

    const buildPlannerStatsForRows = React.useCallback(
        (rows: ScheduleRow[]): PlannerStats => {
            const total = rows.length
            const conflicts = rows.filter((row) => hasConflict(conflictFlagsByMeetingId.get(row.meetingId))).length
            const labs = rows.filter((row) => {
                const rowMeetingType = meetingTypeLabel(row.meetingType)
                const rowRoomType = roomTypeLabel(row.roomType)
                return rowMeetingType === "LAB" || rowRoomType === "LAB"
            }).length

            return { total, conflicts, labs }
        },
        [conflictFlagsByMeetingId, hasConflict]
    )

    const sanitizeFileNamePart = React.useCallback((value: string) => {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "schedule"
    }, [])

    const downloadRowsPdf = React.useCallback(
        async ({ rows, fileNameBase, scopeLabel }: { rows: ScheduleRow[]; fileNameBase: string; scopeLabel?: string }) => {
            if (!selectedVersion || rows.length === 0) {
                toast.error("No schedule entries to export.")
                return
            }

            try {
                const documentNode = (
                    <SchedulePdfDocument
                        rows={rows}
                        versionLabel={selectedVersionLabel}
                        termLabel={selectedTermLabel}
                        deptLabel={selectedDeptLabel}
                        generatedAt={generatedAt}
                        stats={buildPlannerStatsForRows(rows)}
                        filteredByConflict={showConflictsOnly}
                        sectionDisplayLookup={sectionDisplayLookup}
                        scopeLabel={scopeLabel}
                    />
                )

                const blob = await pdf(documentNode).toBlob()
                const url = URL.createObjectURL(blob)

                const a = document.createElement("a")
                a.href = url
                a.download = `${fileNameBase}-${new Date().toISOString().slice(0, 10)}.pdf`
                a.click()

                URL.revokeObjectURL(url)
                toast.success("Schedule PDF exported.")
            } catch (e: any) {
                toast.error(e?.message || "Failed to export PDF.")
            }
        },
        [
            buildPlannerStatsForRows,
            generatedAt,
            sectionDisplayLookup,
            selectedDeptLabel,
            selectedTermLabel,
            selectedVersion,
            selectedVersionLabel,
            showConflictsOnly,
        ]
    )

    const downloadPdf = async () => {
        if (!selectedVersion || displayedPlannerRows.length === 0) {
            toast.error("No schedule entries to export.")
            return
        }

        await downloadRowsPdf({
            rows: displayedPlannerRows,
            fileNameBase: `schedule-report-${selectedVersion.$id}`,
        })
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
                                disabled={!selectedVersion || displayedPlannerRows.length === 0}
                            >
                                <Eye className="mr-2 size-4" />
                                Preview PDF
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={() => void downloadPdf()}
                                disabled={!selectedVersion || displayedPlannerRows.length === 0}
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

                    {selectedVersion && plannerStats.conflicts > 0 ? (
                        <Alert variant="destructive">
                            <AlertTitle className="flex items-center gap-2">
                                <AlertTriangle className="size-4" />
                                Conflicts detected
                            </AlertTitle>
                            <AlertDescription className="space-y-3">
                                <div>
                                    There are <span className="font-semibold">{plannerStats.conflicts}</span> conflicting schedule
                                    entr{plannerStats.conflicts === 1 ? "y" : "ies"} in this version.
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={goToRoomsAndFacilities}
                                >
                                    <ArrowRight className="mr-2 size-4" />
                                    Go to Rooms & Facilities
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <Separator />

                    {selectedVersion ? (
                        <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <SlidersHorizontal className="size-4" />
                                        Table filters & sorting
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Search, filter, and sort visible planner rows before reviewing or exporting.
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className="rounded-lg">
                                        {displayedPlannerRows.length} shown
                                    </Badge>
                                    <span>of {visibleRows.length} visible entries</span>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                                <div className="space-y-1 xl:col-span-2">
                                    <Label>Search</Label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={plannerSearch}
                                            onChange={(e) => setPlannerSearch(e.target.value)}
                                            placeholder="Subject, section, faculty, room, class code..."
                                            className="rounded-xl pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Day</Label>
                                    <Select value={plannerDayFilter} onValueChange={setPlannerDayFilter}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="All days" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All days</SelectItem>
                                            {DAY_OPTIONS.map((day) => (
                                                <SelectItem key={day} value={day}>
                                                    {formatDayDisplayLabel(day)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Meeting Type</Label>
                                    <Select value={plannerMeetingTypeFilter} onValueChange={setPlannerMeetingTypeFilter}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="All meeting types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All meeting types</SelectItem>
                                            {plannerMeetingTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Room Type</Label>
                                    <Select value={plannerRoomTypeFilter} onValueChange={setPlannerRoomTypeFilter}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="All room types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All room types</SelectItem>
                                            {plannerRoomTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Faculty Mode</Label>
                                    <Select value={plannerFacultyFilter} onValueChange={setPlannerFacultyFilter}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="All faculty modes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All faculty modes</SelectItem>
                                            <SelectItem value="assigned">Assigned profile</SelectItem>
                                            <SelectItem value="manual">Manual faculty</SelectItem>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Sort By</Label>
                                    <Select value={plannerSortKey} onValueChange={(value) => setPlannerSortKey(value as PlannerSortKey)}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Sort planner rows" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PLANNER_SORT_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <ArrowUpDown className="size-4" />
                                    <span>
                                        {activeSortLabel} • {plannerSortDirection === "asc" ? "Ascending" : "Descending"}
                                    </span>
                                    <Select
                                        value={plannerSortDirection}
                                        onValueChange={(value) => setPlannerSortDirection(value as PlannerSortDirection)}
                                    >
                                        <SelectTrigger className="h-8 w-35 rounded-xl">
                                            <SelectValue placeholder="Order" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc">Ascending</SelectItem>
                                            <SelectItem value="desc">Descending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button type="button" variant="ghost" className="rounded-xl" onClick={resetPlannerViewControls}>
                                    <X className="mr-2 size-4" />
                                    Reset filters & sort
                                </Button>
                            </div>
                        </div>
                    ) : null}

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
                    ) : displayedPlannerRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <Search className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No planner entries matched</div>
                            <div className="text-sm text-muted-foreground">
                                Adjust the current planner filters or reset the sort controls to see more entries.
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border">
                            <div className="flex flex-col gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                <span>Review entries by Faculty → Course → Section, similar to the Master Data records accordion. Each faculty group can also be printed individually.</span>
                                <span>
                                    Showing {displayedPlannerRows.length} of {visibleRows.length} visible planner entries
                                </span>
                            </div>

                            <Accordion type="multiple" className="w-full">
                                {plannerAccordionGroups.map((facultyGroup, facultyIndex) => (
                                    <AccordionItem
                                        key={`${facultyGroup.key}-${facultyIndex}`}
                                        value={`${facultyGroup.key}-${facultyIndex}`}
                                        className="px-3 sm:px-4"
                                    >
                                        <AccordionTrigger className="min-w-0 gap-3 py-4 text-left hover:no-underline">
                                            <div className="flex min-w-0 flex-1 flex-col pr-2 text-left">
                                                <div className="flex min-w-0 items-start gap-2">
                                                    <UserCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="wrap-break-word text-sm font-semibold leading-5 sm:truncate">
                                                            {facultyGroup.label}
                                                        </div>
                                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                                                            <span>
                                                                {facultyGroup.rowCount} schedule entr{facultyGroup.rowCount === 1 ? "y" : "ies"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                {facultyGroup.courseGroups.length} course group{facultyGroup.courseGroups.length === 1 ? "" : "s"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                {facultyGroup.conflictedCount} conflict{facultyGroup.conflictedCount === 1 ? "" : "s"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionTrigger>

                                        <AccordionContent className="space-y-4 pb-4">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg"
                                                    onClick={() =>
                                                        void downloadRowsPdf({
                                                            rows: facultyGroup.rows,
                                                            fileNameBase: `faculty-schedule-${sanitizeFileNamePart(facultyGroup.label)}`,
                                                            scopeLabel: `Faculty: ${facultyGroup.label}`,
                                                        })
                                                    }
                                                >
                                                    <Printer className="mr-2 size-4" />
                                                    Print Faculty
                                                </Button>
                                            </div>
                                            <Accordion type="multiple" className="w-full space-y-3">
                                                {facultyGroup.courseGroups.map((courseGroup, courseIndex) => (
                                                    <AccordionItem
                                                        key={`${courseGroup.key}-${courseIndex}`}
                                                        value={`${courseGroup.key}-${courseIndex}`}
                                                        className="overflow-hidden rounded-xl border bg-background px-3 sm:px-4"
                                                    >
                                                        <AccordionTrigger className="min-w-0 gap-3 py-4 text-left hover:no-underline">
                                                            <div className="min-w-0 flex-1 text-left">
                                                                <div className="wrap-break-word text-sm font-semibold leading-5">
                                                                    {courseGroup.label}
                                                                </div>
                                                                <div className="mt-1 text-xs text-muted-foreground">
                                                                    {courseGroup.name}
                                                                </div>
                                                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                                                                    <span>
                                                                        {courseGroup.rowCount} subject entr{courseGroup.rowCount === 1 ? "y" : "ies"}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span>
                                                                        {courseGroup.sectionGroups.length} section group{courseGroup.sectionGroups.length === 1 ? "" : "s"}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span>
                                                                        {courseGroup.conflictedCount} conflict{courseGroup.conflictedCount === 1 ? "" : "s"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>

                                                        <AccordionContent className="space-y-3 pb-4">
                                                            <Accordion type="multiple" className="w-full space-y-3">
                                                                {courseGroup.sectionGroups.map((sectionGroup, sectionIndex) => (
                                                                    <AccordionItem
                                                                        key={`${sectionGroup.key}-${sectionIndex}`}
                                                                        value={`${sectionGroup.key}-${sectionIndex}`}
                                                                        className="overflow-hidden rounded-xl border bg-muted/10 px-3 sm:px-4"
                                                                    >
                                                                        <AccordionTrigger className="min-w-0 gap-3 py-4 text-left hover:no-underline">
                                                                            <div className="min-w-0 flex-1 text-left">
                                                                                <div className="wrap-break-word text-sm font-semibold leading-5">
                                                                                    {sectionGroup.label}
                                                                                </div>
                                                                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                                                                                    <span>
                                                                                        {sectionGroup.rowCount} class meeting{sectionGroup.rowCount === 1 ? "" : "s"}
                                                                                    </span>
                                                                                    <span>•</span>
                                                                                    <span>
                                                                                        {sectionGroup.conflictedCount} conflict{sectionGroup.conflictedCount === 1 ? "" : "s"}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </AccordionTrigger>

                                                                        <AccordionContent className="space-y-3 pb-4">
                                                                            <div className="space-y-3 sm:hidden">
                                                                                {sectionGroup.rows.map((row) => {
                                                                                    const flags = conflictFlagsByMeetingId.get(row.meetingId)
                                                                                    const rowHasConflict = hasConflict(flags)
                                                                                    const { code, descriptiveTitle } = splitSubjectLabelParts(row.subjectLabel)
                                                                                    const sectionLabel = getRowSectionDisplayLabel(row, sectionDisplayLookup)

                                                                                    return (
                                                                                        <div key={`mobile-${row.meetingId}`} className="rounded-xl border bg-background p-3 shadow-sm">
                                                                                            <div className="space-y-2">
                                                                                                <div>
                                                                                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</div>
                                                                                                    <div className="font-semibold">{code}</div>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descriptive Title</div>
                                                                                                    <div className="text-sm leading-relaxed">{descriptiveTitle}</div>
                                                                                                </div>
                                                                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                                                                    <div>
                                                                                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</div>
                                                                                                        <div>{meetingTypeLabel(row.meetingType)}</div>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day</div>
                                                                                                        <div>{formatDayDisplayLabel(row.dayOfWeek)}</div>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</div>
                                                                                                        <div>{formatTimeRange(row.startTime, row.endTime)}</div>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instructor</div>
                                                                                                        <div>{row.facultyName || "—"}</div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Section</div>
                                                                                                    <div>{sectionLabel}</div>
                                                                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                                                                        Room: {row.roomLabel || "—"} • {roomTypeLabel(row.roomType)}
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                                    {renderConflictBadges(flags)}
                                                                                                    {row.isManualFaculty ? (
                                                                                                        <Badge variant="secondary" className="rounded-lg">
                                                                                                            Manual
                                                                                                        </Badge>
                                                                                                    ) : null}
                                                                                                </div>
                                                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                                                    {rowHasConflict ? (
                                                                                                        <Button
                                                                                                            type="button"
                                                                                                            variant="outline"
                                                                                                            size="sm"
                                                                                                            className="rounded-lg"
                                                                                                            onClick={goToRoomsAndFacilities}
                                                                                                        >
                                                                                                            <ArrowRight className="mr-2 size-4" />
                                                                                                            Fix Conflict
                                                                                                        </Button>
                                                                                                    ) : null}
                                                                                                    <Button
                                                                                                        type="button"
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        className="rounded-lg"
                                                                                                        onClick={() => onEditEntry(row)}
                                                                                                    >
                                                                                                        <PencilLine className="mr-2 size-4" />
                                                                                                        Edit
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>

                                                                            <div className="hidden overflow-hidden rounded-xl border sm:block">
                                                                                <Table className="table-fixed">
                                                                                    <TableHeader>
                                                                                        <TableRow>
                                                                                            <TableHead className="w-28">Code</TableHead>
                                                                                            <TableHead className="w-72">Descriptive Title</TableHead>
                                                                                            <TableHead className="w-20">Type</TableHead>
                                                                                            <TableHead className="w-24">Day</TableHead>
                                                                                            <TableHead className="w-32">Time</TableHead>
                                                                                            <TableHead className="w-52">Instructor</TableHead>
                                                                                            <TableHead className="w-52">Section</TableHead>
                                                                                            <TableHead className="w-32 text-right">Actions</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {sectionGroup.rows.map((row) => {
                                                                                            const flags = conflictFlagsByMeetingId.get(row.meetingId)
                                                                                            const rowHasConflict = hasConflict(flags)
                                                                                            const { code, descriptiveTitle } = splitSubjectLabelParts(row.subjectLabel)
                                                                                            const sectionLabel = getRowSectionDisplayLabel(row, sectionDisplayLookup)

                                                                                            return (
                                                                                                <TableRow key={`desktop-${row.meetingId}`}>
                                                                                                    <TableCell className="font-medium align-top">{code}</TableCell>
                                                                                                    <TableCell className="align-top">
                                                                                                        <div className="space-y-1 leading-relaxed">
                                                                                                            <div className="font-medium">{descriptiveTitle}</div>
                                                                                                            <div className="text-xs text-muted-foreground">Units: {row.subjectUnits ?? "—"}</div>
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="align-top">
                                                                                                        <Badge variant="outline" className="rounded-lg">
                                                                                                            {meetingTypeLabel(row.meetingType)}
                                                                                                        </Badge>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="align-top">{formatDayDisplayLabel(row.dayOfWeek)}</TableCell>
                                                                                                    <TableCell className="align-top">{formatTimeRange(row.startTime, row.endTime)}</TableCell>
                                                                                                    <TableCell className="align-top">
                                                                                                        <div className="space-y-1 leading-relaxed">
                                                                                                            <div>{row.facultyName || "—"}</div>
                                                                                                            {row.isManualFaculty ? (
                                                                                                                <Badge variant="secondary" className="rounded-lg">
                                                                                                                    Manual
                                                                                                                </Badge>
                                                                                                            ) : null}
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="align-top">
                                                                                                        <div className="space-y-2 leading-relaxed">
                                                                                                            <div>{sectionLabel}</div>
                                                                                                            <div className="text-xs text-muted-foreground">
                                                                                                                Room: {row.roomLabel || "—"} • {roomTypeLabel(row.roomType)}
                                                                                                            </div>
                                                                                                            <div>{renderConflictBadges(flags)}</div>
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="align-top text-right">
                                                                                                        <div className="flex flex-col items-end gap-2">
                                                                                                            {rowHasConflict ? (
                                                                                                                <Button
                                                                                                                    type="button"
                                                                                                                    variant="outline"
                                                                                                                    size="sm"
                                                                                                                    className="rounded-lg"
                                                                                                                    onClick={goToRoomsAndFacilities}
                                                                                                                >
                                                                                                                    <ArrowRight className="mr-2 size-4" />
                                                                                                                    Fix
                                                                                                                </Button>
                                                                                                            ) : null}
                                                                                                            <Button
                                                                                                                type="button"
                                                                                                                variant="outline"
                                                                                                                size="sm"
                                                                                                                className="rounded-lg"
                                                                                                                onClick={() => onEditEntry(row)}
                                                                                                            >
                                                                                                                <PencilLine className="mr-2 size-4" />
                                                                                                                Edit
                                                                                                            </Button>
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                </TableRow>
                                                                                            )
                                                                                        })}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                ))}
                                                            </Accordion>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
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

                            <Table className="min-w-max table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40 whitespace-normal wrap-break-word align-top">Laboratory Room</TableHead>
                                        <TableHead className="w-24 whitespace-normal wrap-break-word align-top">Day</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Time</TableHead>
                                        <TableHead className="w-56 whitespace-normal wrap-break-word align-top">Assigned Faculty</TableHead>
                                        <TableHead className="w-52 whitespace-normal wrap-break-word align-top">Subject</TableHead>
                                        <TableHead className="w-32 whitespace-normal wrap-break-word align-top">Section</TableHead>
                                        <TableHead className="w-40 whitespace-normal wrap-break-word align-top">Conflicts</TableHead>
                                        <TableHead className="w-36 whitespace-normal wrap-break-word align-top">Actions</TableHead>
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
                                                    {formatDayDisplayLabel(row.dayOfWeek)}
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
                                                    {getRowSectionDisplayLabel(row, sectionDisplayLookup)}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    {renderConflictBadges(flags)}
                                                </TableCell>

                                                <TableCell className="whitespace-normal wrap-break-word align-top">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg"
                                                        onClick={() => onEditEntry(row)}
                                                    >
                                                        <PencilLine className="mr-2 size-4" />
                                                        Edit
                                                    </Button>
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
                <DialogContent className="z-120 h-[82vh] max-h-[82vh] overflow-y-auto p-4 sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Schedule PDF Preview</DialogTitle>
                        <DialogDescription>
                            Preview the generated PDF before export.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-[66vh] overflow-hidden rounded-xl border">
                        <PDFViewer style={{ width: "100%", height: "100%" }}>
                            <SchedulePdfDocument
                                rows={displayedPlannerRows}
                                versionLabel={selectedVersionLabel}
                                termLabel={selectedTermLabel}
                                deptLabel={selectedDeptLabel}
                                generatedAt={generatedAt}
                                stats={buildPlannerStatsForRows(displayedPlannerRows)}
                                filteredByConflict={showConflictsOnly}
                                sectionDisplayLookup={sectionDisplayLookup}
                            />
                        </PDFViewer>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>
                            Close
                        </Button>
                        <Button onClick={() => void downloadPdf()} disabled={!selectedVersion || displayedPlannerRows.length === 0}>
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
                        setFormAllowConflictSave(false)
                    }
                }}
            >
                <DialogContent className="z-120 max-h-[78vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? "Edit Schedule Entry" : "Create Schedule Entry"}</DialogTitle>
                        <DialogDescription>
                            {editingEntry
                                ? "Update the selected schedule entry. Section labels follow the same display format used in Master Data."
                                : "Use dropdowns for section, subject, faculty, and room. Section labels follow the same display format used in Master Data."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {editingEntry ? (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="rounded-lg">
                                    Editing entry
                                </Badge>
                                <span>{editingEntry.subjectLabel}</span>
                                <span>•</span>
                                <span>{formatDayDisplayLabel(editingEntry.dayOfWeek)}</span>
                                <span>•</span>
                                <span>{formatTimeRange(editingEntry.startTime, editingEntry.endTime)}</span>
                            </div>
                        ) : null}

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label>Section</Label>
                                    <Select value={formSectionId} onValueChange={setFormSectionId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select section" />
                                        </SelectTrigger>
                                        <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                            {sections.map((s) => (
                                                <SelectItem key={s.$id} value={s.$id}>
                                                    {sectionDisplayLookup[s.$id] || s.$id}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="rounded-xl border border-dashed p-3">
                                    <div className="text-xs text-muted-foreground">Section Reference Preview</div>
                                    <div className="mt-1 font-medium">{selectedSectionPreviewLabel}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Section labels follow the same display format used in Master Data.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Subject</Label>
                                <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
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
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
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
                                <div className="text-xs text-muted-foreground">
                                    Supports single or paired days such as Monday, M-W, and T-TH.
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Room</Label>
                                <Select value={formRoomId} onValueChange={setFormRoomId}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
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
                                        <SelectValue placeholder="Select day or pair" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {DAY_OPTIONS.map((d) => (
                                            <SelectItem key={d} value={d}>
                                                {formatDayDisplayLabel(d)}
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
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
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
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {TIME_OPTIONS.map((t) => (
                                            <SelectItem key={`et-${t.value}`} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Supports single or paired days such as Monday, M-W, and T-TH.
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Meeting Type</Label>
                                <Select value={formMeetingType} onValueChange={(v) => setFormMeetingType(v as MeetingType)}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
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
                                                [{c.type.toUpperCase()}] {formatDayDisplayLabel(c.row.dayOfWeek)} {formatTimeRange(c.row.startTime, c.row.endTime)} •{" "}
                                                {c.row.subjectLabel} • {getRowSectionDisplayLabel(c.row, sectionDisplayLookup)} • {c.row.roomLabel}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <Checkbox
                                            id="allowConflictSave"
                                            checked={formAllowConflictSave}
                                            onCheckedChange={(v) => setFormAllowConflictSave(Boolean(v))}
                                        />
                                        <Label htmlFor="allowConflictSave" className="cursor-pointer text-sm">
                                            Override and save anyway
                                        </Label>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg"
                                            onClick={goToRoomsAndFacilities}
                                        >
                                            <ArrowRight className="mr-2 size-4" />
                                            Fix in Rooms & Facilities
                                        </Button>
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

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {editingEntry ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="destructive" disabled={entrySaving}>
                                            <Trash2 className="mr-2 size-4" />
                                            Delete Entry
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="z-210">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this schedule entry?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove the selected schedule entry from the planner. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={entrySaving}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    void onDeleteEntry()
                                                }}
                                                disabled={entrySaving}
                                                className={cn(entrySaving && "pointer-events-none opacity-90")}
                                            >
                                                {entrySaving ? (
                                                    <>
                                                        <RefreshCcw className="mr-2 size-4 animate-spin" />
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 className="mr-2 size-4" />
                                                        Confirm Delete
                                                    </>
                                                )}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : null}

                            <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)} disabled={entrySaving}>
                                Cancel
                            </Button>
                        </div>

                        <Button
                            type="button"
                            onClick={() => void onSaveEntry()}
                            disabled={entrySaving}
                            className={cn(entrySaving && "opacity-90")}
                        >
                            {entrySaving ? (
                                <>
                                    <RefreshCcw className="mr-2 size-4 animate-spin" />
                                    {editingEntry ? "Saving..." : "Creating..."}
                                </>
                            ) : editingEntry ? (
                                <>
                                    <PencilLine className="mr-2 size-4" />
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
        </>
    )
}