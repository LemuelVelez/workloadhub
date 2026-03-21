/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCcw,
    Pencil,
    Trash2,
    DoorOpen,
    Printer,
    AlertTriangle,
    ShieldCheck,
    Wrench,
    ArrowRightLeft,
    Clock3,
    Building2,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import RoomSchedulePrintSheet, {
    type RoomSchedulePrintItem,
    type RoomScheduleScope,
} from "@/components/room/room-schedule-print-sheet"
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type RoomDoc = {
    $id: string
    code: string
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity: number
    type: string
    isActive: boolean
}

type AcademicTermDocLite = {
    $id: string
    schoolYear: string
    semester: string
    startDate: string
    endDate: string
    isActive: boolean
    isLocked: boolean
}

type ScheduleVersionLite = {
    $id: string
    termId: string
    departmentId: string
    version: number
    label?: string | null
    status: string
}

type ClassMeetingLite = {
    $id: string
    versionId: string
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType?: string | null
    notes?: string | null
}

type ClassLite = {
    $id: string
    sectionId: string
    subjectId: string
    facultyUserId?: string | null
    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null
    remarks?: string | null
}

type SubjectLite = {
    $id: string
    code: string
    title: string
}

type SectionLite = {
    $id: string
    yearLevel: string
    name: string
}

type UserProfileLite = {
    $id: string
    userId: string
    name?: string | null
    email?: string | null
}

type RoomTypeFilter = "ALL" | "LECTURE" | "LAB" | "OTHER"

type RoomScheduleConflictType = "INVALID_TIME" | "DUPLICATE" | "OVERLAP"

type RoomScheduleConflict = {
    id: string
    type: RoomScheduleConflictType
    dayOfWeek: string
    displayTime: string
    keptItem: RoomSchedulePrintItem | null
    conflictingItems: RoomSchedulePrintItem[]
}

type ConflictFixAction = "RESCHEDULE" | "MOVE_ROOM" | "CREATE_ROOM"

const DIALOG_CONTENT_CLASS = "sm:max-w-2xl max-h-[75vh] overflow-y-auto"
const PRINT_FILTER_TRIGGER_CLASS = "w-full max-w-none"
const WRAP_TEXT_CLASS = "break-words whitespace-normal leading-tight"
const CONFLICT_TABLE_CLASS = "min-w-[1240px] table-fixed"

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const DEFAULT_PRINT_TIME_SLOTS = [
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

const MORNING_LABEL = "Morning"
const AFTERNOON_LABEL = "Afternoon"
const BOTH_LABEL = "Morning & Afternoon"
const MORNING_END_MINUTES = 12 * 60
const AFTERNOON_START_MINUTES = 13 * 60
const MINUTES_PER_DAY = 24 * 60
const PRINTABLE_TIME_DAY_START_MINUTES = 6 * 60
const PRINTABLE_TIME_DAY_END_MINUTES = 22 * 60
const MAX_REASONABLE_CLASS_DURATION_MINUTES = 8 * 60

function str(v: any) {
    return String(v ?? "").trim()
}

function num(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function toBool(v: any) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function typeBadgeVariant(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "default"
    if (v === "LECTURE") return "secondary"
    return "outline"
}

function displayType(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "Lab"
    if (v === "LECTURE") return "Lecture"
    if (v === "OTHER") return "Other"
    return v || "Other"
}

function displayRoomLabel(room?: RoomDoc | null) {
    if (!room) return "Room"
    return str(room.name) || str(room.code) || "Room"
}

function displayRoomSubLabel(room?: RoomDoc | null) {
    if (!room) return ""
    const primary = str(room.code)
    const secondary = str(room.name)
    if (primary && secondary && primary !== secondary) {
        return `${secondary} (${primary})`
    }
    return secondary || primary
}

function normalizeDayLabel(value: any) {
    const raw = str(value).toLowerCase()
    if (raw.startsWith("mon")) return "Monday"
    if (raw.startsWith("tue")) return "Tuesday"
    if (raw.startsWith("wed")) return "Wednesday"
    if (raw.startsWith("thu")) return "Thursday"
    if (raw.startsWith("fri")) return "Friday"
    return str(value)
}

function parseClockMinutes(value: any) {
    const raw = str(value)
    if (!raw) return Number.POSITIVE_INFINITY

    const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (ampm) {
        let hh = Number(ampm[1])
        const mm = Number(ampm[2])
        const suffix = ampm[3].toUpperCase()
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.POSITIVE_INFINITY
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return Number.POSITIVE_INFINITY
        if (suffix === "AM" && hh === 12) hh = 0
        if (suffix === "PM" && hh !== 12) hh += 12
        return hh * 60 + mm
    }

    const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (!timeMatch) return Number.POSITIVE_INFINITY

    const hh = Number(timeMatch[1])
    const mm = Number(timeMatch[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.POSITIVE_INFINITY
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return Number.POSITIVE_INFINITY
    return hh * 60 + mm
}

function parsePrintableClockMinutes(value: any) {
    return parseClockMinutes(value)
}

function parsePrintableClockCandidateMinutes(value: any) {
    const raw = str(value)
    if (!raw) return [] as number[]

    const parsed = parseClockMinutes(raw)
    if (!Number.isFinite(parsed)) return [] as number[]

    const hasMeridiem = /\b(?:AM|PM)\b/i.test(raw)
    const plain = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

    if (hasMeridiem || !plain) {
        return [parsed]
    }

    const hh = Number(plain[1])
    const mm = Number(plain[2])

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
        return [parsed]
    }

    const candidates = new Set<number>([hh * 60 + mm])

    if (hh >= 1 && hh <= 11) {
        const shifted = (hh + 12) * 60 + mm
        if (shifted < MINUTES_PER_DAY) {
            candidates.add(shifted)
        }
    }

    return Array.from(candidates).sort((a, b) => a - b)
}

function formatMinutesTo24Hour(totalMinutes: number) {
    const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    const hh = Math.floor(normalized / 60)
    const mm = normalized % 60
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function normalizePrintableTimeTo24Hour(value: any) {
    const minutes = parsePrintableClockMinutes(value)
    if (!Number.isFinite(minutes)) return str(value)
    return formatMinutesTo24Hour(minutes)
}

function scorePrintableTimeRange(startMinutes: number, endMinutes: number) {
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return Number.NEGATIVE_INFINITY
    }

    const duration = endMinutes - startMinutes
    let score = 0

    if (
        startMinutes >= PRINTABLE_TIME_DAY_START_MINUTES &&
        endMinutes <= PRINTABLE_TIME_DAY_END_MINUTES
    ) {
        score += 6
    }

    if (duration >= 30 && duration <= MAX_REASONABLE_CLASS_DURATION_MINUTES) {
        score += 5
    } else if (duration > 0 && duration <= 12 * 60) {
        score += 2
    } else {
        score -= 6
    }

    if (startMinutes < PRINTABLE_TIME_DAY_START_MINUTES) {
        score -= 3
    }

    if (endMinutes > PRINTABLE_TIME_DAY_END_MINUTES) {
        score -= 3
    }

    return score
}

function normalizePrintableTimeRangeTo24Hour(startValue: any, endValue: any) {
    const startCandidates = parsePrintableClockCandidateMinutes(startValue)
    const endCandidates = parsePrintableClockCandidateMinutes(endValue)

    if (startCandidates.length === 0 || endCandidates.length === 0) {
        return {
            normalizedStartTime: normalizePrintableTimeTo24Hour(startValue),
            normalizedEndTime: normalizePrintableTimeTo24Hour(endValue),
        }
    }

    let bestRange:
        | {
              startMinutes: number
              endMinutes: number
              score: number
              duration: number
          }
        | null = null

    for (const startMinutes of startCandidates) {
        for (const endMinutes of endCandidates) {
            if (endMinutes <= startMinutes) continue

            const duration = endMinutes - startMinutes
            const score = scorePrintableTimeRange(startMinutes, endMinutes)

            if (
                !bestRange ||
                score > bestRange.score ||
                (score === bestRange.score && duration < bestRange.duration) ||
                (score === bestRange.score &&
                    duration === bestRange.duration &&
                    startMinutes < bestRange.startMinutes)
            ) {
                bestRange = {
                    startMinutes,
                    endMinutes,
                    score,
                    duration,
                }
            }
        }
    }

    if (!bestRange) {
        return {
            normalizedStartTime: normalizePrintableTimeTo24Hour(startValue),
            normalizedEndTime: normalizePrintableTimeTo24Hour(endValue),
        }
    }

    return {
        normalizedStartTime: formatMinutesTo24Hour(bestRange.startMinutes),
        normalizedEndTime: formatMinutesTo24Hour(bestRange.endMinutes),
    }
}

function formatClockTo12Hour(value: any) {
    const minutes = parsePrintableClockMinutes(value)
    if (!Number.isFinite(minutes)) return str(value)

    const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    const hh24 = Math.floor(normalized / 60)
    const mm = normalized % 60
    const suffix = hh24 >= 12 ? "PM" : "AM"
    const hh12 = hh24 % 12 || 12

    return `${hh12}:${String(mm).padStart(2, "0")} ${suffix}`
}

function normalizeTimeInputToStorage(value: string) {
    const raw = str(value)
    if (!raw) return ""
    const match = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return raw
    const hh = Number(match[1])
    const mm = Number(match[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return raw
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

function scheduleScopeLabel(scope: RoomScheduleScope | "") {
    if (scope === "MORNING") return MORNING_LABEL
    if (scope === "AFTERNOON") return AFTERNOON_LABEL
    if (scope === "BOTH") return BOTH_LABEL
    return ""
}

function inferRoomScheduleScope(startTime: any, endTime: any): RoomScheduleScope | "" {
    const start = parsePrintableClockMinutes(startTime)
    const end = parsePrintableClockMinutes(endTime)

    if (!Number.isFinite(start) || !Number.isFinite(end)) return ""

    if (end <= MORNING_END_MINUTES) return "MORNING"
    if (start >= AFTERNOON_START_MINUTES) return "AFTERNOON"

    return "BOTH"
}

function resolveRoomScheduleScope(item: RoomSchedulePrintItem): RoomScheduleScope | "" {
    const raw = str(item.groupLabel).toLowerCase()

    if (
        raw.includes("combined") ||
        raw.includes("both") ||
        (raw.includes("morning") && raw.includes("afternoon"))
    ) {
        return "BOTH"
    }

    if (raw.includes("morning")) return "MORNING"
    if (raw.includes("afternoon")) return "AFTERNOON"

    return inferRoomScheduleScope(item.startTime, item.endTime)
}

function matchesRoomScheduleScope(item: RoomSchedulePrintItem, scheduleScope: RoomScheduleScope) {
    const itemScope = resolveRoomScheduleScope(item)

    if (!itemScope) return scheduleScope === "BOTH"
    if (scheduleScope === "BOTH") return true
    if (scheduleScope === "MORNING") {
        return itemScope === "MORNING" || itemScope === "BOTH"
    }

    return itemScope === "AFTERNOON" || itemScope === "BOTH"
}

function roomSchedulePeriodBadgeVariant(item: RoomSchedulePrintItem) {
    const scope = resolveRoomScheduleScope(item)

    if (scope === "MORNING") return "secondary" as const
    if (scope === "AFTERNOON") return "default" as const

    return "outline" as const
}

function academicTermLabel(term?: AcademicTermDocLite | null) {
    if (!term) return "Select academic term"
    return `${term.semester} • SY ${term.schoolYear}`
}

function sortTermsDesc(a: AcademicTermDocLite, b: AcademicTermDocLite) {
    const aKey = `${a.startDate}|${a.schoolYear}|${a.semester}`
    const bKey = `${b.startDate}|${b.schoolYear}|${b.semester}`
    return bKey.localeCompare(aKey)
}

function buildSectionLabel(section?: SectionLite | null) {
    if (!section) return ""
    const yearLevel = str(section.yearLevel)
    const name = str(section.name)
    if (yearLevel && name) return `${yearLevel}${name}`
    return yearLevel || name
}

function buildPrintablePeriodText(item: RoomSchedulePrintItem) {
    return scheduleScopeLabel(resolveRoomScheduleScope(item))
}

function buildPrintableSubjectLabel(item: RoomSchedulePrintItem) {
    const code = str(item.subjectCode)
    const title = str(item.subjectTitle)

    if (code && title) return `${code} — ${title}`
    return code || title || "—"
}

function buildPrintableSectionText(item: RoomSchedulePrintItem) {
    return str(item.sectionLabel) || "—"
}

function buildPrintableInstructorText(item: RoomSchedulePrintItem) {
    return str(item.facultyName) || "Unassigned Instructor"
}

function buildPrintableTimeText(item: RoomSchedulePrintItem) {
    const start = str(item.displayStartTime) || formatClockTo12Hour(item.startTime)
    const end = str(item.displayEndTime) || formatClockTo12Hour(item.endTime)

    if (start && end) return `${start} - ${end}`
    return `${str(item.startTime)} - ${str(item.endTime)}`
}

function buildPrintableItemIdentity(item: RoomSchedulePrintItem) {
    return (
        str(item.id) ||
        [
            normalizeDayLabel(item.dayOfWeek),
            normalizePrintableTimeTo24Hour(item.startTime),
            normalizePrintableTimeTo24Hour(item.endTime),
            str(item.subjectCode),
            str(item.subjectTitle),
            str(item.sectionLabel),
            str(item.facultyName),
            str(item.notes),
        ].join("|")
    )
}

function buildPrintableDuplicateKey(item: RoomSchedulePrintItem) {
    return [
        normalizeDayLabel(item.dayOfWeek).toLowerCase(),
        normalizePrintableTimeTo24Hour(item.startTime),
        normalizePrintableTimeTo24Hour(item.endTime),
        str(item.subjectCode).toLowerCase(),
        str(item.subjectTitle).toLowerCase(),
        str(item.sectionLabel).toLowerCase(),
        str(item.facultyName).toLowerCase(),
    ].join("|")
}

function comparePrintableItems(a: RoomSchedulePrintItem, b: RoomSchedulePrintItem) {
    const dayDiff =
        DAY_ORDER.indexOf(normalizeDayLabel(a.dayOfWeek) as (typeof DAY_ORDER)[number]) -
        DAY_ORDER.indexOf(normalizeDayLabel(b.dayOfWeek) as (typeof DAY_ORDER)[number])

    if (dayDiff !== 0) return dayDiff

    const startDiff = parsePrintableClockMinutes(a.startTime) - parsePrintableClockMinutes(b.startTime)
    if (startDiff !== 0) return startDiff

    const endDiff = parsePrintableClockMinutes(a.endTime) - parsePrintableClockMinutes(b.endTime)
    if (endDiff !== 0) return endDiff

    const subjectDiff = buildPrintableSubjectLabel(a).localeCompare(buildPrintableSubjectLabel(b))
    if (subjectDiff !== 0) return subjectDiff

    const sectionDiff = buildPrintableSectionText(a).localeCompare(buildPrintableSectionText(b))
    if (sectionDiff !== 0) return sectionDiff

    return buildPrintableItemIdentity(a).localeCompare(buildPrintableItemIdentity(b))
}

function isValidPrintableTimeRange(item: RoomSchedulePrintItem) {
    const start = parsePrintableClockMinutes(item.startTime)
    const end = parsePrintableClockMinutes(item.endTime)
    return Number.isFinite(start) && Number.isFinite(end) && end > start
}

function doPrintableItemsOverlap(a: RoomSchedulePrintItem, b: RoomSchedulePrintItem) {
    if (normalizeDayLabel(a.dayOfWeek) !== normalizeDayLabel(b.dayOfWeek)) return false

    const aStart = parsePrintableClockMinutes(a.startTime)
    const aEnd = parsePrintableClockMinutes(a.endTime)
    const bStart = parsePrintableClockMinutes(b.startTime)
    const bEnd = parsePrintableClockMinutes(b.endTime)

    if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return false
    return aStart < bEnd && bStart < aEnd
}

function buildPrintableConflictTitle(item: RoomSchedulePrintItem) {
    const subject = buildPrintableSubjectLabel(item)
    const section = buildPrintableSectionText(item)
    const instructor = buildPrintableInstructorText(item)

    return `${subject} • ${section} • ${instructor}`
}

function buildConflictSectionText(conflict: RoomScheduleConflict) {
    const sections = Array.from(
        new Set(
            [
                ...(conflict.keptItem ? [conflict.keptItem] : []),
                ...conflict.conflictingItems,
            ]
                .map((item) => buildPrintableSectionText(item))
                .filter((value) => value && value !== "—")
        )
    )

    return sections.length > 0 ? sections.join(", ") : "—"
}

function analyzePrintableScheduleConflicts(items: RoomSchedulePrintItem[]) {
    const sorted = [...items].sort(comparePrintableItems)
    const conflicts: RoomScheduleConflict[] = []

    const itemsByDay = new Map<string, RoomSchedulePrintItem[]>()
    for (const item of sorted) {
        const day = normalizeDayLabel(item.dayOfWeek)
        if (!itemsByDay.has(day)) {
            itemsByDay.set(day, [])
        }
        itemsByDay.get(day)?.push(item)
    }

    for (const [day, dayItems] of itemsByDay.entries()) {
        const invalidItems = dayItems.filter((item) => !isValidPrintableTimeRange(item))
        for (const item of invalidItems) {
            conflicts.push({
                id: `invalid-${buildPrintableItemIdentity(item)}`,
                type: "INVALID_TIME",
                dayOfWeek: day,
                displayTime: buildPrintableTimeText(item),
                keptItem: null,
                conflictingItems: [item],
            })
        }

        const validItems = dayItems.filter(isValidPrintableTimeRange)

        const duplicateBuckets = new Map<string, RoomSchedulePrintItem[]>()
        for (const item of validItems) {
            const key = buildPrintableDuplicateKey(item)
            if (!duplicateBuckets.has(key)) {
                duplicateBuckets.set(key, [])
            }
            duplicateBuckets.get(key)?.push(item)
        }

        for (const bucket of duplicateBuckets.values()) {
            if (bucket.length <= 1) continue
            const [keptItem, ...duplicateItems] = bucket
            if (!keptItem) continue

            conflicts.push({
                id: `duplicate-${buildPrintableItemIdentity(keptItem)}`,
                type: "DUPLICATE",
                dayOfWeek: day,
                displayTime: buildPrintableTimeText(keptItem),
                keptItem,
                conflictingItems: duplicateItems,
            })
        }

        const overlapChecked = new Set<string>()
        for (let i = 0; i < validItems.length; i += 1) {
            for (let j = i + 1; j < validItems.length; j += 1) {
                const a = validItems[i]
                const b = validItems[j]
                if (!a || !b) continue
                if (!doPrintableItemsOverlap(a, b)) continue

                const pairKey = [buildPrintableItemIdentity(a), buildPrintableItemIdentity(b)]
                    .sort()
                    .join("::")

                if (overlapChecked.has(pairKey)) continue
                overlapChecked.add(pairKey)

                conflicts.push({
                    id: `overlap-${pairKey}`,
                    type: "OVERLAP",
                    dayOfWeek: day,
                    displayTime: `${buildPrintableTimeText(a)} / ${buildPrintableTimeText(b)}`,
                    keptItem: a,
                    conflictingItems: [b],
                })
            }
        }
    }

    return {
        conflicts,
        totalConflicts: conflicts.length,
        hasConflicts: conflicts.length > 0,
    }
}

function choosePreferredVersions(versions: ScheduleVersionLite[]) {
    const byDepartment = new Map<string, ScheduleVersionLite[]>()

    for (const version of versions) {
        const departmentId = str(version.departmentId) || "__unknown__"
        if (!byDepartment.has(departmentId)) {
            byDepartment.set(departmentId, [])
        }
        byDepartment.get(departmentId)?.push(version)
    }

    const statusRank = (status: string) => {
        const value = str(status).toLowerCase()
        if (value === "active") return 0
        if (value === "locked") return 1
        if (value === "draft") return 2
        if (value === "archived") return 3
        return 9
    }

    const selected: ScheduleVersionLite[] = []

    for (const entry of byDepartment.values()) {
        entry.sort((a, b) => {
            const statusDiff = statusRank(a.status) - statusRank(b.status)
            if (statusDiff !== 0) return statusDiff
            return num(b.version, 0) - num(a.version, 0)
        })

        if (entry[0]) {
            selected.push(entry[0])
        }
    }

    return selected
}

function chunkValues<T>(values: T[], size = 100) {
    const chunks: T[][] = []
    for (let i = 0; i < values.length; i += size) {
        chunks.push(values.slice(i, i + size))
    }
    return chunks
}

async function listDocs(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

async function listDocsByField(
    collectionId: string,
    field: string,
    values: string[],
    extraQueries: any[] = []
) {
    const ids = Array.from(new Set(values.map((value) => str(value)).filter(Boolean)))
    if (ids.length === 0) return [] as any[]

    const parts = chunkValues(ids, 100)
    const results: any[] = []

    for (const part of parts) {
        const docs = await listDocs(collectionId, [
            Query.equal(field, part),
            Query.limit(5000),
            ...extraQueries,
        ])
        results.push(...docs)
    }

    return results
}

async function fetchPreferredTermVersionIds(termId: string) {
    const versionDocs = (await listDocs(COLLECTIONS.SCHEDULE_VERSIONS, [
        Query.equal("termId", termId),
        Query.limit(5000),
    ])) as any[]

    const preferredVersions = choosePreferredVersions(
        versionDocs.map(
            (version: any) =>
                ({
                    $id: version.$id,
                    termId: str(version.termId),
                    departmentId: str(version.departmentId),
                    version: num(version.version, 0),
                    label: version.label ?? null,
                    status: str(version.status),
                }) as ScheduleVersionLite
        )
    )

    return preferredVersions.map((version) => version.$id).filter(Boolean)
}

async function fetchMeetingsForVersionIds(versionIds: string[]) {
    const meetingDocs = (await listDocsByField(COLLECTIONS.CLASS_MEETINGS, "versionId", versionIds)) as any[]

    return meetingDocs.map(
        (meeting: any) =>
            ({
                $id: meeting.$id,
                versionId: str(meeting.versionId),
                classId: str(meeting.classId),
                dayOfWeek: normalizeDayLabel(meeting.dayOfWeek),
                startTime: str(meeting.startTime),
                endTime: str(meeting.endTime),
                roomId: meeting.roomId ? str(meeting.roomId) : null,
                meetingType: meeting.meetingType ? str(meeting.meetingType) : null,
                notes: meeting.notes ? str(meeting.notes) : null,
            }) as ClassMeetingLite
    )
}

async function findAvailableRoomsForMeeting(params: {
    termId: string
    meetingId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    preferredRoomType?: string | null
}) {
    const termId = str(params.termId)
    if (!termId) return [] as RoomDoc[]

    const [allRoomsDocs, versionIds] = await Promise.all([
        listDocs(COLLECTIONS.ROOMS, [Query.orderAsc("code"), Query.limit(5000)]),
        fetchPreferredTermVersionIds(termId),
    ])

    const rooms = allRoomsDocs
        .map(
            (r: any) =>
                ({
                    $id: r.$id,
                    code: str(r.code),
                    name: r.name ?? null,
                    building: r.building ?? null,
                    floor: r.floor ?? null,
                    capacity: num(r.capacity, 0),
                    type: str(r.type) || "OTHER",
                    isActive: toBool(r.isActive),
                }) as RoomDoc
        )
        .filter((room) => room.isActive)

    const allMeetings = versionIds.length > 0 ? await fetchMeetingsForVersionIds(versionIds) : []

    const normalizedDay = normalizeDayLabel(params.dayOfWeek)
    const candidateStart = parseClockMinutes(params.startTime)
    const candidateEnd = parseClockMinutes(params.endTime)
    const preferredType = str(params.preferredRoomType).toUpperCase()

    const matchesType = (room: RoomDoc) => {
        if (!preferredType || preferredType === "OTHER") return true
        if (preferredType === "LECTURE") return str(room.type).toUpperCase() !== "LAB"
        return str(room.type).toUpperCase() === preferredType
    }

    return rooms.filter((room) => {
        if (!matchesType(room)) return false

        const roomMeetings = allMeetings.filter(
            (meeting) => str(meeting.roomId) === room.$id && str(meeting.$id) !== str(params.meetingId)
        )

        const hasConflict = roomMeetings.some((meeting) => {
            if (normalizeDayLabel(meeting.dayOfWeek) !== normalizedDay) return false

            const start = parseClockMinutes(meeting.startTime)
            const end = parseClockMinutes(meeting.endTime)

            if (![start, end, candidateStart, candidateEnd].every(Number.isFinite)) return true
            return candidateStart < end && start < candidateEnd
        })

        return !hasConflict
    })
}

async function fetchRoomPrintableSchedule(params: {
    roomId: string
    termId: string
}) {
    const roomId = str(params.roomId)
    const termId = str(params.termId)

    if (!roomId || !termId) return [] as RoomSchedulePrintItem[]

    const versionIds = await fetchPreferredTermVersionIds(termId)
    if (versionIds.length === 0) {
        return [] as RoomSchedulePrintItem[]
    }

    const meetingDocs = (await listDocsByField(
        COLLECTIONS.CLASS_MEETINGS,
        "versionId",
        versionIds,
        [Query.equal("roomId", roomId)]
    )) as any[]

    const meetings = meetingDocs.map(
        (meeting: any) =>
            ({
                $id: meeting.$id,
                versionId: str(meeting.versionId),
                classId: str(meeting.classId),
                dayOfWeek: normalizeDayLabel(meeting.dayOfWeek),
                startTime: str(meeting.startTime),
                endTime: str(meeting.endTime),
                roomId: meeting.roomId ? str(meeting.roomId) : null,
                meetingType: meeting.meetingType ? str(meeting.meetingType) : null,
                notes: meeting.notes ? str(meeting.notes) : null,
            }) as ClassMeetingLite
    )

    const classIds = meetings.map((meeting) => meeting.classId).filter(Boolean)
    const classDocs = (await listDocsByField(COLLECTIONS.CLASSES, "$id", classIds)) as any[]
    const classes = classDocs.map(
        (klass: any) =>
            ({
                $id: klass.$id,
                sectionId: str(klass.sectionId),
                subjectId: str(klass.subjectId),
                facultyUserId: klass.facultyUserId ? str(klass.facultyUserId) : null,
                classCode: klass.classCode ? str(klass.classCode) : null,
                deliveryMode: klass.deliveryMode ? str(klass.deliveryMode) : null,
                status: klass.status ? str(klass.status) : null,
                remarks: klass.remarks ? str(klass.remarks) : null,
            }) as ClassLite
    )

    const classById = new Map(classes.map((klass) => [klass.$id, klass]))

    const subjectIds = classes.map((klass) => klass.subjectId).filter(Boolean)
    const sectionIds = classes.map((klass) => klass.sectionId).filter(Boolean)
    const facultyLookupValues = classes.map((klass) => str(klass.facultyUserId)).filter(Boolean)

    const [subjectDocs, sectionDocs, userDocsByUserId, userDocsByProfileId] = await Promise.all([
        listDocsByField(COLLECTIONS.SUBJECTS, "$id", subjectIds),
        listDocsByField(COLLECTIONS.SECTIONS, "$id", sectionIds),
        listDocsByField(COLLECTIONS.USER_PROFILES, "userId", facultyLookupValues),
        listDocsByField(COLLECTIONS.USER_PROFILES, "$id", facultyLookupValues),
    ])

    const subjectById = new Map<string, SubjectLite>(
        subjectDocs.map((subject: any) => [
            subject.$id,
            {
                $id: subject.$id,
                code: str(subject.code),
                title: str(subject.title),
            } as SubjectLite,
        ])
    )

    const sectionById = new Map<string, SectionLite>(
        sectionDocs.map((section: any) => [
            section.$id,
            {
                $id: section.$id,
                yearLevel: str(section.yearLevel),
                name: str(section.name),
            } as SectionLite,
        ])
    )

    const facultyByLookupId = new Map<string, UserProfileLite>()
    for (const user of [...userDocsByUserId, ...userDocsByProfileId]) {
        const profile = {
            $id: str(user.$id),
            userId: str(user.userId),
            name: user.name ? str(user.name) : null,
            email: user.email ? str(user.email) : null,
        } as UserProfileLite

        if (profile.$id) {
            facultyByLookupId.set(profile.$id, profile)
        }

        if (profile.userId) {
            facultyByLookupId.set(profile.userId, profile)
        }
    }

    const printableItems = meetings.map((meeting) => {
        const klass = classById.get(meeting.classId)
        const subject = klass ? subjectById.get(klass.subjectId) : null
        const section = klass ? sectionById.get(klass.sectionId) : null
        const faculty =
            klass && klass.facultyUserId ? facultyByLookupId.get(str(klass.facultyUserId)) : null

        const { normalizedStartTime, normalizedEndTime } = normalizePrintableTimeRangeTo24Hour(
            meeting.startTime,
            meeting.endTime
        )

        const facultyName = str(faculty?.name) || str(faculty?.email) || "Unassigned Instructor"
        const subjectCode = str(subject?.code)
        const subjectTitle = str(subject?.title)
        const sectionLabel = buildSectionLabel(section)
        const scheduleScope = inferRoomScheduleScope(normalizedStartTime, normalizedEndTime)
        const periodLabel = scheduleScopeLabel(scheduleScope)
        const displayStartTime = formatClockTo12Hour(normalizedStartTime)
        const displayEndTime = formatClockTo12Hour(normalizedEndTime)

        const lineTwoParts = [subjectCode, sectionLabel].filter(Boolean)
        const lineThree = subjectTitle || str(klass?.classCode)

        const contentLines = [periodLabel, facultyName, lineTwoParts.join(" - "), lineThree].filter(Boolean)

        return {
            id: meeting.$id,
            dayOfWeek: meeting.dayOfWeek,
            startTime: normalizedStartTime,
            endTime: normalizedEndTime,
            displayStartTime,
            displayEndTime,
            facultyName,
            subjectCode: subjectCode || null,
            subjectTitle: subjectTitle || null,
            sectionLabel: sectionLabel || null,
            notes: meeting.notes || null,
            groupLabel: periodLabel || null,
            contentLines,
        } as RoomSchedulePrintItem
    })

    printableItems.sort(comparePrintableItems)

    return printableItems
}

export default function AdminRoomsAndFacilitiesPage() {
    const [loading, setLoading] = React.useState(true)

    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDocLite[]>([])

    const [search, setSearch] = React.useState("")
    const [typeFilter, setTypeFilter] = React.useState<RoomTypeFilter>("ALL")
    const [onlyAvailable, setOnlyAvailable] = React.useState(false)

    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [editing, setEditing] = React.useState<RoomDoc | null>(null)

    const [roomCode, setRoomCode] = React.useState("")
    const [roomName, setRoomName] = React.useState("")
    const [roomBuilding, setRoomBuilding] = React.useState("")
    const [roomFloor, setRoomFloor] = React.useState("")
    const [roomCapacity, setRoomCapacity] = React.useState("30")
    const [roomType, setRoomType] = React.useState("LECTURE")
    const [roomAvailable, setRoomAvailable] = React.useState(true)

    const [deleteRoom, setDeleteRoom] = React.useState<RoomDoc | null>(null)

    const [printRoomId, setPrintRoomId] = React.useState("")
    const [printTermId, setPrintTermId] = React.useState("")
    const [printScope, setPrintScope] = React.useState<RoomScheduleScope>("BOTH")
    const [scheduleBusy, setScheduleBusy] = React.useState(false)
    const [printItems, setPrintItems] = React.useState<RoomSchedulePrintItem[]>([])

    const [fixDialogOpen, setFixDialogOpen] = React.useState(false)
    const [fixBusy, setFixBusy] = React.useState(false)
    const [availableRoomBusy, setAvailableRoomBusy] = React.useState(false)
    const [fixTargetItem, setFixTargetItem] = React.useState<RoomSchedulePrintItem | null>(null)
    const [fixAction, setFixAction] = React.useState<ConflictFixAction>("MOVE_ROOM")
    const [fixDayOfWeek, setFixDayOfWeek] = React.useState("Monday")
    const [fixStartTime, setFixStartTime] = React.useState("08:00")
    const [fixEndTime, setFixEndTime] = React.useState("09:00")
    const [fixRoomId, setFixRoomId] = React.useState("")
    const [availableRoomsForFix, setAvailableRoomsForFix] = React.useState<RoomDoc[]>([])
    const [createRoomCode, setCreateRoomCode] = React.useState("")
    const [createRoomName, setCreateRoomName] = React.useState("")
    const [createRoomBuilding, setCreateRoomBuilding] = React.useState("")
    const [createRoomFloor, setCreateRoomFloor] = React.useState("")
    const [createRoomCapacity, setCreateRoomCapacity] = React.useState("30")
    const [createRoomType, setCreateRoomType] = React.useState("LECTURE")

    const refreshRooms = React.useCallback(async () => {
        setLoading(true)
        try {
            const [roomDocs, termDocs] = await Promise.all([
                listDocs(COLLECTIONS.ROOMS, [Query.orderAsc("code"), Query.limit(2000)]),
                listDocs(COLLECTIONS.ACADEMIC_TERMS, [Query.orderDesc("startDate"), Query.limit(200)]),
            ])

            const nextRooms = roomDocs.map(
                (r: any) =>
                    ({
                        $id: r.$id,
                        code: str(r.code),
                        name: r.name ?? null,
                        building: r.building ?? null,
                        floor: r.floor ?? null,
                        capacity: num(r.capacity, 0),
                        type: str(r.type) || "OTHER",
                        isActive: toBool(r.isActive),
                    }) as RoomDoc
            )

            const nextTerms = termDocs
                .map(
                    (t: any) =>
                        ({
                            $id: t.$id,
                            schoolYear: str(t.schoolYear),
                            semester: str(t.semester),
                            startDate: str(t.startDate),
                            endDate: str(t.endDate),
                            isActive: toBool(t.isActive),
                            isLocked: toBool(t.isLocked),
                        }) as AcademicTermDocLite
                )
                .sort(sortTermsDesc)

            setRooms(nextRooms)
            setTerms(nextTerms)

            setPrintRoomId((current) => {
                if (current && nextRooms.some((room) => room.$id === current)) return current
                return nextRooms[0]?.$id ?? ""
            })

            setPrintTermId((current) => {
                if (current && nextTerms.some((term) => term.$id === current)) return current
                return nextTerms.find((term) => term.isActive)?.$id ?? nextTerms[0]?.$id ?? ""
            })
        } catch (e: any) {
            toast.error(e?.message || "Failed to load rooms.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void refreshRooms()
    }, [refreshRooms])

    React.useEffect(() => {
        if (!dialogOpen) return

        if (!editing) {
            setRoomCode("")
            setRoomName("")
            setRoomBuilding("")
            setRoomFloor("")
            setRoomCapacity("30")
            setRoomType("LECTURE")
            setRoomAvailable(true)
            return
        }

        setRoomCode(editing.code)
        setRoomName(String(editing.name ?? ""))
        setRoomBuilding(String(editing.building ?? ""))
        setRoomFloor(String(editing.floor ?? ""))
        setRoomCapacity(String(editing.capacity ?? 0))
        setRoomType(String(editing.type ?? "OTHER"))
        setRoomAvailable(Boolean(editing.isActive))
    }, [dialogOpen, editing])

    const loadPrintableSchedule = React.useCallback(async () => {
        const roomId = str(printRoomId)
        const termId = str(printTermId)

        if (!roomId || !termId) {
            setPrintItems([])
            return
        }

        setScheduleBusy(true)
        try {
            const nextItems = await fetchRoomPrintableSchedule({ roomId, termId })
            setPrintItems(nextItems)
        } catch (e: any) {
            setPrintItems([])
            toast.error(e?.message || "Failed to load room schedule print data.")
        } finally {
            setScheduleBusy(false)
        }
    }, [printRoomId, printTermId])

    React.useEffect(() => {
        void loadPrintableSchedule()
    }, [loadPrintableSchedule])

    async function saveRoom() {
        const payload: any = {
            code: str(roomCode),
            name: str(roomName) || null,
            building: str(roomBuilding) || null,
            floor: str(roomFloor) || null,
            capacity: num(roomCapacity, 0),
            type: str(roomType) || "OTHER",
            isActive: Boolean(roomAvailable),
        }

        if (!payload.code) {
            toast.error("Room code is required.")
            return
        }

        if (!Number.isFinite(payload.capacity) || payload.capacity <= 0) {
            toast.error("Capacity must be a valid number greater than 0.")
            return
        }

        try {
            if (editing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROOMS, editing.$id, payload)
                toast.success("Room updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.ROOMS, ID.unique(), payload)
                toast.success("Room created.")
            }

            setDialogOpen(false)
            setEditing(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save room.")
        }
    }

    async function confirmDelete() {
        if (!deleteRoom) return
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ROOMS, deleteRoom.$id)
            toast.success("Room deleted.")
            setDeleteRoom(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete room.")
        }
    }

    const selectedPrintRoom = React.useMemo(
        () => rooms.find((room) => room.$id === printRoomId) ?? null,
        [rooms, printRoomId]
    )

    const selectedPrintTerm = React.useMemo(
        () => terms.find((term) => term.$id === printTermId) ?? null,
        [terms, printTermId]
    )

    const printableScheduleAnalysis = React.useMemo(
        () => analyzePrintableScheduleConflicts(printItems),
        [printItems]
    )

    const filteredPrintItems = React.useMemo(
        () => printItems.filter((item) => matchesRoomScheduleScope(item, printScope)),
        [printItems, printScope]
    )

    const uniquePrintInstructors = React.useMemo(
        () =>
            Array.from(
                new Set(filteredPrintItems.map((item) => buildPrintableInstructorText(item)).filter(Boolean))
            ),
        [filteredPrintItems]
    )

    const uniquePrintPeriods = React.useMemo(
        () =>
            Array.from(
                new Set(filteredPrintItems.map((item) => buildPrintablePeriodText(item)).filter(Boolean))
            ),
        [filteredPrintItems]
    )

    const visibleConflicts = React.useMemo(
        () =>
            printableScheduleAnalysis.conflicts.filter((conflict) => {
                const itemsToCheck = conflict.keptItem
                    ? [conflict.keptItem, ...conflict.conflictingItems]
                    : conflict.conflictingItems

                return itemsToCheck.some((item) => {
                    const scope = resolveRoomScheduleScope(item)
                    if (!scope && conflict.type === "INVALID_TIME") return true
                    return matchesRoomScheduleScope(item, printScope)
                })
            }),
        [printScope, printableScheduleAnalysis.conflicts]
    )

    const q = search.trim().toLowerCase()

    const filteredRooms = React.useMemo(() => {
        let list = rooms

        if (typeFilter !== "ALL") {
            list = list.filter((r) => String(r.type || "").toUpperCase() === typeFilter)
        }

        if (onlyAvailable) {
            list = list.filter((r) => Boolean(r.isActive))
        }

        if (!q) return list

        return list.filter((r) => {
            const info = `${r.code} ${r.name ?? ""} ${r.building ?? ""} ${r.floor ?? ""} ${r.type}`
            return info.toLowerCase().includes(q)
        })
    }, [rooms, q, typeFilter, onlyAvailable])

    const total = rooms.length
    const availableCount = rooms.filter((r) => r.isActive).length
    const labs = rooms.filter((r) => String(r.type || "").toUpperCase() === "LAB").length
    const lectures = rooms.filter((r) => String(r.type || "").toUpperCase() === "LECTURE").length

    const refreshAvailableRoomsForFix = React.useCallback(
        async (params?: {
            targetItem?: RoomSchedulePrintItem | null
            nextDay?: string
            nextStart?: string
            nextEnd?: string
        }) => {
            const targetItem = params?.targetItem ?? fixTargetItem
            const dayValue = params?.nextDay ?? fixDayOfWeek
            const startValue = params?.nextStart ?? fixStartTime
            const endValue = params?.nextEnd ?? fixEndTime

            if (!targetItem || !printTermId) {
                setAvailableRoomsForFix([])
                setFixRoomId("")
                return
            }

            setAvailableRoomBusy(true)
            try {
                const roomsFound = await findAvailableRoomsForMeeting({
                    termId: printTermId,
                    meetingId: str(targetItem.id),
                    dayOfWeek: dayValue,
                    startTime: startValue,
                    endTime: endValue,
                    preferredRoomType: str(targetItem.notes).toUpperCase().includes("LAB")
                        ? "LAB"
                        : "LECTURE",
                })

                setAvailableRoomsForFix(roomsFound)
                setFixRoomId((current) => {
                    if (current && roomsFound.some((room) => room.$id === current)) return current
                    return roomsFound[0]?.$id ?? ""
                })
            } catch (e: any) {
                setAvailableRoomsForFix([])
                setFixRoomId("")
                toast.error(e?.message || "Failed to load available rooms.")
            } finally {
                setAvailableRoomBusy(false)
            }
        },
        [fixDayOfWeek, fixEndTime, fixStartTime, fixTargetItem, printTermId]
    )

    function openConflictFixDialog(item: RoomSchedulePrintItem) {
        const normalizedStart = normalizeTimeInputToStorage(str(item.startTime)) || "08:00"
        const normalizedEnd = normalizeTimeInputToStorage(str(item.endTime)) || "09:00"
        const inferredType =
            str(item.notes).toUpperCase().includes("LAB") ||
            str(item.subjectTitle).toUpperCase().includes("LAB")
                ? "LAB"
                : "LECTURE"

        setFixTargetItem(item)
        setFixAction("MOVE_ROOM")
        setFixDayOfWeek(normalizeDayLabel(item.dayOfWeek) || "Monday")
        setFixStartTime(normalizedStart)
        setFixEndTime(normalizedEnd)
        setCreateRoomCode("")
        setCreateRoomName("")
        setCreateRoomBuilding("")
        setCreateRoomFloor("")
        setCreateRoomCapacity("30")
        setCreateRoomType(inferredType)
        setAvailableRoomsForFix([])
        setFixRoomId("")
        setFixDialogOpen(true)

        void refreshAvailableRoomsForFix({
            targetItem: item,
            nextDay: normalizeDayLabel(item.dayOfWeek) || "Monday",
            nextStart: normalizedStart,
            nextEnd: normalizedEnd,
        })
    }

    React.useEffect(() => {
        if (!fixDialogOpen || !fixTargetItem) return
        if (fixAction !== "MOVE_ROOM") return

        void refreshAvailableRoomsForFix()
    }, [
        fixAction,
        fixDayOfWeek,
        fixDialogOpen,
        fixEndTime,
        fixStartTime,
        fixTargetItem,
        refreshAvailableRoomsForFix,
    ])

    async function applyConflictFix() {
        if (!fixTargetItem?.id) {
            toast.error("No conflicting schedule selected.")
            return
        }

        const meetingId = str(fixTargetItem.id)

        if (fixAction === "RESCHEDULE") {
            const normalizedStart = normalizeTimeInputToStorage(fixStartTime)
            const normalizedEnd = normalizeTimeInputToStorage(fixEndTime)
            const startMinutes = parseClockMinutes(normalizedStart)
            const endMinutes = parseClockMinutes(normalizedEnd)

            if (!fixDayOfWeek) {
                toast.error("Day is required.")
                return
            }

            if (!normalizedStart || !normalizedEnd) {
                toast.error("Start time and end time are required.")
                return
            }

            if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
                toast.error("Please provide a valid schedule range.")
                return
            }

            setFixBusy(true)
            try {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meetingId, {
                    dayOfWeek: fixDayOfWeek,
                    startTime: normalizedStart,
                    endTime: normalizedEnd,
                })
                toast.success("Conflicted schedule updated.")
                setFixDialogOpen(false)
                await loadPrintableSchedule()
            } catch (e: any) {
                toast.error(e?.message || "Failed to update conflicted schedule.")
            } finally {
                setFixBusy(false)
            }
            return
        }

        if (fixAction === "MOVE_ROOM") {
            if (!fixRoomId) {
                toast.error("Select an available room first.")
                return
            }

            setFixBusy(true)
            try {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meetingId, {
                    roomId: fixRoomId,
                })
                toast.success("Conflicted schedule moved to another available room.")
                setFixDialogOpen(false)
                await Promise.all([refreshRooms(), loadPrintableSchedule()])
            } catch (e: any) {
                toast.error(e?.message || "Failed to move schedule to another room.")
            } finally {
                setFixBusy(false)
            }
            return
        }

        const newRoomPayload = {
            code: str(createRoomCode),
            name: str(createRoomName) || null,
            building: str(createRoomBuilding) || null,
            floor: str(createRoomFloor) || null,
            capacity: num(createRoomCapacity, 0),
            type: str(createRoomType) || "OTHER",
            isActive: true,
        }

        if (!newRoomPayload.code) {
            toast.error("New room code is required.")
            return
        }

        if (!Number.isFinite(newRoomPayload.capacity) || newRoomPayload.capacity <= 0) {
            toast.error("New room capacity must be greater than 0.")
            return
        }

        setFixBusy(true)
        try {
            const createdRoom = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.ROOMS,
                ID.unique(),
                newRoomPayload
            )

            await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meetingId, {
                roomId: str(createdRoom?.$id),
            })

            toast.success("New room created and conflict moved to it.")
            setFixDialogOpen(false)
            await Promise.all([refreshRooms(), loadPrintableSchedule()])
        } catch (e: any) {
            toast.error(e?.message || "Failed to create a new room for the conflict.")
        } finally {
            setFixBusy(false)
        }
    }

    return (
        <DashboardLayout
            title="Rooms & Facilities"
            subtitle="Add or update rooms, manage availability, detect schedule conflicts, fix them, and export the official room monitoring sheet."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refreshRooms()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Room
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 p-6">
                <Alert>
                    <AlertTitle className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" />
                        Rooms & Facilities
                    </AlertTitle>
                    <AlertDescription>
                        Rooms are used in schedules and validations. Mark rooms as{" "}
                        <span className="font-medium">Available</span> to include them in assignments.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{total}</div>
                            <Badge variant="secondary">Total</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Available</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{availableCount}</div>
                            <Badge>Active</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Labs</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{labs}</div>
                            <Badge variant="outline">LAB</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Lecture Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{lectures}</div>
                            <Badge variant="secondary">LECTURE</Badge>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Printer className="h-4 w-4" />
                                    Room Schedule Print Sheet
                                </CardTitle>
                                <CardDescription>
                                    Preview and export a room monitoring sheet for Morning, Afternoon,
                                    or combined Morning & Afternoon schedules.
                                </CardDescription>
                            </div>

                            <div className="flex w-full min-w-0 flex-col gap-3 lg:max-w-4xl">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-room">Room</Label>
                                        <Select value={printRoomId} onValueChange={setPrintRoomId}>
                                            <SelectTrigger
                                                id="print-room"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select room" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rooms.map((room) => (
                                                    <SelectItem key={room.$id} value={room.$id}>
                                                        {displayRoomSubLabel(room)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-term">Academic Term</Label>
                                        <Select value={printTermId} onValueChange={setPrintTermId}>
                                            <SelectTrigger
                                                id="print-term"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select academic term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {terms.map((term) => (
                                                    <SelectItem key={term.$id} value={term.$id}>
                                                        {academicTermLabel(term)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-scope">Schedule</Label>
                                        <Select
                                            value={printScope}
                                            onValueChange={(value) =>
                                                setPrintScope(value as RoomScheduleScope)
                                            }
                                        >
                                            <SelectTrigger
                                                id="print-scope"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select schedule" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MORNING">{MORNING_LABEL}</SelectItem>
                                                <SelectItem value="AFTERNOON">{AFTERNOON_LABEL}</SelectItem>
                                                <SelectItem value="BOTH">{BOTH_LABEL}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {selectedPrintRoom
                                            ? displayRoomSubLabel(selectedPrintRoom)
                                            : "No room selected"}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {selectedPrintTerm
                                            ? academicTermLabel(selectedPrintTerm)
                                            : "No term selected"}
                                    </Badge>
                                    <Badge variant="outline">{scheduleScopeLabel(printScope)}</Badge>
                                    <Badge variant="outline">
                                        {filteredPrintItems.length} schedule block
                                        {filteredPrintItems.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge variant="outline">
                                        {uniquePrintInstructors.length} instructor
                                        {uniquePrintInstructors.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge
                                        variant={visibleConflicts.length > 0 ? "destructive" : "outline"}
                                    >
                                        {visibleConflicts.length} conflict
                                        {visibleConflicts.length === 1 ? "" : "s"}
                                    </Badge>
                                    {uniquePrintPeriods.length > 0 ? (
                                        <Badge variant="outline">{uniquePrintPeriods.join(" • ")}</Badge>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadPrintableSchedule()}
                                    disabled={scheduleBusy || !printRoomId || !printTermId}
                                >
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Refresh Schedule Data
                                </Button>

                                <RoomSchedulePrintSheet
                                    roomLabel={displayRoomLabel(selectedPrintRoom)}
                                    items={printItems}
                                    schoolYear={selectedPrintTerm?.schoolYear ?? ""}
                                    semester={selectedPrintTerm?.semester ?? ""}
                                    timeSlots={[...DEFAULT_PRINT_TIME_SLOTS]}
                                    scheduleScope={printScope}
                                    disabled={scheduleBusy || !printRoomId || !printTermId}
                                />
                            </div>
                        </div>

                        {scheduleBusy ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                                {visibleConflicts.length > 0 ? (
                                    <Alert>
                                        <AlertTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            Room schedule conflicts detected
                                        </AlertTitle>
                                        <AlertDescription>
                                            Found {visibleConflicts.length} conflict
                                            {visibleConflicts.length === 1 ? "" : "s"}. Conflicts are
                                            kept visible. Use the conflict fixer below to update the
                                            schedule, transfer the meeting to an available room, or create
                                            a new room when needed.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert>
                                        <AlertTitle className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            No room schedule conflicts detected
                                        </AlertTitle>
                                        <AlertDescription>
                                            The selected room schedule has no invalid, duplicate, or
                                            overlapping schedule blocks for the current filter.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {visibleConflicts.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="text-sm font-medium">
                                            Conflict detector and fixer
                                        </div>

                                        <div className="overflow-x-auto rounded-md border bg-background">
                                            <Table className={CONFLICT_TABLE_CLASS}>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-28">Type</TableHead>
                                                        <TableHead className="w-28">Day</TableHead>
                                                        <TableHead className="w-44">Time</TableHead>
                                                        <TableHead className="w-40">Section</TableHead>
                                                        <TableHead className="w-72">Kept Entry</TableHead>
                                                        <TableHead className="w-90">
                                                            Conflicting Entries
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {visibleConflicts.map((conflict) => (
                                                        <TableRow key={conflict.id}>
                                                            <TableCell className="align-top">
                                                                <Badge
                                                                    variant={
                                                                        conflict.type === "OVERLAP"
                                                                            ? "destructive"
                                                                            : conflict.type ===
                                                                                "DUPLICATE"
                                                                              ? "secondary"
                                                                              : "outline"
                                                                    }
                                                                >
                                                                    {conflict.type === "INVALID_TIME"
                                                                        ? "Invalid Time"
                                                                        : conflict.type === "DUPLICATE"
                                                                          ? "Duplicate"
                                                                          : "Overlap"}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell className="align-top font-medium">
                                                                {conflict.dayOfWeek}
                                                            </TableCell>

                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className={WRAP_TEXT_CLASS}>
                                                                    {conflict.displayTime}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className={WRAP_TEXT_CLASS}>
                                                                    {buildConflictSectionText(conflict)}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="align-top">
                                                                {conflict.keptItem ? (
                                                                    <div className="space-y-2">
                                                                        <div className="space-y-1">
                                                                            <div
                                                                                className={`font-medium ${WRAP_TEXT_CLASS}`}
                                                                            >
                                                                                {buildPrintableConflictTitle(
                                                                                    conflict.keptItem
                                                                                )}
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {buildPrintableTimeText(
                                                                                    conflict.keptItem
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                openConflictFixDialog(
                                                                                    conflict.keptItem as RoomSchedulePrintItem
                                                                                )
                                                                            }
                                                                        >
                                                                            <Wrench className="mr-2 h-4 w-4" />
                                                                            Fix This Entry
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-muted-foreground">
                                                                        No printable entry kept
                                                                    </div>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="align-top">
                                                                <div className="space-y-2">
                                                                    {conflict.conflictingItems.map((item) => (
                                                                        <div
                                                                            key={buildPrintableItemIdentity(item)}
                                                                            className="rounded-md border bg-muted/30 p-2"
                                                                        >
                                                                            <div
                                                                                className={`text-sm font-medium ${WRAP_TEXT_CLASS}`}
                                                                            >
                                                                                {buildPrintableConflictTitle(item)}
                                                                            </div>
                                                                            <div className="mb-2 text-xs text-muted-foreground">
                                                                                {buildPrintableTimeText(item)}
                                                                            </div>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    openConflictFixDialog(item)
                                                                                }
                                                                            >
                                                                                <Wrench className="mr-2 h-4 w-4" />
                                                                                Fix This Entry
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                ) : null}

                                {filteredPrintItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm font-medium">
                                                Loaded printable schedule data
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto rounded-md border bg-background">
                                            <Table className="min-w-270 table-fixed">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-40">Period</TableHead>
                                                        <TableHead className="w-36">Day</TableHead>
                                                        <TableHead className="w-48">Time</TableHead>
                                                        <TableHead>Instructor</TableHead>
                                                        <TableHead>Subject</TableHead>
                                                        <TableHead className="w-28">Section</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredPrintItems.map((item) => (
                                                        <TableRow
                                                            key={
                                                                item.id ||
                                                                `${item.dayOfWeek}-${item.startTime}-${item.endTime}`
                                                            }
                                                        >
                                                            <TableCell className="align-top">
                                                                <Badge variant={roomSchedulePeriodBadgeVariant(item)}>
                                                                    {buildPrintablePeriodText(item)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="align-top font-medium">
                                                                {normalizeDayLabel(item.dayOfWeek)}
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className={WRAP_TEXT_CLASS}>
                                                                    {buildPrintableTimeText(item)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="space-y-1">
                                                                    <div
                                                                        className={`font-medium ${WRAP_TEXT_CLASS}`}
                                                                    >
                                                                        {buildPrintableInstructorText(item)}
                                                                    </div>
                                                                    {str(item.notes) ? (
                                                                        <div
                                                                            className={`text-xs text-muted-foreground ${WRAP_TEXT_CLASS}`}
                                                                        >
                                                                            {str(item.notes)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className={WRAP_TEXT_CLASS}>
                                                                    {buildPrintableSubjectLabel(item)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className={WRAP_TEXT_CLASS}>
                                                                    {buildPrintableSectionText(item)}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">
                                        No scheduled classes were found for the selected room, academic term,
                                        and schedule. You can refresh again after schedules are finalized or
                                        switch to another schedule selection.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Manage Rooms</CardTitle>
                                <CardDescription>
                                    Add or update room details used by scheduling and workload rules.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search code / name / building..."
                                    className="sm:w-80"
                                />

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={onlyAvailable}
                                        onCheckedChange={(v) => setOnlyAvailable(Boolean(v))}
                                        id="only-available"
                                    />
                                    <Label htmlFor="only-available" className="text-sm">
                                        Available only
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <Tabs value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="ALL">All</TabsTrigger>
                                <TabsTrigger value="LECTURE">Lecture</TabsTrigger>
                                <TabsTrigger value="LAB">Lab</TabsTrigger>
                                <TabsTrigger value="OTHER">Other</TabsTrigger>
                            </TabsList>

                            <TabsContent value={typeFilter}>
                                {loading ? (
                                    <div className="space-y-3 pt-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredRooms.length === 0 ? (
                                    <div className="pt-4 text-sm text-muted-foreground">
                                        No rooms found.
                                    </div>
                                ) : (
                                    <div className="mt-4 overflow-hidden rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-36">Code</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="w-44">Building/Floor</TableHead>
                                                    <TableHead className="w-28">Capacity</TableHead>
                                                    <TableHead className="w-32">Type</TableHead>
                                                    <TableHead className="w-28">Available</TableHead>
                                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredRooms.map((r) => (
                                                    <TableRow key={r.$id}>
                                                        <TableCell className="font-medium">{r.code}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {r.name || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            <div className="text-sm">{r.building || "—"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.floor ? `Floor ${r.floor}` : ""}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{r.capacity}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={typeBadgeVariant(r.type)}>
                                                                {displayType(r.type)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={r.isActive ? "default" : "secondary"}>
                                                                {r.isActive ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEditing(r)
                                                                        setDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>

                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteRoom(r)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardHeader>
                </Card>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Room" : "Add Room"}</DialogTitle>
                            <DialogDescription>
                                Define room details for scheduling and workload capacity checks.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label>Room Code</Label>
                                <Input
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="e.g. R-101 / LAB-2"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Room Name (optional)</Label>
                                <Input
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="e.g. Computer Laboratory 2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Building (optional)</Label>
                                    <Input
                                        value={roomBuilding}
                                        onChange={(e) => setRoomBuilding(e.target.value)}
                                        placeholder="e.g. CCS Building"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Floor (optional)</Label>
                                    <Input
                                        value={roomFloor}
                                        onChange={(e) => setRoomFloor(e.target.value)}
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Capacity</Label>
                                    <Input
                                        value={roomCapacity}
                                        onChange={(e) => setRoomCapacity(e.target.value)}
                                        inputMode="numeric"
                                        placeholder="e.g. 30"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Room Type</Label>
                                    <Select value={roomType} onValueChange={setRoomType}>
                                        <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LECTURE">Lecture</SelectItem>
                                            <SelectItem value="LAB">Lab</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={roomAvailable}
                                    onCheckedChange={(v) => setRoomAvailable(Boolean(v))}
                                    id="room-available"
                                />
                                <Label htmlFor="room-available">Available (Active)</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => void saveRoom()}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Wrench className="h-4 w-4" />
                                Conflict Fixer
                            </DialogTitle>
                            <DialogDescription>
                                Update the conflicted meeting by changing its schedule, transferring it
                                to another available room, or creating a new room when no existing room
                                is available.
                            </DialogDescription>
                        </DialogHeader>

                        {fixTargetItem ? (
                            <div className="space-y-4">
                                <div className="rounded-md border bg-muted/20 p-3">
                                    <div className="text-sm font-medium">
                                        {buildPrintableConflictTitle(fixTargetItem)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {normalizeDayLabel(fixTargetItem.dayOfWeek)} •{" "}
                                        {buildPrintableTimeText(fixTargetItem)}
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Fix Action</Label>
                                    <Select
                                        value={fixAction}
                                        onValueChange={(value) =>
                                            setFixAction(value as ConflictFixAction)
                                        }
                                    >
                                        <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Select fix action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="RESCHEDULE">Change schedule</SelectItem>
                                            <SelectItem value="MOVE_ROOM">
                                                Change to available room
                                            </SelectItem>
                                            <SelectItem value="CREATE_ROOM">
                                                Create new room and assign
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {fixAction === "RESCHEDULE" ? (
                                    <div className="space-y-4 rounded-md border p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Clock3 className="h-4 w-4" />
                                            Reschedule conflicted meeting
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div className="grid gap-2">
                                                <Label>Day</Label>
                                                <Select value={fixDayOfWeek} onValueChange={setFixDayOfWeek}>
                                                    <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Select day" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DAY_ORDER.map((day) => (
                                                            <SelectItem key={day} value={day}>
                                                                {day}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={fixStartTime}
                                                    onChange={(e) => setFixStartTime(e.target.value)}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>End Time</Label>
                                                <Input
                                                    type="time"
                                                    value={fixEndTime}
                                                    onChange={(e) => setFixEndTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {fixAction === "MOVE_ROOM" ? (
                                    <div className="space-y-4 rounded-md border p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <ArrowRightLeft className="h-4 w-4" />
                                            Move to another available room
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div className="grid gap-2">
                                                <Label>Day</Label>
                                                <Select value={fixDayOfWeek} onValueChange={setFixDayOfWeek}>
                                                    <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Select day" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DAY_ORDER.map((day) => (
                                                            <SelectItem key={day} value={day}>
                                                                {day}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Start Time</Label>
                                                <Input
                                                    type="time"
                                                    value={fixStartTime}
                                                    onChange={(e) => setFixStartTime(e.target.value)}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>End Time</Label>
                                                <Input
                                                    type="time"
                                                    value={fixEndTime}
                                                    onChange={(e) => setFixEndTime(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Available Room</Label>
                                            <Select
                                                value={fixRoomId}
                                                onValueChange={setFixRoomId}
                                                disabled={availableRoomBusy || availableRoomsForFix.length === 0}
                                            >
                                                <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                                    <SelectValue
                                                        placeholder={
                                                            availableRoomBusy
                                                                ? "Loading available rooms..."
                                                                : availableRoomsForFix.length > 0
                                                                  ? "Select available room"
                                                                  : "No available room found"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableRoomsForFix.map((room) => (
                                                        <SelectItem key={room.$id} value={room.$id}>
                                                            {displayRoomSubLabel(room)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {availableRoomsForFix.length === 0 && !availableRoomBusy ? (
                                            <Alert>
                                                <AlertTitle>No available room found</AlertTitle>
                                                <AlertDescription>
                                                    There is no available room for the selected schedule
                                                    yet. You can switch the action to{" "}
                                                    <span className="font-medium">
                                                        Create new room and assign
                                                    </span>
                                                    .
                                                </AlertDescription>
                                            </Alert>
                                        ) : null}
                                    </div>
                                ) : null}

                                {fixAction === "CREATE_ROOM" ? (
                                    <div className="space-y-4 rounded-md border p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Building2 className="h-4 w-4" />
                                            Create a new room and assign the conflict
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Room Code</Label>
                                            <Input
                                                value={createRoomCode}
                                                onChange={(e) => setCreateRoomCode(e.target.value)}
                                                placeholder="e.g. TEMP-ROOM-01"
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Room Name (optional)</Label>
                                            <Input
                                                value={createRoomName}
                                                onChange={(e) => setCreateRoomName(e.target.value)}
                                                placeholder="e.g. Temporary Lecture Room"
                                            />
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label>Building (optional)</Label>
                                                <Input
                                                    value={createRoomBuilding}
                                                    onChange={(e) => setCreateRoomBuilding(e.target.value)}
                                                    placeholder="e.g. Main Building"
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Floor (optional)</Label>
                                                <Input
                                                    value={createRoomFloor}
                                                    onChange={(e) => setCreateRoomFloor(e.target.value)}
                                                    placeholder="e.g. 1"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label>Capacity</Label>
                                                <Input
                                                    value={createRoomCapacity}
                                                    onChange={(e) => setCreateRoomCapacity(e.target.value)}
                                                    inputMode="numeric"
                                                    placeholder="e.g. 30"
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Room Type</Label>
                                                <Select
                                                    value={createRoomType}
                                                    onValueChange={setCreateRoomType}
                                                >
                                                    <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                                        <SelectValue placeholder="Select room type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LECTURE">Lecture</SelectItem>
                                                        <SelectItem value="LAB">Lab</SelectItem>
                                                        <SelectItem value="OTHER">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setFixDialogOpen(false)}
                                disabled={fixBusy}
                            >
                                Cancel
                            </Button>
                            <Button onClick={() => void applyConflictFix()} disabled={fixBusy}>
                                {fixBusy ? "Saving..." : "Apply Fix"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AlertDialog
                    open={Boolean(deleteRoom)}
                    onOpenChange={(open) => {
                        if (!open) setDeleteRoom(null)
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Room</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete room{" "}
                                <span className="font-medium">{deleteRoom?.code}</span>. This action
                                cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void confirmDelete()}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}