"use client"

import * as React from "react"
import { FileText, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type RoomPdfActionRoom = {
    $id: string
    code: string
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity: number
    type: string
    isActive: boolean
}

type RoomPdfActionTerm = {
    $id: string
    semester?: string | null
    schoolYear?: string | null
    isActive?: boolean
} | null

export type RoomPdfActionsProps = {
    room: RoomPdfActionRoom
    term: RoomPdfActionTerm
    disabled?: boolean
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function displayText(value?: string | null, fallback = "—") {
    const text = String(value ?? "").trim()
    return text || fallback
}

function buildTermLabel(term: RoomPdfActionTerm) {
    if (!term) return "No academic term selected"

    const semester = displayText(term.semester, "")
    const schoolYear = displayText(term.schoolYear, "")
    const parts = [semester, schoolYear].filter(Boolean)

    return parts.length > 0 ? parts.join(" • ") : "Selected academic term"
}

function buildPrintHtml(room: RoomPdfActionRoom, term: RoomPdfActionTerm) {
    const title = `${displayText(room.code)} Room Schedule Sheet`
    const termLabel = buildTermLabel(term)

    const rows = [
        ["Room Code", displayText(room.code)],
        ["Room Name", displayText(room.name)],
        ["Building", displayText(room.building)],
        ["Floor", displayText(room.floor)],
        ["Capacity", String(room.capacity ?? 0)],
        ["Type", displayText(room.type)],
        ["Available", room.isActive ? "Yes" : "No"],
        ["Academic Term", termLabel],
    ]
        .map(
            ([label, value]) => `
                <tr>
                    <td>${escapeHtml(label)}</td>
                    <td>${escapeHtml(value)}</td>
                </tr>
            `
        )
        .join("")

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            color-scheme: light;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #ffffff;
        }

        .page {
            max-width: 900px;
            margin: 0 auto;
            padding: 32px;
        }

        .header {
            margin-bottom: 24px;
        }

        .title {
            margin: 0 0 8px;
            font-size: 24px;
            font-weight: 700;
        }

        .subtitle {
            margin: 0;
            font-size: 14px;
            color: #4b5563;
        }

        .meta {
            margin-top: 16px;
            font-size: 12px;
            color: #6b7280;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
        }

        th,
        td {
            border: 1px solid #d1d5db;
            padding: 12px 14px;
            text-align: left;
            vertical-align: top;
        }

        th {
            width: 220px;
            background: #f9fafb;
            font-weight: 600;
        }

        .note {
            margin-top: 24px;
            font-size: 12px;
            color: #6b7280;
        }

        @media print {
            .page {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <main class="page">
        <header class="header">
            <h1 class="title">${escapeHtml(title)}</h1>
            <p class="subtitle">Printable room information sheet for scheduling and validation.</p>
            <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        </header>

        <table aria-label="Room schedule print sheet">
            <tbody>
                ${rows}
            </tbody>
        </table>

        <p class="note">
            This sheet reflects the selected room details and academic term at the time of printing.
        </p>
    </main>
</body>
</html>`
}

function openPrintWindow(room: RoomPdfActionRoom, term: RoomPdfActionTerm, shouldPrint: boolean) {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720")

    if (!popup) {
        toast.error("Unable to open print preview. Please allow pop-ups and try again.")
        return
    }

    popup.document.open()
    popup.document.write(buildPrintHtml(room, term))
    popup.document.close()
    popup.focus()

    if (shouldPrint) {
        popup.onload = () => {
            popup.print()
        }
    }
}

export function RoomPdfActions({
    room,
    term,
    disabled = false,
}: RoomPdfActionsProps) {
    const isDisabled = disabled || !term

    const ensureTerm = React.useCallback(() => {
        if (!term) {
            toast.error("Please select an academic term first.")
            return false
        }

        return true
    }, [term])

    const handlePreview = React.useCallback(() => {
        if (!ensureTerm()) return
        openPrintWindow(room, term, false)
    }, [ensureTerm, room, term])

    const handlePrint = React.useCallback(() => {
        if (!ensureTerm()) return
        openPrintWindow(room, term, true)
    }, [ensureTerm, room, term])

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={isDisabled}
            >
                <FileText className="mr-2 h-4 w-4" />
                Preview Sheet
            </Button>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isDisabled}
            >
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>
        </div>
    )
}

export default RoomPdfActions