import { Clock, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react"
import type { AcademicTermDoc, DepartmentDoc } from "./schedule-types"
import { BASE_DAY_OPTIONS, DAY_ABBREVIATIONS } from "./schedule-types"

const MANUAL_FACULTY_TAG_REGEX = /\[\[manualFaculty:(.*?)\]\]/i
const MANUAL_FACULTY_TAG_REMOVE_REGEX = /\s*\[\[manualFaculty:.*?\]\]\s*/gi
const MERIDIEM_REGEX = /\b(AM|PM)\b/g

const DAY_ALIAS_TO_CANONICAL = new Map<string, (typeof BASE_DAY_OPTIONS)[number]>([
    ["m", "Monday"],
    ["mon", "Monday"],
    ["monday", "Monday"],
    ["t", "Tuesday"],
    ["tu", "Tuesday"],
    ["tue", "Tuesday"],
    ["tues", "Tuesday"],
    ["tuesday", "Tuesday"],
    ["w", "Wednesday"],
    ["wed", "Wednesday"],
    ["weds", "Wednesday"],
    ["wednesday", "Wednesday"],
    ["th", "Thursday"],
    ["thu", "Thursday"],
    ["thur", "Thursday"],
    ["thur.", "Thursday"],
    ["thurs", "Thursday"],
    ["thursday", "Thursday"],
    ["f", "Friday"],
    ["fri", "Friday"],
    ["friday", "Friday"],
    ["sat", "Saturday"],
    ["saturday", "Saturday"],
    ["sun", "Sunday"],
    ["sunday", "Sunday"],
])

function normalizeMeridiem(value: string) {
    return String(value || "").replace(MERIDIEM_REGEX, (match) => match.toLowerCase())
}

function getOrderedUniqueDays(days: string[]) {
    return BASE_DAY_OPTIONS.filter((baseDay) => days.includes(baseDay))
}

function tokenizeDayExpression(value?: string | null) {
    const raw = String(value || "")
        .trim()
        .replace(/[–—]/g, "-")
        .replace(/\band\b/gi, " ")
        .replace(/\s*\/\s*/g, " ")
        .replace(/\s*,\s*/g, " ")
        .replace(/\s*\+\s*/g, " ")
        .replace(/\s*-\s*/g, "-")

    if (!raw) return []

    const normalizedRaw = raw.toLowerCase()
    if (DAY_ALIAS_TO_CANONICAL.has(normalizedRaw)) {
        return [DAY_ALIAS_TO_CANONICAL.get(normalizedRaw)!]
    }

    const parts = raw
        .split(/[-\s]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)

    const resolved = parts
        .map((part) => DAY_ALIAS_TO_CANONICAL.get(part) || "")
        .filter(Boolean)

    return getOrderedUniqueDays(resolved)
}

export function shortId(id: string) {
    if (!id) return ""
    return id.length <= 10 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`
}

export function fmtDate(iso?: string | null) {
    if (!iso) return "—"
    try {
        const d = new Date(iso)
        return normalizeMeridiem(
            new Intl.DateTimeFormat(undefined, {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            }).format(d)
        )
    } catch {
        return "—"
    }
}

export function normalizeScheduleStatus(status?: string | null) {
    const s = String(status || "").trim()
    if (!s) return "Draft"
    if (s.toLowerCase() === "locked") return "Archived"
    return s
}

export function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
    const s = normalizeScheduleStatus(status).toLowerCase()
    if (s === "active") return "default"
    if (s === "archived") return "secondary"
    return "outline"
}

export function statusIcon(status: string): LucideIcon {
    const s = normalizeScheduleStatus(status).toLowerCase()
    if (s === "active") return ShieldCheck
    if (s === "archived") return ShieldX
    return Clock
}

export function termLabel(t?: AcademicTermDoc | null) {
    if (!t) return "—"
    const sy = (t.schoolYear || "").trim()
    const sem = (t.semester || "").trim()
    const base = [sy, sem].filter(Boolean).join(" • ")
    const suffix = t.isActive ? " (Active)" : ""
    return (base || t.$id) + suffix
}

export function deptLabel(d?: DepartmentDoc | null) {
    if (!d) return "—"
    const code = (d.code || "").trim()
    const name = (d.name || "").trim()
    if (code && name) return `${code} • ${name}`
    return name || code || d.$id
}

export function normalizeText(v?: string | null) {
    return String(v || "").trim().toLowerCase()
}

export function hhmmToMinutes(v: string) {
    const parts = String(v || "").split(":")
    const hh = Number.parseInt(parts[0] || "0", 10)
    const mm = Number.parseInt(parts[1] || "0", 10)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
    return hh * 60 + mm
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const aS = hhmmToMinutes(aStart)
    const aE = hhmmToMinutes(aEnd)
    const bS = hhmmToMinutes(bStart)
    const bE = hhmmToMinutes(bEnd)
    return Math.max(aS, bS) < Math.min(aE, bE)
}

export function formatClockTime(value?: string | null) {
    const raw = String(value || "").trim()
    if (!raw) return "—"

    const parts = raw.split(":")
    const hh = Number.parseInt(parts[0] || "", 10)
    const mm = Number.parseInt(parts[1] || "", 10)

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw

    const d = new Date()
    d.setHours(hh, mm, 0, 0)

    return normalizeMeridiem(
        new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }).format(d)
    )
}

export function formatTimeRange(start: string, end: string) {
    return `${formatClockTime(start)} - ${formatClockTime(end)}`
}

export function extractManualFaculty(remarks?: string | null) {
    const raw = String(remarks || "")
    const match = raw.match(MANUAL_FACULTY_TAG_REGEX)
    return String(match?.[1] || "").trim()
}

export function stripManualFacultyTag(remarks?: string | null) {
    return String(remarks || "")
        .replace(MANUAL_FACULTY_TAG_REMOVE_REGEX, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
}

export function composeRemarks(baseRemarks: string, manualFaculty: string) {
    const base = stripManualFacultyTag(baseRemarks)
    const manual = String(manualFaculty || "").trim()
    if (!manual) return base || null
    const tag = `[[manualFaculty:${manual}]]`
    return [base, tag].filter(Boolean).join(" ").trim()
}

export function getDayTokens(dayValue?: string | null) {
    return tokenizeDayExpression(dayValue)
}

export function getCanonicalDayValue(dayValue?: string | null) {
    const days = getDayTokens(dayValue)
    if (days.length === 0) return String(dayValue || "").trim()
    if (days.length === 1) return days[0]
    return days.map((day) => DAY_ABBREVIATIONS[day]).join("-")
}

export function formatDayDisplayLabel(dayValue?: string | null) {
    const canonical = getCanonicalDayValue(dayValue)
    if (!canonical) return "—"
    return canonical
}

export function dayExpressionsOverlap(a?: string | null, b?: string | null) {
    const aDays = getDayTokens(a)
    const bDays = getDayTokens(b)
    if (aDays.length === 0 || bDays.length === 0) return false
    return aDays.some((day) => bDays.includes(day))
}

export function dayOrder(day: string) {
    const days = getDayTokens(day)
    if (days.length === 0) return 999
    const indexes = days
        .map((value) => BASE_DAY_OPTIONS.indexOf(value))
        .filter((value) => value >= 0)
    return indexes.length > 0 ? Math.min(...indexes) : 999
}

export function roleLooksLikeFaculty(role?: string | null) {
    const r = String(role || "").toLowerCase()
    return r === "faculty" || r === "instructor"
}

export function roomTypeLabel(roomType: string) {
    const t = String(roomType || "").toUpperCase()
    if (t === "LAB") return "LAB"
    if (t === "LECTURE") return "LECTURE"
    return t || "OTHER"
}

export function meetingTypeLabel(v: string) {
    const t = String(v || "").toUpperCase()
    if (t === "LAB") return "LAB"
    if (t === "LECTURE") return "LECTURE"
    return "OTHER"
}

function buildTimeOptions(stepMinutes = 30) {
    const out: Array<{ value: string; label: string }> = []

    for (let h = 0; h < 24; h += 1) {
        for (let m = 0; m < 60; m += stepMinutes) {
            const hh = String(h).padStart(2, "0")
            const mm = String(m).padStart(2, "0")
            const value = `${hh}:${mm}`

            const h12 = ((h + 11) % 12) + 1
            const period = h >= 12 ? "pm" : "am"
            const label = `${h12}:${mm} ${period}`

            out.push({ value, label })
        }
    }

    return out
}

export const TIME_OPTIONS = buildTimeOptions(30)
