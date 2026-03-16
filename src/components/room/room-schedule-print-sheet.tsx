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
    facultyName?: string | null
    subjectCode?: string | null
    subjectTitle?: string | null
    sectionLabel?: string | null
    notes?: string | null
    displayLabel?: string | null
    contentLines?: string[]
    color?: string | null
    textColor?: string | null
}

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

const TIME_COL_WIDTH = 82
const DAY_COL_WIDTH = 95
const SIGN_COL_WIDTH = 16
const ROW_HEIGHT = 24
const HEADER_ROW_HEIGHT = 18
const HEADER_SUB_ROW_HEIGHT = 14
const HEADER_TOTAL_HEIGHT = HEADER_ROW_HEIGHT + HEADER_SUB_ROW_HEIGHT
const GRID_WIDTH = TIME_COL_WIDTH + DAYS.length * (DAY_COL_WIDTH + SIGN_COL_WIDTH)
const VERTICAL_SIGN_TEXT = "S\ni\ng\nn"

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
    const parts = raw.split("-").map((part) => part.trim()).filter(Boolean)
    return parts[parts.length - 1] || raw
}

function parseClockMinutes(value: string) {
    const raw = normalizeText(value)
    if (!raw) return null

    if (/\b(am|pm)\b/i.test(raw)) {
        const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        if (!m) return null

        let hh = Number(m[1])
        const mm = Number(m[2])
        const suffix = m[3].toUpperCase()

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null

        if (suffix === "AM" && hh === 12) hh = 0
        if (suffix === "PM" && hh !== 12) hh += 12

        return hh * 60 + mm
    }

    const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
    if (!m) return null

    const hh = Number(m[1])
    const mm = Number(m[2])

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null

    return hh * 60 + mm
}

function parseSlotRange(slotLabel: string) {
    const [startRaw, endRaw] = String(slotLabel).split("-")
    const start = parseClockMinutes(startRaw ?? "")
    const end = parseClockMinutes(endRaw ?? "")

    if (start == null || end == null) return null
    return { start, end }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    return aStart <= bEnd && bStart <= aEnd
}

function buildSlotMeta(timeSlots: string[]) {
    return timeSlots.map((slot) => {
        const parsed = parseSlotRange(slot)
        return {
            label: slot,
            start: parsed?.start ?? 0,
            end: parsed?.end ?? 0,
        }
    })
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
    const explicit = (item.contentLines ?? []).map((line) => normalizeText(line)).filter(Boolean)
    if (explicit.length > 0) return explicit.slice(0, 4)

    const oneLine = normalizeText(item.displayLabel)
    if (oneLine) return [oneLine]

    const line1 = normalizeText(item.facultyName)
    const line2 = [normalizeText(item.subjectCode), normalizeText(item.sectionLabel)]
        .filter(Boolean)
        .join(" / ")
    const line3 = normalizeText(item.subjectTitle)
    const line4 = normalizeText(item.notes)

    return [line1, line2, line3, line4].filter(Boolean).slice(0, 4)
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
        if (startMinutes == null || endMinutes == null) continue

        const matchedRows: number[] = []
        for (let rowIndex = 0; rowIndex < slotMeta.length; rowIndex += 1) {
            const slot = slotMeta[rowIndex]
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
        const fontSize = rowSpan >= 3 ? 6.8 : 6.2

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

    return blocks
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

function getAssetAsDataUrl(path: string) {
    if (!assetUrlCache.has(path)) {
        assetUrlCache.set(
            path,
            (async () => {
                const response = await fetch(path)
                if (!response.ok) {
                    throw new Error(`Failed to load asset: ${path}`)
                }
                const blob = await response.blob()
                return await blobToDataUrl(blob)
            })()
        )
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
}: RoomSchedulePrintSheetProps) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [pdfBusy, setPdfBusy] = React.useState(false)
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)
    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)

    const pdfUrlRef = React.useRef<string | null>(null)

    const semesterSchoolYearLine = React.useMemo(
        () => toSemesterSchoolYearLine(semester, schoolYear),
        [semester, schoolYear]
    )
    const yearBadge = React.useMemo(() => inferYearBadge(schoolYear), [schoolYear])
    const meetingBlocks = React.useMemo(() => buildMeetingBlocks(items, timeSlots), [items, timeSlots])

    const cleanupPreviewUrl = React.useCallback(() => {
        if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
            pdfUrlRef.current = null
        }
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
            getAssetAsDataUrl("/logo.svg"),
            getAssetAsDataUrl("/CCS.png"),
        ])

        const generatedAt = new Date()
        const filename = `room-schedule_${roomLabel
            .trim()
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase() || "room"}_${formatTimestamp(generatedAt)}.pdf`

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
                fontWeight: 700,
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
                fontWeight: 700,
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
                height: timeSlots.length * ROW_HEIGHT,
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
                fontWeight: 700,
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
            <Document title={`Room Schedule - ${roomLabel}`}>
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

                        <Text style={styles.roomTitle}>{roomLabel.toUpperCase()}</Text>

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
                                {timeSlots.map((slotLabel) => {
                                    const isNoonBreak = slotLabel === "12:01-1:00"

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
                                                            fontSize: block.fontSize,
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
        timeSlots,
        yearBadge,
        meetingBlocks,
    ])

    const ensurePdfPreview = React.useCallback(async () => {
        if (disabled) return
        if (pdfPreviewBusy) return

        setPdfPreviewBusy(true)
        try {
            const { blob } = await buildPdfBlob()
            const nextUrl = URL.createObjectURL(blob)

            if (pdfUrlRef.current) {
                URL.revokeObjectURL(pdfUrlRef.current)
            }

            pdfUrlRef.current = nextUrl
            setPdfUrl(nextUrl)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to generate room schedule PDF preview.")
        } finally {
            setPdfPreviewBusy(false)
        }
    }, [buildPdfBlob, disabled, pdfPreviewBusy])

    React.useEffect(() => {
        if (!previewOpen) {
            cleanupPreviewUrl()
            return
        }

        void ensurePdfPreview()
    }, [previewOpen, ensurePdfPreview, cleanupPreviewUrl])

    const onExportPdf = React.useCallback(async () => {
        if (disabled) return

        setPdfBusy(true)
        try {
            const { blob, filename } = await buildPdfBlob()
            downloadBlob(blob, filename)
            toast.success("Room schedule PDF exported.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export room schedule PDF.")
        } finally {
            setPdfBusy(false)
        }
    }, [buildPdfBlob, disabled])

    return (
        <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={disabled || pdfBusy}
                >
                    <Eye className="mr-2 h-4 w-4" />
                    {previewLabel}
                </Button>

                <Button size="sm" onClick={() => void onExportPdf()} disabled={disabled || pdfBusy}>
                    {pdfBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    {pdfBusy ? "Exporting..." : exportLabel}
                </Button>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>PDF Preview — {roomLabel}</DialogTitle>
                        <DialogDescription>
                            A4 landscape room monitoring sheet aligned to the official printed sample.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{semester}</Badge>
                        <Badge variant="secondary">SY {schoolYear}</Badge>
                        <Badge variant="outline">
                            {items.length} scheduled block{items.length === 1 ? "" : "s"}
                        </Badge>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-md border">
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
                                title={`Room schedule PDF preview - ${roomLabel}`}
                                src={pdfUrl}
                                className="h-[75vh] w-full"
                            />
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                PDF preview is not ready yet.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Includes the aligned upper-left logo, aligned upper-right CCS mark, corrected header
                            structure, and simplified official layout.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>

                            <Button onClick={() => void onExportPdf()} disabled={disabled || pdfBusy}>
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