/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, Eye, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

export type RoomSchedulePrintItem = {
    id?: string
    dayOfWeek: string
    startTime: string
    endTime: string
    displayStartTime?: string | null
    displayEndTime?: string | null
    facultyName?: string | null
    subjectCode?: string | null
    subjectTitle?: string | null
    sectionLabel?: string | null
    notes?: string | null
    displayLabel?: string | null
    contentLines?: string[]
    color?: string | null
    textColor?: string | null
    groupLabel?: string | null
}

export type RoomScheduleScope = "MORNING" | "AFTERNOON" | "BOTH"

export type RoomSchedulePrintSheetProps = {
    roomLabel: string
    items: RoomSchedulePrintItem[]
    schoolYear: string
    semester: string

    institutionName?: string
    institutionSubtitle?: string
    collegeName?: string
    documentSubtitle?: string

    signatoryName?: string
    signatoryTitle?: string

    timeSlots?: string[]

    previewLabel?: string
    exportLabel?: string
    disabled?: boolean
    scheduleScope?: RoomScheduleScope
}

const DEFAULT_TIME_SLOTS = [
    "8:00-9:00",
    "9:01-10:00",
    "10:01-11:00",
    "11:01-12:00",
    "12:01-1:00",
    "1:01-2:00",
    "2:01-3:00",
    "3:01-4:00",
    "4:01-5:00",
    "5:01-6:00",
    "6:01-7:00",
    "7:01-8:00",
    "8:01-9:00",
] as const

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const NOON_BREAK_SLOT = "12:01-1:00"

const MORNING_LABEL = "Morning"
const AFTERNOON_LABEL = "Afternoon"
const BOTH_LABEL = "Morning & Afternoon"
const MORNING_END_MINUTES = 12 * 60
const AFTERNOON_START_MINUTES = 13 * 60

const TIME_COL_WIDTH = 82
const DAY_COL_WIDTH = 95
const SIGN_COL_WIDTH = 16
const ROW_HEIGHT = 24
const HEADER_ROW_HEIGHT = 18
const HEADER_SUB_ROW_HEIGHT = 14
const HEADER_TOTAL_HEIGHT = HEADER_ROW_HEIGHT + HEADER_SUB_ROW_HEIGHT
const GRID_WIDTH = TIME_COL_WIDTH + DAYS.length * (DAY_COL_WIDTH + SIGN_COL_WIDTH)
const VERTICAL_SIGN_TEXT = "S\ni\ng\nn"

const LEFT_LOGO_PATH = "/logo.png"
const RIGHT_LOGO_PATH = "/CCS.png"

const PASTEL_BLOCKS = [
    "#F5DEB8",
    "#F4CBD7",
    "#DCE7FB",
    "#DCECAB",
    "#E8DDF8",
    "#FBE4CB",
] as const

const assetUrlCache = new Map<string, Promise<string>>()

let pdfRendererPromise: Promise<any> | null = null

function pad2(n: number) {
    return String(n).padStart(2, "0")
}

function formatTimestamp(d: Date) {
    const yyyy = d.getFullYear()
    const mm = pad2(d.getMonth() + 1)
    const dd = pad2(d.getDate())
    const hh = pad2(d.getHours())
    const mi = pad2(d.getMinutes())
    return `${yyyy}-${mm}-${dd}_${hh}${mi}`
}

function normalizeText(value: any) {
    return String(value ?? "").trim()
}

function normalizeDay(value: any) {
    const raw = normalizeText(value).toLowerCase()
    if (raw.startsWith("mon")) return "Monday"
    if (raw.startsWith("tue")) return "Tuesday"
    if (raw.startsWith("wed")) return "Wednesday"
    if (raw.startsWith("thu")) return "Thursday"
    if (raw.startsWith("fri")) return "Friday"
    return ""
}

function toSemesterSchoolYearLine(semester: string, schoolYear: string) {
    const sem = normalizeText(semester)
    const sy = normalizeText(schoolYear)

    if (!sem && !sy) return ""
    if (!sem) return `SY ${sy}`
    if (!sy) return sem

    return /\bsy\b/i.test(sem) ? sem : `${sem} SY ${sy}`
}

function inferYearBadge(schoolYear: string) {
    const raw = normalizeText(schoolYear)
    if (!raw) return ""
    const parts = raw
        .split("-")
        .map((part) => part.trim())
        .filter(Boolean)
    return parts[parts.length - 1] || raw
}

function parseClockMinutes(value: string) {
    const raw = normalizeText(value)
    if (!raw) return null

    const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (ampm) {
        let hh = Number(ampm[1])
        const mm = Number(ampm[2])
        const suffix = ampm[3].toUpperCase()

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null

        if (suffix === "AM" && hh === 12) hh = 0
        if (suffix === "PM" && hh !== 12) hh += 12

        return hh * 60 + mm
    }

    const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (!timeMatch) return null

    const hh = Number(timeMatch[1])
    const mm = Number(timeMatch[2])

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null

    return hh * 60 + mm
}

function scheduleScopeLabel(scope: RoomScheduleScope | "") {
    if (scope === "MORNING") return MORNING_LABEL
    if (scope === "AFTERNOON") return AFTERNOON_LABEL
    if (scope === "BOTH") return BOTH_LABEL
    return ""
}

function scheduleScopeFilenameLabel(scope: RoomScheduleScope | "") {
    if (scope === "MORNING") return "morning"
    if (scope === "AFTERNOON") return "afternoon"
    if (scope === "BOTH") return "morning-afternoon"
    return "schedule"
}

function inferScheduleScope(startTime: string, endTime: string): RoomScheduleScope | "" {
    const start = parseClockMinutes(startTime)
    const end = parseClockMinutes(endTime)

    if (start == null || end == null) return ""

    if (end <= MORNING_END_MINUTES) return "MORNING"
    if (start >= AFTERNOON_START_MINUTES) return "AFTERNOON"

    return "BOTH"
}

function resolveItemScheduleScope(item: RoomSchedulePrintItem): RoomScheduleScope | "" {
    const raw = normalizeText(item.groupLabel).toLowerCase()

    if (raw.includes("morning")) return "MORNING"
    if (raw.includes("afternoon")) return "AFTERNOON"
    if (raw.includes("combined") || raw.includes("both")) return "BOTH"

    return inferScheduleScope(item.startTime, item.endTime)
}

function resolveItemScheduleLabel(item: RoomSchedulePrintItem) {
    return scheduleScopeLabel(resolveItemScheduleScope(item))
}

function matchesScheduleScope(item: RoomSchedulePrintItem, scheduleScope: RoomScheduleScope) {
    const itemScope = resolveItemScheduleScope(item)

    if (!itemScope) return scheduleScope === "BOTH"
    if (scheduleScope === "BOTH") return true
    if (scheduleScope === "MORNING") {
        return itemScope === "MORNING" || itemScope === "BOTH"
    }

    return itemScope === "AFTERNOON" || itemScope === "BOTH"
}

function parseSlotRange(slotLabel: string) {
    const [startRaw, endRaw] = String(slotLabel).split("-")
    const start = parseClockMinutes(startRaw ?? "")
    const end = parseClockMinutes(endRaw ?? "")

    if (start == null || end == null) return null
    return { start, end }
}

function isNoonBreakSlot(slotLabel: string) {
    return normalizeText(slotLabel) === NOON_BREAK_SLOT
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    const normalizedAEnd = aEnd <= aStart ? aStart + 1 : aEnd
    const normalizedBEnd = bEnd <= bStart ? bStart + 1 : bEnd
    return aStart < normalizedBEnd && bStart < normalizedAEnd
}

function buildSlotMeta(timeSlots: string[]) {
    let previousEnd = -1

    return timeSlots.map((slot) => {
        const parsed = parseSlotRange(slot)
        let start = parsed?.start ?? 0
        let end = parsed?.end ?? 0

        if (parsed) {
            while (previousEnd >= 0 && start <= previousEnd) {
                start += 12 * 60
            }

            while (end <= start) {
                end += 12 * 60
            }

            previousEnd = end
        }

        return {
            label: slot,
            start,
            end,
            isNoonBreak: isNoonBreakSlot(slot),
        }
    })
}

function filterTimeSlotsByScope(timeSlots: string[], scheduleScope: RoomScheduleScope) {
    if (scheduleScope === "BOTH") return [...timeSlots]

    const slotMeta = buildSlotMeta(timeSlots)
    const filtered = slotMeta
        .filter((slot) => {
            if (slot.isNoonBreak) return false
            if (scheduleScope === "MORNING") return slot.end <= MORNING_END_MINUTES
            return slot.start >= AFTERNOON_START_MINUTES
        })
        .map((slot) => slot.label)

    return filtered.length > 0 ? filtered : [...timeSlots]
}

function stableHash(value: string) {
    let h = 0
    for (let i = 0; i < value.length; i += 1) {
        h = (h << 5) - h + value.charCodeAt(i)
        h |= 0
    }
    return Math.abs(h)
}

function resolveBlockColor(item: RoomSchedulePrintItem, fallbackSeed: string) {
    if (normalizeText(item.color)) return normalizeText(item.color)
    const idx = stableHash(fallbackSeed) % PASTEL_BLOCKS.length
    return PASTEL_BLOCKS[idx]
}

function resolveBlockTextColor(item: RoomSchedulePrintItem) {
    return normalizeText(item.textColor) || "#334155"
}

function resolveContentLines(item: RoomSchedulePrintItem) {
    const explicit = (item.contentLines ?? [])
        .map((line) => normalizeText(line))
        .filter(Boolean)

    if (explicit.length > 0) return explicit.slice(0, 4)

    const scheduleLabel = resolveItemScheduleLabel(item)

    const oneLine = normalizeText(item.displayLabel)
    if (oneLine) return [scheduleLabel, oneLine].filter(Boolean).slice(0, 4)

    const line1 = normalizeText(item.facultyName)
    const line2 = [normalizeText(item.subjectCode), normalizeText(item.sectionLabel)]
        .filter(Boolean)
        .join(" / ")
    const line3 = normalizeText(item.subjectTitle)
    const line4 = normalizeText(item.notes)

    return [scheduleLabel, line1, line2, line3 || line4].filter(Boolean).slice(0, 4)
}

function buildMeetingBlocks(items: RoomSchedulePrintItem[], timeSlots: string[]) {
    const slotMeta = buildSlotMeta(timeSlots)
    const blocks: Array<{
        id: string
        day: string
        dayIndex: number
        rowIndex: number
        rowSpan: number
        top: number
        left: number
        width: number
        height: number
        color: string
        textColor: string
        lines: string[]
        fontSize: number
    }> = []

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const day = normalizeDay(item.dayOfWeek)
        const dayIndex = DAYS.findIndex((d) => d === day)
        if (dayIndex < 0) continue

        const startMinutes = parseClockMinutes(item.startTime)
        const endMinutes = parseClockMinutes(item.endTime)
        if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) continue

        const matchedRows: number[] = []
        for (let rowIndex = 0; rowIndex < slotMeta.length; rowIndex += 1) {
            const slot = slotMeta[rowIndex]
            if (slot.isNoonBreak) continue

            if (rangesOverlap(startMinutes, endMinutes, slot.start, slot.end)) {
                matchedRows.push(rowIndex)
            }
        }

        if (matchedRows.length === 0) continue

        const rowIndex = matchedRows[0]
        const rowSpan = matchedRows.length
        const left = dayIndex * (DAY_COL_WIDTH + SIGN_COL_WIDTH)
        const top = rowIndex * ROW_HEIGHT
        const width = DAY_COL_WIDTH
        const height = Math.max(rowSpan * ROW_HEIGHT - 1, ROW_HEIGHT)
        const fontSize = rowSpan >= 4 ? 7 : rowSpan >= 3 ? 6.8 : 6.2

        blocks.push({
            id: normalizeText(item.id) || `${day}-${item.startTime}-${item.endTime}-${index}`,
            day,
            dayIndex,
            rowIndex,
            rowSpan,
            top,
            left,
            width,
            height,
            color: resolveBlockColor(
                item,
                `${day}|${item.facultyName}|${item.subjectCode}|${item.sectionLabel}|${index}`
            ),
            textColor: resolveBlockTextColor(item),
            lines: resolveContentLines(item),
            fontSize,
        })
    }

    return blocks.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex
        if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex
        return a.id.localeCompare(b.id)
    })
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result ?? ""))
        reader.onerror = () => reject(new Error("Failed to read file data."))
        reader.readAsDataURL(blob)
    })
}

function isSvgAsset(path: string, blob: Blob) {
    return /\.svg(?:$|\?)/i.test(path) || /image\/svg\+xml/i.test(blob.type)
}

async function loadImageElement(src: string) {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image()
        image.decoding = "async"
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("Failed to decode image asset."))
        image.src = src
    })
}

async function rasterizeSvgBlobToPngDataUrl(blob: Blob) {
    const objectUrl = URL.createObjectURL(blob)

    try {
        const image = await loadImageElement(objectUrl)
        const width = Math.max(image.naturalWidth || image.width || 1, 1)
        const height = Math.max(image.naturalHeight || image.height || 1, 1)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("Failed to prepare canvas for SVG conversion.")
        }

        context.clearRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)

        return canvas.toDataURL("image/png")
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

async function assetBlobToPdfDataUrl(path: string, blob: Blob) {
    if (isSvgAsset(path, blob)) {
        return await rasterizeSvgBlobToPngDataUrl(blob)
    }

    return await blobToDataUrl(blob)
}

function getAssetAsDataUrl(path: string) {
    if (!assetUrlCache.has(path)) {
        const promise = (async () => {
            try {
                const response = await fetch(path, { cache: "force-cache" })
                if (!response.ok) {
                    throw new Error(`Failed to load asset: ${path}`)
                }

                const blob = await response.blob()
                return await assetBlobToPdfDataUrl(path, blob)
            } catch (error) {
                assetUrlCache.delete(path)
                throw error
            }
        })()

        assetUrlCache.set(path, promise)
    }

    return assetUrlCache.get(path)!
}

async function loadPdfRenderer() {
    if (!pdfRendererPromise) {
        pdfRendererPromise = import("@react-pdf/renderer").then((m: any) => m?.default ?? m)
    }
    return pdfRendererPromise
}

export function RoomSchedulePrintSheet({
    roomLabel,
    items,
    schoolYear,
    semester,
    institutionName = "JOSE RIZAL MEMORIAL STATE UNIVERSITY",
    institutionSubtitle = "The Premier University in Zamboanga del Norte",
    collegeName = "COLLEGE OF COMPUTING STUDIES",
    documentSubtitle = "Room Utilization/Class Monitoring",
    signatoryName = "ERSON A. RODRIGUEZ, LPT, MSIT",
    signatoryTitle = "Associate Dean, CCS",
    timeSlots = [...DEFAULT_TIME_SLOTS],
    previewLabel = "Preview PDF",
    exportLabel = "Export PDF",
    disabled = false,
    scheduleScope = "BOTH",
}: RoomSchedulePrintSheetProps) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [pdfBusy, setPdfBusy] = React.useState(false)
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)
    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)

    const pdfUrlRef = React.useRef<string | null>(null)
    const pdfPreviewBusyRef = React.useRef(false)
    const previewRequestIdRef = React.useRef(0)

    const semesterSchoolYearLine = React.useMemo(
        () => toSemesterSchoolYearLine(semester, schoolYear),
        [semester, schoolYear]
    )
    const yearBadge = React.useMemo(() => inferYearBadge(schoolYear), [schoolYear])
    const selectedScheduleLabel = React.useMemo(
        () => scheduleScopeLabel(scheduleScope),
        [scheduleScope]
    )
    const selectedScheduleFileLabel = React.useMemo(
        () => scheduleScopeFilenameLabel(scheduleScope),
        [scheduleScope]
    )
    const filteredItems = React.useMemo(
        () => items.filter((item) => matchesScheduleScope(item, scheduleScope)),
        [items, scheduleScope]
    )
    const filteredTimeSlots = React.useMemo(
        () => filterTimeSlotsByScope(timeSlots, scheduleScope),
        [timeSlots, scheduleScope]
    )
    const meetingBlocks = React.useMemo(
        () => buildMeetingBlocks(filteredItems, filteredTimeSlots),
        [filteredItems, filteredTimeSlots]
    )
    const uniqueScheduleLabels = React.useMemo(
        () =>
            Array.from(
                new Set(filteredItems.map((item) => resolveItemScheduleLabel(item)).filter(Boolean))
            ),
        [filteredItems]
    )

    const cleanupPreviewUrl = React.useCallback(() => {
        previewRequestIdRef.current += 1
        pdfPreviewBusyRef.current = false

        if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
            pdfUrlRef.current = null
        }

        setPdfPreviewBusy(false)
        setPdfUrl(null)
    }, [])

    React.useEffect(() => {
        return () => cleanupPreviewUrl()
    }, [cleanupPreviewUrl])

    const buildPdfBlob = React.useCallback(async () => {
        const pdfLib: any = await loadPdfRenderer()
        const Document = pdfLib.Document as any
        const Page = pdfLib.Page as any
        const Text = pdfLib.Text as any
        const View = pdfLib.View as any
        const Image = pdfLib.Image as any
        const StyleSheet = pdfLib.StyleSheet as any
        const pdf = pdfLib.pdf as any

        const [leftLogoSrc, rightLogoSrc] = await Promise.all([
            getAssetAsDataUrl(LEFT_LOGO_PATH),
            getAssetAsDataUrl(RIGHT_LOGO_PATH),
        ])

        const generatedAt = new Date()
        const filename = `room-schedule_${roomLabel
            .trim()
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase() || "room"}_${selectedScheduleFileLabel}_${formatTimestamp(
            generatedAt
        )}.pdf`

        const styles = StyleSheet.create({
            page: {
                paddingTop: 18,
                paddingRight: 22,
                paddingBottom: 18,
                paddingLeft: 22,
                fontFamily: "Helvetica",
                color: "#1F2937",
                fontSize: 8.25,
            },

            sheetWrap: {
                width: GRID_WIDTH,
                alignSelf: "center",
            },

            headerWrap: {
                width: GRID_WIDTH,
                alignSelf: "center",
            },
            headerRow: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
            },
            logoWrap: {
                width: 72,
                height: 60,
                alignItems: "center",
                justifyContent: "center",
            },
            logo: {
                width: 54,
                height: 54,
                objectFit: "contain",
            },
            centerHeader: {
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
            },
            republic: {
                fontSize: 7,
                color: "#4B5563",
                textAlign: "center",
                marginBottom: 1,
            },
            school: {
                fontSize: 10.5,
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: 1,
            },
            campusLine: {
                fontSize: 7.2,
                color: "#4B5563",
                textAlign: "center",
                marginBottom: 4,
            },
            college: {
                fontSize: 9.25,
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: 1,
            },
            subtitle: {
                fontSize: 8.3,
                textAlign: "center",
                marginBottom: 1,
            },
            semesterLine: {
                fontSize: 8.1,
                textAlign: "center",
            },
            roomTitle: {
                fontSize: 15.5,
                fontStyle: "italic",
                textAlign: "center",
                color: "#4B5563",
                marginTop: 8,
                marginBottom: 10,
            },

            table: {
                width: GRID_WIDTH,
                alignSelf: "center",
                borderWidth: 1,
                borderColor: "#6B7280",
            },
            headerGrid: {
                flexDirection: "row",
                width: GRID_WIDTH,
            },
            timeHeadCell: {
                width: TIME_COL_WIDTH,
                height: HEADER_TOTAL_HEIGHT,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
            },
            dayGroup: {
                flexDirection: "row",
                width: DAY_COL_WIDTH + SIGN_COL_WIDTH,
            },
            dayHeaderStack: {
                width: DAY_COL_WIDTH,
                borderRightWidth: 1,
                borderColor: "#6B7280",
            },
            dayHeadCell: {
                height: HEADER_ROW_HEIGHT,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
            },
            daySubCell: {
                height: HEADER_SUB_ROW_HEIGHT,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
            },
            signHeadCell: {
                width: SIGN_COL_WIDTH,
                height: HEADER_TOTAL_HEIGHT,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 1,
            },
            signText: {
                fontSize: 5,
                lineHeight: 1,
                textAlign: "center",
            },

            bodyGrid: {
                position: "relative",
                width: GRID_WIDTH,
            },
            bodyRow: {
                flexDirection: "row",
                height: ROW_HEIGHT,
            },
            timeCell: {
                width: TIME_COL_WIDTH,
                height: ROW_HEIGHT,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
            },
            blankDayCell: {
                width: DAY_COL_WIDTH,
                height: ROW_HEIGHT,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
            },
            blankSignCell: {
                width: SIGN_COL_WIDTH,
                height: ROW_HEIGHT,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
            },
            noonCell: {
                width: GRID_WIDTH - TIME_COL_WIDTH,
                height: ROW_HEIGHT,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FAFAFA",
            },

            overlayArea: {
                position: "absolute",
                top: 0,
                left: TIME_COL_WIDTH,
                width: GRID_WIDTH - TIME_COL_WIDTH,
                height: filteredTimeSlots.length * ROW_HEIGHT,
            },
            meetingBlock: {
                position: "absolute",
                borderWidth: 0.8,
                borderColor: "#94A3B8",
                paddingVertical: 3,
                paddingHorizontal: 3,
                alignItems: "center",
                justifyContent: "center",
            },
            meetingText: {
                lineHeight: 1.15,
                textAlign: "center",
            },

            signatoryWrap: {
                width: GRID_WIDTH,
                marginTop: 14,
                alignItems: "center",
                justifyContent: "center",
            },
            signatoryName: {
                fontSize: 10.6,
                fontWeight: "bold",
                textAlign: "center",
                textTransform: "uppercase",
                marginBottom: 2,
            },
            signatoryTitle: {
                fontSize: 8.8,
                textAlign: "center",
                color: "#4B5563",
            },

            footerRuleWrap: {
                width: GRID_WIDTH,
                marginTop: 18,
                alignSelf: "center",
            },
            blueRule: {
                height: 2,
                backgroundColor: "#7FA7E8",
                width: "100%",
            },
            goldRule: {
                height: 1.5,
                backgroundColor: "#E9C76B",
                width: "100%",
                marginTop: 2,
            },
        })

        const PdfDoc = () => (
            <Document title={`Room Schedule - ${roomLabel} - ${selectedScheduleLabel}`}>
                <Page size="A4" orientation="landscape" style={styles.page}>
                    <View style={styles.sheetWrap}>
                        <View style={styles.headerWrap}>
                            <View style={styles.headerRow}>
                                <View style={styles.logoWrap}>
                                    <Image src={leftLogoSrc} style={styles.logo} />
                                </View>

                                <View style={styles.centerHeader}>
                                    <Text style={styles.republic}>Republic of the Philippines</Text>
                                    <Text style={styles.school}>{institutionName}</Text>
                                    <Text style={styles.campusLine}>{institutionSubtitle}</Text>
                                    <Text style={styles.college}>{collegeName}</Text>
                                    <Text style={styles.subtitle}>{documentSubtitle}</Text>
                                    <Text style={styles.semesterLine}>{semesterSchoolYearLine}</Text>
                                </View>

                                <View style={styles.logoWrap}>
                                    <Image src={rightLogoSrc} style={styles.logo} />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.roomTitle}>
                            {roomLabel.toUpperCase()} — {selectedScheduleLabel.toUpperCase()}
                        </Text>

                        <View style={styles.table}>
                            <View style={styles.headerGrid}>
                                <View style={styles.timeHeadCell}>
                                    <Text>Time</Text>
                                </View>

                                {DAYS.map((day, dayIndex) => (
                                    <View key={day} style={styles.dayGroup}>
                                        <View style={styles.dayHeaderStack}>
                                            <View style={styles.dayHeadCell}>
                                                <Text>{day}</Text>
                                            </View>
                                            <View style={styles.daySubCell}>
                                                <Text style={{ fontSize: 6.2 }}>{yearBadge || " "}</Text>
                                            </View>
                                        </View>

                                        <View
                                            style={[
                                                styles.signHeadCell,
                                                dayIndex === DAYS.length - 1 ? { borderRightWidth: 0 } : null,
                                            ]}
                                        >
                                            <Text style={styles.signText}>{VERTICAL_SIGN_TEXT}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.bodyGrid}>
                                {filteredTimeSlots.map((slotLabel) => {
                                    const isNoonBreak = isNoonBreakSlot(slotLabel)

                                    return (
                                        <View key={slotLabel} style={styles.bodyRow}>
                                            <View style={styles.timeCell}>
                                                <Text>{slotLabel}</Text>
                                            </View>

                                            {isNoonBreak ? (
                                                <View style={styles.noonCell}>
                                                    <Text style={{ fontSize: 7.2, color: "#4B5563" }}>
                                                        Noon Break
                                                    </Text>
                                                </View>
                                            ) : (
                                                <>
                                                    {DAYS.map((day, dayIndex) => (
                                                        <React.Fragment key={`${slotLabel}-${day}`}>
                                                            <View style={styles.blankDayCell} />
                                                            <View
                                                                style={[
                                                                    styles.blankSignCell,
                                                                    dayIndex === DAYS.length - 1
                                                                        ? { borderRightWidth: 0 }
                                                                        : null,
                                                                ]}
                                                            />
                                                        </React.Fragment>
                                                    ))}
                                                </>
                                            )}
                                        </View>
                                    )
                                })}

                                <View style={styles.overlayArea}>
                                    {meetingBlocks.map((block) => (
                                        <View
                                            key={block.id}
                                            style={[
                                                styles.meetingBlock,
                                                {
                                                    top: block.top,
                                                    left: block.left,
                                                    width: block.width,
                                                    height: block.height,
                                                    backgroundColor: block.color,
                                                },
                                            ]}
                                        >
                                            {block.lines.map((line, lineIndex) => (
                                                <Text
                                                    key={`${block.id}-${lineIndex}`}
                                                    style={[
                                                        styles.meetingText,
                                                        {
                                                            color: block.textColor,
                                                            fontSize:
                                                                lineIndex === 0
                                                                    ? block.fontSize + 0.3
                                                                    : block.fontSize,
                                                            fontWeight:
                                                                lineIndex === 0 ? "bold" : "normal",
                                                        },
                                                    ]}
                                                >
                                                    {line}
                                                </Text>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={styles.signatoryWrap}>
                            <Text style={styles.signatoryName}>{signatoryName}</Text>
                            <Text style={styles.signatoryTitle}>{signatoryTitle}</Text>
                        </View>

                        <View style={styles.footerRuleWrap}>
                            <View style={styles.blueRule} />
                            <View style={styles.goldRule} />
                        </View>
                    </View>
                </Page>
            </Document>
        )

        const blob: Blob = await pdf(<PdfDoc />).toBlob()
        return { blob, filename }
    }, [
        roomLabel,
        institutionName,
        institutionSubtitle,
        collegeName,
        documentSubtitle,
        semesterSchoolYearLine,
        signatoryName,
        signatoryTitle,
        filteredTimeSlots,
        yearBadge,
        meetingBlocks,
        selectedScheduleLabel,
        selectedScheduleFileLabel,
    ])

    const ensurePdfPreview = React.useCallback(async () => {
        if (disabled || pdfPreviewBusyRef.current) return

        const requestId = previewRequestIdRef.current + 1
        previewRequestIdRef.current = requestId
        pdfPreviewBusyRef.current = true
        setPdfPreviewBusy(true)

        try {
            const { blob } = await buildPdfBlob()
            if (previewRequestIdRef.current !== requestId) return

            const nextUrl = URL.createObjectURL(blob)
            if (previewRequestIdRef.current !== requestId) {
                URL.revokeObjectURL(nextUrl)
                return
            }

            if (pdfUrlRef.current) {
                URL.revokeObjectURL(pdfUrlRef.current)
            }

            pdfUrlRef.current = nextUrl
            setPdfUrl(nextUrl)
        } catch (e: any) {
            if (previewRequestIdRef.current === requestId) {
                cleanupPreviewUrl()
                toast.error(e?.message ?? "Failed to generate room schedule PDF preview.")
            }
        } finally {
            if (previewRequestIdRef.current === requestId) {
                pdfPreviewBusyRef.current = false
                setPdfPreviewBusy(false)
            }
        }
    }, [buildPdfBlob, cleanupPreviewUrl, disabled])

    React.useEffect(() => {
        if (!previewOpen) {
            cleanupPreviewUrl()
            return
        }

        cleanupPreviewUrl()
        void ensurePdfPreview()
    }, [previewOpen, ensurePdfPreview, cleanupPreviewUrl])

    const onExportPdf = React.useCallback(async () => {
        if (disabled || pdfBusy) return

        setPdfBusy(true)
        try {
            const { blob, filename } = await buildPdfBlob()
            downloadBlob(blob, filename)
            toast.success(`${selectedScheduleLabel} room schedule PDF exported.`)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export room schedule PDF.")
        } finally {
            setPdfBusy(false)
        }
    }, [buildPdfBlob, disabled, pdfBusy, selectedScheduleLabel])

    const controlsDisabled = disabled || pdfBusy || pdfPreviewBusy

    return (
        <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={controlsDisabled}
                >
                    {pdfPreviewBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Eye className="mr-2 h-4 w-4" />
                    )}
                    {pdfPreviewBusy ? "Preparing preview..." : previewLabel}
                </Button>

                <Button size="sm" onClick={() => void onExportPdf()} disabled={controlsDisabled}>
                    {pdfBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    {pdfBusy ? "Exporting..." : exportLabel}
                </Button>
            </div>

            <Dialog
                open={previewOpen}
                onOpenChange={(open) => {
                    setPreviewOpen(open)
                    if (!open) cleanupPreviewUrl()
                }}
            >
                <DialogContent className="h-[95svh] sm:max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>
                            PDF Preview — {roomLabel} ({selectedScheduleLabel})
                        </DialogTitle>
                        <DialogDescription>
                            A4 landscape room monitoring sheet filtered to the selected schedule with
                            visible instructor assignments and clear morning, afternoon, or combined
                            labels.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{semester}</Badge>
                        <Badge variant="secondary">SY {schoolYear}</Badge>
                        <Badge variant="outline">{selectedScheduleLabel}</Badge>
                        <Badge variant="outline">
                            {filteredItems.length} scheduled block{filteredItems.length === 1 ? "" : "s"}
                        </Badge>
                        {uniqueScheduleLabels.length > 0 ? (
                            <Badge variant="outline">{uniqueScheduleLabels.join(" • ")}</Badge>
                        ) : null}
                    </div>

                    <div className="mt-3 overflow-hidden rounded-md border bg-background">
                        {pdfPreviewBusy ? (
                            <div className="space-y-3 p-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating room schedule PDF preview...
                                </div>
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-[70vh] w-full" />
                            </div>
                        ) : pdfUrl ? (
                            <iframe
                                key={pdfUrl}
                                title={`Room schedule PDF preview - ${roomLabel} - ${selectedScheduleLabel}`}
                                src={pdfUrl}
                                className="block h-[75vh] w-full bg-background"
                            />
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                PDF preview is not ready yet.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Includes the official PNG logo, aligned upper-right CCS mark, corrected header
                            structure, visible instructor names, and the selected room schedule view.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>

                            <Button onClick={() => void onExportPdf()} disabled={controlsDisabled}>
                                {pdfBusy ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Download PDF
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default RoomSchedulePrintSheet