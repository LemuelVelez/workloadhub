/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, Eye, FileSpreadsheet } from "lucide-react"

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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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
 * ✅ Excel Export Styling
 * - Prefer "xlsx-js-style" (supports colors/styles)
 * - Fallback to "xlsx" (no styling support, export still works)
 */
let xlsxPromise: Promise<{ XLSX: any; supportsStyles: boolean }> | null = null
async function loadXlsxModule() {
    if (!xlsxPromise) {
        xlsxPromise = (async () => {
            try {
                const m: any = await import("xlsx-js-style")
                return { XLSX: m?.default ?? m, supportsStyles: true }
            } catch {
                const m: any = await import("xlsx")
                return { XLSX: m?.default ?? m, supportsStyles: false }
            }
        })()
    }
    return xlsxPromise
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function RecordsExcelActions({
    rows,
    resolveTermLabel,
    conflictRecordIds,
    subjectFilterLabel = "All Subjects",
    unitFilterLabel = "All Units",
}: Props) {
    const [previewOpen, setPreviewOpen] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const warnedStylesRef = React.useRef(false)

    const hasRows = rows && rows.length > 0

    const buildWorkbookBlob = React.useCallback(async () => {
        const { XLSX, supportsStyles } = await loadXlsxModule()

        const title = "WorkloadHub — List of Records"
        const generatedAt = new Date()
        const filename = `list-of-records_${formatTimestamp(generatedAt)}.xlsx`

        const headers = [
            "Term",
            "Day",
            "Start Time",
            "End Time",
            "Room",
            "Faculty",
            "Subject Code",
            "Subject Title",
            "Units",
            "Conflict",
        ]

        const dataRows = rows.map((r: any) => {
            const id = safeId(r)
            const hasConflict = id ? conflictRecordIds.has(id) : false

            const unitsRaw = r?.units
            const unitsNum = Number(unitsRaw)
            const units = Number.isFinite(unitsNum) ? unitsNum : "—"

            return [
                resolveTermLabel(r),
                String(r?.dayOfWeek ?? r?.day ?? "—"),
                String(r?.startTime ?? r?.start ?? "—"),
                String(r?.endTime ?? r?.end ?? "—"),
                String(r?.roomLabel ?? r?.room ?? "—"),
                String(r?.facultyLabel ?? r?.faculty ?? "—"),
                String(r?.subjectCode ?? r?.code ?? "—"),
                String(r?.subjectTitle ?? r?.title ?? "—"),
                units,
                hasConflict ? "Conflict" : "Clear",
            ]
        })

        const aoa: any[][] = [
            [title],
            [`Filters: ${subjectFilterLabel} • ${unitFilterLabel}`],
            [`Generated at: ${generatedAt.toLocaleString()}`],
            [],
            headers,
            ...dataRows,
        ]

        const ws = XLSX.utils.aoa_to_sheet(aoa)

        const totalCols = headers.length
        const headerRowIndex = 5 // 1-based row number in Excel (row 5 contains headers)
        const firstDataRowIndex = headerRowIndex + 1

        // Merge title across all columns
        ws["!merges"] = ws["!merges"] || []
        ws["!merges"].push({
            s: { r: 0, c: 0 },
            e: { r: 0, c: totalCols - 1 },
        })

        // Column widths (user-friendly)
        ws["!cols"] = [
            { wch: 24 }, // Term
            { wch: 12 }, // Day
            { wch: 12 }, // Start
            { wch: 12 }, // End
            { wch: 18 }, // Room
            { wch: 28 }, // Faculty
            { wch: 16 }, // Subject Code
            { wch: 36 }, // Subject Title
            { wch: 10 }, // Units
            { wch: 12 }, // Conflict
        ]

        // Row heights (nice spacing)
        ws["!rows"] = ws["!rows"] || []
        ws["!rows"][0] = { hpt: 26 } // title
        ws["!rows"][1] = { hpt: 18 } // filters
        ws["!rows"][2] = { hpt: 18 } // generated at
        ws["!rows"][4] = { hpt: 20 } // headers (row 5)

        // Auto-filter for header row
        const lastColLetter = XLSX.utils.encode_col(totalCols - 1)
        ws["!autofilter"] = { ref: `A${headerRowIndex}:${lastColLetter}${headerRowIndex}` }

        // Styling helpers (requires xlsx-js-style; safe to set even if unsupported)
        const border = {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } },
        }

        const titleStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
            fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
            alignment: { horizontal: "center", vertical: "center" },
        }

        const metaStyle = {
            font: { color: { rgb: "334155" }, sz: 10 },
            fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
            alignment: { horizontal: "left", vertical: "center" },
        }

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "1E293B" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border,
        }

        const rowStyleBase = {
            alignment: { horizontal: "left", vertical: "center", wrapText: true },
            border,
        }

        const zebraFill = (even: boolean) => ({
            patternType: "solid",
            fgColor: { rgb: even ? "FFFFFF" : "F8FAFC" },
        })

        const conflictFill = { patternType: "solid", fgColor: { rgb: "FEE2E2" } } // light red
        const clearFill = { patternType: "solid", fgColor: { rgb: "ECFDF5" } } // light green-ish

        // Title cell style
        const titleCellAddr = "A1"
        if (ws[titleCellAddr]) ws[titleCellAddr].s = titleStyle

        // Meta rows merge + style
        const metaRows = [2, 3] // Excel row numbers
        for (const r of metaRows) {
            const addr = `A${r}`
            if (ws[addr]) {
                ws[addr].s = metaStyle
                ws["!merges"].push({
                    s: { r: r - 1, c: 0 },
                    e: { r: r - 1, c: totalCols - 1 },
                })
            }
        }

        // Header style
        for (let c = 0; c < totalCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: headerRowIndex - 1, c })
            if (ws[addr]) ws[addr].s = headerStyle
        }

        // Data rows style + conditional conflict highlight
        for (let i = 0; i < dataRows.length; i++) {
            const excelRow = firstDataRowIndex + i
            const even = i % 2 === 0
            const recordId = safeId(rows[i])
            const isConflict = recordId ? conflictRecordIds.has(recordId) : false

            ws["!rows"][excelRow - 1] = { hpt: 18 }

            for (let c = 0; c < totalCols; c++) {
                const addr = XLSX.utils.encode_cell({ r: excelRow - 1, c })
                if (!ws[addr]) continue

                const isConflictCol = c === totalCols - 1
                const fill =
                    isConflictCol
                        ? isConflict
                            ? conflictFill
                            : clearFill
                        : isConflict
                            ? conflictFill
                            : zebraFill(even)

                const align =
                    c === 8 // Units
                        ? { horizontal: "center", vertical: "center", wrapText: true }
                        : rowStyleBase.alignment

                ws[addr].s = {
                    ...rowStyleBase,
                    alignment: align,
                    fill,
                    font: isConflictCol
                        ? { bold: true, color: { rgb: isConflict ? "7F1D1D" : "065F46" } }
                        : undefined,
                }

                // Units number formatting (if numeric)
                if (c === 8 && typeof ws[addr]?.v === "number") {
                    ws[addr].z = "0"
                }
            }
        }

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "List of Records")

        const out: ArrayBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
        const blob = new Blob([out], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })

        return { blob, filename, supportsStyles }
    }, [rows, resolveTermLabel, conflictRecordIds, subjectFilterLabel, unitFilterLabel])

    const onExport = React.useCallback(async () => {
        if (!hasRows) {
            toast.error("No records to export.")
            return
        }

        setBusy(true)
        try {
            const { blob, filename, supportsStyles } = await buildWorkbookBlob()

            if (!supportsStyles && !warnedStylesRef.current) {
                warnedStylesRef.current = true
                toast.message("Tip: Install xlsx-js-style to enable colored/styled Excel export.")
            }

            downloadBlob(blob, filename)
            toast.success("Excel exported.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export Excel.")
        } finally {
            setBusy(false)
        }
    }, [hasRows, buildWorkbookBlob])

    const onDownloadFromPreview = React.useCallback(async () => {
        await onExport()
    }, [onExport])

    return (
        <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!hasRows}
                >
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Excel
                </Button>

                <Button size="sm" onClick={() => void onExport()} disabled={!hasRows || busy}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {busy ? "Exporting..." : "Export Excel"}
                </Button>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>Excel Preview — List of Records</DialogTitle>
                        <DialogDescription>
                            This preview matches the exported Excel columns. Conflict rows are highlighted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{subjectFilterLabel}</Badge>
                        <Badge variant="secondary">{unitFilterLabel}</Badge>
                        <Badge variant="outline">
                            {rows.length} record{rows.length === 1 ? "" : "s"}
                        </Badge>
                    </div>

                    {/* ✅ Both horizontal + vertical scrollbars */}
                    <div className="rounded-md border">
                        <ScrollArea className="h-[60vh] w-full">
                            <div className="min-w-max">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-56">Term</TableHead>
                                            <TableHead className="w-28">Day</TableHead>
                                            <TableHead className="w-28">Start</TableHead>
                                            <TableHead className="w-28">End</TableHead>
                                            <TableHead className="w-48">Room</TableHead>
                                            <TableHead className="w-72">Faculty</TableHead>
                                            <TableHead className="w-40">Subject Code</TableHead>
                                            <TableHead className="min-w-80">Subject Title</TableHead>
                                            <TableHead className="w-20">Units</TableHead>
                                            <TableHead className="w-28">Conflict</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((r: any, idx: number) => {
                                            const id = safeId(r)
                                            const isConflict = id ? conflictRecordIds.has(id) : false
                                            return (
                                                <TableRow
                                                    key={id || idx}
                                                    className={isConflict ? "bg-destructive/10" : ""}
                                                >
                                                    <TableCell className="text-muted-foreground">
                                                        {resolveTermLabel(r)}
                                                    </TableCell>
                                                    <TableCell>{String(r?.dayOfWeek ?? r?.day ?? "—")}</TableCell>
                                                    <TableCell>{String(r?.startTime ?? r?.start ?? "—")}</TableCell>
                                                    <TableCell>{String(r?.endTime ?? r?.end ?? "—")}</TableCell>
                                                    <TableCell>{String(r?.roomLabel ?? r?.room ?? "—")}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {String(r?.facultyLabel ?? r?.faculty ?? "—")}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {String(r?.subjectCode ?? r?.code ?? "—")}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {String(r?.subjectTitle ?? r?.title ?? "—")}
                                                    </TableCell>
                                                    <TableCell>{r?.units ?? "—"}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={isConflict ? "destructive" : "secondary"}>
                                                            {isConflict ? "Conflict" : "Clear"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <ScrollBar orientation="horizontal" />
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Exported file includes styled title/header rows, zebra striping, borders, and conflict highlight.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>
                            <Button onClick={() => void onDownloadFromPreview()} disabled={busy || !hasRows}>
                                <Download className="mr-2 h-4 w-4" />
                                {busy ? "Preparing..." : "Download Excel"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}