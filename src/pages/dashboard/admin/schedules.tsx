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




















export default function AdminSchedulesPage() {
    const [loading, setLoading] = React.useState(true)
    const [, setError] = React.useState<string | null>(null)

    const [versions, setVersions] = React.useState<ScheduleVersionDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])

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

    const selectedTermLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return termLabel(termMap.get(String(selectedVersion.termId)) ?? null)
    }, [selectedVersion, termMap])

    const selectedDeptLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return deptLabel(deptMap.get(String(selectedVersion.departmentId)) ?? null)
    }, [selectedVersion, deptMap])





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

    const sectionScopedSubjects = React.useMemo(
        () => filterSubjectsForSection(subjects, selectedFormSection),
        [subjects, selectedFormSection]
    )

    const subjectCollegeOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedDeptLabel !== "—" ? selectedDeptLabel : "",
                ...sectionScopedSubjects.flatMap((subject) => getSubjectCollegeFilterValues(subject)),
            ]),
        [sectionScopedSubjects, selectedDeptLabel]
    )

    const subjectProgramOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedFormSection?.programCode,
                selectedFormSection?.programName,
                selectedFormSection?.programId,
                ...sectionScopedSubjects.flatMap((subject) => getSubjectProgramFilterValues(subject)),
            ]),
        [sectionScopedSubjects, selectedFormSection]
    )

    const subjectYearLevelOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedFormSection?.yearLevel,
                ...sectionScopedSubjects.flatMap((subject) => getSubjectYearLevelFilterValues(subject)),
            ]),
        [sectionScopedSubjects, selectedFormSection]
    )

    const subjectSemesterOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions(sectionScopedSubjects.flatMap((subject) => getSubjectSemesterFilterValues(subject))),
        [sectionScopedSubjects]
    )

    const subjectAcademicTermOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedTermLabel !== "—" ? selectedTermLabel : "",
                ...sectionScopedSubjects.flatMap((subject) => getSubjectAcademicTermFilterValues(subject)),
            ]),
        [sectionScopedSubjects, selectedTermLabel]
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
        setSubjectSemesterFilter(pickMatchingSubjectFilterOption(subjectSemesterOptions, [selectedTermLabel]))
        setSubjectAcademicTermFilter(
            pickMatchingSubjectFilterOption(subjectAcademicTermOptions, [selectedTermLabel, selectedVersion?.termId])
        )
    }, [
        selectedDeptLabel,
        selectedFormSection,
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





    const plannerStats = React.useMemo(() => {
        const total = scheduleRows.length
        const conflicts = conflictedRows.length
        const labs = laboratoryRows.length
        return { total, conflicts, labs }
    }, [scheduleRows, conflictedRows, laboratoryRows])

    const selectedVersionLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return `Semester ${Number(selectedVersion.version || 0)} • ${selectedVersion.label || "Untitled"} (${normalizeScheduleStatus(
            selectedVersion.status
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
                    subjectProgramFilter={subjectProgramFilter}
                    setSubjectProgramFilter={setSubjectProgramFilter}
                    subjectYearLevelFilter={subjectYearLevelFilter}
                    setSubjectYearLevelFilter={setSubjectYearLevelFilter}
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