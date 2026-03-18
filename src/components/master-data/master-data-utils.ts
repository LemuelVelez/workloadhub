/* eslint-disable @typescript-eslint/no-explicit-any */

export const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

export const EMPTY_FACULTY_LOAD = {
    assignedRecordCount: 0,
    assignedSubjectCount: 0,
    totalUnits: 0,
    totalHours: 0,
} as const

export function hasOwn(obj: any, key: string) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key)
}

export function isUnknownLabel(v: any) {
    const s = String(v ?? "").trim().toLowerCase()
    return (
        !s ||
        s === "unknown" ||
        s.includes("unknown term") ||
        s.startsWith("unknown •") ||
        s.startsWith("unknown ")
    )
}

/**
 * Accepts:
 * - "08:00", "8:00", "08:00:00"
 * - "8:00 AM", "8 AM", "8:00PM", "12:15 pm"
 */
export function parseTimeToMinutes(input: string): number | null {
    const raw = String(input ?? "").trim()
    if (!raw) return null

    const s = raw.toLowerCase().replace(/\s+/g, " ")

    const twelve = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    if (twelve) {
        const hh = Number(twelve[1])
        const mm = Number(twelve[2] ?? "0")
        const mer = String(twelve[3]).toLowerCase()

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 1 || hh > 12) return null
        if (mm < 0 || mm > 59) return null

        let hour24 = hh % 12
        if (mer === "pm") hour24 += 12
        return hour24 * 60 + mm
    }

    const twentyFour = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (twentyFour) {
        const hh = Number(twentyFour[1])
        const mm = Number(twentyFour[2])

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 0 || hh > 23) return null
        if (mm < 0 || mm > 59) return null

        return hh * 60 + mm
    }

    return null
}

export function normalizeTimeInput(input: string): string | null {
    const mins = parseTimeToMinutes(input)
    if (mins == null) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function formatTimeAmPm(input: any): string {
    const mins = parseTimeToMinutes(String(input ?? "").trim())
    if (mins == null) return "—"
    const h24 = Math.floor(mins / 60)
    const m = mins % 60
    const period = h24 >= 12 ? "PM" : "AM"
    let h12 = h24 % 12
    if (h12 === 0) h12 = 12
    return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

export function normalizeGroupKey(value: any) {
    return String(value ?? "").trim().toLowerCase()
}

export function daySortIndex(day: any) {
    const idx = DAYS.findIndex(
        (d) => d.toLowerCase() === String(day ?? "").trim().toLowerCase()
    )
    return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

export function safeTimeSortValue(value: any) {
    const mins = parseTimeToMinutes(String(value ?? "").trim())
    return mins == null ? Number.MAX_SAFE_INTEGER : mins
}

export function normalizeLookupValue(value: any) {
    return String(value ?? "").trim()
}

export function toFiniteNumber(value: any): number | null {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

export function formatLoadNumber(value: number) {
    if (!Number.isFinite(value)) return "0"
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function getSubjectHours(subject: any): number | null {
    const totalHours = toFiniteNumber(subject?.totalHours)
    if (totalHours != null) return totalHours

    const lectureHours = toFiniteNumber(subject?.lectureHours) ?? 0
    const labHours = toFiniteNumber(subject?.labHours) ?? 0

    if (lectureHours > 0 || labHours > 0) {
        return lectureHours + labHours
    }

    return null
}

export function getRowDurationHours(row: any): number | null {
    const start = parseTimeToMinutes(String(row?.startTime ?? row?.start ?? "").trim())
    const end = parseTimeToMinutes(String(row?.endTime ?? row?.end ?? "").trim())

    if (start == null || end == null || end <= start) return null
    return (end - start) / 60
}

export function findSubjectForRow(row: any, subjects: any[]) {
    const subjectId = normalizeLookupValue(
        row?.subjectId ?? row?.subject ?? row?.subjectDocId ?? row?.subjectID ?? ""
    )

    if (subjectId) {
        const byId = subjects.find(
            (subject) => normalizeLookupValue(subject?.$id) === subjectId
        )
        if (byId) return byId
    }

    const subjectCode = normalizeGroupKey(row?.subjectCode ?? row?.code ?? "")
    if (subjectCode) {
        const byCode = subjects.find(
            (subject) => normalizeGroupKey(subject?.code) === subjectCode
        )
        if (byCode) return byCode
    }

    return null
}

export function buildFacultyAssignedLoad(
    facultyUserId: string,
    rows: any[],
    subjects: any[]
) {
    const targetFacultyUserId = normalizeGroupKey(facultyUserId)

    if (!targetFacultyUserId) return EMPTY_FACULTY_LOAD

    let totalUnits = 0
    let totalHours = 0
    let assignedRecordCount = 0
    const subjectKeys = new Set<string>()

    for (const row of rows) {
        const rowFacultyUserId = normalizeGroupKey(
            row?.facultyUserId ?? row?.facultyId ?? row?.faculty ?? row?.userId ?? ""
        )

        if (!rowFacultyUserId || rowFacultyUserId !== targetFacultyUserId) continue

        assignedRecordCount += 1

        const subject = findSubjectForRow(row, subjects)
        const units = toFiniteNumber(subject?.units) ?? toFiniteNumber(row?.units) ?? 0
        const hours = getSubjectHours(subject) ?? getRowDurationHours(row) ?? 0

        totalUnits += units
        totalHours += hours

        const subjectKey = normalizeLookupValue(
            subject?.$id ?? row?.subjectId ?? row?.subjectCode ?? row?.subject ?? ""
        )

        if (subjectKey) {
            subjectKeys.add(subjectKey)
        }
    }

    return {
        assignedRecordCount,
        assignedSubjectCount: subjectKeys.size,
        totalUnits,
        totalHours,
    }
}

export type GroupedRecordRowGroup = {
    key: string
    facultyLabel: string
    rows: any[]
    conflictCount: number
}

export function buildGroupedRecordRows(
    rows: any[],
    conflictRecordIds: Set<string>,
    resolveTermLabel: (row: any) => string
): GroupedRecordRowGroup[] {
    const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
    })

    const sortedRows = [...rows].sort((a, b) => {
        const facultyCmp = collator.compare(
            String(a?.facultyLabel ?? ""),
            String(b?.facultyLabel ?? "")
        )
        if (facultyCmp !== 0) return facultyCmp

        const termCmp = collator.compare(resolveTermLabel(a), resolveTermLabel(b))
        if (termCmp !== 0) return termCmp

        const dayCmp = daySortIndex(a?.dayOfWeek) - daySortIndex(b?.dayOfWeek)
        if (dayCmp !== 0) return dayCmp

        const startCmp = safeTimeSortValue(a?.startTime) - safeTimeSortValue(b?.startTime)
        if (startCmp !== 0) return startCmp

        return collator.compare(String(a?.subjectCode ?? ""), String(b?.subjectCode ?? ""))
    })

    const groups = new Map<string, GroupedRecordRowGroup>()

    for (const row of sortedRows) {
        const key =
            normalizeGroupKey(row?.facultyUserId) ||
            normalizeGroupKey(row?.facultyLabel) ||
            "tba-faculty"

        const label = String(row?.facultyLabel ?? "").trim() || "TBA Faculty"
        const existing = groups.get(key)

        if (existing) {
            existing.rows.push(row)
            if (conflictRecordIds.has(String(row?.id ?? "").trim())) {
                existing.conflictCount += 1
            }
        } else {
            groups.set(key, {
                key,
                facultyLabel: label,
                rows: [row],
                conflictCount: conflictRecordIds.has(String(row?.id ?? "").trim()) ? 1 : 0,
            })
        }
    }

    return Array.from(groups.values())
}