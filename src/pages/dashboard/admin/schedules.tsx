/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { RefreshCcw } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Button } from "@/components/ui/button"

import { PlannerManagementSection, SubjectMatchingFiltersCard } from "@/components/schedules/planner-management-section"
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
    ScheduleVersionDoc,
    SectionDoc,
    SubjectDoc,
    UserProfileDoc,
} from "@/components/schedules/schedule-types"
import {
    FACULTY_OPTION_MANUAL,
    FACULTY_OPTION_NONE,
} from "@/components/schedules/schedule-types"
import {
    buildSubjectFilterOptions,
    composeRemarks,
    dayExpressionsOverlap,
    dayOrder,
    deptLabel,
    extractManualFaculty,
    filterSubjectsForSection,
    getCanonicalDayValue,
    getSubjectAcademicTermFilterValues,
    getSubjectCollegeFilterValues,
    getSubjectProgramFilterValues,
    getSubjectSemesterFilterValues,
    getSubjectYearLevelFilterValues,
    hhmmToMinutes,
    isActiveScheduleStatus,
    matchesSelectedSubjectFilter,
    meetingTypeLabel,
    normalizeText,
    pickMatchingSubjectFilterOption,
    rangesOverlap,
    normalizeScheduleStatus,
    roomTypeLabel,
    sortSectionsForDisplay,
    stripManualFacultyTag,
    SUBJECT_FILTER_ALL_VALUE,
    termLabel,
} from "@/components/schedules/schedule-utils"

type ScheduleProgramDoc = {
    $id: string
    departmentId?: string | null
    code?: string | null
    name?: string | null
    isActive?: boolean | null
}

export default function AdminSchedulesPage() {
    const [loading, setLoading] = React.useState(true)
    const [, setError] = React.useState<string | null>(null)

    const [versions, setVersions] = React.useState<ScheduleVersionDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])
    const [programs, setPrograms] = React.useState<ScheduleProgramDoc[]>([])

    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [subjects, setSubjects] = React.useState<SubjectDoc[]>([])
    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [sections, setSections] = React.useState<SectionDoc[]>([])
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

    const [subjectCollegeFilter, setSubjectCollegeFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)
    const [subjectProgramFilter, setSubjectProgramFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)
    const [subjectYearLevelFilter, setSubjectYearLevelFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)
    const [subjectSemesterFilter, setSubjectSemesterFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)
    const [subjectAcademicTermFilter, setSubjectAcademicTermFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)

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

    const selectedVersion = React.useMemo(
        () => versions.find((version) => version.$id === selectedVersionId) || null,
        [versions, selectedVersionId]
    )

    const selectedTermDoc = React.useMemo(() => {
        if (!selectedVersion) return null
        return termMap.get(String(selectedVersion.termId)) ?? null
    }, [selectedVersion, termMap])

    const selectedTermLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return termLabel(termMap.get(String(selectedVersion.termId)) ?? null)
    }, [selectedVersion, termMap])

    const selectedDeptLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return deptLabel(deptMap.get(String(selectedVersion.departmentId)) ?? null)
    }, [selectedVersion, deptMap])

    const selectedSemesterLabel = React.useMemo(() => {
        return String((selectedTermDoc as any)?.semester || "").trim()
    }, [selectedTermDoc])

    const selectedAcademicTermCompositeLabel = React.useMemo(() => {
        const schoolYear = String((selectedTermDoc as any)?.schoolYear || "").trim()
        if (!schoolYear && !selectedSemesterLabel) return ""
        if (schoolYear && selectedSemesterLabel) return `${schoolYear} • ${selectedSemesterLabel}`
        return schoolYear || selectedSemesterLabel
    }, [selectedTermDoc, selectedSemesterLabel])

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
            const key = String((f as any).userId || f.$id || "").trim()
            if (!key) return
            const name = String((f as any).name || "").trim()
            const email = String((f as any).email || "").trim()
            m.set(key, name || email || key)
        })
        return m
    }, [facultyProfiles])

    const selectedFormSection = React.useMemo(
        () => sections.find((section) => section.$id === formSectionId) || null,
        [sections, formSectionId]
    )

    const sectionScopedSubjects = React.useMemo(
        () => filterSubjectsForSection(subjects, selectedFormSection),
        [subjects, selectedFormSection]
    )

    const departmentScopedPrograms = React.useMemo(() => {
        const selectedVersionDepartmentId = String(selectedVersion?.departmentId || "").trim()

        return programs
            .filter((program) => program.isActive !== false)
            .filter((program) => {
                const programDepartmentId = String(program.departmentId || "").trim()
                return !selectedVersionDepartmentId || !programDepartmentId || programDepartmentId === selectedVersionDepartmentId
            })
            .slice()
            .sort((a, b) => `${String(a.code || "")} ${String(a.name || "")}`.localeCompare(`${String(b.code || "")} ${String(b.name || "")}`))
    }, [programs, selectedVersion])

    const subjectCollegeOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedDeptLabel !== "—" ? selectedDeptLabel : "",
                String(selectedVersion?.departmentId || "").trim(),
                ...subjects.flatMap((subject) => getSubjectCollegeFilterValues(subject)),
            ]),
        [selectedDeptLabel, selectedVersion?.departmentId, subjects]
    )

    const subjectProgramOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedFormSection?.programCode,
                selectedFormSection?.programName,
                selectedFormSection?.programId,
                ...sections.flatMap((section) => {
                    const sectionAny = section as any
                    return [sectionAny.programCode, sectionAny.programName, sectionAny.programId]
                }),
                ...departmentScopedPrograms.flatMap((program) => [program.$id, program.code, program.name]),
                ...subjects.flatMap((subject) => getSubjectProgramFilterValues(subject)),
            ]),
        [departmentScopedPrograms, sections, selectedFormSection, subjects]
    )

    const subjectYearLevelOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedFormSection?.yearLevel,
                ...sections.map((section) => section.yearLevel),
                ...subjects.flatMap((subject) => getSubjectYearLevelFilterValues(subject)),
            ]),
        [sections, selectedFormSection, subjects]
    )

    const subjectSemesterOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedSemesterLabel,
                ...subjects.flatMap((subject) => getSubjectSemesterFilterValues(subject)),
            ]),
        [selectedSemesterLabel, subjects]
    )

    const subjectAcademicTermOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedTermLabel !== "—" ? selectedTermLabel : "",
                selectedAcademicTermCompositeLabel,
                String((selectedTermDoc as any)?.schoolYear || "").trim(),
                String(selectedVersion?.termId || "").trim(),
                ...subjects.flatMap((subject) => getSubjectAcademicTermFilterValues(subject)),
            ]),
        [selectedAcademicTermCompositeLabel, selectedTermDoc, selectedTermLabel, selectedVersion?.termId, subjects]
    )

    const clearSubjectFilters = React.useCallback(() => {
        setSubjectCollegeFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectProgramFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectYearLevelFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectSemesterFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
    }, [])

    const applyScheduleContextSubjectFilters = React.useCallback(() => {
        setSubjectCollegeFilter(
            pickMatchingSubjectFilterOption(subjectCollegeOptions, [selectedDeptLabel, selectedVersion?.departmentId])
        )
        setSubjectProgramFilter(
            pickMatchingSubjectFilterOption(subjectProgramOptions, [selectedFormSection?.programCode, selectedFormSection?.programName, selectedFormSection?.programId])
        )
        setSubjectYearLevelFilter(
            pickMatchingSubjectFilterOption(subjectYearLevelOptions, [selectedFormSection?.yearLevel])
        )
        setSubjectSemesterFilter(
            pickMatchingSubjectFilterOption(subjectSemesterOptions, [selectedSemesterLabel, selectedTermLabel])
        )
        setSubjectAcademicTermFilter(
            pickMatchingSubjectFilterOption(subjectAcademicTermOptions, [selectedAcademicTermCompositeLabel, selectedTermLabel, selectedVersion?.termId])
        )
    }, [
        selectedAcademicTermCompositeLabel,
        selectedDeptLabel,
        selectedFormSection,
        selectedSemesterLabel,
        selectedTermLabel,
        selectedVersion?.departmentId,
        selectedVersion?.termId,
        subjectAcademicTermOptions,
        subjectCollegeOptions,
        subjectProgramOptions,
        subjectSemesterOptions,
        subjectYearLevelOptions,
    ])

    React.useEffect(() => {
        if (!entryDialogOpen) return
        applyScheduleContextSubjectFilters()
    }, [entryDialogOpen, formSectionId, selectedVersion?.$id, applyScheduleContextSubjectFilters])

    React.useEffect(() => {
        if (subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectCollegeOptions.includes(subjectCollegeFilter)) {
            setSubjectCollegeFilter(SUBJECT_FILTER_ALL_VALUE)
        }
        if (subjectProgramFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectProgramOptions.includes(subjectProgramFilter)) {
            setSubjectProgramFilter(SUBJECT_FILTER_ALL_VALUE)
        }
        if (subjectYearLevelFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectYearLevelOptions.includes(subjectYearLevelFilter)) {
            setSubjectYearLevelFilter(SUBJECT_FILTER_ALL_VALUE)
        }
        if (subjectSemesterFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectSemesterOptions.includes(subjectSemesterFilter)) {
            setSubjectSemesterFilter(SUBJECT_FILTER_ALL_VALUE)
        }
        if (subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectAcademicTermOptions.includes(subjectAcademicTermFilter)) {
            setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
        }
    }, [
        subjectAcademicTermFilter,
        subjectAcademicTermOptions,
        subjectCollegeFilter,
        subjectCollegeOptions,
        subjectProgramFilter,
        subjectProgramOptions,
        subjectSemesterFilter,
        subjectSemesterOptions,
        subjectYearLevelFilter,
        subjectYearLevelOptions,
    ])

    const filteredFormSubjects = React.useMemo(() => {
        return sectionScopedSubjects
            .filter((subject) => {
                const subjectCollegeValues = getSubjectCollegeFilterValues(subject)
                const subjectProgramValues = getSubjectProgramFilterValues(subject)
                const subjectYearValues = getSubjectYearLevelFilterValues(subject)
                const subjectSemesterValues = getSubjectSemesterFilterValues(subject)
                const subjectAcademicTermValues = getSubjectAcademicTermFilterValues(subject)

                return (
                    matchesSelectedSubjectFilter(subjectCollegeFilter, subjectCollegeValues) &&
                    matchesSelectedSubjectFilter(subjectProgramFilter, subjectProgramValues) &&
                    matchesSelectedSubjectFilter(subjectYearLevelFilter, subjectYearValues) &&
                    matchesSelectedSubjectFilter(subjectSemesterFilter, subjectSemesterValues) &&
                    matchesSelectedSubjectFilter(subjectAcademicTermFilter, subjectAcademicTermValues)
                )
            })
            .slice()
            .sort((a, b) => {
                const ac = String(a.code || "").toLowerCase()
                const bc = String(b.code || "").toLowerCase()
                if (ac !== bc) return ac.localeCompare(bc)
                return String(a.title || "").localeCompare(String(b.title || ""))
            })
    }, [
        sectionScopedSubjects,
        subjectAcademicTermFilter,
        subjectCollegeFilter,
        subjectProgramFilter,
        subjectSemesterFilter,
        subjectYearLevelFilter,
    ])

    const activeSubjectFilterBadges = React.useMemo(
        () =>
            [
                subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE ? `College: ${subjectCollegeFilter}` : null,
                subjectProgramFilter !== SUBJECT_FILTER_ALL_VALUE ? `Program: ${subjectProgramFilter}` : null,
                subjectYearLevelFilter !== SUBJECT_FILTER_ALL_VALUE ? `Year Level: ${subjectYearLevelFilter}` : null,
                subjectSemesterFilter !== SUBJECT_FILTER_ALL_VALUE ? `Semester: ${subjectSemesterFilter}` : null,
                subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE ? `Academic Term: ${subjectAcademicTermFilter}` : null,
            ].filter(Boolean) as string[],
        [
            subjectAcademicTermFilter,
            subjectCollegeFilter,
            subjectProgramFilter,
            subjectSemesterFilter,
            subjectYearLevelFilter,
        ]
    )


    const subjectProgramFilters = React.useMemo(() => {
        return subjectProgramFilter !== SUBJECT_FILTER_ALL_VALUE ? [subjectProgramFilter] : []
    }, [subjectProgramFilter])

    const setSubjectProgramFilters = React.useCallback<React.Dispatch<React.SetStateAction<string[]>>>(
        (value) => {
            const prev = subjectProgramFilter !== SUBJECT_FILTER_ALL_VALUE ? [subjectProgramFilter] : []
            const next = typeof value === "function" ? value(prev) : value
            const normalized = Array.isArray(next)
                ? next.map((item) => String(item || "").trim()).filter(Boolean)
                : []

            setSubjectProgramFilter(normalized[0] || SUBJECT_FILTER_ALL_VALUE)
        },
        [subjectProgramFilter]
    )

    const subjectYearLevelFilters = React.useMemo(() => {
        return subjectYearLevelFilter !== SUBJECT_FILTER_ALL_VALUE ? [subjectYearLevelFilter] : []
    }, [subjectYearLevelFilter])

    const setSubjectYearLevelFilters = React.useCallback<React.Dispatch<React.SetStateAction<string[]>>>(
        (value) => {
            const prev = subjectYearLevelFilter !== SUBJECT_FILTER_ALL_VALUE ? [subjectYearLevelFilter] : []
            const next = typeof value === "function" ? value(prev) : value
            const normalized = Array.isArray(next)
                ? next.map((item) => String(item || "").trim()).filter(Boolean)
                : []

            setSubjectYearLevelFilter(normalized[0] || SUBJECT_FILTER_ALL_VALUE)
        },
        [subjectYearLevelFilter]
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [vRes, tRes, dRes, pRes] = await Promise.all([
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
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PROGRAMS, [
                    Query.orderAsc("name"),
                    Query.limit(1000),
                ]),
            ])

            const vDocs = (vRes?.documents ?? []) as ScheduleVersionDoc[]
            const tDocs = (tRes?.documents ?? []) as AcademicTermDoc[]
            const dDocs = (dRes?.documents ?? []) as DepartmentDoc[]
            const pDocs = ((pRes?.documents ?? []) as any[]).map((program) => ({
                $id: String(program.$id || ""),
                departmentId: String(program.departmentId || "").trim() || null,
                code: String(program.code || "").trim() || null,
                name: String(program.name || "").trim() || null,
                isActive: program.isActive !== false,
            })) as ScheduleProgramDoc[]

            setVersions(vDocs)
            setTerms(tDocs)
            setDepartments(dDocs)
            setPrograms(pDocs)

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

    const fetchScheduleContext = React.useCallback(async () => {
        if (!selectedVersion) {
            setSubjects([])
            setRooms([])
            setSections([])
            setFacultyProfiles([])
            setClasses([])
            setMeetings([])
            setEntriesError(null)
            return
        }

        setEntriesLoading(true)
        setEntriesError(null)

        try {
            const [cRes, mRes, subjRes, roomRes, secRes, userRes] = await Promise.all([
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
                databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.orderAsc("name"),
                    Query.limit(5000),
                ]),
            ])

            const allSubjects = (subjRes?.documents ?? []) as SubjectDoc[]
            const selectedVersionDeptId = String(selectedVersion.departmentId || "").trim()
            const selectedVersionTermId = String(selectedVersion.termId || "").trim()

            const departmentSubjects = allSubjects
                .filter((s) => (s as any).isActive !== false)
                .filter((s) => {
                    const subjectDeptId = String((s as any).departmentId || "").trim()
                    return !subjectDeptId || subjectDeptId === selectedVersionDeptId
                })
                .sort((a, b) => {
                    const ac = String((a as any).code || "").toLowerCase()
                    const bc = String((b as any).code || "").toLowerCase()
                    if (ac !== bc) return ac.localeCompare(bc)
                    return String((a as any).title || "").localeCompare(String((b as any).title || ""))
                })

            const scopedSubjects = departmentSubjects.filter((s) => {
                const subjectTermId = String((s as any).termId || "").trim()
                if (subjectTermId && selectedVersionTermId && subjectTermId !== selectedVersionTermId) {
                    return false
                }
                return true
            })

            const scopedRooms = ((roomRes?.documents ?? []) as RoomDoc[])
                .filter((r) => (r as any).isActive !== false)
                .sort((a, b) => String((a as any).code || "").localeCompare(String((b as any).code || "")))

            const scopedSections = ((secRes?.documents ?? []) as SectionDoc[])
                .filter((s) => (s as any).isActive !== false)
                .sort(sortSectionsForDisplay)

            const scopedFaculty = ((userRes?.documents ?? []) as UserProfileDoc[])
                .filter((f) => (f as any).isActive !== false)
                .sort((a, b) =>
                    String((a as any).name || (a as any).email || (a as any).userId || "").localeCompare(
                        String((b as any).name || (b as any).email || (b as any).userId || "")
                    )
                )

            setClasses((cRes?.documents ?? []) as ClassDoc[])
            setMeetings((mRes?.documents ?? []) as ClassMeetingDoc[])
            setSubjects(scopedSubjects)
            setRooms(scopedRooms)
            setSections(scopedSections)
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

    const scheduleRows = React.useMemo<ScheduleRow[]>(() => {
        const classMap = new Map<string, ClassDoc>()
        classes.forEach((c) => classMap.set(c.$id, c))

        const rows: ScheduleRow[] = []

        for (const m of meetings) {
            const c = classMap.get(String((m as any).classId))
            if (!c) continue

            const subject = subjectMap.get(String((c as any).subjectId))
            const section = sectionMap.get(String((c as any).sectionId))
            const room = roomMap.get(String((m as any).roomId || ""))

            const manualFaculty = extractManualFaculty((c as any).remarks)
            const facultyUserId = String((c as any).facultyUserId || "").trim()
            const facultyName = facultyUserId
                ? facultyNameMap.get(facultyUserId) || facultyUserId
                : manualFaculty || "Unassigned"

            const facultyKey = facultyUserId
                ? `uid:${facultyUserId}`
                : manualFaculty
                  ? `manual:${normalizeText(manualFaculty)}`
                  : ""

            const subjectCode = String((subject as any)?.code || "").trim()
            const subjectTitle = String((subject as any)?.title || "").trim()
            const subjectLabel = [subjectCode, subjectTitle].filter(Boolean).join(" • ") || String((c as any).subjectId || "")

            const sectionAny = (section || {}) as any
            const secName = String((section as any)?.name || "").trim()
            const secYearRaw = (section as any)?.yearLevel ?? sectionAny.yearLevel ?? null
            const secYearText = String(secYearRaw ?? "").trim()
            const secProgramCode = String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim()
            const secProgramName = String(sectionAny.programName || sectionAny.sectionProgramName || "").trim()
            const sectionLabel =
                String((section as any)?.label || sectionAny.sectionLabel || "").trim() ||
                (secName ? `${secYearText ? `Y${secYearText}` : "Y?"} - ${secName}` : String((c as any).sectionId || ""))

            const roomCode = String((room as any)?.code || "").trim()
            const roomName = String((room as any)?.name || "").trim()
            const roomLabel = [roomCode, roomName].filter(Boolean).join(" • ") || "Unassigned"
            const normalizedMeetingDayOfWeek = getCanonicalDayValue(String((m as any).dayOfWeek || "").trim())

            rows.push({
                meetingId: String((m as any).$id || ""),
                classId: String((c as any).$id || ""),

                versionId: String((c as any).versionId || (m as any).versionId || ""),
                termId: String((c as any).termId || ""),
                departmentId: String((c as any).departmentId || ""),

                dayOfWeek: normalizedMeetingDayOfWeek,
                startTime: String((m as any).startTime || ""),
                endTime: String((m as any).endTime || ""),
                meetingType: (((m as any).meetingType || "LECTURE") as MeetingType),

                roomId: String((m as any).roomId || ""),
                roomType: String((room as any)?.type || ""),
                roomLabel,

                sectionId: String((c as any).sectionId || ""),
                sectionLabel,
                sectionYearLevel: secYearRaw,
                sectionName: secName || null,
                sectionProgramCode: secProgramCode || null,
                sectionProgramName: secProgramName || null,

                subjectId: String((c as any).subjectId || ""),
                subjectLabel,
                subjectUnits: (subject as any)?.units != null ? Number((subject as any).units) : null,

                facultyUserId,
                facultyName,
                manualFaculty,
                facultyKey,
                isManualFaculty: !facultyUserId && Boolean(manualFaculty),

                classCode: String((c as any).classCode || ""),
                deliveryMode: String((c as any).deliveryMode || ""),
                classStatus: String((c as any).status || "Planned"),
                classRemarks: stripManualFacultyTag((c as any).remarks),
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
                termId: (selectedVersion as any).termId,
                departmentId: (selectedVersion as any).departmentId,
                programId: (selectedSectionForPayload as any)?.programId || null,
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
                    classId: (createdClass as any).$id,
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
                    String((meeting as any).classId || "") === String(editingEntry.classId || "") &&
                    String((meeting as any).$id || "") !== String(editingEntry.meetingId || "")
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

    const plannerStats = React.useMemo(() => {
        const total = scheduleRows.length
        const conflicts = conflictedRows.length
        const labs = laboratoryRows.length
        return { total, conflicts, labs }
    }, [scheduleRows, conflictedRows, laboratoryRows])

    const selectedVersionLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return `Semester ${Number((selectedVersion as any).version || 0)} • ${(selectedVersion as any).label || "Untitled"} (${normalizeScheduleStatus(
            (selectedVersion as any).status
        )})`
    }, [selectedVersion])

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading || entriesLoading || entrySaving}>
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Schedules"
            actions={HeaderActions}
        >
            <div className="space-y-6 p-6">
                <SubjectMatchingFiltersCard
                    subjectCollegeFilter={subjectCollegeFilter}
                    setSubjectCollegeFilter={setSubjectCollegeFilter}
                    subjectProgramFilters={subjectProgramFilters}
                    setSubjectProgramFilters={setSubjectProgramFilters}
                    subjectYearLevelFilters={subjectYearLevelFilters}
                    setSubjectYearLevelFilters={setSubjectYearLevelFilters}
                    subjectSemesterFilter={subjectSemesterFilter}
                    setSubjectSemesterFilter={setSubjectSemesterFilter}
                    subjectAcademicTermFilter={subjectAcademicTermFilter}
                    setSubjectAcademicTermFilter={setSubjectAcademicTermFilter}
                    subjectCollegeOptions={subjectCollegeOptions}
                    subjectProgramOptions={subjectProgramOptions}
                    subjectYearLevelOptions={subjectYearLevelOptions}
                    subjectSemesterOptions={subjectSemesterOptions}
                    subjectAcademicTermOptions={subjectAcademicTermOptions}
                    filteredSubjectCount={filteredFormSubjects.length}
                    activeSubjectFilterBadges={activeSubjectFilterBadges}
                    onClearSubjectFilters={clearSubjectFilters}
                    onApplyScheduleContextSubjectFilters={applyScheduleContextSubjectFilters}
                />

                <PlannerManagementSection
                    selectedVersion={selectedVersion}
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
                    subjectCollegeFilter={subjectCollegeFilter}
                    setSubjectCollegeFilter={setSubjectCollegeFilter}
                    subjectProgramFilters={subjectProgramFilters}
                    setSubjectProgramFilters={setSubjectProgramFilters}
                    subjectYearLevelFilters={subjectYearLevelFilters}
                    setSubjectYearLevelFilters={setSubjectYearLevelFilters}
                    subjectSemesterFilter={subjectSemesterFilter}
                    setSubjectSemesterFilter={setSubjectSemesterFilter}
                    subjectAcademicTermFilter={subjectAcademicTermFilter}
                    setSubjectAcademicTermFilter={setSubjectAcademicTermFilter}
                    subjectCollegeOptions={subjectCollegeOptions}
                    subjectProgramOptions={subjectProgramOptions}
                    subjectYearLevelOptions={subjectYearLevelOptions}
                    subjectSemesterOptions={subjectSemesterOptions}
                    subjectAcademicTermOptions={subjectAcademicTermOptions}
                    onClearSubjectFilters={clearSubjectFilters}
                    onApplyScheduleContextSubjectFilters={applyScheduleContextSubjectFilters}
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
                    facultyProfiles={facultyProfiles}
                    rooms={rooms}
                    filteredSubjectOptions={filteredFormSubjects}
                    activeSubjectFilterBadges={activeSubjectFilterBadges}
                    onEditEntry={openEditEntry}
                    onSaveEntry={saveEntry}
                    onDeleteEntry={deleteEntry}
                />
            </div>
        </DashboardLayout>
    )
}