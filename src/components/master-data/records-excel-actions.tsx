/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Download, Eye, FileSpreadsheet, Loader2 } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
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
    showBatchFacultyExport?: boolean
}

const LEFT_LOGO_PATH = "/logo.png"
const RIGHT_LOGO_PATH = "/CCS.png"

const HEADER_REPUBLIC = "Republic of the Philippines"
const HEADER_INSTITUTION = "JOSE RIZAL MEMORIAL STATE UNIVERSITY"
const HEADER_SUBTITLE = "The Premier University in Zamboanga del Norte"
const HEADER_COLLEGE = "COLLEGE OF COMPUTING STUDIES"
const HEADER_DOCUMENT = "LIST OF RECORDS"

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
    showBatchFacultyExport = true,
}: Props) {
    const [previewOpen, setPreviewOpen] = React.useState(false)

    const [excelBusy, setExcelBusy] = React.useState(false)
    const [facultyExcelBusy, setFacultyExcelBusy] = React.useState(false)
    const warnedStylesRef = React.useRef(false)

    const hasRows = rows && rows.length > 0

    const facultyGroups = React.useMemo(() => groupRowsByFaculty(rows), [rows])
    const singleFacultyLabel = React.useMemo(() => inferSingleFacultyLabel(rows), [rows])

    const previewColumns = React.useMemo(() => {
        const isIndividualFaculty = Boolean(singleFacultyLabel?.trim())

        return isIndividualFaculty
            ? [
                  { key: "term", label: "Term", className: "w-56" },
                  { key: "day", label: "Day", className: "w-28" },
                  { key: "start", label: "Start", className: "w-32" },
                  { key: "end", label: "End", className: "w-32" },
                  { key: "room", label: "Room", className: "w-48" },
                  { key: "code", label: "Subject Code", className: "w-40" },
                  { key: "title", label: "Subject Title", className: "min-w-80" },
                  { key: "units", label: "Units", className: "w-20" },
                  { key: "conflict", label: "Conflict", className: "w-28" },
              ]
            : [
                  { key: "term", label: "Term", className: "w-56" },
                  { key: "day", label: "Day", className: "w-28" },
                  { key: "start", label: "Start", className: "w-32" },
                  { key: "end", label: "End", className: "w-32" },
                  { key: "room", label: "Room", className: "w-48" },
                  { key: "faculty", label: "Faculty", className: "w-72" },
                  { key: "code", label: "Subject Code", className: "w-40" },
                  { key: "title", label: "Subject Title", className: "min-w-80" },
                  { key: "units", label: "Units", className: "w-20" },
                  { key: "conflict", label: "Conflict", className: "w-28" },
              ]
    }, [singleFacultyLabel])

    const getPreviewCellValue = React.useCallback(
        (r: any, key: string, isConflict: boolean) => {
            const startRaw = r?.startTime ?? r?.start ?? "—"
            const endRaw = r?.endTime ?? r?.end ?? "—"

            if (key === "term") return resolveTermLabel(r)
            if (key === "day") return String(r?.dayOfWeek ?? r?.day ?? "—")
            if (key === "start") return formatTimeAmPm(startRaw)
            if (key === "end") return formatTimeAmPm(endRaw)
            if (key === "room") return String(r?.roomLabel ?? r?.room ?? "—")
            if (key === "faculty") return facultyLabelOf(r)
            if (key === "code") return String(r?.subjectCode ?? r?.code ?? "—")
            if (key === "title") return String(r?.subjectTitle ?? r?.title ?? "—")
            if (key === "units") return r?.units ?? "—"
            if (key === "conflict") return isConflict ? "Conflict" : "Clear"
            return "—"
        },
        [resolveTermLabel]
    )

    const buildWorkbookBlob = React.useCallback(
        async (targetRows: any[], facultyLabel?: string) => {
            const { XLSX, supportsStyles } = await loadXlsxModule()

            const generatedAt = new Date()
            const isIndividualFaculty = Boolean(facultyLabel?.trim())
            const normalizedFacultyLabel = facultyLabel?.trim() || ""

            const filename = isIndividualFaculty
                ? `list-of-records_${sanitizeFilenamePart(normalizedFacultyLabel)}_${formatTimestamp(generatedAt)}.xlsx`
                : `list-of-records_${formatTimestamp(generatedAt)}.xlsx`

            const facultyLine = isIndividualFaculty ? normalizedFacultyLabel : "All Faculty"
            const filtersLine = isIndividualFaculty
                ? `Filters: ${subjectFilterLabel} • ${unitFilterLabel} • Faculty: ${normalizedFacultyLabel}`
                : `Filters: ${subjectFilterLabel} • ${unitFilterLabel}`

            const columns = isIndividualFaculty
                ? [
                      { key: "term", label: "Term", wch: 28 },
                      { key: "day", label: "Day", wch: 14 },
                      { key: "start", label: "Start Time", wch: 14 },
                      { key: "end", label: "End Time", wch: 14 },
                      { key: "room", label: "Room", wch: 22 },
                      { key: "code", label: "Subject Code", wch: 18 },
                      { key: "title", label: "Subject Title", wch: 48 },
                      { key: "units", label: "Units", wch: 10 },
                      { key: "conflict", label: "Conflict", wch: 12 },
                  ]
                : [
                      { key: "term", label: "Term", wch: 28 },
                      { key: "day", label: "Day", wch: 14 },
                      { key: "start", label: "Start Time", wch: 14 },
                      { key: "end", label: "End Time", wch: 14 },
                      { key: "room", label: "Room", wch: 22 },
                      { key: "faculty", label: "Faculty", wch: 34 },
                      { key: "code", label: "Subject Code", wch: 18 },
                      { key: "title", label: "Subject Title", wch: 48 },
                      { key: "units", label: "Units", wch: 10 },
                      { key: "conflict", label: "Conflict", wch: 12 },
                  ]

            const headers = columns.map((column) => column.label)

            const dataRows = targetRows.map((r: any) => {
                const id = safeId(r)
                const hasConflict = id ? conflictRecordIds.has(id) : false

                const unitsRaw = r?.units
                const unitsNum = Number(unitsRaw)
                const units = Number.isFinite(unitsNum) ? unitsNum : "—"

                const startRaw = r?.startTime ?? r?.start ?? "—"
                const endRaw = r?.endTime ?? r?.end ?? "—"

                return columns.map((column) => {
                    if (column.key === "term") return resolveTermLabel(r)
                    if (column.key === "day") return String(r?.dayOfWeek ?? r?.day ?? "—")
                    if (column.key === "start") return formatTimeAmPm(startRaw)
                    if (column.key === "end") return formatTimeAmPm(endRaw)
                    if (column.key === "room") return String(r?.roomLabel ?? r?.room ?? "—")
                    if (column.key === "faculty") return facultyLabelOf(r)
                    if (column.key === "code") return String(r?.subjectCode ?? r?.code ?? "—")
                    if (column.key === "title") return String(r?.subjectTitle ?? r?.title ?? "—")
                    if (column.key === "units") return units
                    if (column.key === "conflict") return hasConflict ? "Conflict" : "Clear"
                    return "—"
                })
            })

            const aoa: any[][] = [
                [HEADER_REPUBLIC],
                [HEADER_INSTITUTION],
                [HEADER_SUBTITLE],
                [HEADER_COLLEGE],
                [HEADER_DOCUMENT],
                [facultyLine],
                [filtersLine],
                [`Generated at: ${formatDateTimeAmPm(generatedAt)}`],
                [],
                headers,
                ...dataRows,
            ]

            const ws = XLSX.utils.aoa_to_sheet(aoa)

            const totalCols = headers.length
            const headerRowIndex = 10
            const firstDataRowIndex = headerRowIndex + 1

            ws["!merges"] = ws["!merges"] || []

            for (let r = 0; r <= 7; r += 1) {
                ws["!merges"].push({
                    s: { r, c: 0 },
                    e: { r, c: totalCols - 1 },
                })
            }

            ws["!cols"] = columns.map((column) => ({ wch: column.wch }))

            ws["!rows"] = ws["!rows"] || []
            ws["!rows"][0] = { hpt: 14 }
            ws["!rows"][1] = { hpt: 20 }
            ws["!rows"][2] = { hpt: 14 }
            ws["!rows"][3] = { hpt: 18 }
            ws["!rows"][4] = { hpt: 26 }
            ws["!rows"][5] = { hpt: 18 }
            ws["!rows"][6] = { hpt: 18 }
            ws["!rows"][7] = { hpt: 18 }
            ws["!rows"][8] = { hpt: 8 }
            ws["!rows"][9] = { hpt: 24 }

            const lastColLetter = XLSX.utils.encode_col(totalCols - 1)
            ws["!autofilter"] = { ref: `A${headerRowIndex}:${lastColLetter}${headerRowIndex}` }

            const border = {
                top: { style: "thin", color: { rgb: "CBD5E1" } },
                bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                left: { style: "thin", color: { rgb: "CBD5E1" } },
                right: { style: "thin", color: { rgb: "CBD5E1" } },
            }

            const centerMetaStyle = {
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
            }

            const headerStyle = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                border,
            }

            const rowStyleBase = {
                alignment: { horizontal: "left", vertical: "top", wrapText: true, indent: 1 },
                border,
            }

            const zebraFill = (even: boolean) => ({
                patternType: "solid",
                fgColor: { rgb: even ? "FFFFFF" : "F8FAFC" },
            })

            const conflictFill = { patternType: "solid", fgColor: { rgb: "FEE2E2" } }
            const clearFill = { patternType: "solid", fgColor: { rgb: "ECFDF5" } }

            const republicCell = ws["A1"]
            if (republicCell) {
                republicCell.s = {
                    ...centerMetaStyle,
                    font: { sz: 9, color: { rgb: "4B5563" } },
                }
            }

            const institutionCell = ws["A2"]
            if (institutionCell) {
                institutionCell.s = {
                    ...centerMetaStyle,
                    font: { bold: true, sz: 14, color: { rgb: "0F172A" } },
                }
            }

            const subtitleCell = ws["A3"]
            if (subtitleCell) {
                subtitleCell.s = {
                    ...centerMetaStyle,
                    font: { sz: 9, color: { rgb: "4B5563" } },
                }
            }

            const collegeCell = ws["A4"]
            if (collegeCell) {
                collegeCell.s = {
                    ...centerMetaStyle,
                    font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
                }
            }

            const documentCell = ws["A5"]
            if (documentCell) {
                documentCell.s = {
                    ...centerMetaStyle,
                    font: { italic: true, sz: 16, color: { rgb: "6B7280" } },
                }
            }

            const facultyCell = ws["A6"]
            if (facultyCell) {
                facultyCell.s = {
                    ...centerMetaStyle,
                    font: { bold: true, sz: 10, color: { rgb: "334155" } },
                }
            }

            const filtersCell = ws["A7"]
            if (filtersCell) {
                filtersCell.s = {
                    ...centerMetaStyle,
                    font: { sz: 9, color: { rgb: "475569" } },
                }
            }

            const generatedCell = ws["A8"]
            if (generatedCell) {
                generatedCell.s = {
                    ...centerMetaStyle,
                    font: { sz: 9, color: { rgb: "475569" } },
                }
            }

            for (let c = 0; c < totalCols; c++) {
                const addr = XLSX.utils.encode_cell({ r: headerRowIndex - 1, c })
                if (ws[addr]) ws[addr].s = headerStyle
            }

            for (let i = 0; i < dataRows.length; i++) {
                const excelRow = firstDataRowIndex + i
                const even = i % 2 === 0
                const recordId = safeId(targetRows[i])
                const isConflict = recordId ? conflictRecordIds.has(recordId) : false

                ws["!rows"][excelRow - 1] = { hpt: 30 }

                for (let c = 0; c < totalCols; c++) {
                    const addr = XLSX.utils.encode_cell({ r: excelRow - 1, c })
                    if (!ws[addr]) continue

                    const columnKey = columns[c]?.key
                    const isConflictCol = columnKey === "conflict"
                    const isCenterColumn =
                        columnKey === "day" ||
                        columnKey === "start" ||
                        columnKey === "end" ||
                        columnKey === "units" ||
                        columnKey === "conflict"

                    const fill =
                        isConflictCol
                            ? isConflict
                                ? conflictFill
                                : clearFill
                            : isConflict
                              ? conflictFill
                              : zebraFill(even)

                    ws[addr].s = {
                        ...rowStyleBase,
                        alignment: isCenterColumn
                            ? { horizontal: "center", vertical: "center", wrapText: true }
                            : rowStyleBase.alignment,
                        fill,
                        font: isConflictCol
                            ? { bold: true, color: { rgb: isConflict ? "7F1D1D" : "065F46" } }
                            : undefined,
                    }

                    if (columnKey === "units" && typeof ws[addr]?.v === "number") {
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
        },
        [resolveTermLabel, conflictRecordIds, subjectFilterLabel, unitFilterLabel]
    )

    const onExportExcel = React.useCallback(async () => {
        if (!hasRows) {
            toast.error("No records to export.")
            return
        }

        setExcelBusy(true)
        try {
            const { blob, filename, supportsStyles } = await buildWorkbookBlob(
                rows,
                singleFacultyLabel ?? undefined
            )

            if (!supportsStyles && !warnedStylesRef.current) {
                warnedStylesRef.current = true
                toast.message("Tip: Install xlsx-js-style to enable colored/styled Excel export.")
            }

            downloadBlob(blob, filename)
            toast.success("Excel exported.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export Excel.")
        } finally {
            setExcelBusy(false)
        }
    }, [hasRows, buildWorkbookBlob, rows, singleFacultyLabel])

    const onExportFacultyExcel = React.useCallback(async () => {
        if (!hasRows) {
            toast.error("No records to export.")
            return
        }

        if (facultyGroups.length === 0) {
            toast.error("No faculty groups found to export.")
            return
        }

        setFacultyExcelBusy(true)
        try {
            let exportedCount = 0

            for (const group of facultyGroups) {
                const { blob, filename, supportsStyles } = await buildWorkbookBlob(
                    group.rows,
                    group.facultyLabel
                )

                if (!supportsStyles && !warnedStylesRef.current) {
                    warnedStylesRef.current = true
                    toast.message("Tip: Install xlsx-js-style to enable colored/styled Excel export.")
                }

                downloadBlob(blob, filename)
                exportedCount += 1
                await wait(180)
            }

            toast.success(
                `Exported ${exportedCount} faculty Excel file${exportedCount === 1 ? "" : "s"}.`
            )
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to export individual faculty Excel files.")
        } finally {
            setFacultyExcelBusy(false)
        }
    }, [hasRows, facultyGroups, buildWorkbookBlob])

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
                    Preview Excel
                </Button>

                {showBatchFacultyExport ? (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void onExportFacultyExcel()}
                        disabled={!hasRows || excelBusy || facultyExcelBusy}
                        aria-label="Export individual faculty Excel files"
                        title="Export individual faculty Excel files"
                    >
                        {facultyExcelBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                    </Button>
                ) : null}

                <Button
                    size="sm"
                    onClick={() => void onExportExcel()}
                    disabled={!hasRows || excelBusy || facultyExcelBusy}
                >
                    {excelBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    {excelBusy ? "Exporting..." : "Export Excel"}
                </Button>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="sm:max-w-6xl min-w-0 overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>
                            Excel Preview — List of Records
                            {singleFacultyLabel ? ` — ${singleFacultyLabel}` : ""}
                        </DialogTitle>
                        <DialogDescription>
                            Preview the branded Excel table layout before downloading. Conflict rows are highlighted.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border bg-muted/20 px-4 py-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                                <img
                                    src={LEFT_LOGO_PATH}
                                    alt="JRMSU logo"
                                    className="h-14 w-14 object-contain"
                                />
                            </div>

                            <div className="min-w-0 flex-1 text-center">
                                <div className="text-[11px] text-muted-foreground">
                                    {HEADER_REPUBLIC}
                                </div>
                                <div className="text-base font-bold leading-tight">
                                    {HEADER_INSTITUTION}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {HEADER_SUBTITLE}
                                </div>
                                <div className="mt-1 text-sm font-bold">
                                    {HEADER_COLLEGE}
                                </div>
                                <div className="mt-2 text-xl italic text-muted-foreground">
                                    {HEADER_DOCUMENT}
                                </div>
                                <div className="mt-1 text-sm font-medium text-foreground">
                                    {singleFacultyLabel || "All Faculty"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Filters: {subjectFilterLabel} • {unitFilterLabel}
                                </div>
                            </div>

                            <div className="flex h-16 w-16 shrink-0 items-center justify-center">
                                <img
                                    src={RIGHT_LOGO_PATH}
                                    alt="CCS logo"
                                    className="h-14 w-14 object-contain"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{subjectFilterLabel}</Badge>
                        <Badge variant="secondary">{unitFilterLabel}</Badge>
                        {singleFacultyLabel ? <Badge variant="secondary">{singleFacultyLabel}</Badge> : null}
                        <Badge variant="outline">
                            {rows.length} record{rows.length === 1 ? "" : "s"}
                        </Badge>
                    </div>

                    <div className="mt-3 rounded-md border min-w-0 max-w-full">
                        <ScrollArea className="h-[60vh] w-full min-w-0">
                            <Table containerClassName="w-max overflow-visible" className="w-full">
                                <TableHeader>
                                    <TableRow>
                                        {previewColumns.map((column) => (
                                            <TableHead key={column.key} className={column.className}>
                                                {column.label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {!hasRows ? (
                                        <TableRow>
                                            <TableCell colSpan={previewColumns.length}>
                                                <div className="p-4">
                                                    <Skeleton className="h-8 w-full" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((r: any, idx: number) => {
                                            const id = safeId(r)
                                            const isConflict = id ? conflictRecordIds.has(id) : false

                                            return (
                                                <TableRow
                                                    key={id || idx}
                                                    className={isConflict ? "bg-destructive/10" : ""}
                                                >
                                                    {previewColumns.map((column) => {
                                                        const value = getPreviewCellValue(r, column.key, isConflict)

                                                        if (column.key === "term") {
                                                            return (
                                                                <TableCell
                                                                    key={column.key}
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {value}
                                                                </TableCell>
                                                            )
                                                        }

                                                        if (column.key === "faculty") {
                                                            return (
                                                                <TableCell
                                                                    key={column.key}
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {value}
                                                                </TableCell>
                                                            )
                                                        }

                                                        if (column.key === "code") {
                                                            return (
                                                                <TableCell key={column.key} className="font-medium">
                                                                    {value}
                                                                </TableCell>
                                                            )
                                                        }

                                                        if (column.key === "title") {
                                                            return (
                                                                <TableCell
                                                                    key={column.key}
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {value}
                                                                </TableCell>
                                                            )
                                                        }

                                                        if (column.key === "conflict") {
                                                            return (
                                                                <TableCell key={column.key}>
                                                                    <Badge
                                                                        variant={
                                                                            isConflict ? "destructive" : "secondary"
                                                                        }
                                                                    >
                                                                        {value}
                                                                    </Badge>
                                                                </TableCell>
                                                            )
                                                        }

                                                        return <TableCell key={column.key}>{value}</TableCell>
                                                    })}
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>

                            <ScrollBar orientation="horizontal" />
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            Excel export keeps the official branded header text and styling. The preview shows the JRMSU and CCS logos to match the room print sheet layout.
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                                Close
                            </Button>

                            {showBatchFacultyExport ? (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void onExportFacultyExcel()}
                                    disabled={facultyExcelBusy || excelBusy || !hasRows}
                                    aria-label="Export individual faculty Excel files"
                                    title="Export individual faculty Excel files"
                                >
                                    {facultyExcelBusy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                </Button>
                            ) : null}

                            <Button
                                onClick={() => void onExportExcel()}
                                disabled={excelBusy || facultyExcelBusy || !hasRows}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Excel
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}