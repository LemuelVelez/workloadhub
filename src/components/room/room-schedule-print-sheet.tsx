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
export type RoomSchedulePaperSize = "A4" | "SHORT_BOND" | "LONG_BOND"

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
    paperSize?: RoomSchedulePaperSize

    previewLabel?: string
    exportLabel?: string
    disabled?: boolean
    scheduleScope?: RoomScheduleScope
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const NOON_BREAK_SLOT = "12:01-1:00"

const MORNING_LABEL = "Morning"
const AFTERNOON_LABEL = "Afternoon"
const BOTH_LABEL = "Morning & Afternoon"
const MORNING_END_MINUTES = 12 * 60
const AFTERNOON_START_MINUTES = 13 * 60
const MINUTES_PER_HALF_DAY = 12 * 60
const MINUTES_PER_DAY = 24 * 60

const PAGE_PADDING_TOP = 18
const PAGE_PADDING_RIGHT = 22
const PAGE_PADDING_BOTTOM = 18
const PAGE_PADDING_LEFT = 22

const TIME_COL_WIDTH = 84
const DAY_COL_WIDTH = 108
const SIGN_COL_WIDTH = 18
const ROW_HEIGHT = 30
const HEADER_ROW_HEIGHT = 20
const HEADER_SUB_ROW_HEIGHT = 16
const HEADER_TOTAL_HEIGHT = HEADER_ROW_HEIGHT + HEADER_SUB_ROW_HEIGHT
const GRID_WIDTH = TIME_COL_WIDTH + DAYS.length * (DAY_COL_WIDTH + SIGN_COL_WIDTH)
const VERTICAL_SIGN_TEXT = "S\ni\ng\nn"

const BLOCK_PADDING_X = 3
const BLOCK_PADDING_Y = 2
const BLOCK_MIN_FONT_SIZE = 4.1
const BLOCK_MAX_FONT_SIZE = 7.2
const BLOCK_FONT_STEP = 0.2
const BLOCK_LINE_HEIGHT_RATIO = 1.08

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

const PAPER_SIZE_OPTIONS: Array<{
    value: RoomSchedulePaperSize
    label: string
}> = [
    { value: "A4", label: "A4" },
    { value: "SHORT_BOND", label: "Short Bond" },
    { value: "LONG_BOND", label: "Long Bond" },
]

const assetUrlCache = new Map<string, Promise<string>>()

let pdfRendererPromise: Promise<any> | null = null

type SlotDescriptor = {
    label: string
    start: number
    end: number
    isNoonBreak: boolean
}

type PdfLayoutMetrics = {
    tableScale: number
    rowHeight: number
    headerRowHeight: number
    headerSubRowHeight: number
    headerTotalHeight: number
    dayHeaderFontSize: number
    yearBadgeFontSize: number
    signFontSize: number
    timeFontSize: number
    noonFontSize: number
    bodyGridHeight: number
    blockScale: number
}

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

function formatMinutesToSlotClock(totalMinutes: number) {
    const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    const hh24 = Math.floor(normalized / 60)
    const mm = normalized % 60
    const hh12 = hh24 % 12 || 12
    return `${hh12}:${pad2(mm)}`
}

function inchesToPoints(value: number) {
    return value * 72
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

function paperSizeLabel(paperSize: RoomSchedulePaperSize) {
    if (paperSize === "SHORT_BOND") return "Short Bond Paper"
    if (paperSize === "LONG_BOND") return "Long Bond Paper"
    return "A4"
}

function paperSizeFilenameLabel(paperSize: RoomSchedulePaperSize) {
    if (paperSize === "SHORT_BOND") return "short-bond"
    if (paperSize === "LONG_BOND") return "long-bond"
    return "a4"
}

function resolvePdfPageSize(paperSize: RoomSchedulePaperSize) {
    if (paperSize === "SHORT_BOND") {
        return {
            width: inchesToPoints(11),
            height: inchesToPoints(8.5),
        }
    }

    if (paperSize === "LONG_BOND") {
        return {
            width: inchesToPoints(13),
            height: inchesToPoints(8.5),
        }
    }

    return "A4"
}

function resolvePdfPageDimensions(paperSize: RoomSchedulePaperSize) {
    if (paperSize === "SHORT_BOND") {
        return {
            width: inchesToPoints(11),
            height: inchesToPoints(8.5),
        }
    }

    if (paperSize === "LONG_BOND") {
        return {
            width: inchesToPoints(13),
            height: inchesToPoints(8.5),
        }
    }

    return {
        width: 841.89,
        height: 595.28,
    }
}

function computePdfLayoutMetrics(
    rowCount: number,
    paperSize: RoomSchedulePaperSize
): PdfLayoutMetrics {
    const { height: pageHeight } = resolvePdfPageDimensions(paperSize)
    const usablePageHeight = pageHeight - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM

    const reservedHeaderHeight = 86
    const reservedTitleHeight = 38
    const reservedBottomHeight = 82
    const reservedGapHeight = 12

    const maxTableHeight = Math.max(
        150,
        usablePageHeight -
            reservedHeaderHeight -
            reservedTitleHeight -
            reservedBottomHeight -
            reservedGapHeight
    )

    const baseTableHeight = HEADER_TOTAL_HEIGHT + rowCount * ROW_HEIGHT
    const tableScale =
        baseTableHeight > 0 ? Math.min(1, maxTableHeight / baseTableHeight) : 1

    const rowHeight = Number((ROW_HEIGHT * tableScale).toFixed(2))
    const headerRowHeight = Number((HEADER_ROW_HEIGHT * tableScale).toFixed(2))
    const headerSubRowHeight = Number((HEADER_SUB_ROW_HEIGHT * tableScale).toFixed(2))
    const headerTotalHeight = Number((headerRowHeight + headerSubRowHeight).toFixed(2))
    const bodyGridHeight = Number((rowCount * rowHeight).toFixed(2))
    const blockScale = Math.max(0.45, tableScale)

    return {
        tableScale,
        rowHeight,
        headerRowHeight,
        headerSubRowHeight,
        headerTotalHeight,
        dayHeaderFontSize: Math.max(5.1, Number((8.2 * tableScale).toFixed(2))),
        yearBadgeFontSize: Math.max(4, Number((6.2 * tableScale).toFixed(2))),
        signFontSize: Math.max(3.2, Number((5.3 * tableScale).toFixed(2))),
        timeFontSize: Math.max(4.2, Number((7 * tableScale).toFixed(2))),
        noonFontSize: Math.max(4.2, Number((7.2 * tableScale).toFixed(2))),
        bodyGridHeight,
        blockScale,
    }
}

function inferScheduleScope(startTime: string, endTime: string): RoomScheduleScope | "" {
    const start = parseClockMinutes(startTime)
    const end = parseClockMinutes(endTime)

    if (start == null || end == null) return ""

    if (end <= MORNING_END_MINUTES) return "MORNING"
    if (start >= AFTERNOON_START_MINUTES) return "AFTERNOON"

    return "BOTH"
}

function resolveItemScheduleScopeFromLabel(item: RoomSchedulePrintItem): RoomScheduleScope | "" {
    const candidates = [
        item.groupLabel,
        item.displayLabel,
        ...(item.contentLines ?? []),
    ]
        .map((value) => normalizeScheduleMarkerText(String(value ?? "")))
        .filter(Boolean)

    if (candidates.length === 0) return ""

    for (const raw of candidates) {
        if (
            raw === "both" ||
            raw === "combined" ||
            raw === "morning and afternoon" ||
            raw === "afternoon and morning" ||
            (raw.includes("morning") && raw.includes("afternoon"))
        ) {
            return "BOTH"
        }
    }

    for (const raw of candidates) {
        if (raw.includes("morning")) return "MORNING"
        if (raw.includes("afternoon")) return "AFTERNOON"
    }

    return ""
}

function resolveItemScheduleScope(item: RoomSchedulePrintItem): RoomScheduleScope | "" {
    const fromLabel = resolveItemScheduleScopeFromLabel(item)
    if (fromLabel) return fromLabel
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

function parseOrderedSlotDescriptors(timeSlots: string[]) {
    let previousEnd = -1

    return timeSlots
        .map((slot) => {
            const parsed = parseSlotRange(slot)
            if (!parsed) return null

            let start = parsed.start
            let end = parsed.end

            while (previousEnd >= 0 && start <= previousEnd) {
                start += MINUTES_PER_HALF_DAY
            }

            while (end <= start) {
                end += MINUTES_PER_HALF_DAY
            }

            previousEnd = end

            return {
                label: slot,
                start,
                end,
                isNoonBreak: isNoonBreakSlot(slot),
            } satisfies SlotDescriptor
        })
        .filter(Boolean) as SlotDescriptor[]
}

function buildSlotMeta(
    timeSlots: string[],
    scheduleScope: RoomScheduleScope = "BOTH"
) {
    const normalized = parseOrderedSlotDescriptors(timeSlots)

    if (scheduleScope !== "AFTERNOON") {
        return normalized
    }

    return normalized.map((slot) => {
        if (slot.start >= AFTERNOON_START_MINUTES) return slot

        let start = slot.start
        let end = slot.end

        while (start < AFTERNOON_START_MINUTES) {
            start += MINUTES_PER_HALF_DAY
            end += MINUTES_PER_HALF_DAY
        }

        return {
            ...slot,
            start,
            end,
        }
    })
}

function resolveItemTimeRange(
    item: RoomSchedulePrintItem,
    slotMeta: SlotDescriptor[] = []
) {
    const parsedStart = parseClockMinutes(item.startTime)
    const parsedEnd = parseClockMinutes(item.endTime)

    if (parsedStart == null || parsedEnd == null) return null

    const normalizeRange = (baseStart: number, baseEnd: number) => {
        let start = baseStart
        let end = baseEnd

        while (end <= start) {
            end += MINUTES_PER_HALF_DAY
        }

        return { start, end }
    }

    const rawScope = resolveItemScheduleScopeFromLabel(item)
    const candidates: Array<{ start: number; end: number }> = []

    const pushCandidate = (start: number, end: number) => {
        const normalized = normalizeRange(start, end)
        if (
            !candidates.some(
                (candidate) =>
                    candidate.start === normalized.start && candidate.end === normalized.end
            )
        ) {
            candidates.push(normalized)
        }
    }

    pushCandidate(parsedStart, parsedEnd)
    pushCandidate(parsedStart + MINUTES_PER_HALF_DAY, parsedEnd + MINUTES_PER_HALF_DAY)

    if (rawScope === "AFTERNOON" || rawScope === "BOTH") {
        pushCandidate(parsedStart + MINUTES_PER_HALF_DAY, parsedEnd + MINUTES_PER_HALF_DAY)
    }

    const matchesAnySlot = (range: { start: number; end: number }) =>
        slotMeta.some(
            (slot) =>
                !slot.isNoonBreak && rangesOverlap(range.start, range.end, slot.start, slot.end)
        )

    if (slotMeta.length > 0) {
        const matchedCandidate = candidates.find(matchesAnySlot)
        if (matchedCandidate) return matchedCandidate
    }

    if (rawScope === "AFTERNOON") {
        const afternoonCandidate = candidates.find(
            (candidate) => candidate.start >= AFTERNOON_START_MINUTES
        )
        if (afternoonCandidate) return afternoonCandidate
    }

    if (rawScope === "MORNING") {
        const morningCandidate = candidates.find(
            (candidate) => candidate.end <= MORNING_END_MINUTES
        )
        if (morningCandidate) return morningCandidate
    }

    return candidates[0] ?? null
}

function inferPreferredSlotDuration(items: RoomSchedulePrintItem[], slotMeta: SlotDescriptor[]) {
    const counts = new Map<number, number>()

    const addDuration = (value: number | null) => {
        if (value == null || value <= 0) return
        counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    for (const slot of slotMeta) {
        if (slot.isNoonBreak) continue
        addDuration(slot.end - slot.start)
    }

    for (const item of items) {
        const range = resolveItemTimeRange(item)
        if (!range) continue
        addDuration(range.end - range.start)
    }

    const ranked = Array.from(counts.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return b[0] - a[0]
    })

    return ranked[0]?.[0] ?? null
}

function buildLabelsFromBoundaries(boundaries: number[], preferredDuration: number | null) {
    const uniqueSorted = Array.from(
        new Set(boundaries.filter((value) => Number.isFinite(value)))
    ).sort((a, b) => a - b)

    if (uniqueSorted.length < 2) return [] as string[]

    const labels: string[] = []

    for (let index = 0; index < uniqueSorted.length - 1; index += 1) {
        const start = uniqueSorted[index]
        const end = uniqueSorted[index + 1]

        if (end <= start) continue

        if (!preferredDuration || preferredDuration <= 0) {
            labels.push(`${formatMinutesToSlotClock(start)}-${formatMinutesToSlotClock(end)}`)
            continue
        }

        let cursor = start
        while (cursor + preferredDuration < end) {
            const next = cursor + preferredDuration
            labels.push(`${formatMinutesToSlotClock(cursor)}-${formatMinutesToSlotClock(next)}`)
            cursor = next
        }

        labels.push(`${formatMinutesToSlotClock(cursor)}-${formatMinutesToSlotClock(end)}`)
    }

    return labels
}

function resolveAutoTimeSlots(items: RoomSchedulePrintItem[], timeSlots?: string[]) {
    const explicitSlots = parseOrderedSlotDescriptors(timeSlots ?? [])
    const preferredDuration = inferPreferredSlotDuration(items, explicitSlots)

    const itemRanges = items
        .map((item) => resolveItemTimeRange(item))
        .filter(Boolean) as Array<{ start: number; end: number }>

    if (explicitSlots.length === 0) {
        const boundaries = itemRanges.flatMap((range) => [range.start, range.end])
        return buildLabelsFromBoundaries(boundaries, preferredDuration)
    }

    if (itemRanges.length === 0) {
        return explicitSlots.map((slot) => slot.label)
    }

    const descriptors = [...explicitSlots]
    const minItemStart = Math.min(...itemRanges.map((range) => range.start))
    const maxItemEnd = Math.max(...itemRanges.map((range) => range.end))

    if (preferredDuration && preferredDuration > 0) {
        let firstStart = descriptors[0]?.start ?? minItemStart
        const prepended: SlotDescriptor[] = []

        while (minItemStart < firstStart) {
            const nextStart = Math.max(minItemStart, firstStart - preferredDuration)
            prepended.unshift({
                label: `${formatMinutesToSlotClock(nextStart)}-${formatMinutesToSlotClock(firstStart)}`,
                start: nextStart,
                end: firstStart,
                isNoonBreak: false,
            })
            if (nextStart === firstStart) break
            firstStart = nextStart
        }

        let lastEnd = descriptors[descriptors.length - 1]?.end ?? maxItemEnd
        const appended: SlotDescriptor[] = []

        while (maxItemEnd > lastEnd) {
            const nextEnd = Math.min(maxItemEnd, lastEnd + preferredDuration)
            appended.push({
                label: `${formatMinutesToSlotClock(lastEnd)}-${formatMinutesToSlotClock(nextEnd)}`,
                start: lastEnd,
                end: nextEnd,
                isNoonBreak: false,
            })
            if (nextEnd === lastEnd) break
            lastEnd = nextEnd
        }

        return [...prepended, ...descriptors, ...appended].map((slot) => slot.label)
    }

    const boundaries = [...explicitSlots.flatMap((slot) => [slot.start, slot.end])]
    for (const range of itemRanges) {
        boundaries.push(range.start, range.end)
    }

    return buildLabelsFromBoundaries(boundaries, preferredDuration)
}

function filterTimeSlotsByScope(timeSlots: string[], scheduleScope: RoomScheduleScope) {
    if (scheduleScope === "BOTH") return [...timeSlots]

    const slotMeta = buildSlotMeta(timeSlots, "BOTH")
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

function collapseLineText(value: string) {
    return normalizeText(value).replace(/\s+/g, " ")
}

function normalizeScheduleMarkerText(value: string) {
    return collapseLineText(value)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[|/,-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function isStandaloneScheduleMarker(value: string) {
    const normalized = normalizeScheduleMarkerText(value)
    return (
        normalized === "morning" ||
        normalized === "afternoon" ||
        normalized === "both" ||
        normalized === "combined" ||
        normalized === "morning and afternoon" ||
        normalized === "afternoon and morning"
    )
}

function stripSchedulePrefix(value: string) {
    const normalized = collapseLineText(value)
    if (!normalized) return ""

    const stripped = normalized
        .replace(/^\(?\s*(morning|afternoon)\s*\)?\s*[:\-–|/]*\s*/i, "")
        .trim()

    if (!stripped) return ""
    if (isStandaloneScheduleMarker(stripped)) return ""

    return stripped
}

function sanitizeBlockLine(value: string) {
    const stripped = stripSchedulePrefix(value)
    if (isStandaloneScheduleMarker(stripped)) return ""
    return stripped
}

function sanitizeBlockLines(values: string[]) {
    return values.map((value) => sanitizeBlockLine(value)).filter(Boolean)
}

function resolveContentLines(item: RoomSchedulePrintItem) {
    const explicit = sanitizeBlockLines((item.contentLines ?? []).map((line) => String(line ?? "")))
    if (explicit.length > 0) return explicit.slice(0, 4)

    const oneLine = sanitizeBlockLine(normalizeText(item.displayLabel))
    if (oneLine) return [oneLine].slice(0, 4)

    const line1 = sanitizeBlockLine(normalizeText(item.facultyName))
    const line2 = [
        sanitizeBlockLine(normalizeText(item.subjectCode)),
        sanitizeBlockLine(normalizeText(item.sectionLabel)),
    ]
        .filter(Boolean)
        .join(" / ")
    const line3 = sanitizeBlockLine(normalizeText(item.subjectTitle))
    const line4 = sanitizeBlockLine(normalizeText(item.notes))

    return [line1, line2, line3 || line4].filter(Boolean).slice(0, 4)
}

function clampLineText(value: string, maxLength: number) {
    const text = collapseLineText(value)
    if (text.length <= maxLength) return text
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function wrapLineText(value: string, maxCharsPerLine: number) {
    const text = collapseLineText(value)
    if (!text) return [] as string[]
    if (text.length <= maxCharsPerLine) return [text]

    const words = text.split(" ").filter(Boolean)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word

        if (candidate.length <= maxCharsPerLine) {
            current = candidate
            continue
        }

        if (current) {
            lines.push(current)
            current = ""
        }

        if (word.length <= maxCharsPerLine) {
            current = word
            continue
        }

        let remaining = word
        while (remaining.length > maxCharsPerLine) {
            lines.push(`${remaining.slice(0, Math.max(1, maxCharsPerLine - 1))}-`)
            remaining = remaining.slice(Math.max(1, maxCharsPerLine - 1))
        }
        current = remaining
    }

    if (current) {
        lines.push(current)
    }

    return lines
}

function buildWrappedLayout(
    lines: string[],
    width: number,
    height: number,
    fontSize: number,
    paddingX: number,
    paddingY: number
) {
    const usableWidth = Math.max(width - paddingX * 2 - 2, 28)
    const usableHeight = Math.max(height - paddingY * 2 - 2, fontSize)

    const maxCharsPerLine = Math.max(
        5,
        Math.floor(usableWidth / Math.max(fontSize * 0.6, 1))
    )

    const wrapped = lines.flatMap((line) => wrapLineText(line, maxCharsPerLine))
    const maxLines = Math.max(
        1,
        Math.floor(usableHeight / Math.max(fontSize * BLOCK_LINE_HEIGHT_RATIO, 1))
    )

    return {
        wrapped,
        maxCharsPerLine,
        maxLines,
    }
}

function resolveScaledBlockContent(
    item: RoomSchedulePrintItem,
    width: number,
    height: number,
    scale = 1
) {
    const baseLines = resolveContentLines(item).map(collapseLineText).filter(Boolean)

    const paddingX = Math.max(1, Number((BLOCK_PADDING_X * scale).toFixed(2)))
    const paddingY = Math.max(0.8, Number((BLOCK_PADDING_Y * scale).toFixed(2)))
    const minFontSize = Math.max(2.6, Number((BLOCK_MIN_FONT_SIZE * scale).toFixed(2)))
    const maxFontSize = Math.max(minFontSize, Number((BLOCK_MAX_FONT_SIZE * scale).toFixed(2)))
    const fontStep = Math.max(0.1, Number((BLOCK_FONT_STEP * scale).toFixed(2)))

    if (baseLines.length === 0) {
        return {
            lines: [] as string[],
            fontSize: minFontSize,
            paddingX,
            paddingY,
        }
    }

    for (
        let fontSize = maxFontSize;
        fontSize >= minFontSize;
        fontSize = Number((fontSize - fontStep).toFixed(2))
    ) {
        const layout = buildWrappedLayout(baseLines, width, height, fontSize, paddingX, paddingY)
        if (layout.wrapped.length <= layout.maxLines) {
            return {
                lines: layout.wrapped,
                fontSize,
                paddingX,
                paddingY,
            }
        }
    }

    const fallbackLayout = buildWrappedLayout(
        baseLines,
        width,
        height,
        minFontSize,
        paddingX,
        paddingY
    )
    const clipped = fallbackLayout.wrapped.slice(0, fallbackLayout.maxLines)

    if (clipped.length > 0) {
        clipped[clipped.length - 1] = clampLineText(
            clipped[clipped.length - 1],
            Math.max(5, fallbackLayout.maxCharsPerLine - 1)
        )

        if (!clipped[clipped.length - 1].endsWith("…")) {
            clipped[clipped.length - 1] = `${clipped[clipped.length - 1].replace(/[.…]+$/g, "")}…`
        }
    }

    return {
        lines: clipped,
        fontSize: minFontSize,
        paddingX,
        paddingY,
    }
}

function buildMeetingBlocks(
    items: RoomSchedulePrintItem[],
    timeSlots: string[],
    scheduleScope: RoomScheduleScope,
    rowHeight: number,
    blockScale: number
) {
    const slotMeta = buildSlotMeta(timeSlots, scheduleScope)
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
        paddingX: number
        paddingY: number
    }> = []

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const day = normalizeDay(item.dayOfWeek)
        const dayIndex = DAYS.findIndex((d) => d === day)
        if (dayIndex < 0) continue

        const range = resolveItemTimeRange(item, slotMeta)
        if (!range) continue

        const matchedRows: number[] = []
        for (let rowIndex = 0; rowIndex < slotMeta.length; rowIndex += 1) {
            const slot = slotMeta[rowIndex]
            if (slot.isNoonBreak) continue

            if (rangesOverlap(range.start, range.end, slot.start, slot.end)) {
                matchedRows.push(rowIndex)
            }
        }

        if (matchedRows.length === 0) continue

        const rowIndex = matchedRows[0]
        const rowSpan = matchedRows.length
        const left = dayIndex * (DAY_COL_WIDTH + SIGN_COL_WIDTH)
        const top = rowIndex * rowHeight
        const width = DAY_COL_WIDTH
        const height = Math.max(rowSpan * rowHeight - 1, rowHeight)
        const blockContent = resolveScaledBlockContent(item, width, height, blockScale)

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
            lines: blockContent.lines,
            fontSize: blockContent.fontSize,
            paddingX: blockContent.paddingX,
            paddingY: blockContent.paddingY,
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
    timeSlots,
    paperSize = "A4",
    previewLabel = "Preview PDF",
    exportLabel = "Export PDF",
    disabled = false,
    scheduleScope = "BOTH",
}: RoomSchedulePrintSheetProps) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [pdfBusy, setPdfBusy] = React.useState(false)
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)
    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
    const [selectedPaperSize, setSelectedPaperSize] =
        React.useState<RoomSchedulePaperSize>(paperSize)

    const pdfUrlRef = React.useRef<string | null>(null)
    const pdfPreviewBusyRef = React.useRef(false)
    const previewRequestIdRef = React.useRef(0)

    React.useEffect(() => {
        setSelectedPaperSize(paperSize)
    }, [paperSize])

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
    const selectedPaperSizeLabel = React.useMemo(
        () => paperSizeLabel(selectedPaperSize),
        [selectedPaperSize]
    )
    const selectedPaperSizeFileLabel = React.useMemo(
        () => paperSizeFilenameLabel(selectedPaperSize),
        [selectedPaperSize]
    )
    const pdfPageSize = React.useMemo(
        () => resolvePdfPageSize(selectedPaperSize),
        [selectedPaperSize]
    )
    const filteredItems = React.useMemo(
        () => items.filter((item) => matchesScheduleScope(item, scheduleScope)),
        [items, scheduleScope]
    )
    const resolvedTimeSlots = React.useMemo(
        () => resolveAutoTimeSlots(items, timeSlots),
        [items, timeSlots]
    )
    const filteredTimeSlots = React.useMemo(
        () => filterTimeSlotsByScope(resolvedTimeSlots, scheduleScope),
        [resolvedTimeSlots, scheduleScope]
    )
    const tableLayout = React.useMemo(
        () => computePdfLayoutMetrics(filteredTimeSlots.length, selectedPaperSize),
        [filteredTimeSlots.length, selectedPaperSize]
    )
    const meetingBlocks = React.useMemo(
        () =>
            buildMeetingBlocks(
                filteredItems,
                filteredTimeSlots,
                scheduleScope,
                tableLayout.rowHeight,
                tableLayout.blockScale
            ),
        [filteredItems, filteredTimeSlots, scheduleScope, tableLayout.rowHeight, tableLayout.blockScale]
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
            .toLowerCase() || "room"}_${selectedScheduleFileLabel}_${selectedPaperSizeFileLabel}_${formatTimestamp(
            generatedAt
        )}.pdf`

        const styles = StyleSheet.create({
            page: {
                paddingTop: PAGE_PADDING_TOP,
                paddingRight: PAGE_PADDING_RIGHT,
                paddingBottom: PAGE_PADDING_BOTTOM,
                paddingLeft: PAGE_PADDING_LEFT,
                fontFamily: "Helvetica",
                color: "#1F2937",
                fontSize: 8.25,
            },

            sheetWrap: {
                width: GRID_WIDTH,
                minHeight: "100%",
                alignSelf: "center",
                display: "flex",
                flexDirection: "column",
            },

            contentWrap: {
                width: GRID_WIDTH,
                alignSelf: "center",
            },

            bottomWrap: {
                width: GRID_WIDTH,
                marginTop: "auto",
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
                height: tableLayout.headerTotalHeight,
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
                height: tableLayout.headerRowHeight,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
            },
            daySubCell: {
                height: tableLayout.headerSubRowHeight,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
            },
            signHeadCell: {
                width: SIGN_COL_WIDTH,
                height: tableLayout.headerTotalHeight,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 1,
            },
            signText: {
                fontSize: tableLayout.signFontSize,
                lineHeight: 1,
                textAlign: "center",
            },

            bodyGrid: {
                position: "relative",
                width: GRID_WIDTH,
                height: tableLayout.bodyGridHeight,
            },
            bodyRow: {
                flexDirection: "row",
                height: tableLayout.rowHeight,
            },
            timeCell: {
                width: TIME_COL_WIDTH,
                height: tableLayout.rowHeight,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
            },
            blankDayCell: {
                width: DAY_COL_WIDTH,
                height: tableLayout.rowHeight,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
            },
            blankSignCell: {
                width: SIGN_COL_WIDTH,
                height: tableLayout.rowHeight,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "#6B7280",
            },
            noonCell: {
                width: GRID_WIDTH - TIME_COL_WIDTH,
                height: tableLayout.rowHeight,
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
                height: tableLayout.bodyGridHeight,
            },
            meetingBlock: {
                position: "absolute",
                borderWidth: 0.8,
                borderColor: "#94A3B8",
                alignItems: "center",
                justifyContent: "center",
            },
            meetingText: {
                lineHeight: BLOCK_LINE_HEIGHT_RATIO,
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

        const pdfPageProps =
            typeof pdfPageSize === "string"
                ? { size: pdfPageSize, orientation: "landscape" as const }
                : { size: pdfPageSize }

        const PdfDoc = () => (
            <Document
                title={`Room Schedule - ${roomLabel} - ${selectedScheduleLabel} - ${selectedPaperSizeLabel}`}
            >
                <Page {...pdfPageProps} style={styles.page}>
                    <View style={styles.sheetWrap}>
                        <View style={styles.contentWrap}>
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
                                        <Text style={{ fontSize: tableLayout.dayHeaderFontSize }}>Time</Text>
                                    </View>

                                    {DAYS.map((day, dayIndex) => (
                                        <View key={day} style={styles.dayGroup}>
                                            <View style={styles.dayHeaderStack}>
                                                <View style={styles.dayHeadCell}>
                                                    <Text style={{ fontSize: tableLayout.dayHeaderFontSize }}>
                                                        {day}
                                                    </Text>
                                                </View>
                                                <View style={styles.daySubCell}>
                                                    <Text style={{ fontSize: tableLayout.yearBadgeFontSize }}>
                                                        {yearBadge || " "}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View
                                                style={[
                                                    styles.signHeadCell,
                                                    dayIndex === DAYS.length - 1
                                                        ? { borderRightWidth: 0 }
                                                        : null,
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
                                                    <Text style={{ fontSize: tableLayout.timeFontSize }}>
                                                        {slotLabel}
                                                    </Text>
                                                </View>

                                                {isNoonBreak ? (
                                                    <View style={styles.noonCell}>
                                                        <Text
                                                            style={{
                                                                fontSize: tableLayout.noonFontSize,
                                                                color: "#4B5563",
                                                            }}
                                                        >
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
                                                        paddingHorizontal: block.paddingX,
                                                        paddingVertical: block.paddingY,
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
                                                                fontSize: block.fontSize,
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
                        </View>

                        <View style={styles.bottomWrap}>
                            <View style={styles.signatoryWrap}>
                                <Text style={styles.signatoryName}>{signatoryName}</Text>
                                <Text style={styles.signatoryTitle}>{signatoryTitle}</Text>
                            </View>

                            <View style={styles.footerRuleWrap}>
                                <View style={styles.blueRule} />
                                <View style={styles.goldRule} />
                            </View>
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
        selectedPaperSizeLabel,
        selectedPaperSizeFileLabel,
        pdfPageSize,
        tableLayout,
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
            toast.success(
                `${selectedScheduleLabel} room schedule PDF exported in ${selectedPaperSizeLabel}.`
            )
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export room schedule PDF.")
        } finally {
            setPdfBusy(false)
        }
    }, [buildPdfBlob, disabled, pdfBusy, selectedScheduleLabel, selectedPaperSizeLabel])

    const controlsDisabled = disabled || pdfBusy || pdfPreviewBusy

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Paper Size:</span>
                        <div className="flex flex-wrap items-center gap-2">
                            {PAPER_SIZE_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    type="button"
                                    size="sm"
                                    variant={
                                        selectedPaperSize === option.value ? "default" : "outline"
                                    }
                                    onClick={() => setSelectedPaperSize(option.value)}
                                    disabled={controlsDisabled}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

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
                            Room monitoring sheet with adaptive text fitting, dynamic time-slot generation,
                            switchable paper size, and auto-scaled table height so the signatory stays on
                            the same page.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{semester}</Badge>
                        <Badge variant="secondary">SY {schoolYear}</Badge>
                        <Badge variant="outline">{selectedScheduleLabel}</Badge>
                        <Badge variant="outline">{selectedPaperSizeLabel}</Badge>
                        <Badge variant="outline">
                            {filteredItems.length} scheduled block{filteredItems.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline">
                            {filteredTimeSlots.length} time slot{filteredTimeSlots.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline">
                            Scale {(tableLayout.tableScale * 100).toFixed(0)}%
                        </Badge>
                        {uniqueScheduleLabels.length > 0 ? (
                            <Badge variant="outline">{uniqueScheduleLabels.join(" • ")}</Badge>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Paper Size:</span>
                        {PAPER_SIZE_OPTIONS.map((option) => (
                            <Button
                                key={`preview-${option.value}`}
                                type="button"
                                size="sm"
                                variant={selectedPaperSize === option.value ? "default" : "outline"}
                                onClick={() => setSelectedPaperSize(option.value)}
                                disabled={controlsDisabled}
                            >
                                {option.label}
                            </Button>
                        ))}
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
                                title={`Room schedule PDF preview - ${roomLabel} - ${selectedScheduleLabel} - ${selectedPaperSizeLabel}`}
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
                            The table now automatically scales to fit the current page height so the
                            signatory block remains on the same page.
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