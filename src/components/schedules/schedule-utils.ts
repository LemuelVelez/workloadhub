import { Clock, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react"
import type { AcademicTermDoc, DepartmentDoc, SectionDoc, SubjectDoc } from "./schedule-types"
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

function normalizeToken(value?: unknown) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
}

function toValueList(value: unknown) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
    }

    const normalized = String(value ?? "").trim()
    if (!normalized) return []

    return normalized
        .split(/[|,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
}

function extractYearLevelToken(value?: unknown) {
    const normalized = normalizeToken(value)
    if (!normalized) return ""

    const directMatch = normalized.match(/^(?:cs|is)?\s*([1-9]\d*)$/i)
    if (directMatch?.[1]) return directMatch[1]

    const ordinalMatch = normalized.match(/([1-9]\d*)(?:st|nd|rd|th)?(?:\s+year)?$/i)
    if (ordinalMatch?.[1]) return ordinalMatch[1]

    return ""
}

function collectProgramAliases(values: Array<unknown>) {
    const aliases = new Set<string>()

    for (const value of values) {
        const normalized = normalizeToken(value)
        if (!normalized) continue

        aliases.add(normalized)

        if (normalized === "bscs" || normalized === "cs" || normalized.includes("computer science")) {
            aliases.add("bscs")
            aliases.add("cs")
            aliases.add("computer science")
        }

        if (
            normalized === "bsis" ||
            normalized === "is" ||
            normalized.includes("information system") ||
            normalized.includes("information systems")
        ) {
            aliases.add("bsis")
            aliases.add("is")
            aliases.add("information systems")
        }
    }

    return aliases
}

function getSectionProgramAliases(section?: SectionDoc | null) {
    if (!section) return new Set<string>()

    const inferredProgramValues = [section.yearLevel, section.label, section.name]
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)
        .map((value) => {
            if (value.startsWith("CS")) return "CS"
            if (value.startsWith("IS")) return "IS"
            return ""
        })
        .filter(Boolean)

    return collectProgramAliases([
        section.programId,
        section.programCode,
        section.programName,
        section.label,
        section.name,
        ...inferredProgramValues,
    ])
}

function getSectionYearAliases(section?: SectionDoc | null) {
    if (!section) return new Set<string>()

    const aliases = new Set<string>()
    const rawValues = [section.yearLevel, section.label, section.name]

    for (const value of rawValues) {
        const normalized = normalizeToken(value)
        if (normalized) aliases.add(normalized)

        const yearToken = extractYearLevelToken(value)
        if (yearToken) aliases.add(yearToken)
    }

    return aliases
}

function getSubjectSectionAliases(subject?: SubjectDoc | null) {
    if (!subject) return new Set<string>()

    const aliases = new Set<string>()
    const anySubject = subject as Record<string, unknown>

    const rawSectionValues = [
        subject.sectionId,
        subject.sectionIds,
        subject.linkedSectionId,
        subject.linkedSectionIds,
        anySubject.subjectSectionId,
        anySubject.subjectSectionIds,
        anySubject.section,
        anySubject.sections,
    ]

    for (const rawValue of rawSectionValues) {
        for (const value of toValueList(rawValue)) {
            const normalized = normalizeToken(value)
            if (normalized) aliases.add(normalized)
        }
    }

    return aliases
}

function getSubjectProgramAliases(subject?: SubjectDoc | null) {
    if (!subject) return new Set<string>()

    const anySubject = subject as Record<string, unknown>

    return collectProgramAliases([
        subject.programId,
        subject.programIds,
        subject.programCode,
        subject.programCodes,
        subject.programName,
        anySubject.track,
        anySubject.tracks,
        anySubject.course,
        anySubject.courses,
        anySubject.courseCode,
        anySubject.courseCodes,
    ])
}

function getSubjectYearAliases(subject?: SubjectDoc | null) {
    if (!subject) return new Set<string>()

    const aliases = new Set<string>()
    const anySubject = subject as Record<string, unknown>
    const rawValues = [subject.yearLevel, subject.yearLevels, anySubject.level, anySubject.levels]

    for (const rawValue of rawValues) {
        for (const value of toValueList(rawValue)) {
            const normalized = normalizeToken(value)
            if (normalized) aliases.add(normalized)

            const yearToken = extractYearLevelToken(value)
            if (yearToken) aliases.add(yearToken)
        }
    }

    return aliases
}

function setsIntersect(a: Set<string>, b: Set<string>) {
    for (const value of a) {
        if (b.has(value)) return true
    }
    return false
}

export function subjectHasSectionScopedMetadata(subject?: SubjectDoc | null) {
    if (!subject) return false

    return (
        getSubjectSectionAliases(subject).size > 0 ||
        getSubjectProgramAliases(subject).size > 0 ||
        getSubjectYearAliases(subject).size > 0
    )
}

export function sectionSortValue(section?: SectionDoc | null) {
    if (!section) return Number.MAX_SAFE_INTEGER
    const yearToken = extractYearLevelToken(section.yearLevel ?? section.label ?? section.name)
    return Number.parseInt(yearToken || "999", 10)
}

export function sortSectionsForDisplay(a?: SectionDoc | null, b?: SectionDoc | null) {
    const yearDiff = sectionSortValue(a) - sectionSortValue(b)
    if (yearDiff !== 0) return yearDiff

    const programDiff = String(a?.programCode || a?.programName || a?.label || "").localeCompare(
        String(b?.programCode || b?.programName || b?.label || ""),
        undefined,
        { sensitivity: "base" }
    )
    if (programDiff !== 0) return programDiff

    return String(a?.name || a?.label || a?.$id || "").localeCompare(
        String(b?.name || b?.label || b?.$id || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
    )
}

export function doesSubjectBelongToSection(subject?: SubjectDoc | null, section?: SectionDoc | null) {
    if (!subject || !section) return true

    const normalizedSectionId = normalizeToken(section.$id)
    const subjectSectionAliases = getSubjectSectionAliases(subject)
    if (normalizedSectionId && subjectSectionAliases.size > 0) {
        return subjectSectionAliases.has(normalizedSectionId)
    }

    const subjectProgramAliases = getSubjectProgramAliases(subject)
    const subjectYearAliases = getSubjectYearAliases(subject)
    const sectionProgramAliases = getSectionProgramAliases(section)
    const sectionYearAliases = getSectionYearAliases(section)

    const hasProgramScope = subjectProgramAliases.size > 0 && sectionProgramAliases.size > 0
    const hasYearScope = subjectYearAliases.size > 0 && sectionYearAliases.size > 0

    if (hasProgramScope || hasYearScope) {
        const programMatches = !hasProgramScope || setsIntersect(subjectProgramAliases, sectionProgramAliases)
        const yearMatches = !hasYearScope || setsIntersect(subjectYearAliases, sectionYearAliases)
        return programMatches && yearMatches
    }

    return true
}

export function filterSubjectsForSection(subjects: SubjectDoc[], section?: SectionDoc | null) {
    if (!section) return subjects

    const matchedSubjects = subjects.filter((subject) => doesSubjectBelongToSection(subject, section))
    const hasScopedMetadata = subjects.some((subject) => subjectHasSectionScopedMetadata(subject))

    if (matchedSubjects.length > 0 || hasScopedMetadata) {
        return matchedSubjects
    }

    return subjects
}

export function filterSubjectsForSections(subjects: SubjectDoc[], sections: SectionDoc[]) {
    const normalizedSections = sections.filter(Boolean)
    if (normalizedSections.length === 0) return subjects

    const matchedSubjects = subjects.filter((subject) =>
        normalizedSections.some((section) => doesSubjectBelongToSection(subject, section))
    )
    const hasScopedMetadata = subjects.some((subject) => subjectHasSectionScopedMetadata(subject))

    if (matchedSubjects.length > 0 || hasScopedMetadata) {
        return matchedSubjects
    }

    return subjects
}

export type SectionScopeFilterParams = {
    section: SectionDoc
    subjectCollegeFilter: string
    subjectProgramFilters: string[]
    subjectYearLevelFilters: string[]
    subjectAcademicTermFilter: string
    subjectSectionFilters?: string[]
}

export function sectionMatchesSubjectFilters({
    section,
    subjectCollegeFilter,
    subjectProgramFilters,
    subjectYearLevelFilters,
    subjectAcademicTermFilter,
    subjectSectionFilters = [],
}: SectionScopeFilterParams) {
    const normalizedCollegeFilter = normalizeToken(subjectCollegeFilter)
    const normalizedProgramFilters = subjectProgramFilters.map(normalizeToken).filter(Boolean)
    const normalizedYearLevelFilters = subjectYearLevelFilters.map(normalizeToken).filter(Boolean)
    const normalizedAcademicTermFilter = normalizeToken(subjectAcademicTermFilter)
    const normalizedSectionFilters = subjectSectionFilters.map(normalizeToken).filter(Boolean)

    const sectionCollegeTokens = [section.departmentId, section.programCode, section.programName]
        .map(normalizeToken)
        .filter(Boolean)
    const sectionProgramTokens = [section.$id, section.programId, section.programCode, section.programName]
        .map(normalizeToken)
        .filter(Boolean)
    const sectionYearLevelTokens = [section.yearLevel, section.label, section.name]
        .map((value) => normalizeToken(String(value ?? "")))
        .filter(Boolean)
    const sectionAcademicTermToken = normalizeToken(section.academicTermLabel)
    const sectionIdToken = normalizeToken(section.$id)

    if (normalizedCollegeFilter && normalizedCollegeFilter !== normalizeToken(SUBJECT_FILTER_ALL_VALUE)) {
        if (!sectionCollegeTokens.includes(normalizedCollegeFilter)) return false
    }

    if (normalizedProgramFilters.length > 0) {
        const hasProgramMatch = normalizedProgramFilters.some((value) => sectionProgramTokens.includes(value))
        if (!hasProgramMatch) return false
    }

    if (normalizedYearLevelFilters.length > 0) {
        const hasYearMatch = normalizedYearLevelFilters.some((value) =>
            sectionYearLevelTokens.some((token) => token === value || token.includes(value) || value.includes(token))
        )
        if (!hasYearMatch) return false
    }


    if (normalizedAcademicTermFilter && normalizedAcademicTermFilter !== normalizeToken(SUBJECT_FILTER_ALL_VALUE)) {
        if (sectionAcademicTermToken !== normalizedAcademicTermFilter) return false
    }

    if (normalizedSectionFilters.length > 0) {
        if (!sectionIdToken || !normalizedSectionFilters.includes(sectionIdToken)) return false
    }

    return true
}

export const SUBJECT_FILTER_ALL_VALUE = "__all__"

function normalizeSubjectFilterText(value?: unknown) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
}

function splitSubjectFilterValues(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((item) => splitSubjectFilterValues(item))
    }

    const normalized = String(value ?? "").trim()
    if (!normalized) return []

    return normalized
        .split(/[|,;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
}

function getYearLevelToken(value?: unknown) {
    const normalized = normalizeSubjectFilterText(value)
    if (!normalized) return ""

    const directMatch = normalized.match(/^(?:cs|is)?\s*([1-9]\d*)$/i)
    if (directMatch?.[1]) return directMatch[1]

    const ordinalMatch = normalized.match(/([1-9]\d*)(?:st|nd|rd|th)?(?:\s+year)?$/i)
    if (ordinalMatch?.[1]) return ordinalMatch[1]

    return ""
}

function getOrdinalSuffix(value: number) {
    const mod100 = value % 100
    if (mod100 >= 11 && mod100 <= 13) return "th"

    switch (value % 10) {
        case 1:
            return "st"
        case 2:
            return "nd"
        case 3:
            return "rd"
        default:
            return "th"
    }
}

export function formatYearLevelFilterLabel(value?: unknown) {
    const rawText = String(value ?? "").trim()
    const yearToken = getYearLevelToken(value)
    if (!yearToken) return rawText

    const parsedYear = Number.parseInt(yearToken, 10)
    if (!Number.isFinite(parsedYear)) return rawText || yearToken

    return `${parsedYear}${getOrdinalSuffix(parsedYear)} Year`
}

function buildComparableSubjectFilterTokens(value?: unknown) {
    const normalized = normalizeSubjectFilterText(value)
    const tokens = new Set<string>()
    if (!normalized) return tokens

    tokens.add(normalized)

    const yearToken = getYearLevelToken(value)
    if (yearToken) {
        tokens.add(yearToken)
        tokens.add(normalizeSubjectFilterText(formatYearLevelFilterLabel(yearToken)))
    }

    if (normalized.includes("computer science") || normalized === "cs" || normalized === "bscs") {
        tokens.add("computer science")
        tokens.add("cs")
        tokens.add("bscs")
    }

    if (normalized.includes("information system") || normalized.includes("information systems") || normalized === "is" || normalized === "bsis") {
        tokens.add("information systems")
        tokens.add("information system")
        tokens.add("is")
        tokens.add("bsis")
    }

    if (normalized.includes("first")) tokens.add("1")
    if (normalized.includes("second")) tokens.add("2")
    if (normalized.includes("third")) tokens.add("3")
    if (normalized.includes("fourth")) tokens.add("4")

    if (normalized.includes("1st") || normalized.includes("1st semester")) tokens.add("1")
    if (normalized.includes("2nd") || normalized.includes("2nd semester")) tokens.add("2")
    if (normalized.includes("3rd") || normalized.includes("3rd semester")) tokens.add("3")
    if (normalized.includes("4th") || normalized.includes("4th semester")) tokens.add("4")

    return tokens
}

export function subjectFilterValuesMatch(leftValue: string, rightValue: string) {
    const leftTokens = buildComparableSubjectFilterTokens(leftValue)
    const rightTokens = buildComparableSubjectFilterTokens(rightValue)

    for (const token of leftTokens) {
        if (rightTokens.has(token)) return true
    }

    const leftNormalized = normalizeSubjectFilterText(leftValue)
    const rightNormalized = normalizeSubjectFilterText(rightValue)
    if (!leftNormalized || !rightNormalized) return false

    return leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized)
}

export function matchesSelectedSubjectFilter(selectedValue: string, subjectValues: string[]) {
    if (!selectedValue || selectedValue === SUBJECT_FILTER_ALL_VALUE) return true
    if (subjectValues.length === 0) return true

    return subjectValues.some((value) => subjectFilterValuesMatch(value, selectedValue))
}

function compareSubjectFilterText(a?: string | number | null, b?: string | number | null) {
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
    })
}

export function buildSubjectFilterOptions(values: Array<unknown>, formatter?: (value: unknown) => string) {
    const seen = new Set<string>()
    const options: string[] = []

    for (const rawValue of values) {
        for (const value of splitSubjectFilterValues(rawValue)) {
            const displayValue = String(formatter ? formatter(value) : value).trim()
            if (!displayValue || displayValue === "—") continue

            const normalized = normalizeSubjectFilterText(displayValue)
            if (!normalized || seen.has(normalized)) continue

            seen.add(normalized)
            options.push(displayValue)
        }
    }

    return options.sort(compareSubjectFilterText)
}

export function getSubjectCollegeFilterValues(subject?: SubjectDoc | null) {
    if (!subject) return []

    const anySubject = subject as Record<string, unknown>

    return buildSubjectFilterOptions([
        anySubject.college,
        anySubject.collegeName,
        anySubject.collegeCode,
        anySubject.departmentLabel,
        anySubject.departmentName,
        anySubject.departmentCode,
        subject.departmentId,
    ])
}

export function getSubjectProgramFilterValues(subject?: SubjectDoc | null) {
    if (!subject) return []

    const anySubject = subject as Record<string, unknown>

    return buildSubjectFilterOptions([
        subject.programName,
        subject.programCode,
        subject.programId,
        subject.programIds,
        subject.programCodes,
        anySubject.program,
        anySubject.programs,
        anySubject.programLabel,
    ])
}

export function getSubjectYearLevelFilterValues(subject?: SubjectDoc | null) {
    if (!subject) return []

    const anySubject = subject as Record<string, unknown>

    return buildSubjectFilterOptions(
        [subject.yearLevel, subject.yearLevels, anySubject.level, anySubject.levels],
        formatYearLevelFilterLabel
    )
}

export function getSubjectSemesterFilterValues(subject?: SubjectDoc | null) {
    if (!subject) return []

    const anySubject = subject as Record<string, unknown>

    return buildSubjectFilterOptions([
        anySubject.semester,
        anySubject.semesters,
        anySubject.curriculumSemester,
        anySubject.offeredSemester,
        anySubject.termSemester,
    ])
}

export function getSubjectAcademicTermFilterValues(subject?: SubjectDoc | null) {
    if (!subject) return []

    const anySubject = subject as Record<string, unknown>
    const schoolYear = String(anySubject.schoolYear ?? "").trim()
    const semester = String(anySubject.semester ?? "").trim()
    const combinedSchoolYearSemester = schoolYear && semester ? `${schoolYear} • ${semester}` : ""

    return buildSubjectFilterOptions([
        subject.termId,
        anySubject.academicTerm,
        anySubject.term,
        anySubject.termName,
        anySubject.termLabel,
        anySubject.schoolYear,
        combinedSchoolYearSemester,
    ])
}

export function pickMatchingSubjectFilterOption(options: string[], candidates: Array<unknown>) {
    for (const candidate of candidates) {
        const normalizedCandidate = normalizeSubjectFilterText(candidate)
        if (!normalizedCandidate || normalizedCandidate === "—") continue

        const exactMatch = options.find((option) => subjectFilterValuesMatch(option, normalizedCandidate))
        if (exactMatch) return exactMatch
    }

    return SUBJECT_FILTER_ALL_VALUE
}

export function formatSubjectOptionLabel(subject?: SubjectDoc | null) {
    if (!subject) return "—"
    const code = String(subject.code || "").trim()
    const title = String(subject.title || "").trim()
    const units = subject.units != null ? ` (${subject.units}u)` : ""
    return ([code, title].filter(Boolean).join(" • ") || subject.$id) + units
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

    const normalized = s.toLowerCase()
    if (normalized === "locked") return "Archived"
    if (normalized === "archived") return "Archived"
    if (normalized === "active") return "Active"
    if (normalized === "draft") return "Draft"

    return s
}

export function isActiveScheduleStatus(status?: string | null) {
    return normalizeScheduleStatus(status) === "Active"
}

export function isArchivedScheduleStatus(status?: string | null) {
    return normalizeScheduleStatus(status) === "Archived"
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
    return [sy, sem].filter(Boolean).join(" • ") || t.$id
}

export function deptLabel(d?: DepartmentDoc | null) {
    if (!d) return "—"
    const name = (d.name || "").trim()
    const code = (d.code || "").trim()
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
    const startText = formatClockTime(start)
    const endText = formatClockTime(end)

    if (startText === "—" && endText === "—") return "—"
    if (startText === "—") return endText
    if (endText === "—") return startText

    return `${startText} to ${endText}`
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

export function formatCompactDayDisplay(dayValue?: string | null) {
    const days = getDayTokens(dayValue)
    if (days.length === 0) {
        return String(dayValue || "").trim() || "—"
    }

    return days.map((day) => DAY_ABBREVIATIONS[day] || day).join("-")
}

export function formatCompactDayDisplayFromValues(dayValues: Array<string | null | undefined>) {
    const resolvedDays = getOrderedUniqueDays(dayValues.flatMap((value) => getDayTokens(value)))
    if (resolvedDays.length === 0) return "—"

    return resolvedDays.map((day) => DAY_ABBREVIATIONS[day] || day).join("-")
}

type CombinedMeetingDisplayEntry = {
    dayOfWeek?: string | null
    startTime?: string | null
    endTime?: string | null
}

type CombinedMeetingDisplaySegment = {
    dayDisplay: string
    timeDisplay: string
    sortDayValue: string
    sortStartTime: string
}

function buildCombinedMeetingDisplaySegments(entries: CombinedMeetingDisplayEntry[]): CombinedMeetingDisplaySegment[] {
    const timeGroups = new Map<string, CombinedMeetingDisplayEntry[]>()

    for (const entry of entries) {
        const startTime = String(entry.startTime || "")
        const endTime = String(entry.endTime || "")
        const groupKey = `${startTime}__${endTime}`
        const existingEntries = timeGroups.get(groupKey) || []
        existingEntries.push(entry)
        timeGroups.set(groupKey, existingEntries)
    }

    return Array.from(timeGroups.values())
        .map((groupEntries) => {
            const orderedEntries = groupEntries.slice().sort((a, b) => {
                const dayDiff = dayOrder(String(a.dayOfWeek || "")) - dayOrder(String(b.dayOfWeek || ""))
                if (dayDiff !== 0) return dayDiff

                const startDiff = hhmmToMinutes(String(a.startTime || "")) - hhmmToMinutes(String(b.startTime || ""))
                if (startDiff !== 0) return startDiff

                return hhmmToMinutes(String(a.endTime || "")) - hhmmToMinutes(String(b.endTime || ""))
            })

            const firstEntry = orderedEntries[0]

            return {
                dayDisplay: formatCompactDayDisplayFromValues(orderedEntries.map((entry) => entry.dayOfWeek)),
                timeDisplay: formatTimeRange(String(firstEntry?.startTime || ""), String(firstEntry?.endTime || "")),
                sortDayValue: String(firstEntry?.dayOfWeek || ""),
                sortStartTime: String(firstEntry?.startTime || ""),
            }
        })
        .sort((a, b) => {
            const dayDiff = dayOrder(a.sortDayValue) - dayOrder(b.sortDayValue)
            if (dayDiff !== 0) return dayDiff

            const startDiff = hhmmToMinutes(a.sortStartTime) - hhmmToMinutes(b.sortStartTime)
            if (startDiff !== 0) return startDiff

            return a.timeDisplay.localeCompare(b.timeDisplay)
        })
}

export function formatCombinedMeetingDayDisplay(entries: CombinedMeetingDisplayEntry[]) {
    return formatCompactDayDisplayFromValues(entries.map((entry) => entry.dayOfWeek))
}

export function joinDisplayValues(values: Array<string | null | undefined>, separator = " / ") {
    const uniqueValues: string[] = []

    for (const value of values) {
        const normalized = String(value || "").trim()
        if (!normalized || uniqueValues.includes(normalized)) continue
        uniqueValues.push(normalized)
    }

    return uniqueValues.length > 0 ? uniqueValues.join(separator) : "—"
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

export function formatCombinedMeetingTimeDisplay(entries: CombinedMeetingDisplayEntry[]) {
    const segments = buildCombinedMeetingDisplaySegments(entries)
    if (segments.length === 0) return "—"

    return segments.map((segment) => segment.timeDisplay).filter(Boolean).join(" / ") || "—"
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