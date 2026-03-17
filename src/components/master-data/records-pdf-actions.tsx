/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, Eye, FileText, Loader2 } from "lucide-react"

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

type Props = {
    rows: any[]
    resolveTermLabel: (r: any) => string
    conflictRecordIds: Set<string>
    subjectFilterLabel?: string
    unitFilterLabel?: string
    showBatchFacultyExport?: boolean
}

const LEFT_LOGO_PATH = "/logo.png"
const RIGHT_LOGO_PATH = "/CCS.png"

const HEADER_REPUBLIC = "Republic of the Philippines"
const HEADER_INSTITUTION = "JOSE RIZAL MEMORIAL STATE UNIVERSITY"
const HEADER_SUBTITLE = "The Premier University in Zamboanga del Norte"
const HEADER_COLLEGE = "COLLEGE OF COMPUTING STUDIES"
const HEADER_DOCUMENT = "LIST OF RECORDS"

const assetUrlCache = new Map<string, Promise<string>>()

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

function safeId(r: any) {
    return String(r?.id ?? r?.$id ?? r?.recordId ?? r?.record_id ?? "").trim()
}

function facultyLabelOf(r: any) {
    const raw = String(r?.facultyLabel ?? r?.faculty ?? "").trim()
    return raw || "Unknown Faculty"
}

function sanitizeFilenamePart(value: any) {
    const sanitized = String(value ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()

    return sanitized || "unknown-faculty"
}

function groupRowsByFaculty(rows: any[]) {
    const map = new Map<string, any[]>()

    for (const row of rows) {
        const label = facultyLabelOf(row)
        if (!map.has(label)) {
            map.set(label, [])
        }
        map.get(label)?.push(row)
    }

    return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([facultyLabel, groupedRows]) => ({
            facultyLabel,
            rows: groupedRows,
        }))
}

function inferSingleFacultyLabel(rows: any[]) {
    const labels = Array.from(
        new Set(
            rows
                .map((row) => facultyLabelOf(row))
                .map((label) => label.trim())
                .filter(Boolean)
        )
    )

    return labels.length === 1 ? labels[0] : null
}

function wait(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

/**
 * Display time as 12-hour clock with AM/PM.
 * Accepts: "08:00", "8:00", "08:00:00", already formatted "8:00 AM", etc.
 */
function formatTimeAmPm(value: any) {
    const raw = String(value ?? "").trim()
    if (!raw || raw === "—") return "—"

    if (/\b(am|pm)\b/i.test(raw)) {
        return raw.replace(/\s+/g, " ").trim()
    }

    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
    if (!m) return raw

    const hh = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return raw

    const suffix = hh >= 12 ? "PM" : "AM"
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    return `${h12}:${pad2(mm)} ${suffix}`
}

function formatDateTimeAmPm(d: Date) {
    try {
        return d.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
    } catch {
        const yyyy = d.getFullYear()
        const mm = pad2(d.getMonth() + 1)
        const dd = pad2(d.getDate())
        const hh = d.getHours()
        const mi = d.getMinutes()
        const suffix = hh >= 12 ? "PM" : "AM"
        const h12 = hh % 12 === 0 ? 12 : hh % 12
        return `${yyyy}-${mm}-${dd} ${h12}:${pad2(mi)} ${suffix}`
    }
}

let pdfRendererPromise: Promise<any> | null = null
async function loadPdfRenderer() {
    if (!pdfRendererPromise) {
        pdfRendererPromise = import("@react-pdf/renderer").then((m: any) => m?.default ?? m)
    }
    return pdfRendererPromise
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
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

export function RecordsPdfActions({
    rows,
    resolveTermLabel,
    conflictRecordIds,
    subjectFilterLabel = "All Subjects",
    unitFilterLabel = "All Units",
    showBatchFacultyExport = true,
}: Props) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [pdfBusy, setPdfBusy] = React.useState(false)
    const [facultyPdfBusy, setFacultyPdfBusy] = React.useState(false)

    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
    const pdfUrlRef = React.useRef<string | null>(null)
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)

    const hasRows = rows && rows.length > 0
    const facultyGroups = React.useMemo(() => groupRowsByFaculty(rows), [rows])
    const singleFacultyLabel = React.useMemo(() => inferSingleFacultyLabel(rows), [rows])

    const buildPdfBlob = React.useCallback(
        async (targetRows: any[], facultyLabel?: string) => {
            const m: any = await loadPdfRenderer()
            const Document = m.Document as any
            const Page = m.Page as any
            const Text = m.Text as any
            const View = m.View as any
            const Image = m.Image as any
            const StyleSheet = m.StyleSheet as any
            const pdf = m.pdf as any

            const [leftLogoSrc, rightLogoSrc] = await Promise.all([
                getAssetAsDataUrl(LEFT_LOGO_PATH),
                getAssetAsDataUrl(RIGHT_LOGO_PATH),
            ])

            const generatedAt = new Date()
            const isIndividualFaculty = Boolean(facultyLabel?.trim())
            const normalizedFacultyLabel = facultyLabel?.trim() || ""

            const filename = isIndividualFaculty
                ? `list-of-records_${sanitizeFilenamePart(normalizedFacultyLabel)}_${formatTimestamp(generatedAt)}.pdf`
                : `list-of-records_${formatTimestamp(generatedAt)}.pdf`

            const subtitle = isIndividualFaculty
                ? `Filters: ${subjectFilterLabel} • ${unitFilterLabel} • Faculty: ${normalizedFacultyLabel}`
                : `Filters: ${subjectFilterLabel} • ${unitFilterLabel}`

            const generatedLabel = `Generated at: ${formatDateTimeAmPm(generatedAt)}`

            const cols = isIndividualFaculty
                ? ([
                      { key: "term", label: "Term", w: "15%" },
                      { key: "day", label: "Day", w: "8%" },
                      { key: "start", label: "Start", w: "8%" },
                      { key: "end", label: "End", w: "8%" },
                      { key: "room", label: "Room", w: "12%" },
                      { key: "code", label: "Subject Code", w: "12%" },
                      { key: "title", label: "Subject Title", w: "22%" },
                      { key: "units", label: "Units", w: "6%" },
                      { key: "conflict", label: "Conflict", w: "9%" },
                  ] as const)
                : ([
                      { key: "term", label: "Term", w: "13%" },
                      { key: "day", label: "Day", w: "7%" },
                      { key: "start", label: "Start", w: "7%" },
                      { key: "end", label: "End", w: "7%" },
                      { key: "room", label: "Room", w: "10%" },
                      { key: "faculty", label: "Faculty", w: "16%" },
                      { key: "code", label: "Subject Code", w: "10%" },
                      { key: "title", label: "Subject Title", w: "18%" },
                      { key: "units", label: "Units", w: "5%" },
                      { key: "conflict", label: "Conflict", w: "7%" },
                  ] as const)

            const styles = StyleSheet.create({
                page: {
                    paddingTop: 18,
                    paddingRight: 22,
                    paddingBottom: 36,
                    paddingLeft: 22,
                    fontFamily: "Helvetica",
                    color: "#1F2937",
                    fontSize: 8.5,
                },

                headerWrap: {
                    width: "100%",
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
                documentTitle: {
                    fontSize: 15.5,
                    fontStyle: "italic",
                    textAlign: "center",
                    color: "#4B5563",
                    marginTop: 8,
                    marginBottom: 2,
                },
                facultyLine: {
                    fontSize: 9.4,
                    textAlign: "center",
                    color: "#334155",
                    marginBottom: 2,
                    fontWeight: "bold",
                },
                metaCenter: {
                    fontSize: 8.1,
                    textAlign: "center",
                    color: "#475569",
                    marginBottom: 1,
                },

                table: {
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: "#CBD5E1",
                },
                headerRowTable: {
                    flexDirection: "row",
                    backgroundColor: "#0F172A",
                },
                headerCell: {
                    padding: 6,
                    color: "#FFFFFF",
                    fontWeight: "bold",
                    borderRightWidth: 1,
                    borderRightColor: "#CBD5E1",
                    textAlign: "center",
                },
                row: {
                    flexDirection: "row",
                },
                cell: {
                    padding: 6,
                    borderTopWidth: 1,
                    borderTopColor: "#CBD5E1",
                    borderRightWidth: 1,
                    borderRightColor: "#CBD5E1",
                    color: "#0F172A",
                },
                zebra: {
                    backgroundColor: "#F8FAFC",
                },
                conflictRow: {
                    backgroundColor: "#FEE2E2",
                },

                footerText: {
                    position: "absolute",
                    bottom: 12,
                    left: 22,
                    right: 22,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    fontSize: 8,
                    color: "#64748B",
                },
                footerRuleWrap: {
                    position: "absolute",
                    bottom: 24,
                    left: 22,
                    right: 22,
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

            const RecordsPdfDocument = () => (
                <Document title={`${HEADER_DOCUMENT}${isIndividualFaculty ? ` - ${normalizedFacultyLabel}` : ""}`}>
                    <Page size="A4" orientation="landscape" style={styles.page}>
                        <View style={styles.headerWrap}>
                            <View style={styles.headerRow}>
                                <View style={styles.logoWrap}>
                                    <Image src={leftLogoSrc} style={styles.logo} />
                                </View>

                                <View style={styles.centerHeader}>
                                    <Text style={styles.republic}>{HEADER_REPUBLIC}</Text>
                                    <Text style={styles.school}>{HEADER_INSTITUTION}</Text>
                                    <Text style={styles.campusLine}>{HEADER_SUBTITLE}</Text>
                                    <Text style={styles.college}>{HEADER_COLLEGE}</Text>
                                </View>

                                <View style={styles.logoWrap}>
                                    <Image src={rightLogoSrc} style={styles.logo} />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.documentTitle}>{HEADER_DOCUMENT}</Text>
                        {isIndividualFaculty ? (
                            <Text style={styles.facultyLine}>{normalizedFacultyLabel}</Text>
                        ) : null}
                        <Text style={styles.metaCenter}>{subtitle}</Text>
                        <Text style={styles.metaCenter}>{generatedLabel}</Text>

                        <View style={styles.table}>
                            <View style={styles.headerRowTable} wrap={false}>
                                {cols.map((c, idx) => (
                                    <View
                                        key={c.key}
                                        style={{
                                            width: c.w,
                                            borderRightWidth: idx === cols.length - 1 ? 0 : 1,
                                            borderRightColor: "#CBD5E1",
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.headerCell,
                                                {
                                                    borderRightWidth: 0,
                                                    textAlign:
                                                        c.key === "day" ||
                                                        c.key === "start" ||
                                                        c.key === "end" ||
                                                        c.key === "units" ||
                                                        c.key === "conflict"
                                                            ? "center"
                                                            : "left",
                                                },
                                            ]}
                                        >
                                            {c.label}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {targetRows.map((r: any, i: number) => {
                                const id = safeId(r)
                                const isConflict = id ? conflictRecordIds.has(id) : false
                                const even = i % 2 === 0

                                const startRaw = r?.startTime ?? r?.start ?? "—"
                                const endRaw = r?.endTime ?? r?.end ?? "—"

                                const unitsRaw = r?.units
                                const unitsNum = Number(unitsRaw)
                                const units = Number.isFinite(unitsNum) ? String(unitsNum) : "—"

                                const rowStyle = isConflict
                                    ? styles.conflictRow
                                    : even
                                      ? undefined
                                      : styles.zebra

                                return (
                                    <View key={id || i} style={[styles.row, rowStyle]} wrap={false}>
                                        {cols.map((c, idx) => {
                                            const value =
                                                c.key === "term"
                                                    ? resolveTermLabel(r)
                                                    : c.key === "day"
                                                      ? String(r?.dayOfWeek ?? r?.day ?? "—")
                                                      : c.key === "start"
                                                        ? formatTimeAmPm(startRaw)
                                                        : c.key === "end"
                                                          ? formatTimeAmPm(endRaw)
                                                          : c.key === "room"
                                                            ? String(r?.roomLabel ?? r?.room ?? "—")
                                                            : c.key === "faculty"
                                                              ? facultyLabelOf(r)
                                                              : c.key === "code"
                                                                ? String(r?.subjectCode ?? r?.code ?? "—")
                                                                : c.key === "title"
                                                                  ? String(r?.subjectTitle ?? r?.title ?? "—")
                                                                  : c.key === "units"
                                                                    ? units
                                                                    : c.key === "conflict"
                                                                      ? isConflict
                                                                          ? "Conflict"
                                                                          : "Clear"
                                                                      : ""

                                            const align =
                                                c.key === "day" ||
                                                c.key === "start" ||
                                                c.key === "end" ||
                                                c.key === "units" ||
                                                c.key === "conflict"
                                                    ? "center"
                                                    : "left"

                                            const isLast = idx === cols.length - 1

                                            return (
                                                <View
                                                    key={c.key}
                                                    style={{
                                                        width: c.w,
                                                        borderRightWidth: isLast ? 0 : 1,
                                                        borderRightColor: "#CBD5E1",
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.cell,
                                                            {
                                                                borderRightWidth: 0,
                                                                textAlign: align,
                                                                fontWeight: c.key === "conflict" ? "bold" : "normal",
                                                                color:
                                                                    c.key === "conflict"
                                                                        ? isConflict
                                                                            ? "#7F1D1D"
                                                                            : "#065F46"
                                                                        : "#0F172A",
                                                            },
                                                        ]}
                                                    >
                                                        {String(value ?? "—")}
                                                    </Text>
                                                </View>
                                            )
                                        })}
                                    </View>
                                )
                            })}
                        </View>

                        <View style={styles.footerRuleWrap} fixed>
                            <View style={styles.blueRule} />
                            <View style={styles.goldRule} />
                        </View>

                        <View style={styles.footerText} fixed>
                            <Text>
                                {targetRows.length} record{targetRows.length === 1 ? "" : "s"}
                            </Text>
                            <Text>WorkloadHub</Text>
                        </View>
                    </Page>
                </Document>
            )

            const blob: Blob = await pdf(<RecordsPdfDocument />).toBlob()
            return { blob, filename }
        },
        [resolveTermLabel, conflictRecordIds, subjectFilterLabel, unitFilterLabel]
    )

    const ensurePdfPreview = React.useCallback(async () => {
        if (!hasRows) return
        if (pdfUrl) return
        if (pdfPreviewBusy) return

        setPdfPreviewBusy(true)
        try {
            const { blob } = await buildPdfBlob(rows, singleFacultyLabel ?? undefined)
            const url = URL.createObjectURL(blob)

            if (pdfUrlRef.current) {
                URL.revokeObjectURL(pdfUrlRef.current)
            }
            pdfUrlRef.current = url
            setPdfUrl(url)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to generate PDF preview.")
        } finally {
            setPdfPreviewBusy(false)
        }
    }, [hasRows, pdfUrl, pdfPreviewBusy, buildPdfBlob, rows, singleFacultyLabel])

    React.useEffect(() => {
        if (!previewOpen) return
        void ensurePdfPreview()
    }, [previewOpen, ensurePdfPreview])

    React.useEffect(() => {
        if (previewOpen) return
        if (pdfUrlRef.current) {
            URL.revokeObjectURL(pdfUrlRef.current)
            pdfUrlRef.current = null
        }
        setPdfUrl(null)
        setPdfPreviewBusy(false)
    }, [previewOpen])

    React.useEffect(() => {
        return () => {
            if (pdfUrlRef.current) {
                URL.revokeObjectURL(pdfUrlRef.current)
                pdfUrlRef.current = null
            }
        }
    }, [])

    const onExportPdf = React.useCallback(async () => {
        if (!hasRows) {
            toast.error("No records to export.")
            return
        }

        setPdfBusy(true)
        try {
            const { blob, filename } = await buildPdfBlob(rows, singleFacultyLabel ?? undefined)
            downloadBlob(blob, filename)
            toast.success("PDF exported.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export PDF.")
        } finally {
            setPdfBusy(false)
        }
    }, [hasRows, buildPdfBlob, rows, singleFacultyLabel])

    const onExportFacultyPdf = React.useCallback(async () => {
        if (!hasRows) {
            toast.error("No records to export.")
            return
        }

        if (facultyGroups.length === 0) {
            toast.error("No faculty groups found to export.")
            return
        }

        setFacultyPdfBusy(true)
        try {
            let exportedCount = 0

            for (const group of facultyGroups) {
                const { blob, filename } = await buildPdfBlob(group.rows, group.facultyLabel)
                downloadBlob(blob, filename)
                exportedCount += 1
                await wait(180)
            }

            toast.success(
                `Exported ${exportedCount} faculty PDF file${exportedCount === 1 ? "" : "s"}.`
            )
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export individual faculty PDF files.")
        } finally {
            setFacultyPdfBusy(false)
        }
    }, [hasRows, facultyGroups, buildPdfBlob])

    return (
        <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!hasRows}
                >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview PDF
                </Button>

                {showBatchFacultyExport ? (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void onExportFacultyPdf()}
                        disabled={!hasRows || pdfBusy || facultyPdfBusy}
                        aria-label="Export individual faculty PDF files"
                        title="Export individual faculty PDF files"
                    >
                        {facultyPdfBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                    </Button>
                ) : null}

                <Button
                    size="sm"
                    onClick={() => void onExportPdf()}
                    disabled={!hasRows || pdfBusy || facultyPdfBusy}
                >
                    {pdfBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileText className="mr-2 h-4 w-4" />
                    )}
                    {pdfBusy ? "Exporting..." : "Export PDF"}
                </Button>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-6xl min-w-0 overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>
                            PDF Preview — List of Records
                            {singleFacultyLabel ? ` — ${singleFacultyLabel}` : ""}
                        </DialogTitle>
                        <DialogDescription>
                            Preview the branded PDF layout before downloading. Conflict rows are highlighted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{subjectFilterLabel}</Badge>
                        <Badge variant="secondary">{unitFilterLabel}</Badge>
                        {singleFacultyLabel ? <Badge variant="secondary">{singleFacultyLabel}</Badge> : null}
                        <Badge variant="outline">
                            {rows.length} record{rows.length === 1 ? "" : "s"}
                        </Badge>
                    </div>

                    <div className="mt-3 rounded-md border min-w-0 max-w-full overflow-hidden">
                        {pdfPreviewBusy ? (
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating PDF preview...
                                </div>
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-[52vh] w-full" />
                            </div>
                        ) : pdfUrl ? (
                            <iframe title="PDF Preview" src={pdfUrl} className="h-[60vh] w-full" />
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                PDF preview is not ready. Click “Preview PDF” again or export PDF.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            PDF export now includes the JRMSU and CCS logos, official institutional header,
                            branded title area, footer rules, and conflict highlighting.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>

                            {showBatchFacultyExport ? (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void onExportFacultyPdf()}
                                    disabled={facultyPdfBusy || pdfBusy || !hasRows}
                                    aria-label="Export individual faculty PDF files"
                                    title="Export individual faculty PDF files"
                                >
                                    {facultyPdfBusy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                </Button>
                            ) : null}

                            <Button
                                onClick={() => void onExportPdf()}
                                disabled={pdfBusy || facultyPdfBusy || !hasRows}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}