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

const assetUrlCache = new Map<string, Promise<string>>()

let excelJsPromise: Promise<any> | null = null
async function loadExcelJsModule() {
    if (!excelJsPromise) {
        excelJsPromise = import("exceljs").then((m: any) => m?.default ?? m)
    }
    return excelJsPromise
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

async function assetBlobToExcelDataUrl(path: string, blob: Blob) {
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
                return await assetBlobToExcelDataUrl(path, blob)
            } catch (error) {
                assetUrlCache.delete(path)
                throw error
            }
        })()

        assetUrlCache.set(path, promise)
    }

    return assetUrlCache.get(path)!
}

function inferImageExtension(dataUrl: string) {
    const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,/i.exec(dataUrl)
    const mime = String(match?.[1] ?? "").toLowerCase()

    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpeg"
    return "png"
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
            const ExcelJS: any = await loadExcelJsModule()

            const generatedAt = new Date()
            const isIndividualFaculty = Boolean(facultyLabel?.trim())
            const normalizedFacultyLabel = facultyLabel?.trim() || ""

            const filename = isIndividualFaculty
                ? `list-of-records_${sanitizeFilenamePart(normalizedFacultyLabel)}_${formatTimestamp(generatedAt)}.xlsx`
                : `list-of-records_${formatTimestamp(generatedAt)}.xlsx`

            const filtersLine = isIndividualFaculty
                ? `Filters: ${subjectFilterLabel} • ${unitFilterLabel} • Faculty: ${normalizedFacultyLabel}`
                : `Filters: ${subjectFilterLabel} • ${unitFilterLabel}`

            const columns = isIndividualFaculty
                ? [
                      { key: "term", label: "Term", width: 24 },
                      { key: "day", label: "Day", width: 14 },
                      { key: "start", label: "Start Time", width: 14 },
                      { key: "end", label: "End Time", width: 14 },
                      { key: "room", label: "Room", width: 22 },
                      { key: "code", label: "Subject Code", width: 18 },
                      { key: "title", label: "Subject Title", width: 42 },
                      { key: "units", label: "Units", width: 10 },
                      { key: "conflict", label: "Conflict", width: 12 },
                  ]
                : [
                      { key: "term", label: "Term", width: 24 },
                      { key: "day", label: "Day", width: 14 },
                      { key: "start", label: "Start Time", width: 14 },
                      { key: "end", label: "End Time", width: 14 },
                      { key: "room", label: "Room", width: 22 },
                      { key: "faculty", label: "Faculty", width: 28 },
                      { key: "code", label: "Subject Code", width: 18 },
                      { key: "title", label: "Subject Title", width: 42 },
                      { key: "units", label: "Units", width: 10 },
                      { key: "conflict", label: "Conflict", width: 12 },
                  ]

            const workbook = new ExcelJS.Workbook()
            workbook.creator = "WorkloadHub"
            workbook.lastModifiedBy = "WorkloadHub"
            workbook.created = generatedAt
            workbook.modified = generatedAt

            const worksheet = workbook.addWorksheet("List of Records", {
                views: [{ state: "frozen", ySplit: 10 }],
            })

            worksheet.pageSetup = {
                orientation: "landscape",
                paperSize: 9,
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: {
                    left: 0.3,
                    right: 0.3,
                    top: 0.35,
                    bottom: 0.35,
                    header: 0.2,
                    footer: 0.2,
                },
            }

            worksheet.properties.defaultRowHeight = 22
            worksheet.columns = columns.map((column) => ({
                key: column.key,
                width: column.width,
            }))

            const totalCols = columns.length
            const centerStartCol = 3
            const centerEndCol = Math.max(totalCols - 2, centerStartCol)
            const lastColLetter = worksheet.getColumn(totalCols).letter
            const conflictColumnIndex = totalCols - 1

            for (let row = 1; row <= 8; row += 1) {
                worksheet.mergeCells(row, centerStartCol, row, centerEndCol)
            }

            worksheet.getCell(1, centerStartCol).value = HEADER_REPUBLIC
            worksheet.getCell(2, centerStartCol).value = HEADER_INSTITUTION
            worksheet.getCell(3, centerStartCol).value = HEADER_SUBTITLE
            worksheet.getCell(4, centerStartCol).value = HEADER_COLLEGE
            worksheet.getCell(5, centerStartCol).value = HEADER_DOCUMENT
            worksheet.getCell(6, centerStartCol).value = isIndividualFaculty ? normalizedFacultyLabel : "All Faculty"
            worksheet.getCell(7, centerStartCol).value = filtersLine
            worksheet.getCell(8, centerStartCol).value = `Generated at: ${formatDateTimeAmPm(generatedAt)}`

            worksheet.getRow(1).height = 18
            worksheet.getRow(2).height = 22
            worksheet.getRow(3).height = 18
            worksheet.getRow(4).height = 20
            worksheet.getRow(5).height = 28
            worksheet.getRow(6).height = 20
            worksheet.getRow(7).height = 20
            worksheet.getRow(8).height = 20
            worksheet.getRow(9).height = 10
            worksheet.getRow(10).height = 24

            const border = {
                top: { style: "thin", color: { argb: "FFCBD5E1" } },
                bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
                left: { style: "thin", color: { argb: "FFCBD5E1" } },
                right: { style: "thin", color: { argb: "FFCBD5E1" } },
            }

            const centerHeaderBase = {
                alignment: { vertical: "middle", horizontal: "center", wrapText: true },
            }

            worksheet.getCell(1, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 9, color: { argb: "FF4B5563" } },
            }

            worksheet.getCell(2, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 14, bold: true, color: { argb: "FF0F172A" } },
            }

            worksheet.getCell(3, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 9, color: { argb: "FF4B5563" } },
            }

            worksheet.getCell(4, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 11, bold: true, color: { argb: "FF0F172A" } },
            }

            worksheet.getCell(5, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 16, italic: true, color: { argb: "FF6B7280" } },
            }

            worksheet.getCell(6, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 10, bold: true, color: { argb: "FF334155" } },
            }

            worksheet.getCell(7, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 9, color: { argb: "FF475569" } },
            }

            worksheet.getCell(8, centerStartCol).style = {
                ...centerHeaderBase,
                font: { name: "Helvetica", size: 9, color: { argb: "FF475569" } },
            }

            columns.forEach((column, index) => {
                const cell = worksheet.getCell(10, index + 1)
                cell.value = column.label
                cell.style = {
                    font: { name: "Helvetica", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
                    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } },
                    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
                    border,
                }
            })

            targetRows.forEach((r: any, rowIndex: number) => {
                const excelRowNumber = 11 + rowIndex
                const id = safeId(r)
                const isConflict = id ? conflictRecordIds.has(id) : false
                const even = rowIndex % 2 === 0

                const startRaw = r?.startTime ?? r?.start ?? "—"
                const endRaw = r?.endTime ?? r?.end ?? "—"

                const unitsRaw = r?.units
                const unitsNum = Number(unitsRaw)
                const units = Number.isFinite(unitsNum) ? unitsNum : "—"

                const rowValues = columns.map((column) => {
                    if (column.key === "term") return resolveTermLabel(r)
                    if (column.key === "day") return String(r?.dayOfWeek ?? r?.day ?? "—")
                    if (column.key === "start") return formatTimeAmPm(startRaw)
                    if (column.key === "end") return formatTimeAmPm(endRaw)
                    if (column.key === "room") return String(r?.roomLabel ?? r?.room ?? "—")
                    if (column.key === "faculty") return facultyLabelOf(r)
                    if (column.key === "code") return String(r?.subjectCode ?? r?.code ?? "—")
                    if (column.key === "title") return String(r?.subjectTitle ?? r?.title ?? "—")
                    if (column.key === "units") return units
                    if (column.key === "conflict") return isConflict ? "Conflict" : "Clear"
                    return "—"
                })

                rowValues.forEach((value, cellIndex) => {
                    const column = columns[cellIndex]
                    const cell = worksheet.getCell(excelRowNumber, cellIndex + 1)

                    cell.value = value as any

                    const isConflictCol = column.key === "conflict"
                    const centerAligned =
                        column.key === "day" ||
                        column.key === "start" ||
                        column.key === "end" ||
                        column.key === "units" ||
                        column.key === "conflict"

                    const fillArgb = isConflict
                        ? "FFFEE2E2"
                        : even
                          ? "FFFFFFFF"
                          : "FFF8FAFC"

                    const conflictFillArgb = isConflict ? "FFFEE2E2" : "FFECFDF5"
                    const fontColor =
                        column.key === "conflict"
                            ? isConflict
                                ? "FF7F1D1D"
                                : "FF065F46"
                            : "FF0F172A"

                    cell.style = {
                        font: {
                            name: "Helvetica",
                            size: 10,
                            bold: isConflictCol,
                            color: { argb: fontColor },
                        },
                        fill: {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: {
                                argb: isConflictCol ? conflictFillArgb : fillArgb,
                            },
                        },
                        alignment: {
                            vertical: "middle",
                            horizontal: centerAligned ? "center" : "left",
                            wrapText: true,
                            indent: centerAligned ? 0 : 1,
                        },
                        border,
                    }
                })

                worksheet.getRow(excelRowNumber).height = 28
            })

            const leftLogoDataUrl = await getAssetAsDataUrl(LEFT_LOGO_PATH)
            const rightLogoDataUrl = await getAssetAsDataUrl(RIGHT_LOGO_PATH)

            const leftImageId = workbook.addImage({
                base64: leftLogoDataUrl,
                extension: inferImageExtension(leftLogoDataUrl),
            })

            const rightImageId = workbook.addImage({
                base64: rightLogoDataUrl,
                extension: inferImageExtension(rightLogoDataUrl),
            })

            worksheet.addImage(leftImageId, {
                tl: { col: 0.08, row: 0.05 },
                ext: { width: 78, height: 78 },
            })

            worksheet.addImage(rightImageId, {
                tl: { col: conflictColumnIndex + 0.02, row: 0.05 },
                ext: { width: 78, height: 78 },
            })

            worksheet.autoFilter = {
                from: { row: 10, column: 1 },
                to: { row: 10, column: totalCols },
            }

            worksheet.mergeCells(`A${targetRows.length + 13}:${lastColLetter}${targetRows.length + 13}`)
            worksheet.mergeCells(`A${targetRows.length + 14}:${lastColLetter}${targetRows.length + 14}`)

            const blueRuleCell = worksheet.getCell(`A${targetRows.length + 13}`)
            blueRuleCell.value = ""
            blueRuleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF7FA7E8" },
            }

            const goldRuleCell = worksheet.getCell(`A${targetRows.length + 14}`)
            goldRuleCell.value = ""
            goldRuleCell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE9C76B" },
            }

            worksheet.getRow(targetRows.length + 13).height = 4
            worksheet.getRow(targetRows.length + 14).height = 3

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })

            return { blob, filename }
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
            const { blob, filename } = await buildWorkbookBlob(
                rows,
                singleFacultyLabel ?? undefined
            )
            downloadBlob(blob, filename)
            toast.success("Excel exported with images.")
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
                const { blob, filename } = await buildWorkbookBlob(
                    group.rows,
                    group.facultyLabel
                )

                downloadBlob(blob, filename)
                exportedCount += 1
                await wait(180)
            }

            toast.success(
                `Exported ${exportedCount} faculty Excel file${exportedCount === 1 ? "" : "s"} with images.`
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
                <DialogContent className="sm:max-w-6xl min-w-0 overflow-auto h-[95vh]">
                    <DialogHeader>
                        <DialogTitle>
                            Excel Preview — List of Records
                            {singleFacultyLabel ? ` — ${singleFacultyLabel}` : ""}
                        </DialogTitle>
                        <DialogDescription>
                            Preview the branded Excel layout before downloading. The downloaded file includes the JRMSU and CCS images.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-md border bg-muted/20 px-4 py-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center">
                                <img
                                    src={LEFT_LOGO_PATH}
                                    alt="JRMSU logo"
                                    className="h-18 w-18 object-contain"
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

                            <div className="flex h-20 w-20 shrink-0 items-center justify-center">
                                <img
                                    src={RIGHT_LOGO_PATH}
                                    alt="CCS logo"
                                    className="h-18 w-18 object-contain"
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
                            <Table className="w-full">
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