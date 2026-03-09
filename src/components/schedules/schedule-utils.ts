import { Clock, FileLock2, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react"
import type { AcademicTermDoc, DepartmentDoc } from "./schedule-types"
import { DAY_OPTIONS } from "./schedule-types"

const MANUAL_FACULTY_TAG_REGEX = /\[\[manualFaculty:(.*?)\]\]/i
const MANUAL_FACULTY_TAG_REMOVE_REGEX = /\s*\[\[manualFaculty:.*?\]\]\s*/gi
const MERIDIEM_REGEX = /\b(AM|PM)\b/g

function normalizeMeridiem(value: string) {
  return String(value || "").replace(MERIDIEM_REGEX, (match) => match.toLowerCase())
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

export function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  const s = String(status || "").toLowerCase()
  if (s === "active") return "default"
  if (s === "locked") return "secondary"
  return "outline" // Draft, Archived, unknown
}

export function statusIcon(status: string): LucideIcon {
  const s = String(status || "").toLowerCase()
  if (s === "active") return ShieldCheck
  if (s === "locked") return FileLock2
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

export function dayOrder(day: string) {
  const idx = DAY_OPTIONS.findIndex((d) => d.toLowerCase() === String(day || "").toLowerCase())
  return idx >= 0 ? idx : 999
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