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

function safeId(r: any) {
    return String(r?.id ?? r?.$id ?? r?.recordId ?? r?.record_id ?? "").trim()
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

export function RecordsPdfActions({
    rows,
    resolveTermLabel,
    conflictRecordIds,
    subjectFilterLabel = "All Subjects",
    unitFilterLabel = "All Units",
}: Props) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [pdfBusy, setPdfBusy] = React.useState(false)

    const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
    const pdfUrlRef = React.useRef<string | null>(null)
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)

    const hasRows = rows && rows.length > 0

    const buildPdfBlob = React.useCallback(async () => {
        const m: any = await loadPdfRenderer()
        const Document = m.Document as any
        const Page = m.Page as any
        const Text = m.Text as any
        const View = m.View as any
        const StyleSheet = m.StyleSheet as any
        const pdf = m.pdf as any

        const generatedAt = new Date()
        const filename = `list-of-records_${formatTimestamp(generatedAt)}.pdf`

        const title = "WorkloadHub — List of Records"
        const subtitle = `Filters: ${subjectFilterLabel} • ${unitFilterLabel}`
        const generatedLabel = `Generated at: ${formatDateTimeAmPm(generatedAt)}`

        const cols = [
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
        ] as const

        const styles = StyleSheet.create({
            page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
            title: { fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#0F172A" },
            meta: { fontSize: 9, color: "#475569", marginBottom: 2 },
            table: { marginTop: 10, borderWidth: 1, borderColor: "#CBD5E1" },

            headerRow: { flexDirection: "row", backgroundColor: "#0F172A" },
            headerCell: {
                padding: 6,
                color: "#FFFFFF",
                fontWeight: 700,
                borderRightWidth: 1,
                borderRightColor: "#CBD5E1",
            },
            row: { flexDirection: "row" },
            cell: {
                padding: 6,
                borderTopWidth: 1,
                borderTopColor: "#CBD5E1",
                borderRightWidth: 1,
                borderRightColor: "#CBD5E1",
                color: "#0F172A",
            },
            zebra: { backgroundColor: "#F8FAFC" },
            conflictRow: { backgroundColor: "#FEE2E2" },

            footer: {
                position: "absolute",
                bottom: 14,
                left: 24,
                right: 24,
                flexDirection: "row",
                justifyContent: "space-between",
                fontSize: 8,
                color: "#64748B",
            },
        })

        const RecordsPdfDocument = () => (
            <Document title={title}>
                <Page size="A4" orientation="landscape" style={styles.page}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.meta}>{subtitle}</Text>
                    <Text style={styles.meta}>{generatedLabel}</Text>

                    <View style={styles.table}>
                        <View style={styles.headerRow} wrap={false}>
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
                                        style={{
                                            ...styles.headerCell,
                                            borderRightWidth: 0,
                                            textAlign:
                                                c.key === "day" ||
                                                c.key === "start" ||
                                                c.key === "end" ||
                                                c.key === "units" ||
                                                c.key === "conflict"
                                                    ? "center"
                                                    : "left",
                                        }}
                                    >
                                        {c.label}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {rows.map((r: any, i: number) => {
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
                                                          ? String(r?.facultyLabel ?? r?.faculty ?? "—")
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
                                                    style={{
                                                        ...styles.cell,
                                                        borderRightWidth: 0,
                                                        textAlign: align,
                                                        fontWeight: c.key === "conflict" ? 700 : 400,
                                                        color:
                                                            c.key === "conflict"
                                                                ? isConflict
                                                                    ? "#7F1D1D"
                                                                    : "#065F46"
                                                                : "#0F172A",
                                                    }}
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

                    <View style={styles.footer} fixed>
                        <Text>
                            {rows.length} record{rows.length === 1 ? "" : "s"}
                        </Text>
                        <Text>WorkloadHub</Text>
                    </View>
                </Page>
            </Document>
        )

        const blob: Blob = await pdf(<RecordsPdfDocument />).toBlob()
        return { blob, filename }
    }, [rows, resolveTermLabel, conflictRecordIds, subjectFilterLabel, unitFilterLabel])

    const ensurePdfPreview = React.useCallback(async () => {
        if (!hasRows) return
        if (pdfUrl) return
        if (pdfPreviewBusy) return

        setPdfPreviewBusy(true)
        try {
            const { blob } = await buildPdfBlob()
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
    }, [hasRows, pdfUrl, pdfPreviewBusy, buildPdfBlob])

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
            const { blob, filename } = await buildPdfBlob()
            downloadBlob(blob, filename)
            toast.success("PDF exported.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export PDF.")
        } finally {
            setPdfBusy(false)
        }
    }, [hasRows, buildPdfBlob])

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

                <Button
                    size="sm"
                    onClick={() => void onExportPdf()}
                    disabled={!hasRows || pdfBusy}
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
                        <DialogTitle>PDF Preview — List of Records</DialogTitle>
                        <DialogDescription>
                            Preview the PDF layout before downloading. Conflict rows are highlighted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{subjectFilterLabel}</Badge>
                        <Badge variant="secondary">{unitFilterLabel}</Badge>
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
                            PDF export uses A4 landscape layout with the same columns and conflict highlighting.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>

                            <Button
                                onClick={() => void onExportPdf()}
                                disabled={pdfBusy || !hasRows}
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