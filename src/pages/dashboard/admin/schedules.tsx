/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { BookPlus, PlusCircle, RefreshCcw } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Card,
    CardContent,
    CardDescription,
    CardTitle,
} from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { VersionManagementSection } from "@/components/schedules/version-management-section"
import { PlannerManagementSection } from "@/components/schedules/planner-management-section"
import type {
    AcademicTermDoc,
    CandidateConflict,
    ClassDoc,
    ClassMeetingDoc,
    ConflictFlags,
    DepartmentDoc,
    MeetingType,
    RoomDoc,
    ScheduleRow,
    ScheduleStatus,
    ScheduleVersionDoc,
    SectionDoc,
    SubjectDoc,
    TabKey,
    UserProfileDoc,
} from "@/components/schedules/schedule-types"
import {
    FACULTY_OPTION_MANUAL,
    FACULTY_OPTION_NONE,
} from "@/components/schedules/schedule-types"
import {
    composeRemarks,
    dayExpressionsOverlap,
    dayOrder,
    deptLabel,
    extractManualFaculty,
    filterSubjectsForSection,
    getCanonicalDayValue,
    hhmmToMinutes,
    meetingTypeLabel,
    normalizeText,
    rangesOverlap,
    isActiveScheduleStatus,
    normalizeScheduleStatus,
    roleLooksLikeFaculty,
    roomTypeLabel,
    sortSectionsForDisplay,
    stripManualFacultyTag,
    termLabel,
} from "@/components/schedules/schedule-utils"

const CREATE_TERM_MODES = {
    existing: "existing",
    new: "new",
} as const

type CreateTermMode = (typeof CREATE_TERM_MODES)[keyof typeof CREATE_TERM_MODES]

const CREATE_TERM_SEMESTER_OPTIONS = ["1st Semester", "2nd Semester", "Summer"] as const
const YEAR_LEVEL_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const
const CUSTOM_SCHOOL_YEAR_VALUE = "__custom_school_year__"

type CourseYearScopeOption = {
    key: string
    label: string
    programId?: string | null
    programCode?: string | null
    programName?: string | null
    yearLevel?: string | number | null
}

type ProgramDoc = {
    $id: string
    departmentId?: string | null
    code?: string | null
    name?: string | null
    isActive?: boolean
}

type SubjectManagementDialogMode = "new" | "existing" | null

function formatSchoolYear(startYear: number) {
    return `${startYear}-${startYear + 1}`
}

function parseSchoolYear(value?: string | null) {
    const match = String(value || "")
        .trim()
        .match(/^(\d{4})\s*-\s*(\d{4})$/)

    if (!match) return null

    const startYear = Number.parseInt(match[1], 10)
    const endYear = Number.parseInt(match[2], 10)

    if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear !== startYear + 1) {
        return null
    }

    return { startYear, endYear }
}

function getCurrentSchoolYear(date = new Date()) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const startYear = month >= 5 ? year : year - 1
    return formatSchoolYear(startYear)
}

function getCurrentSemester(date = new Date()) {
    const month = date.getMonth()

    if (month >= 5 && month <= 6) return "Summer"
    if (month >= 7) return "1st Semester"
    return "2nd Semester"
}

function buildSchoolYearOptions(anchorSchoolYear = getCurrentSchoolYear()) {
    const parsed = parseSchoolYear(anchorSchoolYear)
    const baseStartYear = parsed?.startYear ?? new Date().getFullYear()

    return [-2, -1, 0, 1, 2].map((offset) => formatSchoolYear(baseStartYear + offset))
}

function getAcademicTermDateRange(schoolYearValue: string, semesterValue: string) {
    const parsed = parseSchoolYear(schoolYearValue) ?? parseSchoolYear(getCurrentSchoolYear())
    const startYear = parsed?.startYear ?? new Date().getFullYear()
    const endYear = parsed?.endYear ?? startYear + 1

    const semester = normalizeText(semesterValue)

    if (semester.includes("2")) {
        return {
            startDate: `${endYear}-01-01`,
            endDate: `${endYear}-05-31`,
        }
    }

    if (semester.includes("summer")) {
        return {
            startDate: `${endYear}-06-01`,
            endDate: `${endYear}-07-31`,
        }
    }

    return {
        startDate: `${startYear}-08-01`,
        endDate: `${startYear}-12-31`,
    }
}

function toStoredScheduleStatus(nextStatus: ScheduleStatus, currentRawStatus?: string | null): ScheduleStatus {
    const normalizedNextStatus = normalizeScheduleStatus(nextStatus)

    if (normalizedNextStatus === "Archived") {
        const currentRaw = String(currentRawStatus || "").trim()
        if (currentRaw && normalizeScheduleStatus(currentRaw) === "Archived") {
            return currentRaw as ScheduleStatus
        }

        return "Locked"
    }

    if (normalizedNextStatus === "Active") {
        return "Active"
    }

    return "Draft"
}

function buildScheduleStatusPayload(
    nextStatus: ScheduleStatus,
    actorUserId: string,
    currentRawStatus?: string | null
) {
    const storedStatus = toStoredScheduleStatus(nextStatus, currentRawStatus)
    const normalizedStoredStatus = normalizeScheduleStatus(storedStatus)

    if (normalizedStoredStatus === "Archived") {
        return {
            status: storedStatus,
            lockedBy: actorUserId,
            lockedAt: new Date().toISOString(),
        }
    }

    return {
        status: storedStatus,
        lockedBy: null,
        lockedAt: null,
    }
}

function uniqStrings(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value || "").trim())
                .filter(Boolean)
        )
    )
}

function uniqYearValues(values: Array<string | number | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value ?? "").trim())
                .filter(Boolean)
        )
    )
}

function normalizeYearLevelForDisplay(value?: string | number | null) {
    const raw = String(value ?? "").trim()
    if (!raw) return "Unspecified"

    const digits = raw.match(/\d+/)?.[0]
    if (digits) {
        return digits
    }

    return raw
}

function formatCourseYearScopeLabel(programCode?: string | null, programName?: string | null, yearLevel?: string | number | null) {
    const programLabel = String(programCode || programName || "COURSE").trim()
    const yearLabel = normalizeYearLevelForDisplay(yearLevel)
    return `${programLabel} ${yearLabel}`.trim()
}

function buildCourseYearScopeOptions(sections: SectionDoc[]) {
    const map = new Map<string, CourseYearScopeOption>()

    for (const section of sections) {
        const programId = String(section.programId || "").trim() || null
        const programCode = String(section.programCode || "").trim() || null
        const programName = String(section.programName || "").trim() || null
        const yearLevel = String(section.yearLevel ?? "").trim() || null

        const key = [
            normalizeText(programId || ""),
            normalizeText(programCode || ""),
            normalizeText(programName || ""),
            normalizeText(yearLevel || ""),
        ].join("::")

        if (!key.replace(/[:]/g, "")) continue

        if (!map.has(key)) {
            map.set(key, {
                key,
                label: formatCourseYearScopeLabel(programCode, programName, yearLevel),
                programId,
                programCode,
                programName,
                yearLevel,
            })
        }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
}

function buildProgramYearScopeOptions(programs: ProgramDoc[], yearLevelOptions: readonly string[]) {
    const map = new Map<string, CourseYearScopeOption>()

    for (const program of programs) {
        const programId = String(program.$id || "").trim() || null
        const programCode = String(program.code || "").trim() || null
        const programName = String(program.name || "").trim() || null

        for (const yearLevel of yearLevelOptions) {
            const normalizedYearLevel = String(yearLevel || "").trim() || null
            const key = [
                normalizeText(programId || ""),
                normalizeText(programCode || ""),
                normalizeText(programName || ""),
                normalizeText(normalizedYearLevel || ""),
            ].join("::")

            if (!key.replace(/[:]/g, "")) continue

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: formatCourseYearScopeLabel(programCode, programName, normalizedYearLevel),
                    programId,
                    programCode,
                    programName,
                    yearLevel: normalizedYearLevel,
                })
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
}

function getSubjectScopeSummary(subject?: SubjectDoc | null) {
    if (!subject) return "Unscoped"

    const programCodes = uniqStrings([
        subject.programCode,
        ...(Array.isArray(subject.programCodes)
            ? subject.programCodes
            : String(subject.programCodes || "")
                  .split(",")
                  .map((value) => value.trim())),
    ])

    const yearLevels = uniqYearValues([
        subject.yearLevel,
        ...(Array.isArray(subject.yearLevels)
            ? subject.yearLevels
            : String(subject.yearLevels || "")
                  .split(",")
                  .map((value) => value.trim())),
    ])

    if (programCodes.length === 0 && yearLevels.length === 0) {
        return "All course/year levels"
    }

    if (programCodes.length === 0) {
        return yearLevels.join(", ")
    }

    if (yearLevels.length === 0) {
        return programCodes.join(", ")
    }

    return programCodes
        .map((programCode, index) => `${programCode} ${yearLevels[index] || yearLevels[0] || ""}`.trim())
        .join(", ")
}

function buildSectionDisplayLabel(
    programCode?: string | null,
    programName?: string | null,
    yearLevel?: string | number | null,
    sectionName?: string | null
) {
    const courseYearLabel = formatCourseYearScopeLabel(programCode, programName, yearLevel)
    const normalizedSectionName = String(sectionName || "").trim()

    if (!normalizedSectionName) return courseYearLabel

    return `${courseYearLabel} - ${normalizedSectionName}`
}

export default function AdminSchedulesPage() {
    const { user } = useSession()
    const userId = String(user?.$id || user?.id || "").trim()

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [versions, setVersions] = React.useState<ScheduleVersionDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])

    const [tab, setTab] = React.useState<TabKey>("all")
    const [search, setSearch] = React.useState("")

    const [filterTermId, setFilterTermId] = React.useState<string>("all")
    const [filterDeptId, setFilterDeptId] = React.useState<string>("all")

    const [viewOpen, setViewOpen] = React.useState(false)
    const [active, setActive] = React.useState<ScheduleVersionDoc | null>(null)

    const [createOpen, setCreateOpen] = React.useState(false)
    const [editingVersion, setEditingVersion] = React.useState<ScheduleVersionDoc | null>(null)
    const [createTermMode, setCreateTermMode] = React.useState<CreateTermMode>(CREATE_TERM_MODES.existing)
    const [createTermId, setCreateTermId] = React.useState<string>("")
    const [createSchoolYear, setCreateSchoolYear] = React.useState<string>(() => getCurrentSchoolYear())
    const [createSemester, setCreateSemester] = React.useState<string>(() => getCurrentSemester())
    const [createDeptId, setCreateDeptId] = React.useState<string>("")
    const [createLabel, setCreateLabel] = React.useState<string>("")
    const [createNotes, setCreateNotes] = React.useState<string>("")
    const [createSetActive, setCreateSetActive] = React.useState<boolean>(false)
    const [saving, setSaving] = React.useState(false)

    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [subjects, setSubjects] = React.useState<SubjectDoc[]>([])
    const [subjectDirectory, setSubjectDirectory] = React.useState<SubjectDoc[]>([])
    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [sections, setSections] = React.useState<SectionDoc[]>([])
    const [programs, setPrograms] = React.useState<ProgramDoc[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<UserProfileDoc[]>([])
    const [classes, setClasses] = React.useState<ClassDoc[]>([])
    const [meetings, setMeetings] = React.useState<ClassMeetingDoc[]>([])

    const [entriesLoading, setEntriesLoading] = React.useState(false)
    const [entriesError, setEntriesError] = React.useState<string | null>(null)
    const [showConflictsOnly, setShowConflictsOnly] = React.useState(false)

    const [entryDialogOpen, setEntryDialogOpen] = React.useState(false)
    const [entrySaving, setEntrySaving] = React.useState(false)

    const [formSectionId, setFormSectionId] = React.useState("")
    const [formSubjectIds, setFormSubjectIds] = React.useState<string[]>([])
    const [formFacultyChoice, setFormFacultyChoice] = React.useState<string>(FACULTY_OPTION_NONE)
    const [formManualFaculty, setFormManualFaculty] = React.useState("")
    const [formRoomId, setFormRoomId] = React.useState("")
    const [formDayOfWeek, setFormDayOfWeek] = React.useState<string>("Monday")
    const [formStartTime, setFormStartTime] = React.useState("07:00")
    const [formEndTime, setFormEndTime] = React.useState("08:00")
    const [formMeetingType, setFormMeetingType] = React.useState<MeetingType>("LECTURE")
    const [formAllowConflictSave, setFormAllowConflictSave] = React.useState(false)
    const [editingEntry, setEditingEntry] = React.useState<ScheduleRow | null>(null)

    const [subjectManagementDialogMode, setSubjectManagementDialogMode] = React.useState<SubjectManagementDialogMode>(null)
    const [subjectCode, setSubjectCode] = React.useState("")
    const [subjectTitle, setSubjectTitle] = React.useState("")
    const [subjectUnits, setSubjectUnits] = React.useState("")
    const [subjectScopeKeys, setSubjectScopeKeys] = React.useState<string[]>([])
    const [subjectSearch, setSubjectSearch] = React.useState("")
    const [bulkLinkSubjectIds, setBulkLinkSubjectIds] = React.useState<string[]>([])
    const [bulkLinkScopeKeys, setBulkLinkScopeKeys] = React.useState<string[]>([])
    const [subjectSaving, setSubjectSaving] = React.useState(false)

    const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false)
    const [sectionTermMode, setSectionTermMode] = React.useState<CreateTermMode>(CREATE_TERM_MODES.existing)
    const [sectionTermId, setSectionTermId] = React.useState("")
    const [sectionSchoolYear, setSectionSchoolYear] = React.useState<string>(() => getCurrentSchoolYear())
    const [sectionSemester, setSectionSemester] = React.useState<string>(() => getCurrentSemester())
    const [sectionProgramId, setSectionProgramId] = React.useState("")
    const [sectionYearLevel, setSectionYearLevel] = React.useState<string>(YEAR_LEVEL_OPTIONS[0])
    const [sectionName, setSectionName] = React.useState("")
    const [sectionSaving, setSectionSaving] = React.useState(false)
    const [subjectDetailsDialogOpen, setSubjectDetailsDialogOpen] = React.useState(false)
    const [subjectTransferSearch, setSubjectTransferSearch] = React.useState("")
    const [subjectTransferIds, setSubjectTransferIds] = React.useState<string[]>([])
    const [subjectTransferTermMode, setSubjectTransferTermMode] = React.useState<CreateTermMode>(CREATE_TERM_MODES.existing)
    const [subjectTransferTermId, setSubjectTransferTermId] = React.useState("")
    const [subjectTransferSchoolYear, setSubjectTransferSchoolYear] = React.useState<string>(() => getCurrentSchoolYear())
    const [subjectTransferSemester, setSubjectTransferSemester] = React.useState<string>(() => getCurrentSemester())
    const [subjectTransferScopeKeys, setSubjectTransferScopeKeys] = React.useState<string[]>([])
    const [subjectTransferSaving, setSubjectTransferSaving] = React.useState(false)

    const termMap = React.useMemo(() => {
        const m = new Map<string, AcademicTermDoc>()
        terms.forEach((t) => m.set(t.$id, t))
        return m
    }, [terms])

    const deptMap = React.useMemo(() => {
        const m = new Map<string, DepartmentDoc>()
        departments.forEach((d) => m.set(d.$id, d))
        return m
    }, [departments])

    const programMap = React.useMemo(() => {
        const m = new Map<string, ProgramDoc>()
        programs.forEach((program) => m.set(program.$id, program))
        return m
    }, [programs])

    const subjectMap = React.useMemo(() => {
        const m = new Map<string, SubjectDoc>()
        subjects.forEach((s) => m.set(s.$id, s))
        return m
    }, [subjects])

    const roomMap = React.useMemo(() => {
        const m = new Map<string, RoomDoc>()
        rooms.forEach((r) => m.set(r.$id, r))
        return m
    }, [rooms])

    const sectionMap = React.useMemo(() => {
        const m = new Map<string, SectionDoc>()
        sections.forEach((s) => m.set(s.$id, s))
        return m
    }, [sections])

    const facultyNameMap = React.useMemo(() => {
        const m = new Map<string, string>()
        facultyProfiles.forEach((f) => {
            const key = String(f.userId || f.$id || "").trim()
            if (!key) return
            const name = String(f.name || "").trim()
            const email = String(f.email || "").trim()
            m.set(key, name || email || key)
        })
        return m
    }, [facultyProfiles])

    const selectedFormSection = React.useMemo(
        () => sections.find((section) => section.$id === formSectionId) || null,
        [sections, formSectionId]
    )

    const filteredFormSubjects = React.useMemo(() => {
        const scopedSubjects = filterSubjectsForSection(subjects, selectedFormSection)
        return scopedSubjects
            .slice()
            .sort((a, b) => {
                const ac = String(a.code || "").toLowerCase()
                const bc = String(b.code || "").toLowerCase()
                if (ac !== bc) return ac.localeCompare(bc)
                return String(a.title || "").localeCompare(String(b.title || ""))
            })
    }, [subjects, selectedFormSection])

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [vRes, tRes, dRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
                    Query.orderAsc("name"),
                    Query.limit(200),
                ]),
            ])

            const vDocs = (vRes?.documents ?? []) as ScheduleVersionDoc[]
            const tDocs = (tRes?.documents ?? []) as AcademicTermDoc[]
            const dDocs = (dRes?.documents ?? []) as DepartmentDoc[]

            setVersions(vDocs)
            setTerms(tDocs)
            setDepartments(dDocs)

            setSelectedVersionId((prev) => {
                if (prev && vDocs.some((x) => x.$id === prev)) return prev
                const activeFirst = vDocs.find((x) => isActiveScheduleStatus(x.status))
                return activeFirst?.$id || vDocs[0]?.$id || ""
            })
        } catch (e: any) {
            setError(e?.message || "Failed to load schedules.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()

        return versions.filter((v) => {
            const term = termMap.get(String(v.termId)) ?? null
            const dept = deptMap.get(String(v.departmentId)) ?? null
            const status = normalizeScheduleStatus(v.status)
            const tabOk = tab === "all" ? true : status === tab
            if (!tabOk) return false

            const termOk = filterTermId === "all" ? true : String(v.termId) === filterTermId
            if (!termOk) return false

            const deptOk = filterDeptId === "all" ? true : String(v.departmentId) === filterDeptId
            if (!deptOk) return false

            if (!q) return true

            const hay = [
                v.$id,
                v.termId,
                v.departmentId,
                term?.schoolYear ?? "",
                term?.semester ?? "",
                termLabel(term),
                dept?.code ?? "",
                dept?.name ?? "",
                deptLabel(dept),
                v.label ?? "",
                normalizeScheduleStatus(v.status),
                String(v.version ?? ""),
                v.createdBy ?? "",
                v.notes ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [versions, tab, search, filterTermId, filterDeptId, termMap, deptMap])

    const stats = React.useMemo(() => {
        const total = versions.length
        const draft = versions.filter((x) => normalizeScheduleStatus(x.status) === "Draft").length
        const activeCount = versions.filter((x) => normalizeScheduleStatus(x.status) === "Active").length
        const archived = versions.filter((x) => normalizeScheduleStatus(x.status) === "Archived").length
        return { total, draft, active: activeCount, archived }
    }, [versions])

    const openView = (it: ScheduleVersionDoc) => {
        setActive(it)
        setViewOpen(true)
    }

    const schoolYearOptions = React.useMemo(
        () => buildSchoolYearOptions(createSchoolYear || getCurrentSchoolYear()),
        [createSchoolYear]
    )

    const sectionSchoolYearOptions = React.useMemo(
        () => buildSchoolYearOptions(sectionSchoolYear || getCurrentSchoolYear()),
        [sectionSchoolYear]
    )

    const subjectTransferSchoolYearOptions = React.useMemo(
        () => buildSchoolYearOptions(subjectTransferSchoolYear || getCurrentSchoolYear()),
        [subjectTransferSchoolYear]
    )

    const matchedCreateTerm = React.useMemo(() => {
        if (createTermMode !== CREATE_TERM_MODES.new) return null

        const schoolYear = String(createSchoolYear || "").trim()
        const semester = String(createSemester || "").trim()
        if (!schoolYear || !semester) return null

        return (
            terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            ) || null
        )
    }, [createTermMode, createSchoolYear, createSemester, terms])

    const matchedSectionTerm = React.useMemo(() => {
        if (sectionTermMode !== CREATE_TERM_MODES.new) return null

        const schoolYear = String(sectionSchoolYear || "").trim()
        const semester = String(sectionSemester || "").trim()
        if (!schoolYear || !semester) return null

        return (
            terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            ) || null
        )
    }, [sectionTermMode, sectionSchoolYear, sectionSemester, terms])

    const versionTermId = React.useMemo(() => {
        if (createTermMode === CREATE_TERM_MODES.new) {
            return String(matchedCreateTerm?.$id || "")
        }

        return createTermId
    }, [createTermMode, matchedCreateTerm, createTermId])

    const resolvedSectionTermId = React.useMemo(() => {
        if (sectionTermMode === CREATE_TERM_MODES.new) {
            return String(matchedSectionTerm?.$id || "")
        }

        return sectionTermId
    }, [sectionTermMode, matchedSectionTerm, sectionTermId])

    const matchedSubjectTransferTerm = React.useMemo(() => {
        if (subjectTransferTermMode !== CREATE_TERM_MODES.new) return null

        const schoolYear = String(subjectTransferSchoolYear || "").trim()
        const semester = String(subjectTransferSemester || "").trim()
        if (!schoolYear || !semester) return null

        return (
            terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            ) || null
        )
    }, [subjectTransferTermMode, subjectTransferSchoolYear, subjectTransferSemester, terms])

    const resolvedSubjectTransferTermId = React.useMemo(() => {
        if (subjectTransferTermMode === CREATE_TERM_MODES.new) {
            return String(matchedSubjectTransferTerm?.$id || "")
        }

        return subjectTransferTermId
    }, [subjectTransferTermMode, matchedSubjectTransferTerm, subjectTransferTermId])

    const nextVersionNumber = React.useMemo(() => {
        if (!versionTermId || !createDeptId) return 1
        const list = versions.filter(
            (v) => String(v.termId) === versionTermId && String(v.departmentId) === createDeptId
        )
        const max = list.reduce((acc, v) => Math.max(acc, Number(v.version || 0)), 0)
        return max + 1
    }, [versions, versionTermId, createDeptId])

    const canCreateVersion = React.useMemo(() => {
        if (!createDeptId) return false

        if (createTermMode === CREATE_TERM_MODES.new) {
            return Boolean(String(createSchoolYear || "").trim() && String(createSemester || "").trim())
        }

        return Boolean(createTermId)
    }, [createDeptId, createTermMode, createSchoolYear, createSemester, createTermId])

    const existingSemesterSchedule = React.useMemo(() => {
        if (!versionTermId || !createDeptId) return null

        return (
            versions.find((version) => {
                if (editingVersion?.$id && version.$id === editingVersion.$id) return false

                return (
                    String(version.termId) === String(versionTermId) &&
                    String(version.departmentId) === String(createDeptId)
                )
            }) || null
        )
    }, [versions, versionTermId, createDeptId, editingVersion])

    const selectedVersion = React.useMemo(
        () => versions.find((v) => v.$id === selectedVersionId) || null,
        [versions, selectedVersionId]
    )

    const resetCreateForm = React.useCallback(() => {
        setEditingVersion(null)
        setCreateTermMode(CREATE_TERM_MODES.existing)
        setCreateTermId("")
        setCreateSchoolYear(getCurrentSchoolYear())
        setCreateSemester(getCurrentSemester())
        setCreateDeptId("")
        setCreateLabel("")
        setCreateNotes("")
        setCreateSetActive(false)
    }, [])

    const resetSubjectForm = React.useCallback(() => {
        setSubjectCode("")
        setSubjectTitle("")
        setSubjectUnits("")
        setSubjectScopeKeys([])
    }, [])

    const resetBulkLinkForm = React.useCallback(() => {
        setSubjectSearch("")
        setBulkLinkSubjectIds([])
        setBulkLinkScopeKeys([])
    }, [])

    const resetSubjectTransferForm = React.useCallback(() => {
        const fallbackTermId =
            terms.find((term) => String(term.$id || "") !== String(selectedVersion?.termId || ""))?.$id || ""

        setSubjectTransferSearch("")
        setSubjectTransferIds([])
        setSubjectTransferTermMode(CREATE_TERM_MODES.existing)
        setSubjectTransferTermId(String(fallbackTermId || ""))
        setSubjectTransferSchoolYear(getCurrentSchoolYear())
        setSubjectTransferSemester(getCurrentSemester())
        setSubjectTransferScopeKeys([])
    }, [terms, selectedVersion])

    const resetSectionForm = React.useCallback(() => {
        const defaultTerm = selectedVersion ? termMap.get(String(selectedVersion.termId)) ?? null : null

        setSectionTermMode(CREATE_TERM_MODES.existing)
        setSectionTermId(String(selectedVersion?.termId || terms[0]?.$id || ""))
        setSectionSchoolYear(String(defaultTerm?.schoolYear || getCurrentSchoolYear()))
        setSectionSemester(String(defaultTerm?.semester || getCurrentSemester()))
        setSectionProgramId((current) => {
            if (current && programs.some((program) => program.$id === current)) return current
            return programs[0]?.$id || ""
        })
        setSectionYearLevel(YEAR_LEVEL_OPTIONS[0])
        setSectionName("")
    }, [programs, selectedVersion, termMap, terms])

    const openSubjectManagementDialog = React.useCallback(
        (mode: Exclude<SubjectManagementDialogMode, null>) => {
            if (mode === "new") {
                resetSubjectForm()
            } else {
                resetBulkLinkForm()
            }

            setSubjectManagementDialogMode(mode)
        },
        [resetBulkLinkForm, resetSubjectForm]
    )

    const handleSubjectManagementDialogChange = React.useCallback((nextOpen: boolean) => {
        if (!nextOpen) {
            setSubjectManagementDialogMode(null)
        }
    }, [])

    const handleSubjectDetailsDialogOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            setSubjectDetailsDialogOpen(nextOpen)
            if (!nextOpen) {
                resetSubjectTransferForm()
            }
        },
        [resetSubjectTransferForm]
    )

    const openSubjectDetailsDialog = React.useCallback(() => {
        resetSubjectTransferForm()
        setSubjectDetailsDialogOpen(true)
    }, [resetSubjectTransferForm])

    const openSectionDialog = React.useCallback(() => {
        resetSectionForm()
        setSectionDialogOpen(true)
    }, [resetSectionForm])

    const openCreateVersion = React.useCallback(() => {
        resetCreateForm()
        setCreateOpen(true)
    }, [resetCreateForm])

    const openEditVersion = React.useCallback((version: ScheduleVersionDoc) => {
        const term = terms.find((item) => item.$id === String(version.termId)) || null

        setEditingVersion(version)
        setCreateTermMode(CREATE_TERM_MODES.existing)
        setCreateTermId(String(version.termId || ""))
        setCreateSchoolYear(String(term?.schoolYear || getCurrentSchoolYear()))
        setCreateSemester(String(term?.semester || getCurrentSemester()))
        setCreateDeptId(String(version.departmentId || ""))
        setCreateLabel(String(version.label || ""))
        setCreateNotes(String(version.notes || ""))
        setCreateSetActive(normalizeScheduleStatus(version.status) === "Active")
        setCreateOpen(true)
    }, [terms])

    const saveVersion = async () => {
        let termIdToUse = createTermId

        if (createTermMode === CREATE_TERM_MODES.new) {
            const schoolYear = String(createSchoolYear || "").trim()
            const semester = String(createSemester || "").trim()

            if (!schoolYear) {
                toast.error("Please select a school year.")
                return
            }

            if (!semester) {
                toast.error("Please select a semester.")
                return
            }

            const existingTerm = terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            )

            if (existingTerm?.$id) {
                termIdToUse = String(existingTerm.$id)
            }
        }

        if (!termIdToUse && createTermMode !== CREATE_TERM_MODES.new) {
            toast.error("Please select an Academic Term.")
            return
        }

        if (!createDeptId) {
            toast.error("Please select a College.")
            return
        }
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            if (createTermMode === CREATE_TERM_MODES.new && !termIdToUse) {
                const schoolYear = String(createSchoolYear || "").trim()
                const semester = String(createSemester || "").trim()
                const { startDate, endDate } = getAcademicTermDateRange(schoolYear, semester)

                const createdTerm = (await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    ID.unique(),
                    {
                        schoolYear,
                        semester,
                        startDate,
                        endDate,
                        isActive: false,
                        isLocked: false,
                    }
                )) as AcademicTermDoc

                termIdToUse = String(createdTerm?.$id || "")
            }

            if (!termIdToUse) {
                toast.error("Please select or create an Academic Term.")
                return
            }

            if (createSetActive) {
                const others = versions.filter(
                    (x) =>
                        x.$id !== editingVersion?.$id &&
                        String(x.termId) === String(termIdToUse) &&
                        String(x.departmentId) === String(createDeptId) &&
                        isActiveScheduleStatus(x.status)
                )

                for (const other of others) {
                    try {
                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, other.$id, {
                            ...buildScheduleStatusPayload("Draft", userId),
                        })
                    } catch {
                        // best effort
                    }
                }
            }

            const computedVersionNumber = editingVersion
                ? String(editingVersion.termId) === String(termIdToUse) &&
                  String(editingVersion.departmentId) === String(createDeptId)
                    ? Number(editingVersion.version || 1)
                    : versions
                          .filter(
                              (v) =>
                                  v.$id !== editingVersion.$id &&
                                  String(v.termId) === String(termIdToUse) &&
                                  String(v.departmentId) === String(createDeptId)
                          )
                          .reduce((acc, v) => Math.max(acc, Number(v.version || 0)), 0) + 1
                : versions
                      .filter(
                          (v) =>
                              String(v.termId) === String(termIdToUse) &&
                              String(v.departmentId) === String(createDeptId)
                      )
                      .reduce((acc, v) => Math.max(acc, Number(v.version || 0)), 0) + 1

            if (editingVersion) {
                const currentStatus = normalizeScheduleStatus(editingVersion.status)
                const nextStatus = createSetActive
                    ? "Active"
                    : currentStatus === "Active"
                      ? "Draft"
                      : currentStatus

                const payload: any = {
                    termId: termIdToUse,
                    departmentId: createDeptId,
                    version: computedVersionNumber,
                    label: createLabel.trim() || editingVersion.label?.trim() || `Semester ${computedVersionNumber}`,
                    ...buildScheduleStatusPayload(nextStatus, userId, editingVersion.status),
                    notes: createNotes.trim() || null,
                }

                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, editingVersion.$id, payload)

                const termOrDeptChanged =
                    String(editingVersion.termId) !== String(termIdToUse) ||
                    String(editingVersion.departmentId) !== String(createDeptId)

                if (termOrDeptChanged) {
                    const classRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASSES, [
                        Query.equal("versionId", editingVersion.$id),
                        Query.limit(5000),
                    ])

                    for (const classDoc of (classRes?.documents ?? []) as ClassDoc[]) {
                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASSES, classDoc.$id, {
                            termId: termIdToUse,
                            departmentId: createDeptId,
                        })
                    }
                }

                toast.success("Schedule semester updated.")
            } else {
                const payload: any = {
                    termId: termIdToUse,
                    departmentId: createDeptId,
                    version: computedVersionNumber,
                    label: createLabel.trim() || `Semester ${computedVersionNumber}`,
                    ...buildScheduleStatusPayload(createSetActive ? "Active" : "Draft", userId),
                    createdBy: userId,
                    notes: createNotes.trim() || null,
                }

                await databases.createDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, ID.unique(), payload)

                toast.success(
                    createTermMode === CREATE_TERM_MODES.new
                        ? "Schedule semester created with academic term"
                        : "Schedule semester created"
                )
            }
            setCreateOpen(false)
            resetCreateForm()
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to create schedule semester.")
        } finally {
            setSaving(false)
        }
    }

    const setStatus = async (it: ScheduleVersionDoc, next: ScheduleStatus) => {
        if (!it?.$id) return
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            if (next === "Active") {
                const others = versions.filter(
                    (x) =>
                        x.$id !== it.$id &&
                        String(x.termId) === String(it.termId) &&
                        String(x.departmentId) === String(it.departmentId) &&
                        isActiveScheduleStatus(x.status)
                )

                for (const o of others) {
                    try {
                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, o.$id, {
                            ...buildScheduleStatusPayload("Draft", userId),
                        })
                    } catch {
                        // best effort
                    }
                }
            }

            const payload: any = buildScheduleStatusPayload(next, userId, it.status)

            await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, it.$id, payload)

            if (normalizeScheduleStatus(payload.status) === "Active") {
                setSelectedVersionId(it.$id)
            }

            toast.success(`Schedule semester set to ${normalizeScheduleStatus(payload.status)}`)
            setViewOpen(false)
            setActive(null)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update schedule semester status.")
        } finally {
            setSaving(false)
        }
    }

    const deleteVersion = async (it: ScheduleVersionDoc) => {
        if (!it?.$id) return

        setSaving(true)
        try {
            const [meetingRes, classRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, [
                    Query.equal("versionId", it.$id),
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASSES, [
                    Query.equal("versionId", it.$id),
                    Query.limit(5000),
                ]),
            ])

            const meetingDocs = (meetingRes?.documents ?? []) as ClassMeetingDoc[]
            const classDocs = (classRes?.documents ?? []) as ClassDoc[]

            for (const meeting of meetingDocs) {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meeting.$id)
            }

            for (const classDoc of classDocs) {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.CLASSES, classDoc.$id)
            }

            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, it.$id)

            if (selectedVersionId === it.$id) {
                setSelectedVersionId("")
            }

            if (active?.$id === it.$id) {
                setViewOpen(false)
                setActive(null)
            }

            if (editingVersion?.$id === it.$id) {
                setCreateOpen(false)
                resetCreateForm()
            }

            toast.success("Schedule semester deleted.")
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete schedule semester.")
        } finally {
            setSaving(false)
        }
    }

    const courseYearOptions = React.useMemo(() => buildCourseYearScopeOptions(sections), [sections])
    const transferCourseYearOptions = React.useMemo(
        () => buildProgramYearScopeOptions(programs, YEAR_LEVEL_OPTIONS),
        [programs]
    )

    const selectedSubjectScopeOptions = React.useMemo(
        () => courseYearOptions.filter((option) => subjectScopeKeys.includes(option.key)),
        [courseYearOptions, subjectScopeKeys]
    )

    const selectedBulkLinkScopeOptions = React.useMemo(
        () => courseYearOptions.filter((option) => bulkLinkScopeKeys.includes(option.key)),
        [courseYearOptions, bulkLinkScopeKeys]
    )

    const selectedTransferScopeOptions = React.useMemo(
        () => transferCourseYearOptions.filter((option) => subjectTransferScopeKeys.includes(option.key)),
        [transferCourseYearOptions, subjectTransferScopeKeys]
    )

    const subjectScopeKeySet = React.useMemo(() => new Set(subjectScopeKeys), [subjectScopeKeys])
    const bulkLinkScopeKeySet = React.useMemo(() => new Set(bulkLinkScopeKeys), [bulkLinkScopeKeys])
    const bulkLinkSubjectIdSet = React.useMemo(() => new Set(bulkLinkSubjectIds), [bulkLinkSubjectIds])
    const subjectTransferScopeKeySet = React.useMemo(() => new Set(subjectTransferScopeKeys), [subjectTransferScopeKeys])
    const subjectTransferIdSet = React.useMemo(() => new Set(subjectTransferIds), [subjectTransferIds])

    const allSubjectScopesSelected =
        courseYearOptions.length > 0 && courseYearOptions.every((option) => subjectScopeKeySet.has(option.key))
    const someSubjectScopesSelected =
        !allSubjectScopesSelected && courseYearOptions.some((option) => subjectScopeKeySet.has(option.key))

    const allBulkLinkScopesSelected =
        courseYearOptions.length > 0 && courseYearOptions.every((option) => bulkLinkScopeKeySet.has(option.key))
    const someBulkLinkScopesSelected =
        !allBulkLinkScopesSelected && courseYearOptions.some((option) => bulkLinkScopeKeySet.has(option.key))

    const allTransferScopesSelected =
        transferCourseYearOptions.length > 0 && transferCourseYearOptions.every((option) => subjectTransferScopeKeySet.has(option.key))
    const someTransferScopesSelected =
        !allTransferScopesSelected && transferCourseYearOptions.some((option) => subjectTransferScopeKeySet.has(option.key))

    const selectedSectionProgram = React.useMemo(
        () => programs.find((program) => program.$id === sectionProgramId) || null,
        [programs, sectionProgramId]
    )

    const buildSubjectScopePayload = React.useCallback(
        (
            selectedOptions: CourseYearScopeOption[],
            overrides?: {
                termId?: string | null
                departmentId?: string | null
            }
        ) => {
            const programIds = uniqStrings(selectedOptions.map((option) => option.programId || ""))
            const programCodes = uniqStrings(selectedOptions.map((option) => option.programCode || ""))
            const programNames = uniqStrings(selectedOptions.map((option) => option.programName || ""))
            const yearLevels = uniqYearValues(selectedOptions.map((option) => option.yearLevel))

            return {
                termId: overrides?.termId ?? selectedVersion?.termId ?? null,
                departmentId: overrides?.departmentId ?? selectedVersion?.departmentId ?? null,
                programId: programIds[0] || null,
                programIds: programIds.length > 0 ? programIds : null,
                programCode: programCodes[0] || null,
                programCodes: programCodes.length > 0 ? programCodes : null,
                programName: programNames[0] || null,
                yearLevel: yearLevels[0] || null,
                yearLevels: yearLevels.length > 0 ? yearLevels : null,
                sectionId: null,
                sectionIds: null,
                linkedSectionId: null,
                linkedSectionIds: null,
            }
        },
        [selectedVersion]
    )

    const sanitizeSubjectWritePayload = React.useCallback((payload: Record<string, any>) => {
        const nextPayload: Record<string, any> = {}
        const allowedKeys = [
            "termId",
            "departmentId",
            "programId",
            "programIds",
            "programCode",
            "programCodes",
            "programName",
            "yearLevel",
            "yearLevels",
            "sectionId",
            "sectionIds",
            "linkedSectionId",
            "linkedSectionIds",
            "code",
            "title",
            "units",
            "lectureHours",
            "labHours",
            "totalHours",
            "isActive",
        ] as const

        for (const key of allowedKeys) {
            if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
                nextPayload[key] = payload[key]
            }
        }

        return nextPayload
    }, [])

    const fetchScheduleContext = React.useCallback(async () => {
        if (!selectedVersion) {
            setSubjects([])
            setSubjectDirectory([])
            setRooms([])
            setSections([])
            setPrograms([])
            setFacultyProfiles([])
            setClasses([])
            setMeetings([])
            setEntriesError(null)
            return
        }

        setEntriesLoading(true)
        setEntriesError(null)

        try {
            const [cRes, mRes, subjRes, roomRes, secRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASSES, [
                    Query.equal("versionId", selectedVersion.$id),
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, [
                    Query.equal("versionId", selectedVersion.$id),
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SUBJECTS, [Query.limit(5000)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROOMS, [Query.limit(2000)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SECTIONS, [
                    Query.equal("termId", selectedVersion.termId),
                    Query.equal("departmentId", selectedVersion.departmentId),
                    Query.limit(2000),
                ]),
            ])

            let facultyDocs: UserProfileDoc[] = []
            let programDocs: ProgramDoc[] = []

            try {
                const fRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.equal("role", "FACULTY"),
                    Query.limit(2000),
                ])
                facultyDocs = (fRes?.documents ?? []) as UserProfileDoc[]
            } catch {
                const fResFallback = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.limit(2000),
                ])
                facultyDocs = ((fResFallback?.documents ?? []) as UserProfileDoc[]).filter((x) =>
                    roleLooksLikeFaculty(x.role)
                )
            }

            try {
                const programsCollectionId = String((COLLECTIONS as any).PROGRAMS || "").trim()

                if (programsCollectionId) {
                    const programRes = await databases.listDocuments(DATABASE_ID, programsCollectionId, [
                        Query.equal("departmentId", selectedVersion.departmentId),
                        Query.limit(2000),
                    ])

                    programDocs = ((programRes?.documents ?? []) as ProgramDoc[])
                        .filter((program) => program.isActive !== false)
                        .sort((left, right) =>
                            String(left.code || left.name || "").localeCompare(String(right.code || right.name || ""))
                        )
                }
            } catch {
                programDocs = []
            }

            const allSubjects = (subjRes?.documents ?? []) as SubjectDoc[]
            const selectedVersionDeptId = String(selectedVersion.departmentId || "").trim()
            const selectedVersionTermId = String(selectedVersion.termId || "").trim()

            const departmentSubjects = allSubjects
                .filter((s) => s.isActive !== false)
                .filter((s) => {
                    const subjectDeptId = String(s.departmentId || "").trim()
                    return !subjectDeptId || subjectDeptId === selectedVersionDeptId
                })
                .sort((a, b) => {
                    const ac = String(a.code || "").toLowerCase()
                    const bc = String(b.code || "").toLowerCase()
                    if (ac !== bc) return ac.localeCompare(bc)
                    return String(a.title || "").localeCompare(String(b.title || ""))
                })

            const scopedSubjects = departmentSubjects
                .filter((s) => {
                    const subjectTermId = String(s.termId || "").trim()
                    if (subjectTermId && selectedVersionTermId && subjectTermId !== selectedVersionTermId) {
                        return false
                    }

                    return true
                })

            const scopedRooms = ((roomRes?.documents ?? []) as RoomDoc[])
                .filter((r) => r.isActive !== false)
                .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")))

            const scopedSections = ((secRes?.documents ?? []) as SectionDoc[])
                .filter((s) => s.isActive !== false)
                .sort(sortSectionsForDisplay)

            const scopedFaculty = facultyDocs
                .filter((f) => f.isActive !== false)
                .sort((a, b) =>
                    String(a.name || a.email || a.userId || "").localeCompare(
                        String(b.name || b.email || b.userId || "")
                    )
                )

            setClasses((cRes?.documents ?? []) as ClassDoc[])
            setMeetings((mRes?.documents ?? []) as ClassMeetingDoc[])
            setSubjects(scopedSubjects)
            setSubjectDirectory(departmentSubjects)
            setRooms(scopedRooms)
            setSections(scopedSections)
            setPrograms(programDocs)
            setFacultyProfiles(scopedFaculty)
        } catch (e: any) {
            setEntriesError(e?.message || "Failed to load schedule entries.")
        } finally {
            setEntriesLoading(false)
        }
    }, [selectedVersion])

    React.useEffect(() => {
        void fetchScheduleContext()
    }, [fetchScheduleContext])

    React.useEffect(() => {
        setSectionProgramId((current) => {
            if (current && programs.some((program) => program.$id === current)) {
                return current
            }

            return programs[0]?.$id || ""
        })
    }, [programs])

    React.useEffect(() => {
        setFormSubjectIds((prev) => {
            const availableIds = new Set(filteredFormSubjects.map((subject) => subject.$id))
            const currentSelection = prev.find((subjectId) => availableIds.has(subjectId))

            if (currentSelection) {
                return [currentSelection]
            }

            const fallbackSubjectId = filteredFormSubjects[0]?.$id || ""
            if (!fallbackSubjectId) return []

            return [fallbackSubjectId]
        })
    }, [filteredFormSubjects])

    React.useEffect(() => {
        setBulkLinkSubjectIds((prev) => prev.filter((subjectId) => subjectDirectory.some((subject) => subject.$id === subjectId)))
    }, [subjectDirectory])

    React.useEffect(() => {
        setSubjectTransferIds((prev) => prev.filter((subjectId) => subjects.some((subject) => subject.$id === subjectId)))
    }, [subjects])

    React.useEffect(() => {
        if (!selectedVersion) {
            setSubjectDetailsDialogOpen(false)
        }
    }, [selectedVersion])

    const scheduleRows = React.useMemo<ScheduleRow[]>(() => {
        const classMap = new Map<string, ClassDoc>()
        classes.forEach((c) => classMap.set(c.$id, c))

        const rows: ScheduleRow[] = []

        for (const m of meetings) {
            const c = classMap.get(String(m.classId))
            if (!c) continue

            const subject = subjectMap.get(String(c.subjectId))
            const section = sectionMap.get(String(c.sectionId))
            const room = roomMap.get(String(m.roomId || ""))

            const manualFaculty = extractManualFaculty(c.remarks)
            const facultyUserId = String(c.facultyUserId || "").trim()
            const facultyName = facultyUserId
                ? facultyNameMap.get(facultyUserId) || facultyUserId
                : manualFaculty || "Unassigned"

            const facultyKey = facultyUserId
                ? `uid:${facultyUserId}`
                : manualFaculty
                  ? `manual:${normalizeText(manualFaculty)}`
                  : ""

            const subjectCode = String(subject?.code || "").trim()
            const subjectTitle = String(subject?.title || "").trim()
            const subjectLabel = [subjectCode, subjectTitle].filter(Boolean).join(" • ") || c.subjectId

            const sectionAny = (section || {}) as any
            const secName = String(section?.name || "").trim()
            const secYearRaw = section?.yearLevel ?? sectionAny.yearLevel ?? null
            const secYearText = String(secYearRaw ?? "").trim()
            const secProgramCode = String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim()
            const secProgramName = String(sectionAny.programName || sectionAny.sectionProgramName || "").trim()
            const sectionLabel =
                String(section?.label || sectionAny.sectionLabel || "").trim() ||
                (secName ? `${secYearText ? `Y${secYearText}` : "Y?"} - ${secName}` : c.sectionId)

            const roomCode = String(room?.code || "").trim()
            const roomName = String(room?.name || "").trim()
            const roomLabel = [roomCode, roomName].filter(Boolean).join(" • ") || "Unassigned"
            const normalizedMeetingDayOfWeek = getCanonicalDayValue(String(m.dayOfWeek || "").trim())

            rows.push({
                meetingId: m.$id,
                classId: c.$id,

                versionId: String(c.versionId || m.versionId || ""),
                termId: String(c.termId || ""),
                departmentId: String(c.departmentId || ""),

                dayOfWeek: normalizedMeetingDayOfWeek,
                startTime: String(m.startTime || ""),
                endTime: String(m.endTime || ""),
                meetingType: (m.meetingType || "LECTURE") as MeetingType,

                roomId: String(m.roomId || ""),
                roomType: String(room?.type || ""),
                roomLabel,

                sectionId: String(c.sectionId || ""),
                sectionLabel,
                sectionYearLevel: secYearRaw,
                sectionName: secName || null,
                sectionProgramCode: secProgramCode || null,
                sectionProgramName: secProgramName || null,

                subjectId: String(c.subjectId || ""),
                subjectLabel,
                subjectUnits: subject?.units != null ? Number(subject.units) : null,

                facultyUserId,
                facultyName,
                manualFaculty,
                facultyKey,
                isManualFaculty: !facultyUserId && Boolean(manualFaculty),

                classCode: String(c.classCode || ""),
                deliveryMode: String(c.deliveryMode || ""),
                classStatus: String(c.status || "Planned"),
                classRemarks: stripManualFacultyTag(c.remarks),
            })
        }

        rows.sort((a, b) => {
            const classCompare = String(a.classId || "").localeCompare(String(b.classId || ""))
            if (classCompare !== 0) return classCompare

            const d = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
            if (d !== 0) return d

            const ts = hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime)
            if (ts !== 0) return ts

            return a.subjectLabel.localeCompare(b.subjectLabel)
        })

        return rows
    }, [classes, meetings, subjectMap, sectionMap, roomMap, facultyNameMap])

    const conflictFlagsByMeetingId = React.useMemo(() => {
        const map = new Map<string, ConflictFlags>()

        for (const row of scheduleRows) {
            map.set(row.meetingId, {
                room: false,
                faculty: false,
                section: false,
            })
        }

        const mark = (id: string, type: "room" | "faculty" | "section") => {
            const current = map.get(id)
            if (!current) return
            current[type] = true
        }

        for (let i = 0; i < scheduleRows.length; i += 1) {
            for (let j = i + 1; j < scheduleRows.length; j += 1) {
                const a = scheduleRows[i]
                const b = scheduleRows[j]

                if (!dayExpressionsOverlap(a.dayOfWeek, b.dayOfWeek)) continue
                if (!rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue

                if (a.roomId && b.roomId && a.roomId === b.roomId) {
                    mark(a.meetingId, "room")
                    mark(b.meetingId, "room")
                }

                if (a.facultyKey && b.facultyKey && a.facultyKey === b.facultyKey) {
                    mark(a.meetingId, "faculty")
                    mark(b.meetingId, "faculty")
                }

                if (a.sectionId && b.sectionId && a.sectionId === b.sectionId) {
                    mark(a.meetingId, "section")
                    mark(b.meetingId, "section")
                }
            }
        }

        return map
    }, [scheduleRows])

    const conflictedRows = React.useMemo(() => {
        return scheduleRows.filter((r) => {
            const f = conflictFlagsByMeetingId.get(r.meetingId)
            return Boolean(f?.room || f?.faculty || f?.section)
        })
    }, [scheduleRows, conflictFlagsByMeetingId])

    const visibleRows = React.useMemo(() => {
        if (!showConflictsOnly) return scheduleRows
        return conflictedRows
    }, [scheduleRows, conflictedRows, showConflictsOnly])

    const laboratoryRows = React.useMemo(() => {
        return scheduleRows.filter((r) => {
            const mType = meetingTypeLabel(r.meetingType)
            const rType = roomTypeLabel(r.roomType)
            return mType === "LAB" || rType === "LAB"
        })
    }, [scheduleRows])

    const manualFacultySuggestions = React.useMemo(() => {
        const set = new Set<string>()
        for (const r of scheduleRows) {
            const val = String(r.manualFaculty || "").trim()
            if (val) set.add(val)
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [scheduleRows])

    const resetEntryForm = React.useCallback(() => {
        const nextSectionId = sections[0]?.$id || ""
        const nextSection = sections.find((section) => section.$id === nextSectionId) || null
        const nextSubjects = filterSubjectsForSection(subjects, nextSection)

        setFormSectionId(nextSectionId)
        setFormSubjectIds(nextSubjects[0]?.$id ? [nextSubjects[0].$id] : [])
        setFormFacultyChoice(FACULTY_OPTION_NONE)
        setFormManualFaculty("")
        setFormRoomId(rooms[0]?.$id || "")
        setFormDayOfWeek(getCanonicalDayValue("Monday"))
        setFormStartTime("07:00")
        setFormEndTime("08:00")
        setFormMeetingType("LECTURE")
        setFormAllowConflictSave(false)
    }, [sections, subjects, rooms])

    const handleEntryDialogOpenChange = React.useCallback((nextOpen: boolean) => {
        setEntryDialogOpen(nextOpen)
        if (!nextOpen) {
            setFormAllowConflictSave(false)
            setEditingEntry(null)
        }
    }, [])

    const openCreateEntry = React.useCallback(() => {
        setEditingEntry(null)
        resetEntryForm()
        setEntryDialogOpen(true)
    }, [resetEntryForm])

    const openEditEntry = React.useCallback((row: ScheduleRow) => {
        setEditingEntry(row)
        setFormSectionId(String(row.sectionId || ""))
        setFormSubjectIds(String(row.subjectId || "").trim() ? [String(row.subjectId || "")] : [])
        setFormFacultyChoice(
            row.isManualFaculty
                ? FACULTY_OPTION_MANUAL
                : row.facultyUserId
                  ? String(row.facultyUserId)
                  : FACULTY_OPTION_NONE
        )
        setFormManualFaculty(String(row.manualFaculty || ""))
        setFormRoomId(String(row.roomId || ""))
        setFormDayOfWeek(getCanonicalDayValue(String(row.dayOfWeek || "Monday")))
        setFormStartTime(String(row.startTime || "07:00"))
        setFormEndTime(String(row.endTime || "08:00"))
        setFormMeetingType((row.meetingType || "LECTURE") as MeetingType)
        setFormAllowConflictSave(false)
        setEntryDialogOpen(true)
    }, [])

    const candidateConflicts = React.useMemo<CandidateConflict[]>(() => {
        if (!entryDialogOpen) return []
        if (!selectedVersion) return []
        if (!formDayOfWeek || !formStartTime || !formEndTime) return []

        const candidateFacultyKey =
            formFacultyChoice === FACULTY_OPTION_MANUAL
                ? formManualFaculty.trim()
                    ? `manual:${normalizeText(formManualFaculty)}`
                    : ""
                : formFacultyChoice === FACULTY_OPTION_NONE
                  ? ""
                  : `uid:${formFacultyChoice}`

        const out: CandidateConflict[] = []

        for (const r of scheduleRows) {
            if (editingEntry && (r.meetingId === editingEntry.meetingId || r.classId === editingEntry.classId)) {
                continue
            }
            if (!dayExpressionsOverlap(r.dayOfWeek, formDayOfWeek)) continue
            if (!rangesOverlap(r.startTime, r.endTime, formStartTime, formEndTime)) continue

            if (formRoomId && r.roomId && formRoomId === r.roomId) {
                out.push({ type: "room", row: r })
            }

            if (candidateFacultyKey && r.facultyKey && candidateFacultyKey === r.facultyKey) {
                out.push({ type: "faculty", row: r })
            }

            if (formSectionId && r.sectionId && formSectionId === r.sectionId) {
                out.push({ type: "section", row: r })
            }
        }

        return out
    }, [
        entryDialogOpen,
        selectedVersion,
        formDayOfWeek,
        formStartTime,
        formEndTime,
        formRoomId,
        formFacultyChoice,
        formManualFaculty,
        formSectionId,
        scheduleRows,
        editingEntry,
    ])

    const candidateConflictCounts = React.useMemo(() => {
        const counts = { room: 0, faculty: 0, section: 0 }
        for (const c of candidateConflicts) {
            counts[c.type] += 1
        }
        return counts
    }, [candidateConflicts])

    const saveEntry = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule semester first.")
            return
        }

        if (!formSectionId) {
            toast.error("Please select a section.")
            return
        }

        const selectedSubjectId = String(formSubjectIds[0] || "").trim()

        if (!selectedSubjectId) {
            toast.error("Please select a subject.")
            return
        }

        if (!formRoomId) {
            toast.error("Please select a room.")
            return
        }

        if (!formDayOfWeek) {
            toast.error("Please select a day.")
            return
        }

        if (!formStartTime || !formEndTime) {
            toast.error("Please select both start and end time.")
            return
        }

        const startMin = hhmmToMinutes(formStartTime)
        const endMin = hhmmToMinutes(formEndTime)

        if (startMin >= endMin) {
            toast.error("End time must be later than start time.")
            return
        }

        if (formFacultyChoice === FACULTY_OPTION_MANUAL && !formManualFaculty.trim()) {
            toast.error("Please enter manual faculty name.")
            return
        }

        if (candidateConflicts.length > 0 && !formAllowConflictSave) {
            toast.error("Conflict detected. Resolve conflicts or enable override.")
            return
        }

        setEntrySaving(true)
        try {
            const manualFaculty = formFacultyChoice === FACULTY_OPTION_MANUAL ? formManualFaculty.trim() : ""
            const facultyUserId =
                formFacultyChoice === FACULTY_OPTION_NONE || formFacultyChoice === FACULTY_OPTION_MANUAL
                    ? null
                    : formFacultyChoice
            const selectedSectionForPayload =
                sections.find((section) => section.$id === formSectionId) || null

            const classPayload: any = {
                versionId: selectedVersion.$id,
                termId: selectedVersion.termId,
                departmentId: selectedVersion.departmentId,
                programId: selectedSectionForPayload?.programId || null,
                sectionId: formSectionId,
                facultyUserId,
                classCode: null,
                deliveryMode: null,
                remarks: composeRemarks("", manualFaculty),
            }

            if (editingEntry) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingEntry.classId,
                    {
                        ...classPayload,
                        subjectId: selectedSubjectId,
                    }
                )

                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    editingEntry.meetingId,
                    {
                        dayOfWeek: getCanonicalDayValue(formDayOfWeek),
                        startTime: formStartTime,
                        endTime: formEndTime,
                        roomId: formRoomId || null,
                        meetingType: formMeetingType,
                    }
                )

                toast.success("Schedule entry updated.")
            } else {
                const createdClass = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    ID.unique(),
                    {
                        ...classPayload,
                        subjectId: selectedSubjectId,
                        status: "Planned",
                    }
                )

                await databases.createDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, ID.unique(), {
                    versionId: selectedVersion.$id,
                    classId: createdClass.$id,
                    dayOfWeek: getCanonicalDayValue(formDayOfWeek),
                    startTime: formStartTime,
                    endTime: formEndTime,
                    roomId: formRoomId || null,
                    meetingType: formMeetingType,
                })

                toast.success("Schedule entry created.")
            }

            handleEntryDialogOpenChange(false)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save schedule entry.")
        } finally {
            setEntrySaving(false)
        }
    }

    const deleteEntry = async () => {
        if (!editingEntry) {
            toast.error("No schedule entry selected.")
            return
        }

        setEntrySaving(true)
        try {
            const siblingMeetings = meetings.filter(
                (meeting) =>
                    String(meeting.classId || "") === String(editingEntry.classId || "") &&
                    String(meeting.$id || "") !== String(editingEntry.meetingId || "")
            )

            await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.CLASS_MEETINGS,
                editingEntry.meetingId
            )

            if (siblingMeetings.length === 0) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingEntry.classId
                )
            }

            toast.success("Schedule entry deleted.")
            handleEntryDialogOpenChange(false)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete schedule entry.")
        } finally {
            setEntrySaving(false)
        }
    }

    const saveSubject = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule semester first.")
            return
        }

        if (!subjectCode.trim()) {
            toast.error("Please enter a subject code.")
            return
        }

        if (!subjectTitle.trim()) {
            toast.error("Please enter a subject title.")
            return
        }

        if (subjectScopeKeys.length === 0) {
            toast.error("Please choose at least one course/year scope.")
            return
        }

        const unitsValue = subjectUnits.trim()
        const parsedUnits = unitsValue ? Number(unitsValue) : null
        if (unitsValue && !Number.isFinite(parsedUnits)) {
            toast.error("Units must be a valid number.")
            return
        }

        setSubjectSaving(true)
        try {
            const payload = sanitizeSubjectWritePayload({
                code: subjectCode.trim(),
                title: subjectTitle.trim(),
                units: parsedUnits,
                isActive: true,
                ...buildSubjectScopePayload(selectedSubjectScopeOptions),
            })

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SUBJECTS,
                ID.unique(),
                payload
            )

            toast.success("Subject created and linked to the selected semester.")
            resetSubjectForm()
            setSubjectManagementDialogMode(null)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to create subject.")
        } finally {
            setSubjectSaving(false)
        }
    }

    const bulkLinkSubjects = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule semester first.")
            return
        }

        if (bulkLinkSubjectIds.length === 0) {
            toast.error("Please select at least one existing subject.")
            return
        }

        if (selectedBulkLinkScopeOptions.length === 0) {
            toast.error("Please choose at least one course/year scope.")
            return
        }

        setSubjectSaving(true)
        try {
            for (const subjectId of bulkLinkSubjectIds) {
                const existingSubject = subjectDirectory.find((subject) => subject.$id === subjectId)
                const nextPayload = sanitizeSubjectWritePayload({
                    ...buildSubjectScopePayload(selectedBulkLinkScopeOptions, {
                        termId: selectedVersion.termId || existingSubject?.termId || null,
                        departmentId: selectedVersion.departmentId || existingSubject?.departmentId || null,
                    }),
                })

                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, subjectId, nextPayload)
            }

            toast.success("Selected subjects linked to the selected semester.")
            resetBulkLinkForm()
            setSubjectManagementDialogMode(null)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to link selected subjects.")
        } finally {
            setSubjectSaving(false)
        }
    }

    const transferSubjects = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule semester first.")
            return
        }

        if (subjectTransferIds.length === 0) {
            toast.error("Please select at least one subject to transfer.")
            return
        }

        let targetTermIdToUse = subjectTransferTermId

        if (subjectTransferTermMode === CREATE_TERM_MODES.new) {
            const schoolYear = String(subjectTransferSchoolYear || "").trim()
            const semester = String(subjectTransferSemester || "").trim()

            if (!schoolYear) {
                toast.error("Please select or enter a target school year.")
                return
            }

            if (!parseSchoolYear(schoolYear)) {
                toast.error("Target school year must use the YYYY-YYYY format.")
                return
            }

            if (!semester) {
                toast.error("Please select a target semester.")
                return
            }

            const existingTerm = terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            )

            if (existingTerm?.$id) {
                targetTermIdToUse = String(existingTerm.$id)
            }
        }

        if (!targetTermIdToUse && subjectTransferTermMode !== CREATE_TERM_MODES.new) {
            toast.error("Please select a target academic term.")
            return
        }

        if (selectedTransferScopeOptions.length === 0) {
            toast.error("Please choose at least one target course/year level.")
            return
        }

        setSubjectTransferSaving(true)
        try {
            if (subjectTransferTermMode === CREATE_TERM_MODES.new && !targetTermIdToUse) {
                const schoolYear = String(subjectTransferSchoolYear || "").trim()
                const semester = String(subjectTransferSemester || "").trim()
                const { startDate, endDate } = getAcademicTermDateRange(schoolYear, semester)

                const createdTerm = (await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    ID.unique(),
                    {
                        schoolYear,
                        semester,
                        startDate,
                        endDate,
                        isActive: false,
                        isLocked: false,
                    }
                )) as AcademicTermDoc

                targetTermIdToUse = String(createdTerm?.$id || "")
            }

            if (!targetTermIdToUse) {
                toast.error("Please select or create a target academic term.")
                return
            }

            if (String(targetTermIdToUse) === String(selectedVersion.termId || "")) {
                toast.error("Please choose another semester before transferring subjects.")
                return
            }

            const payload = sanitizeSubjectWritePayload(
                buildSubjectScopePayload(selectedTransferScopeOptions, {
                    termId: targetTermIdToUse,
                    departmentId: String(selectedVersion.departmentId || "") || null,
                })
            )

            for (const subjectId of subjectTransferIds) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, subjectId, payload)
            }

            const targetTermLabel =
                termLabel(termMap.get(String(targetTermIdToUse)) ?? null) ||
                [subjectTransferSchoolYear, subjectTransferSemester].filter(Boolean).join(" • ") ||
                "the selected semester"

            toast.success(
                `${subjectTransferIds.length} subject${subjectTransferIds.length === 1 ? "" : "s"} transferred to ${targetTermLabel}.`
            )
            resetSubjectTransferForm()
            await fetchAll()
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to transfer subjects.")
        } finally {
            setSubjectTransferSaving(false)
        }
    }

    const saveSection = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule semester first.")
            return
        }

        let sectionTermIdToUse = sectionTermId

        if (sectionTermMode === CREATE_TERM_MODES.new) {
            const schoolYear = String(sectionSchoolYear || "").trim()
            const semester = String(sectionSemester || "").trim()

            if (!schoolYear) {
                toast.error("Please select or enter a school year.")
                return
            }

            if (!parseSchoolYear(schoolYear)) {
                toast.error("School year must use the YYYY-YYYY format.")
                return
            }

            if (!semester) {
                toast.error("Please select a semester.")
                return
            }

            const existingTerm = terms.find(
                (term) =>
                    normalizeText(term.schoolYear) === normalizeText(schoolYear) &&
                    normalizeText(term.semester) === normalizeText(semester)
            )

            if (existingTerm?.$id) {
                sectionTermIdToUse = String(existingTerm.$id)
            }
        }

        if (!sectionTermIdToUse && sectionTermMode !== CREATE_TERM_MODES.new) {
            toast.error("Please select an academic term.")
            return
        }

        if (!sectionProgramId) {
            toast.error("Please select a course.")
            return
        }

        if (!sectionYearLevel.trim()) {
            toast.error("Please select a year level.")
            return
        }

        if (!sectionName.trim()) {
            toast.error("Please enter a section name.")
            return
        }

        const selectedProgram = programMap.get(sectionProgramId) || null
        if (!selectedProgram) {
            toast.error("Selected course could not be found.")
            return
        }

        setSectionSaving(true)
        try {
            if (sectionTermMode === CREATE_TERM_MODES.new && !sectionTermIdToUse) {
                const schoolYear = String(sectionSchoolYear || "").trim()
                const semester = String(sectionSemester || "").trim()
                const { startDate, endDate } = getAcademicTermDateRange(schoolYear, semester)

                const createdTerm = (await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.ACADEMIC_TERMS,
                    ID.unique(),
                    {
                        schoolYear,
                        semester,
                        startDate,
                        endDate,
                        isActive: false,
                        isLocked: false,
                    }
                )) as AcademicTermDoc

                sectionTermIdToUse = String(createdTerm?.$id || "")
            }

            if (!sectionTermIdToUse) {
                toast.error("Please select or create an academic term.")
                return
            }

            const normalizedSectionName = sectionName.trim()
            const normalizedYearLevel = normalizeYearLevelForDisplay(sectionYearLevel)

            const existingSectionRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SECTIONS, [
                Query.equal("termId", sectionTermIdToUse),
                Query.equal("departmentId", selectedVersion.departmentId),
                Query.limit(2000),
            ])

            const duplicateSection = ((existingSectionRes?.documents ?? []) as SectionDoc[]).some((section) =>
                String(section.programId || "") === sectionProgramId &&
                normalizeText(String(section.yearLevel || "")) === normalizeText(normalizedYearLevel) &&
                normalizeText(String(section.name || section.label || "")) === normalizeText(normalizedSectionName)
            )

            if (duplicateSection) {
                toast.error("That course/year section already exists for the selected term.")
                return
            }

            await databases.createDocument(DATABASE_ID, COLLECTIONS.SECTIONS, ID.unique(), {
                termId: sectionTermIdToUse,
                departmentId: selectedVersion.departmentId,
                programId: selectedProgram.$id,
                yearLevel: normalizedYearLevel,
                name: normalizedSectionName,
                label: buildSectionDisplayLabel(selectedProgram.code, selectedProgram.name, normalizedYearLevel, normalizedSectionName),
                programCode: selectedProgram.code || null,
                programName: selectedProgram.name || null,
                isActive: true,
            })

            toast.success(
                String(sectionTermIdToUse) === String(selectedVersion.termId)
                    ? "Course/year section created."
                    : `Course/year section created for ${selectedSectionTermLabel}.`
            )
            setSectionDialogOpen(false)
            resetSectionForm()
            await fetchAll()
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to create course/year section.")
        } finally {
            setSectionSaving(false)
        }
    }

    const plannerStats = React.useMemo(() => {
        const total = scheduleRows.length
        const conflicts = conflictedRows.length
        const labs = laboratoryRows.length
        return { total, conflicts, labs }
    }, [scheduleRows, conflictedRows, laboratoryRows])

    const versionSelectOptions = React.useMemo(() => {
        return versions
            .slice()
            .sort((a, b) => {
                const ad = new Date(a.$createdAt).getTime()
                const bd = new Date(b.$createdAt).getTime()
                return bd - ad
            })
            .map((v) => {
                const term = termMap.get(String(v.termId))
                const dept = deptMap.get(String(v.departmentId))
                const label = `Semester ${Number(v.version || 0)} • ${v.label || "Untitled"}`
                const meta = `${termLabel(term)} • ${deptLabel(dept)}`
                return {
                    value: v.$id,
                    label: `${label} (${normalizeScheduleStatus(v.status)})`,
                    meta,
                }
            })
    }, [versions, termMap, deptMap])

    const selectedVersionLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return `Semester ${Number(selectedVersion.version || 0)} • ${selectedVersion.label || "Untitled"} (${normalizeScheduleStatus(
            selectedVersion.status
        )})`
    }, [selectedVersion])

    const selectedTermLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return termLabel(termMap.get(String(selectedVersion.termId)) ?? null)
    }, [selectedVersion, termMap])

    const selectedDeptLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return deptLabel(deptMap.get(String(selectedVersion.departmentId)) ?? null)
    }, [selectedVersion, deptMap])

    const selectedSectionTermLabel = React.useMemo(() => {
        if (sectionTermMode === CREATE_TERM_MODES.new) {
            const schoolYear = String(sectionSchoolYear || "").trim()
            const semester = String(sectionSemester || "").trim()
            if (!schoolYear && !semester) return "—"
            return [schoolYear, semester].filter(Boolean).join(" • ")
        }

        if (!resolvedSectionTermId) return "—"
        return termLabel(termMap.get(String(resolvedSectionTermId)) ?? null)
    }, [sectionTermMode, sectionSchoolYear, sectionSemester, resolvedSectionTermId, termMap])

    const sectionSchoolYearSelectValue = sectionSchoolYearOptions.includes(sectionSchoolYear)
        ? sectionSchoolYear
        : CUSTOM_SCHOOL_YEAR_VALUE
    const showCustomSectionSchoolYearInput =
        sectionTermMode === CREATE_TERM_MODES.new && sectionSchoolYearSelectValue === CUSTOM_SCHOOL_YEAR_VALUE

    const selectedSubjectTransferTermLabel = React.useMemo(() => {
        if (subjectTransferTermMode === CREATE_TERM_MODES.new) {
            const schoolYear = String(subjectTransferSchoolYear || "").trim()
            const semester = String(subjectTransferSemester || "").trim()
            if (!schoolYear && !semester) return "—"
            return [schoolYear, semester].filter(Boolean).join(" • ")
        }

        if (!resolvedSubjectTransferTermId) return "—"
        return termLabel(termMap.get(String(resolvedSubjectTransferTermId)) ?? null)
    }, [
        subjectTransferTermMode,
        subjectTransferSchoolYear,
        subjectTransferSemester,
        resolvedSubjectTransferTermId,
        termMap,
    ])

    const subjectTransferSchoolYearSelectValue = subjectTransferSchoolYearOptions.includes(subjectTransferSchoolYear)
        ? subjectTransferSchoolYear
        : CUSTOM_SCHOOL_YEAR_VALUE
    const showCustomSubjectTransferSchoolYearInput =
        subjectTransferTermMode === CREATE_TERM_MODES.new &&
        subjectTransferSchoolYearSelectValue === CUSTOM_SCHOOL_YEAR_VALUE

    const filteredExistingSubjects = React.useMemo(() => {
        const query = subjectSearch.trim().toLowerCase()

        return subjectDirectory.filter((subject) => {
            if (!query) return true

            const haystack = [
                subject.code,
                subject.title,
                getSubjectScopeSummary(subject),
                termLabel(termMap.get(String(subject.termId || "")) ?? null),
            ]
                .join(" ")
                .toLowerCase()

            return haystack.includes(query)
        })
    }, [subjectDirectory, subjectSearch, termMap])

    const allFilteredExistingSubjectsSelected =
        filteredExistingSubjects.length > 0 &&
        filteredExistingSubjects.every((subject) => bulkLinkSubjectIdSet.has(subject.$id))
    const someFilteredExistingSubjectsSelected =
        !allFilteredExistingSubjectsSelected &&
        filteredExistingSubjects.some((subject) => bulkLinkSubjectIdSet.has(subject.$id))

    const filteredTransferSubjects = React.useMemo(() => {
        const query = subjectTransferSearch.trim().toLowerCase()

        return subjects.filter((subject) => {
            if (!query) return true

            const haystack = [subject.code, subject.title, getSubjectScopeSummary(subject)]
                .join(" ")
                .toLowerCase()

            return haystack.includes(query)
        })
    }, [subjects, subjectTransferSearch])

    const allFilteredTransferSubjectsSelected =
        filteredTransferSubjects.length > 0 &&
        filteredTransferSubjects.every((subject) => subjectTransferIdSet.has(subject.$id))
    const someFilteredTransferSubjectsSelected =
        !allFilteredTransferSubjectsSelected &&
        filteredTransferSubjects.some((subject) => subjectTransferIdSet.has(subject.$id))

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading || saving}>
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>

            <Button size="sm" onClick={openCreateVersion} disabled={loading || saving}>
                <BookPlus className="mr-2 size-4" />
                New Semester
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Schedules"
            actions={HeaderActions}
        >
            <div className="space-y-6 p-6">
                <VersionManagementSection
                    loading={loading}
                    saving={saving}
                    error={error}
                    terms={terms}
                    departments={departments}
                    termMap={termMap}
                    deptMap={deptMap}
                    stats={stats}
                    filtered={filtered}
                    tab={tab}
                    setTab={setTab}
                    search={search}
                    setSearch={setSearch}
                    filterTermId={filterTermId}
                    setFilterTermId={setFilterTermId}
                    filterDeptId={filterDeptId}
                    setFilterDeptId={setFilterDeptId}
                    selectedVersionId={selectedVersionId}
                    setSelectedVersionId={setSelectedVersionId}
                    onRefresh={() => void fetchAll()}
                    onOpenCreate={openCreateVersion}
                    onSetStatus={setStatus}
                    editingVersion={editingVersion}
                    onEditVersion={openEditVersion}
                    onDeleteVersion={deleteVersion}
                    viewOpen={viewOpen}
                    setViewOpen={setViewOpen}
                    active={active}
                    setActive={setActive}
                    onOpenView={openView}
                    createOpen={createOpen}
                    setCreateOpen={setCreateOpen}
                    createTermMode={createTermMode}
                    setCreateTermMode={setCreateTermMode}
                    createTermId={createTermId}
                    setCreateTermId={setCreateTermId}
                    createSchoolYear={createSchoolYear}
                    setCreateSchoolYear={setCreateSchoolYear}
                    createSemester={createSemester}
                    setCreateSemester={setCreateSemester}
                    schoolYearOptions={schoolYearOptions}
                    semesterOptions={[...CREATE_TERM_SEMESTER_OPTIONS]}
                    matchedCreateTerm={matchedCreateTerm}
                    createDeptId={createDeptId}
                    setCreateDeptId={setCreateDeptId}
                    createLabel={createLabel}
                    setCreateLabel={setCreateLabel}
                    createNotes={createNotes}
                    setCreateNotes={setCreateNotes}
                    createSetActive={createSetActive}
                    setCreateSetActive={setCreateSetActive}
                    nextVersionNumber={nextVersionNumber}
                    canCreateVersion={canCreateVersion}
                    existingSemesterSchedule={existingSemesterSchedule}
                    onSaveVersion={saveVersion}
                    resetCreateForm={resetCreateForm}
                />

                <Card className="rounded-2xl">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="subject-term-course-year-management" className="border-none">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <div className="text-left">
                                    <CardTitle>Subject Term & Course/Year Management</CardTitle>
                                </div>
                            </AccordionTrigger>

                            <AccordionContent>
                                <CardContent className="space-y-6 pt-0">
                                    <CardDescription>
                                        Create new subjects directly under the selected semester, link existing subjects to the active term plus course/year scope, and quick-create new course/year sections for faster schedule entry.
                                    </CardDescription>

                                    {!selectedVersion ? (
                                        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                                            Select a semester schedule first to manage scoped subjects and course/year sections.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="rounded-lg">
                                                    {selectedTermLabel}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-lg">
                                                    {selectedDeptLabel}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-lg">
                                                    {courseYearOptions.length} scoped course/year option{courseYearOptions.length === 1 ? "" : "s"}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <Button onClick={() => openSubjectManagementDialog("new")} disabled={subjectSaving}>
                                                    New Subject
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    className="border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800"
                                                    onClick={() => openSubjectManagementDialog("existing")}
                                                    disabled={subjectSaving}
                                                >
                                                    Existing Subjects
                                                </Button>
                                            </div>

                                            <div className="rounded-2xl border p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div className="space-y-1">
                                                        <h3 className="font-semibold">Master Data Quick Create</h3>
                                                        <p className="text-sm text-muted-foreground">
                                                            Add a new course/year section directly from the schedule page so subject scoping and entry creation stay organized.
                                                        </p>
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
                                                        onClick={openSectionDialog}
                                                        disabled={sectionSaving}
                                                    >
                                                        <PlusCircle className="mr-2 size-4" />
                                                        New Course/Year Section
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="rounded-2xl border">
                                                <Accordion type="single" collapsible className="w-full">
                                                    <AccordionItem value="subjects-available-for-this-semester" className="border-none">
                                                        <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                                            <div className="text-left">
                                                                <h3 className="font-semibold">Subjects Available for This Semester</h3>
                                                            </div>
                                                        </AccordionTrigger>

                                                        <AccordionContent className="px-4 pb-4">
                                                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                                <div className="space-y-1">
                                                                    <p className="text-sm text-muted-foreground">
                                                                        These are the subjects that will appear faster during schedule entry because they already match the selected semester and course/year scope.
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {subjects.length === 0
                                                                            ? `No scoped subjects found yet for ${selectedTermLabel}.`
                                                                            : `${subjects.length} scoped subject${subjects.length === 1 ? "" : "s"} ready for quick review.`}
                                                                    </p>
                                                                </div>

                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
                                                                    onClick={openSubjectDetailsDialog}
                                                                    disabled={subjects.length === 0}
                                                                >
                                                                    Details
                                                                </Button>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                </Accordion>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Card>

                <Dialog
                    open={subjectManagementDialogMode === "new"}
                    onOpenChange={handleSubjectManagementDialogChange}
                >
                    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>New Subject</DialogTitle>
                            <DialogDescription>
                                Create a new subject and scope it to {selectedTermLabel} and the selected course/year combinations.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="rounded-lg">
                                    {selectedTermLabel}
                                </Badge>
                                <Badge variant="outline" className="rounded-lg">
                                    {selectedDeptLabel}
                                </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="subject-code">Subject Code</Label>
                                    <Input
                                        id="subject-code"
                                        value={subjectCode}
                                        onChange={(event) => setSubjectCode(event.target.value)}
                                        placeholder="e.g. COMP 101"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject-units">Units</Label>
                                    <Input
                                        id="subject-units"
                                        value={subjectUnits}
                                        onChange={(event) => setSubjectUnits(event.target.value)}
                                        placeholder="e.g. 3"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject-title">Subject Title</Label>
                                <Input
                                    id="subject-title"
                                    value={subjectTitle}
                                    onChange={(event) => setSubjectTitle(event.target.value)}
                                    placeholder="Introduction to Computing"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <Label>Course / Year Scope</Label>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Checkbox
                                            checked={allSubjectScopesSelected ? true : someSubjectScopesSelected ? "indeterminate" : false}
                                            onCheckedChange={(value) =>
                                                setSubjectScopeKeys(Boolean(value) ? courseYearOptions.map((option) => option.key) : [])
                                            }
                                            disabled={courseYearOptions.length === 0}
                                        />
                                        <span>Select all</span>
                                    </div>
                                </div>

                                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                                    {courseYearOptions.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            No course/year options found for the selected semester. Create one first using the quick create button.
                                        </div>
                                    ) : (
                                        courseYearOptions.map((option) => {
                                            const checked = subjectScopeKeys.includes(option.key)

                                            return (
                                                <label
                                                    key={option.key}
                                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                                                >
                                                    <div>
                                                        <div className="font-medium">{option.label}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {selectedTermLabel}
                                                        </div>
                                                    </div>

                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(value) => {
                                                            const nextChecked = Boolean(value)
                                                            setSubjectScopeKeys((prev) =>
                                                                nextChecked
                                                                    ? Array.from(new Set([...prev, option.key]))
                                                                    : prev.filter((item) => item !== option.key)
                                                            )
                                                        }}
                                                    />
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={resetSubjectForm} disabled={subjectSaving}>
                                Reset
                            </Button>
                            <Button onClick={saveSubject} disabled={subjectSaving || !selectedVersion}>
                                Save Subject
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={subjectManagementDialogMode === "existing"}
                    onOpenChange={handleSubjectManagementDialogChange}
                >
                    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>Existing Subjects</DialogTitle>
                            <DialogDescription>
                                Link multiple existing subjects to {selectedTermLabel} and the selected course/year scope in one action.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="grid gap-6 xl:grid-cols-[1.2fr,1.8fr]">
                                <div className="space-y-4 rounded-2xl border p-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="subject-search">Search Existing Subjects</Label>
                                        <Input
                                            id="subject-search"
                                            value={subjectSearch}
                                            onChange={(event) => setSubjectSearch(event.target.value)}
                                            placeholder="Search by code, title, or scope"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <Label>Target Course / Year Scope</Label>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Checkbox
                                                    checked={allBulkLinkScopesSelected ? true : someBulkLinkScopesSelected ? "indeterminate" : false}
                                                    onCheckedChange={(value) =>
                                                        setBulkLinkScopeKeys(Boolean(value) ? courseYearOptions.map((option) => option.key) : [])
                                                    }
                                                    disabled={courseYearOptions.length === 0}
                                                />
                                                <span>Select all</span>
                                            </div>
                                        </div>

                                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
                                            {courseYearOptions.length === 0 ? (
                                                <div className="text-sm text-muted-foreground">
                                                    No course/year options found for the selected semester. Create one first using the quick create button.
                                                </div>
                                            ) : (
                                                courseYearOptions.map((option) => {
                                                    const checked = bulkLinkScopeKeys.includes(option.key)

                                                    return (
                                                        <label
                                                            key={`bulk-${option.key}`}
                                                            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                                                        >
                                                            <div>
                                                                <div className="font-medium">{option.label}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {selectedTermLabel}
                                                                </div>
                                                            </div>

                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(value) => {
                                                                    const nextChecked = Boolean(value)
                                                                    setBulkLinkScopeKeys((prev) =>
                                                                        nextChecked
                                                                            ? Array.from(new Set([...prev, option.key]))
                                                                            : prev.filter((item) => item !== option.key)
                                                                    )
                                                                }}
                                                            />
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 rounded-2xl border p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <Label>Existing Subjects</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {bulkLinkSubjectIds.length} selected from {filteredExistingSubjects.length} visible subject{filteredExistingSubjects.length === 1 ? "" : "s"}.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Checkbox
                                                checked={allFilteredExistingSubjectsSelected ? true : someFilteredExistingSubjectsSelected ? "indeterminate" : false}
                                                onCheckedChange={(value) => {
                                                    const shouldSelect = Boolean(value)
                                                    setBulkLinkSubjectIds((current) => {
                                                        if (!shouldSelect) {
                                                            const visibleIds = new Set(filteredExistingSubjects.map((subject) => subject.$id))
                                                            return current.filter((subjectId) => !visibleIds.has(subjectId))
                                                        }

                                                        return Array.from(new Set([...current, ...filteredExistingSubjects.map((subject) => subject.$id)]))
                                                    })
                                                }}
                                                disabled={filteredExistingSubjects.length === 0}
                                            />
                                            <span>Select all</span>
                                        </div>
                                    </div>

                                    <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border p-3">
                                        {filteredExistingSubjects.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                No existing subjects matched the current search.
                                            </div>
                                        ) : (
                                            filteredExistingSubjects.map((subject) => {
                                                const checked = bulkLinkSubjectIds.includes(subject.$id)

                                                return (
                                                    <label
                                                        key={subject.$id}
                                                        className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3"
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                {[subject.code, subject.title].filter(Boolean).join(" • ") || subject.$id}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {getSubjectScopeSummary(subject)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {termLabel(termMap.get(String(subject.termId || "")) ?? null)}
                                                            </div>
                                                        </div>

                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(value) => {
                                                                const nextChecked = Boolean(value)
                                                                setBulkLinkSubjectIds((prev) =>
                                                                    nextChecked
                                                                        ? Array.from(new Set([...prev, subject.$id]))
                                                                        : prev.filter((item) => item !== subject.$id)
                                                                )
                                                            }}
                                                        />
                                                    </label>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={resetBulkLinkForm} disabled={subjectSaving}>
                                Clear Selection
                            </Button>
                            <Button onClick={bulkLinkSubjects} disabled={subjectSaving || !selectedVersion}>
                                Link Selected Subjects
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={subjectDetailsDialogOpen} onOpenChange={handleSubjectDetailsDialogOpenChange}>
                    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>Subjects Available for This Semester</DialogTitle>
                            <DialogDescription>
                                Review the scoped subjects for {selectedTermLabel}. Open this when you need the full list instead of the compact accordion.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="rounded-lg">
                                    {selectedTermLabel}
                                </Badge>
                                <Badge variant="outline" className="rounded-lg">
                                    {selectedDeptLabel}
                                </Badge>
                                <Badge variant="outline" className="rounded-lg">
                                    {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                                </Badge>
                                <Badge variant="outline" className="rounded-lg">
                                    {subjectTransferIds.length} selected
                                </Badge>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[1.3fr,1.7fr]">
                                <div className="space-y-4 rounded-2xl border p-4">
                                    <div className="space-y-1">
                                        <h3 className="font-semibold">Transfer Selected Subjects</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Move all or selected subjects to another semester and replace their scope with the target course/year levels.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Target Term Setup</Label>
                                        <Select
                                            value={subjectTransferTermMode}
                                            onValueChange={(value) => setSubjectTransferTermMode(value as CreateTermMode)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select setup" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="existing">Use Existing Semester / Term</SelectItem>
                                                <SelectItem value="new">Create New Semester / School Year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {subjectTransferTermMode === CREATE_TERM_MODES.existing ? (
                                        <div className="space-y-2">
                                            <Label>Target Academic Term</Label>
                                            <Select value={subjectTransferTermId} onValueChange={setSubjectTransferTermId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select target term" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {terms.filter((term) => String(term.$id || "") !== String(selectedVersion?.termId || "")).length === 0 ? (
                                                        <SelectItem value="__no_transfer_terms__" disabled>
                                                            No other terms available
                                                        </SelectItem>
                                                    ) : (
                                                        terms
                                                            .filter((term) => String(term.$id || "") !== String(selectedVersion?.termId || ""))
                                                            .map((term) => (
                                                                <SelectItem key={term.$id} value={term.$id}>
                                                                    {termLabel(term)}
                                                                </SelectItem>
                                                            ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>School Year</Label>
                                                    <Select
                                                        value={subjectTransferSchoolYearSelectValue}
                                                        onValueChange={(value) => {
                                                            if (value === CUSTOM_SCHOOL_YEAR_VALUE) {
                                                                if (subjectTransferSchoolYearOptions.includes(subjectTransferSchoolYear)) {
                                                                    setSubjectTransferSchoolYear("")
                                                                }
                                                                return
                                                            }
                                                            setSubjectTransferSchoolYear(value)
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select school year" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {subjectTransferSchoolYearOptions.map((schoolYear) => (
                                                                <SelectItem key={schoolYear} value={schoolYear}>
                                                                    {schoolYear}
                                                                </SelectItem>
                                                            ))}
                                                            <SelectItem value={CUSTOM_SCHOOL_YEAR_VALUE}>Custom school year</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Semester</Label>
                                                    <Select value={subjectTransferSemester} onValueChange={setSubjectTransferSemester}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select semester" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CREATE_TERM_SEMESTER_OPTIONS.map((semesterOption) => (
                                                                <SelectItem key={semesterOption} value={semesterOption}>
                                                                    {semesterOption}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {showCustomSubjectTransferSchoolYearInput ? (
                                                <div className="space-y-2">
                                                    <Label htmlFor="subject-transfer-school-year">Custom School Year</Label>
                                                    <Input
                                                        id="subject-transfer-school-year"
                                                        value={subjectTransferSchoolYear}
                                                        onChange={(event) => setSubjectTransferSchoolYear(event.target.value)}
                                                        placeholder="e.g. 2027-2028"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Use the format YYYY-YYYY.
                                                    </p>
                                                </div>
                                            ) : null}
                                        </>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <Label>Target Course / Year Levels</Label>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Checkbox
                                                    checked={allTransferScopesSelected ? true : someTransferScopesSelected ? "indeterminate" : false}
                                                    onCheckedChange={(value) =>
                                                        setSubjectTransferScopeKeys(
                                                            Boolean(value) ? transferCourseYearOptions.map((option) => option.key) : []
                                                        )
                                                    }
                                                    disabled={transferCourseYearOptions.length === 0}
                                                />
                                                <span>Select all</span>
                                            </div>
                                        </div>

                                        <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                                            {transferCourseYearOptions.length === 0 ? (
                                                <div className="text-sm text-muted-foreground">
                                                    No course offerings are available yet for this college.
                                                </div>
                                            ) : (
                                                transferCourseYearOptions.map((option) => {
                                                    const checked = subjectTransferScopeKeys.includes(option.key)

                                                    return (
                                                        <label
                                                            key={`transfer-scope-${option.key}`}
                                                            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
                                                        >
                                                            <div>
                                                                <div className="font-medium">{option.label}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {selectedSubjectTransferTermLabel}
                                                                </div>
                                                            </div>

                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(value) => {
                                                                    const nextChecked = Boolean(value)
                                                                    setSubjectTransferScopeKeys((prev) =>
                                                                        nextChecked
                                                                            ? Array.from(new Set([...prev, option.key]))
                                                                            : prev.filter((item) => item !== option.key)
                                                                    )
                                                                }}
                                                            />
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 rounded-2xl border p-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="subject-transfer-search">Search Subjects</Label>
                                        <Input
                                            id="subject-transfer-search"
                                            value={subjectTransferSearch}
                                            onChange={(event) => setSubjectTransferSearch(event.target.value)}
                                            placeholder="Search by code, title, or current scope"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <Label>Subjects in {selectedTermLabel}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {subjectTransferIds.length} selected from {filteredTransferSubjects.length} visible subject{filteredTransferSubjects.length === 1 ? "" : "s"}.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Checkbox
                                                checked={allFilteredTransferSubjectsSelected ? true : someFilteredTransferSubjectsSelected ? "indeterminate" : false}
                                                onCheckedChange={(value) => {
                                                    const shouldSelect = Boolean(value)
                                                    setSubjectTransferIds((current) => {
                                                        if (!shouldSelect) {
                                                            const visibleIds = new Set(filteredTransferSubjects.map((subject) => subject.$id))
                                                            return current.filter((subjectId) => !visibleIds.has(subjectId))
                                                        }

                                                        return Array.from(
                                                            new Set([...current, ...filteredTransferSubjects.map((subject) => subject.$id)])
                                                        )
                                                    })
                                                }}
                                                disabled={filteredTransferSubjects.length === 0}
                                            />
                                            <span>Select all</span>
                                        </div>
                                    </div>

                                    <div className="max-h-128 space-y-2 overflow-y-auto rounded-xl border p-3">
                                        {filteredTransferSubjects.length === 0 ? (
                                            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                                No scoped subjects found yet for {selectedTermLabel}.
                                            </div>
                                        ) : (
                                            filteredTransferSubjects.map((subject) => {
                                                const checked = subjectTransferIds.includes(subject.$id)

                                                return (
                                                    <label
                                                        key={`transfer-subject-${subject.$id}`}
                                                        className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3"
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                {[subject.code, subject.title].filter(Boolean).join(" • ") || subject.$id}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {getSubjectScopeSummary(subject)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Units: {subject.units ?? "—"}
                                                            </div>
                                                        </div>

                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(value) => {
                                                                const nextChecked = Boolean(value)
                                                                setSubjectTransferIds((prev) =>
                                                                    nextChecked
                                                                        ? Array.from(new Set([...prev, subject.$id]))
                                                                        : prev.filter((item) => item !== subject.$id)
                                                                )
                                                            }}
                                                        />
                                                    </label>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={resetSubjectTransferForm}
                                disabled={subjectTransferSaving}
                            >
                                Clear Selection
                            </Button>
                            <Button
                                onClick={transferSubjects}
                                disabled={subjectTransferSaving || subjectTransferIds.length === 0 || !selectedVersion}
                            >
                                Transfer Selected Subjects
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
                    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>New Course/Year Section</DialogTitle>
                            <DialogDescription>
                                Create a section for the selected college using an existing term like 2026-2027 • 1st Semester or create a new term on the spot.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="rounded-lg">
                                    {selectedDeptLabel}
                                </Badge>
                                <Badge variant="outline" className="rounded-lg">
                                    {selectedSectionTermLabel}
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <Label>Term Setup</Label>
                                <Select value={sectionTermMode} onValueChange={(value) => setSectionTermMode(value as CreateTermMode)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select setup" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="existing">Use Existing Semester / Term</SelectItem>
                                        <SelectItem value="new">Create New Semester / School Year</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Choose an existing term or create a new one without leaving this dialog.
                                </p>
                            </div>

                            {sectionTermMode === CREATE_TERM_MODES.existing ? (
                                <div className="space-y-2">
                                    <Label>Academic Term</Label>
                                    <Select value={sectionTermId} onValueChange={setSectionTermId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select term" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {terms.length === 0 ? (
                                                <SelectItem value="__no_terms__" disabled>
                                                    No terms available
                                                </SelectItem>
                                            ) : (
                                                terms.map((term) => (
                                                    <SelectItem key={term.$id} value={term.$id}>
                                                        {termLabel(term)}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>School Year</Label>
                                        <Select
                                            value={sectionSchoolYearSelectValue}
                                            onValueChange={(value) => {
                                                if (value === CUSTOM_SCHOOL_YEAR_VALUE) {
                                                    if (sectionSchoolYearOptions.includes(sectionSchoolYear)) {
                                                        setSectionSchoolYear("")
                                                    }
                                                    return
                                                }
                                                setSectionSchoolYear(value)
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select school year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sectionSchoolYearOptions.map((schoolYear) => (
                                                    <SelectItem key={schoolYear} value={schoolYear}>
                                                        {schoolYear}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value={CUSTOM_SCHOOL_YEAR_VALUE}>Custom school year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Pick from the list or choose custom.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Semester</Label>
                                        <Select value={sectionSemester} onValueChange={setSectionSemester}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select semester" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CREATE_TERM_SEMESTER_OPTIONS.map((semesterOption) => (
                                                    <SelectItem key={semesterOption} value={semesterOption}>
                                                        {semesterOption}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {showCustomSectionSchoolYearInput ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="section-school-year-custom">Custom School Year</Label>
                                        <Input
                                            id="section-school-year-custom"
                                            value={sectionSchoolYear}
                                            onChange={(event) => setSectionSchoolYear(event.target.value)}
                                            placeholder="e.g. 2027-2028"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Use the format YYYY-YYYY.
                                        </p>
                                    </div>
                                ) : null}
                                </>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Course</Label>
                                    <Select value={sectionProgramId} onValueChange={setSectionProgramId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {programs.length === 0 ? (
                                                <SelectItem value="__no_programs__" disabled>
                                                    No courses available
                                                </SelectItem>
                                            ) : (
                                                programs.map((program) => (
                                                    <SelectItem key={program.$id} value={program.$id}>
                                                        {String(program.code || program.name || program.$id)}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Year Level</Label>
                                    <Select value={sectionYearLevel} onValueChange={setSectionYearLevel}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select year level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {YEAR_LEVEL_OPTIONS.map((yearLevelOption) => (
                                                <SelectItem key={yearLevelOption} value={yearLevelOption}>
                                                    {yearLevelOption}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="section-name">Section Name / Label</Label>
                                <Input
                                    id="section-name"
                                    value={sectionName}
                                    onChange={(event) => setSectionName(event.target.value)}
                                    placeholder="e.g. A"
                                />
                            </div>

                            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                                <div>Term: {selectedSectionTermLabel}</div>
                                <div className="mt-1">
                                    Preview: {buildSectionDisplayLabel(selectedSectionProgram?.code, selectedSectionProgram?.name, sectionYearLevel, sectionName || "Section")}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={resetSectionForm} disabled={sectionSaving}>
                                Reset
                            </Button>
                            <Button onClick={saveSection} disabled={sectionSaving || !selectedVersion || programs.length === 0}>
                                Create Section
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <PlannerManagementSection
                    selectedVersion={selectedVersion}
                    selectedVersionId={selectedVersionId}
                    onSelectedVersionChange={setSelectedVersionId}
                    versionSelectOptions={versionSelectOptions}
                    showConflictsOnly={showConflictsOnly}
                    onShowConflictsOnlyChange={setShowConflictsOnly}
                    entriesLoading={entriesLoading}
                    entriesError={entriesError}
                    entrySaving={entrySaving}
                    onReloadEntries={() => void fetchScheduleContext()}
                    onOpenCreateEntry={openCreateEntry}
                    plannerStats={plannerStats}
                    visibleRows={visibleRows}
                    laboratoryRows={laboratoryRows}
                    conflictFlagsByMeetingId={conflictFlagsByMeetingId}
                    selectedVersionLabel={selectedVersionLabel}
                    selectedTermLabel={selectedTermLabel}
                    selectedDeptLabel={selectedDeptLabel}
                    entryDialogOpen={entryDialogOpen}
                    setEntryDialogOpen={handleEntryDialogOpenChange}
                    editingEntry={editingEntry}
                    formSectionId={formSectionId}
                    setFormSectionId={setFormSectionId}
                    formSubjectIds={formSubjectIds}
                    setFormSubjectIds={setFormSubjectIds}
                    formFacultyChoice={formFacultyChoice}
                    setFormFacultyChoice={setFormFacultyChoice}
                    formManualFaculty={formManualFaculty}
                    setFormManualFaculty={setFormManualFaculty}
                    formRoomId={formRoomId}
                    setFormRoomId={setFormRoomId}
                    formDayOfWeek={formDayOfWeek}
                    setFormDayOfWeek={setFormDayOfWeek}
                    formStartTime={formStartTime}
                    setFormStartTime={setFormStartTime}
                    formEndTime={formEndTime}
                    setFormEndTime={setFormEndTime}
                    formMeetingType={formMeetingType}
                    setFormMeetingType={setFormMeetingType}
                    formAllowConflictSave={formAllowConflictSave}
                    setFormAllowConflictSave={setFormAllowConflictSave}
                    candidateConflicts={candidateConflicts}
                    candidateConflictCounts={candidateConflictCounts}
                    manualFacultySuggestions={manualFacultySuggestions}
                    sections={sections}
                    subjects={subjects}
                    facultyProfiles={facultyProfiles}
                    rooms={rooms}
                    onEditEntry={openEditEntry}
                    onSaveEntry={saveEntry}
                    onDeleteEntry={deleteEntry}
                />
            </div>
        </DashboardLayout>
    )
}