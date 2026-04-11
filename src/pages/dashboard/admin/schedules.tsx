/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronsUpDown, RefreshCcw } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

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
    filterSubjectsForSections,
    formatYearLevelFilterLabel,
    getCanonicalDayValue,
    getSubjectYearLevelFilterValues,
    hhmmToMinutes,
    matchesSelectedSubjectFilter,
    meetingTypeLabel,
    normalizeText,
    pickMatchingSubjectFilterOption,
    rangesOverlap,
    roomTypeLabel,
    sectionMatchesSubjectFilters,
    sortSectionsForDisplay,
    stripManualFacultyTag,
    subjectFilterValuesMatch,
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

type AcademicTermScopeOption = {
    $id: string
    label: string
    isActive: boolean
}

type ScheduleClassWritePayload = Pick<
    ClassDoc,
    | "termId"
    | "departmentId"
    | "programId"
    | "sectionId"
    | "subjectId"
    | "facultyUserId"
    | "classCode"
    | "deliveryMode"
    | "status"
    | "remarks"
>

type ScheduleMeetingWritePayload = Pick<
    ClassMeetingDoc,
    | "classId"
    | "dayOfWeek"
    | "startTime"
    | "endTime"
    | "roomId"
    | "meetingType"
>

function buildScheduleClassWritePayload({
    termId,
    departmentId,
    programId,
    sectionId,
    subjectId,
    facultyUserId,
    manualFaculty,
    status,
}: {
    termId: string
    departmentId: string
    programId?: string | null
    sectionId: string
    subjectId: string
    facultyUserId?: string | null
    manualFaculty?: string | null
    status?: string | null
}): ScheduleClassWritePayload {
    return {
        termId,
        departmentId,
        programId: programId || null,
        sectionId,
        subjectId,
        facultyUserId: facultyUserId || null,
        classCode: null,
        deliveryMode: null,
        status: status || null,
        remarks: composeRemarks("", String(manualFaculty || "").trim()),
    }
}

function buildScheduleMeetingWritePayload({
    classId,
    dayOfWeek,
    startTime,
    endTime,
    roomId,
    meetingType,
}: {
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType: MeetingType
}): ScheduleMeetingWritePayload {
    return {
        classId,
        dayOfWeek: getCanonicalDayValue(dayOfWeek),
        startTime,
        endTime,
        roomId: roomId || null,
        meetingType,
    }
}

function getScheduleSaveErrorMessage(error: unknown) {
    const message = String((error as any)?.message || "").trim()

    if (message.includes('Missing required attribute "versionId"')) {
        return 'The schedule schema still requires versionId in Appwrite. Remove that required attribute from the affected schedule collection, then save again.'
    }

    return message || "Failed to save schedule entry."
}

function buildScheduleDuplicateKey({
    termId,
    sectionId,
    subjectId,
    dayOfWeek,
    startTime,
    endTime,
    meetingType,
}: {
    termId?: string | null
    sectionId?: string | null
    subjectId?: string | null
    dayOfWeek?: string | null
    startTime?: string | null
    endTime?: string | null
    meetingType?: MeetingType | string | null
}) {
    return [
        String(termId || "").trim(),
        String(sectionId || "").trim(),
        String(subjectId || "").trim(),
        getCanonicalDayValue(String(dayOfWeek || "").trim()),
        String(startTime || "").trim(),
        String(endTime || "").trim(),
        String(meetingType || "").trim().toUpperCase(),
    ].join("::")
}


function normalizeSectionYearLevelLabel(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    const prefixedMatch = normalized.match(/^(CS|IS)\s*([1-9]\d*)$/)
    if (prefixedMatch) {
        return `${prefixedMatch[1]} ${prefixedMatch[2]}`
    }

    if (/^(CS|IS)\s+[1-9]\d*$/.test(normalized)) {
        return normalized
    }

    const plainNumberMatch = normalized.match(/^([1-9]\d*)$/)
    if (plainNumberMatch) {
        return plainNumberMatch[1]
    }

    const ordinalYearMatch = normalized.match(/^([1-9]\d*)(?:ST|ND|RD|TH)?(?:\s+YEAR)?$/)
    if (ordinalYearMatch) {
        return ordinalYearMatch[1]
    }

    return String(value ?? "").trim()
}

function buildSectionDisplayLabel(section?: SectionDoc | null) {
    if (!section) return ""

    const yearLabel = normalizeSectionYearLevelLabel(section.yearLevel)
    const sectionName = String(section.name ?? "").trim()
    const explicitLabel = String((section as any)?.label ?? "").trim()

    if (yearLabel && sectionName) {
        return `${yearLabel} - ${sectionName}`
    }

    if (yearLabel) return yearLabel
    if (sectionName) return sectionName
    if (explicitLabel) return explicitLabel

    return String(section.$id ?? "").trim()
}

function hasLinkedSectionMetadata(section?: SectionDoc | null) {
    if (!section) return false

    const sectionName = String((section as any).name || (section as any).label || "").trim()
    const sectionSubjectIds = Array.isArray((section as any).subjectIds)
        ? ((section as any).subjectIds as Array<unknown>).map((value) => String(value || "").trim()).filter(Boolean)
        : []

    return Boolean(
        String((section as any).termId || "").trim() &&
        String((section as any).departmentId || "").trim() &&
        (String((section as any).programId || "").trim() || sectionName || String((section as any).subjectId || "").trim() || sectionSubjectIds.length > 0) &&
        (String((section as any).yearLevel || "").trim() || sectionName)
    )
}

function hasLinkedSubjectMetadata(subject?: SubjectDoc | null) {
    if (!subject) return false

    const subjectProgramIds = Array.isArray((subject as any).programIds)
        ? ((subject as any).programIds as Array<unknown>).map((value) => String(value || "").trim()).filter(Boolean)
        : []
    const subjectYearLevels = Array.isArray((subject as any).yearLevels)
        ? ((subject as any).yearLevels as Array<unknown>).map((value) => String(value || "").trim()).filter(Boolean)
        : []
    const subjectSectionIds = [
        (subject as any).sectionId,
        (subject as any).sectionIds,
        (subject as any).linkedSectionId,
        (subject as any).linkedSectionIds,
        (subject as any).subjectSectionId,
        (subject as any).subjectSectionIds,
    ]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .map((value) => String(value || "").trim())
        .filter(Boolean)

    const hasDepartmentScope = Boolean(String((subject as any).departmentId || "").trim())
    const hasTermScope = Boolean(String((subject as any).termId || "").trim() || String((subject as any).semester || "").trim())
    const hasProgramScope = Boolean(String((subject as any).programId || "").trim() || subjectProgramIds.length > 0)
    const hasYearScope = Boolean(String((subject as any).yearLevel || "").trim() || subjectYearLevels.length > 0)
    const hasSectionScope = subjectSectionIds.length > 0

    if (!hasDepartmentScope || !hasTermScope) return false
    if (hasSectionScope) return true
    if (hasProgramScope && hasYearScope) return true

    return true
}



type ExtraSmallScheduleCardShellProps = {
    value: string
    title: string
    description?: string
    dialogTitle?: string
    dialogDescription?: string
    children: React.ReactNode
}

function ExtraSmallScheduleCardShell({
    value,
    title,
    description,
    children,
}: ExtraSmallScheduleCardShellProps) {
    return (
        <div className="sm:hidden">
            <Accordion type="single" collapsible className="rounded-2xl border bg-background">
                <AccordionItem value={value} className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                        <span className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold">{title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                            {description ? (
                                <p className="text-sm text-muted-foreground wrap-anywhere">{description}</p>
                            ) : null}

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-col-1 flex w-full flex-col items-center justify-center gap-1 rounded-xl whitespace-normal wrap-anywhere"
                                    >
                                        Details
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[95svh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto px-4 sm:px-6">

                                    <div className="min-w-0">{children}</div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
export default function AdminSchedulesPage() {
    const [loading, setLoading] = React.useState(true)
    const [, setError] = React.useState<string | null>(null)

    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])
    const [programs, setPrograms] = React.useState<ScheduleProgramDoc[]>([])

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
    const [subjectProgramFilters, setSubjectProgramFilters] = React.useState<string[]>([])
    const [subjectSectionFilters, setSubjectSectionFilters] = React.useState<string[]>([])
    const [subjectYearLevelFilters, setSubjectYearLevelFilters] = React.useState<string[]>([])
    const [subjectAcademicTermFilter, setSubjectAcademicTermFilter] = React.useState(SUBJECT_FILTER_ALL_VALUE)
    const [sectionMutating, setSectionMutating] = React.useState(false)
    const [yearLevelMutating, setYearLevelMutating] = React.useState(false)

    const [termScopePopoverOpen, setTermScopePopoverOpen] = React.useState(false)
    const [termScopeSelection, setTermScopeSelection] = React.useState<string[]>([])
    const [termScopeSaving, setTermScopeSaving] = React.useState(false)

    const DEFAULT_YEAR_LEVEL_SECTION_NAME = "Others"

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

    const activeAcademicTerms = React.useMemo(
        () =>
            terms
                .filter((term) => (term as any).isActive !== false)
                .slice()
                .sort((a, b) =>
                    String(a.schoolYear || "").localeCompare(String(b.schoolYear || ""), undefined, {
                        numeric: true,
                        sensitivity: "base",
                    }) ||
                    String(a.semester || "").localeCompare(String(b.semester || ""), undefined, {
                        numeric: true,
                        sensitivity: "base",
                    })
                ),
        [terms]
    )

    const activeAcademicTermIds = React.useMemo(
        () => activeAcademicTerms.map((term) => String(term.$id || "").trim()).filter(Boolean),
        [activeAcademicTerms]
    )

    const selectedFormTermDoc = React.useMemo(() => {
        const selectedSection = sections.find((section) => section.$id === formSectionId) || null
        const termId = String(selectedSection?.termId || "").trim()
        if (!termId) return null
        return termMap.get(termId) ?? null
    }, [formSectionId, sections, termMap])

    const selectedFormDeptDoc = React.useMemo(() => {
        const selectedSection = sections.find((section) => section.$id === formSectionId) || null
        const departmentId = String(selectedSection?.departmentId || "").trim()
        if (!departmentId) return null
        return deptMap.get(departmentId) ?? null
    }, [deptMap, formSectionId, sections])

    const hasScheduleScope = activeAcademicTermIds.length > 0

    const activeScheduleScopeKey = React.useMemo(
        () => activeAcademicTermIds.join("|"),
        [activeAcademicTermIds]
    )


    React.useEffect(() => {
        setTermScopeSelection(activeAcademicTermIds)
    }, [activeAcademicTermIds])

    const academicTermScopeOptions = React.useMemo<AcademicTermScopeOption[]>(
        () =>
            terms
                .slice()
                .sort((a, b) =>
                    String(a.schoolYear || "").localeCompare(String(b.schoolYear || ""), undefined, {
                        numeric: true,
                        sensitivity: "base",
                    }) ||
                    String(a.semester || "").localeCompare(String(b.semester || ""), undefined, {
                        numeric: true,
                        sensitivity: "base",
                    })
                )
                .map((term) => ({
                    $id: String(term.$id || ""),
                    label: termLabel(term),
                    isActive: (term as any).isActive !== false,
                })),
        [terms]
    )

    const selectedAcademicTermScopeLabel = React.useMemo(() => {
        if (termScopeSelection.length === 0) return "No active semesters selected"
        if (termScopeSelection.length === 1) {
            return academicTermScopeOptions.find((term) => term.$id === termScopeSelection[0])?.label || "1 semester selected"
        }
        return `${termScopeSelection.length} semesters selected`
    }, [academicTermScopeOptions, termScopeSelection])

    const selectedTermLabel = React.useMemo(() => {
        if (selectedFormTermDoc) return termLabel(selectedFormTermDoc)
        if (activeAcademicTerms.length === 1) return termLabel(activeAcademicTerms[0])
        if (activeAcademicTerms.length > 1) return `${activeAcademicTerms.length} active semesters`
        return "—"
    }, [activeAcademicTerms, selectedFormTermDoc])

    const selectedDeptLabel = React.useMemo(() => {
        if (selectedFormDeptDoc) return deptLabel(selectedFormDeptDoc)

        const uniqueDepartmentIds = Array.from(
            new Set(
                sections
                    .map((section) => String(section.departmentId || "").trim())
                    .filter(Boolean)
            )
        )

        if (uniqueDepartmentIds.length === 1) {
            return deptLabel(deptMap.get(uniqueDepartmentIds[0]) ?? null)
        }

        if (uniqueDepartmentIds.length > 1) {
            return `${uniqueDepartmentIds.length} colleges`
        }

        return "—"
    }, [deptMap, sections, selectedFormDeptDoc])

    const selectedDepartmentName = React.useMemo(() => {
        if (selectedFormDeptDoc) return String(selectedFormDeptDoc.name || "").trim()

        const uniqueDepartmentIds = Array.from(
            new Set(
                sections
                    .map((section) => String(section.departmentId || "").trim())
                    .filter(Boolean)
            )
        )

        if (uniqueDepartmentIds.length === 1) {
            return String(deptMap.get(uniqueDepartmentIds[0])?.name || "").trim()
        }

        return ""
    }, [deptMap, sections, selectedFormDeptDoc])


    const selectedAcademicTermCompositeLabel = React.useMemo(() => {
        const sourceTerm = selectedFormTermDoc || (activeAcademicTerms.length === 1 ? activeAcademicTerms[0] : null)
        const schoolYear = String(sourceTerm?.schoolYear || "").trim()
        const semester = String(sourceTerm?.semester || "").trim()
        if (!schoolYear && !semester) return ""
        if (schoolYear && semester) return `${schoolYear} • ${semester}`
        return schoolYear || semester
    }, [activeAcademicTerms, selectedFormTermDoc])

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

    const normalizeDisplayValue = React.useCallback((value?: unknown) => String(value ?? "").trim(), [])

    const buildAcademicTermOptionLabel = React.useCallback(
        (term?: AcademicTermDoc | null) => {
            const schoolYear = normalizeDisplayValue((term as any)?.schoolYear)
            const semester = normalizeDisplayValue((term as any)?.semester)
            if (schoolYear && semester) return `${schoolYear} • ${semester}`
            return schoolYear || semester
        },
        [normalizeDisplayValue]
    )

    const getSectionAcademicTermDisplay = React.useCallback(
        (section?: SectionDoc | null) => {
            if (!section) return ""

            const cachedLabel = normalizeDisplayValue((section as any)?.academicTermLabel)
            const cachedSemester = normalizeDisplayValue((section as any)?.semester)
            const relatedTerm = termMap.get(normalizeDisplayValue((section as any)?.termId)) ?? null
            const resolvedSchoolYear = normalizeDisplayValue((relatedTerm as any)?.schoolYear)
            const resolvedSemester = normalizeDisplayValue((relatedTerm as any)?.semester) || cachedSemester

            if (cachedLabel) return cachedLabel
            if (resolvedSchoolYear && resolvedSemester) return `${resolvedSchoolYear} • ${resolvedSemester}`
            return resolvedSchoolYear || resolvedSemester || cachedSemester
        },
        [normalizeDisplayValue, termMap]
    )

    const programNameMap = React.useMemo(() => {
        const m = new Map<string, string>()
        programs.forEach((program) => {
            const key = normalizeDisplayValue(program.$id)
            const value = normalizeDisplayValue(program.name)
            if (key && value) m.set(key, value)
        })
        return m
    }, [programs, normalizeDisplayValue])

    const getProgramNameById = React.useCallback(
        (value?: unknown) => {
            const id = normalizeDisplayValue(value)
            if (!id) return ""
            return normalizeDisplayValue(programNameMap.get(id))
        },
        [normalizeDisplayValue, programNameMap]
    )

    const getDepartmentNameById = React.useCallback(
        (value?: unknown) => {
            const id = normalizeDisplayValue(value)
            if (!id) return ""
            return normalizeDisplayValue(deptMap.get(id)?.name)
        },
        [deptMap, normalizeDisplayValue]
    )

    const getSectionDepartmentName = React.useCallback(
        (section?: SectionDoc | null) => {
            if (!section) return ""
            return (
                normalizeDisplayValue((section as any)?.departmentName) ||
                normalizeDisplayValue((section as any)?.collegeName) ||
                getDepartmentNameById((section as any)?.departmentId)
            )
        },
        [getDepartmentNameById, normalizeDisplayValue]
    )

    const getSectionProgramDisplayName = React.useCallback(
        (section?: SectionDoc | null) => {
            if (!section) return ""
            return (
                normalizeDisplayValue((section as any)?.programName) ||
                getProgramNameById((section as any)?.programId)
            )
        },
        [getProgramNameById, normalizeDisplayValue]
    )

    const getSectionFilterLabel = React.useCallback(
        (section?: SectionDoc | null) => normalizeDisplayValue(buildSectionDisplayLabel(section)),
        [normalizeDisplayValue]
    )

    const hasSelectedCollege = subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE
    const hasSelectedSemester = hasSelectedCollege && subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE
    const hasSelectedPrograms = hasSelectedSemester && subjectProgramFilters.length > 0
    const hasSelectedYearLevels = hasSelectedPrograms && subjectYearLevelFilters.length > 0

    const sectionsMatchingCollege = React.useMemo(
        () =>
            sections
                .filter((section) =>
                    sectionMatchesSubjectFilters({
                        section,
                        subjectCollegeFilter,
                        subjectProgramFilters: [],
                        subjectSectionFilters: [],
                        subjectYearLevelFilters: [],
                        subjectAcademicTermFilter: SUBJECT_FILTER_ALL_VALUE,
                    })
                )
                .slice()
                .sort(sortSectionsForDisplay),
        [sections, subjectCollegeFilter]
    )

    const sectionsMatchingCollegeAndSemester = React.useMemo(
        () =>
            sectionsMatchingCollege
                .filter((section) =>
                    sectionMatchesSubjectFilters({
                        section,
                        subjectCollegeFilter,
                        subjectProgramFilters: [],
                        subjectSectionFilters: [],
                        subjectYearLevelFilters: [],
                        subjectAcademicTermFilter,
                    })
                )
                .slice()
                .sort(sortSectionsForDisplay),
        [sectionsMatchingCollege, subjectAcademicTermFilter, subjectCollegeFilter]
    )

    const sectionsMatchingCollegeSemesterAndPrograms = React.useMemo(
        () =>
            sectionsMatchingCollegeAndSemester
                .filter((section) =>
                    sectionMatchesSubjectFilters({
                        section,
                        subjectCollegeFilter,
                        subjectProgramFilters,
                        subjectSectionFilters: [],
                        subjectYearLevelFilters: [],
                        subjectAcademicTermFilter,
                    })
                )
                .slice()
                .sort(sortSectionsForDisplay),
        [
            sectionsMatchingCollegeAndSemester,
            subjectAcademicTermFilter,
            subjectCollegeFilter,
            subjectProgramFilters,
        ]
    )

    const sectionsMatchingCollegeSemesterProgramAndYear = React.useMemo(
        () =>
            sectionsMatchingCollegeSemesterAndPrograms
                .filter((section) =>
                    sectionMatchesSubjectFilters({
                        section,
                        subjectCollegeFilter,
                        subjectProgramFilters,
                        subjectSectionFilters: [],
                        subjectYearLevelFilters,
                        subjectAcademicTermFilter,
                    })
                )
                .slice()
                .sort(sortSectionsForDisplay),
        [
            sectionsMatchingCollegeSemesterAndPrograms,
            subjectAcademicTermFilter,
            subjectCollegeFilter,
            subjectProgramFilters,
            subjectYearLevelFilters,
        ]
    )

    const subjectSectionOptions = React.useMemo(
        () => {
            if (!hasSelectedYearLevels) return []

            return sectionsMatchingCollegeSemesterProgramAndYear.map((section) => ({
                value: section.$id,
                label: getSectionFilterLabel(section),
            }))
        },
        [getSectionFilterLabel, hasSelectedYearLevels, sectionsMatchingCollegeSemesterProgramAndYear]
    )

    const filteredScopedSections = React.useMemo(() => {
        let scopedSections = sections

        if (hasSelectedCollege) {
            scopedSections = sectionsMatchingCollege
        }

        if (hasSelectedSemester) {
            scopedSections = sectionsMatchingCollegeAndSemester
        }

        if (hasSelectedPrograms) {
            scopedSections = sectionsMatchingCollegeSemesterAndPrograms
        }

        if (hasSelectedYearLevels) {
            scopedSections = sectionsMatchingCollegeSemesterProgramAndYear
        }

        if (subjectSectionFilters.length > 0) {
            scopedSections = scopedSections.filter((section) =>
                sectionMatchesSubjectFilters({
                    section,
                    subjectCollegeFilter,
                    subjectProgramFilters: hasSelectedPrograms ? subjectProgramFilters : [],
                    subjectSectionFilters,
                    subjectYearLevelFilters: hasSelectedYearLevels ? subjectYearLevelFilters : [],
                    subjectAcademicTermFilter: hasSelectedSemester ? subjectAcademicTermFilter : SUBJECT_FILTER_ALL_VALUE,
                })
            )
        }

        return scopedSections.slice().sort(sortSectionsForDisplay)
    }, [
        hasSelectedCollege,
        hasSelectedPrograms,
        hasSelectedSemester,
        hasSelectedYearLevels,
        sections,
        sectionsMatchingCollege,
        sectionsMatchingCollegeAndSemester,
        sectionsMatchingCollegeSemesterAndPrograms,
        sectionsMatchingCollegeSemesterProgramAndYear,
        subjectAcademicTermFilter,
        subjectCollegeFilter,
        subjectProgramFilters,
        subjectSectionFilters,
        subjectYearLevelFilters,
    ])



    React.useEffect(() => {
        const fallbackSectionId = filteredScopedSections[0]?.$id || ""

        if (!fallbackSectionId) {
            if (formSectionId) setFormSectionId("")
            return
        }

        if (filteredScopedSections.some((section) => section.$id === formSectionId)) return
        setFormSectionId(fallbackSectionId)
    }, [filteredScopedSections, formSectionId])

    const selectedFormSection = React.useMemo(
        () => filteredScopedSections.find((section) => section.$id === formSectionId) || filteredScopedSections[0] || null,
        [filteredScopedSections, formSectionId]
    )

    const normalizedSubjectSectionFilters = React.useMemo(
        () => subjectSectionFilters.map((value) => normalizeDisplayValue(value)).filter(Boolean),
        [normalizeDisplayValue, subjectSectionFilters]
    )

    const targetSectionsForSave = React.useMemo(() => {
        if (editingEntry) {
            const editingSectionId = normalizeDisplayValue(editingEntry.sectionId)
            const selectedSectionId = normalizeDisplayValue(formSectionId)
            const resolvedSection =
                (selectedSectionId
                    ? filteredScopedSections.find((section) => normalizeDisplayValue(section.$id) === selectedSectionId) || null
                    : null) ||
                (editingSectionId
                    ? sections.find((section) => normalizeDisplayValue(section.$id) === editingSectionId) || null
                    : null) ||
                selectedFormSection

            return resolvedSection ? [resolvedSection] : []
        }

        if (normalizedSubjectSectionFilters.length > 0) {
            return filteredScopedSections.filter((section) =>
                normalizedSubjectSectionFilters.includes(normalizeDisplayValue(section.$id))
            )
        }

        const selectedSectionId = normalizeDisplayValue(formSectionId)
        if (selectedSectionId) {
            const resolvedSection = filteredScopedSections.find(
                (section) => normalizeDisplayValue(section.$id) === selectedSectionId
            )
            if (resolvedSection) {
                return [resolvedSection]
            }
        }

        return filteredScopedSections.length === 1 ? filteredScopedSections : []
    }, [
        editingEntry,
        filteredScopedSections,
        formSectionId,
        normalizeDisplayValue,
        normalizedSubjectSectionFilters,
        sections,
        selectedFormSection,
    ])

    const targetSectionIdsForConflict = React.useMemo(
        () => new Set(targetSectionsForSave.map((section) => normalizeDisplayValue(section.$id)).filter(Boolean)),
        [normalizeDisplayValue, targetSectionsForSave]
    )

    const sectionScopedSubjects = React.useMemo(
        () => filterSubjectsForSections(subjects, filteredScopedSections),
        [filteredScopedSections, subjects]
    )

    const getSubjectCollegeNameValues = React.useCallback(
        (subject?: SubjectDoc | null) => {
            if (!subject) return []
            const anySubject = subject as Record<string, unknown>
            return buildSubjectFilterOptions([
                getDepartmentNameById(subject.departmentId),
                anySubject.departmentName,
                anySubject.collegeName,
                anySubject.college,
            ])
        },
        [getDepartmentNameById]
    )

    const getSubjectProgramNameValues = React.useCallback(
        (subject?: SubjectDoc | null) => {
            if (!subject) return []
            const anySubject = subject as Record<string, unknown>
            return buildSubjectFilterOptions([
                subject.programName,
                getProgramNameById(subject.programId),
                ...(Array.isArray(subject.programIds) ? (subject.programIds as Array<string | null | undefined>).map((programId) => getProgramNameById(programId)) : []),
                anySubject.programName,
            ])
        },
        [getProgramNameById]
    )

    const getSubjectAcademicTermNameValues = React.useCallback(
        (subject?: SubjectDoc | null) => {
            if (!subject) return []
            const anySubject = subject as Record<string, unknown>
            const subjectTermLabel = buildAcademicTermOptionLabel(termMap.get(normalizeDisplayValue(subject.termId)) ?? null)
            const inlineSchoolYear = normalizeDisplayValue(anySubject.schoolYear)
            const inlineSemester = normalizeDisplayValue(anySubject.semester)
            const inlineLabel = inlineSchoolYear && inlineSemester ? `${inlineSchoolYear} • ${inlineSemester}` : ""

            return buildSubjectFilterOptions([
                subjectTermLabel,
                inlineLabel,
            ])
        },
        [buildAcademicTermOptionLabel, normalizeDisplayValue, termMap]
    )

    const matchesAnySelectedSubjectFilter = React.useCallback(
        (selectedValues: string[], subjectValues: string[]) => {
            if (selectedValues.length === 0) return true
            if (subjectValues.length === 0) return true
            return selectedValues.some((selectedValue) => matchesSelectedSubjectFilter(selectedValue, subjectValues))
        },
        []
    )

    const subjectCollegeOptions = React.useMemo(
        () =>
            buildSubjectFilterOptions([
                selectedDepartmentName,
                ...departments.map((department) => normalizeDisplayValue(department.name)),
                ...subjects.flatMap((subject) => getSubjectCollegeNameValues(subject)),
            ]),
        [departments, getSubjectCollegeNameValues, normalizeDisplayValue, selectedDepartmentName, subjects]
    )

    const subjectProgramOptions = React.useMemo(() => {
        if (!hasSelectedSemester) return []

        const semesterScopedSubjects = subjects.filter((subject) => {
            const subjectCollegeValues = getSubjectCollegeNameValues(subject)
            const subjectAcademicTermValues = getSubjectAcademicTermNameValues(subject)

            return (
                matchesSelectedSubjectFilter(subjectCollegeFilter, subjectCollegeValues) &&
                matchesSelectedSubjectFilter(subjectAcademicTermFilter, subjectAcademicTermValues)
            )
        })

        const scopedPrograms = programs.filter((program) => {
            const departmentName = getDepartmentNameById(program.departmentId)
            if (!departmentName) return false
            return matchesSelectedSubjectFilter(subjectCollegeFilter, [departmentName])
        })

        return buildSubjectFilterOptions([
            ...sectionsMatchingCollegeAndSemester.map((section) => getSectionProgramDisplayName(section)),
            ...scopedPrograms.map((program) => normalizeDisplayValue(program.name)),
            ...semesterScopedSubjects.flatMap((subject) => getSubjectProgramNameValues(subject)),
        ])
    }, [
        getDepartmentNameById,
        getSectionProgramDisplayName,
        getSubjectAcademicTermNameValues,
        getSubjectCollegeNameValues,
        getSubjectProgramNameValues,
        hasSelectedSemester,
        matchesSelectedSubjectFilter,
        normalizeDisplayValue,
        programs,
        sectionsMatchingCollegeAndSemester,
        subjectAcademicTermFilter,
        subjectCollegeFilter,
        subjects,
    ])

    const yearLevelTotals = React.useMemo(() => {
        if (!hasSelectedPrograms) return []

        const totals = new Map<string, number>()
        sectionsMatchingCollegeSemesterAndPrograms.forEach((section) => {
            const label = normalizeDisplayValue(formatYearLevelFilterLabel(section.yearLevel))
            if (!label) return
            totals.set(label, (totals.get(label) || 0) + 1)
        })

        return Array.from(totals.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
    }, [hasSelectedPrograms, normalizeDisplayValue, sectionsMatchingCollegeSemesterAndPrograms])

    const subjectYearLevelOptions = React.useMemo(
        () => yearLevelTotals.map((item) => item.label),
        [yearLevelTotals]
    )

    const subjectYearLevelCounts = React.useMemo(() => {
        return yearLevelTotals.reduce<Record<string, number>>((acc, item) => {
            acc[item.label] = item.count
            return acc
        }, {})
    }, [yearLevelTotals])


    const subjectAcademicTermOptions = React.useMemo(() => {
        if (!hasSelectedCollege) return []

        const collegeScopedSubjects = subjects.filter((subject) =>
            matchesSelectedSubjectFilter(subjectCollegeFilter, getSubjectCollegeNameValues(subject))
        )

        return buildSubjectFilterOptions([
            ...sectionsMatchingCollege.map((section) => getSectionAcademicTermDisplay(section)),
            ...activeAcademicTerms.map((term) => buildAcademicTermOptionLabel(term)),
            ...collegeScopedSubjects.flatMap((subject) => getSubjectAcademicTermNameValues(subject)),
        ])
    }, [
        activeAcademicTerms,
        buildAcademicTermOptionLabel,
        getSectionAcademicTermDisplay,
        getSubjectAcademicTermNameValues,
        getSubjectCollegeNameValues,
        hasSelectedCollege,
        matchesSelectedSubjectFilter,
        sectionsMatchingCollege,
        subjectCollegeFilter,
        subjects,
    ])

    const clearSubjectFilters = React.useCallback(() => {
        setSubjectCollegeFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectProgramFilters([])
        setSubjectSectionFilters([])
        setSubjectYearLevelFilters([])
        setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
    }, [])


    const setSubjectCollegeFilterCascade = React.useCallback((value: string) => {
        setSubjectCollegeFilter(value)
        setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
        setSubjectProgramFilters([])
        setSubjectYearLevelFilters([])
        setSubjectSectionFilters([])
    }, [])

    const setSubjectAcademicTermFilterCascade = React.useCallback((value: string) => {
        setSubjectAcademicTermFilter(value)
        setSubjectProgramFilters([])
        setSubjectYearLevelFilters([])
        setSubjectSectionFilters([])
    }, [])

    const setSubjectProgramFiltersCascade = React.useCallback((value: React.SetStateAction<string[]>) => {
        setSubjectProgramFilters((current) => (typeof value === "function" ? value(current) : value))
        setSubjectYearLevelFilters([])
        setSubjectSectionFilters([])
    }, [])

    const setSubjectYearLevelFiltersCascade = React.useCallback((value: React.SetStateAction<string[]>) => {
        setSubjectYearLevelFilters((current) => (typeof value === "function" ? value(current) : value))
        setSubjectSectionFilters([])
    }, [])


    const applyScheduleContextSubjectFilters = React.useCallback(() => {
        const nextCollege = pickMatchingSubjectFilterOption(subjectCollegeOptions, [
            selectedDepartmentName,
            getSectionDepartmentName(selectedFormSection),
        ])
        const nextSemester = getSectionAcademicTermDisplay(selectedFormSection) || selectedAcademicTermCompositeLabel
        const nextProgram = getSectionProgramDisplayName(selectedFormSection)
        const nextYearLevel = formatYearLevelFilterLabel(selectedFormSection?.yearLevel)

        setSubjectCollegeFilter(nextCollege)
        setSubjectAcademicTermFilter(nextSemester || SUBJECT_FILTER_ALL_VALUE)
        setSubjectProgramFilters(nextProgram ? [nextProgram] : [])
        setSubjectYearLevelFilters(nextYearLevel ? [nextYearLevel] : [])
        setSubjectSectionFilters(selectedFormSection?.$id ? [selectedFormSection.$id] : [])
    }, [
        getSectionAcademicTermDisplay,
        getSectionDepartmentName,
        getSectionProgramDisplayName,
        selectedAcademicTermCompositeLabel,
        selectedDepartmentName,
        selectedFormSection,
        subjectCollegeOptions,
    ])

    const hasActiveSubjectScopeFilters = React.useMemo(
        () =>
            subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE ||
            subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE ||
            subjectProgramFilters.length > 0 ||
            subjectYearLevelFilters.length > 0 ||
            subjectSectionFilters.length > 0,
        [
            subjectAcademicTermFilter,
            subjectCollegeFilter,
            subjectProgramFilters.length,
            subjectSectionFilters.length,
            subjectYearLevelFilters.length,
        ]
    )

    React.useEffect(() => {
        if (!entryDialogOpen || editingEntry || hasActiveSubjectScopeFilters) return
        applyScheduleContextSubjectFilters()
    }, [
        activeScheduleScopeKey,
        applyScheduleContextSubjectFilters,
        editingEntry,
        entryDialogOpen,
        formSectionId,
        hasActiveSubjectScopeFilters,
    ])

    React.useEffect(() => {
        if (subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectCollegeOptions.includes(subjectCollegeFilter)) {
            setSubjectCollegeFilter(SUBJECT_FILTER_ALL_VALUE)
            return
        }

        if (subjectCollegeFilter === SUBJECT_FILTER_ALL_VALUE) {
            if (subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE) setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
            if (subjectProgramFilters.length > 0) setSubjectProgramFilters([])
            if (subjectYearLevelFilters.length > 0) setSubjectYearLevelFilters([])
            if (subjectSectionFilters.length > 0) setSubjectSectionFilters([])
            return
        }

        if (subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE && !subjectAcademicTermOptions.includes(subjectAcademicTermFilter)) {
            setSubjectAcademicTermFilter(SUBJECT_FILTER_ALL_VALUE)
            return
        }

        if (subjectAcademicTermFilter === SUBJECT_FILTER_ALL_VALUE) {
            if (subjectProgramFilters.length > 0) setSubjectProgramFilters([])
            if (subjectYearLevelFilters.length > 0) setSubjectYearLevelFilters([])
            if (subjectSectionFilters.length > 0) setSubjectSectionFilters([])
            return
        }

        const nextProgramFilters = subjectProgramFilters.filter((value) => subjectProgramOptions.includes(value))
        if (nextProgramFilters.length !== subjectProgramFilters.length) {
            setSubjectProgramFilters(nextProgramFilters)
            return
        }

        if (subjectProgramFilters.length === 0) {
            if (subjectYearLevelFilters.length > 0) setSubjectYearLevelFilters([])
            if (subjectSectionFilters.length > 0) setSubjectSectionFilters([])
            return
        }

        const nextYearLevelFilters = subjectYearLevelFilters.filter((value) => subjectYearLevelOptions.includes(value))
        if (nextYearLevelFilters.length !== subjectYearLevelFilters.length) {
            setSubjectYearLevelFilters(nextYearLevelFilters)
            return
        }

        if (subjectYearLevelFilters.length === 0) {
            if (subjectSectionFilters.length > 0) setSubjectSectionFilters([])
            return
        }

        const nextSectionFilters = subjectSectionFilters.filter((value) =>
            subjectSectionOptions.some((option) => option.value === value)
        )
        if (nextSectionFilters.length !== subjectSectionFilters.length) {
            setSubjectSectionFilters(nextSectionFilters)
        }
    }, [
        subjectAcademicTermFilter,
        subjectAcademicTermOptions,
        subjectCollegeFilter,
        subjectCollegeOptions,
        subjectProgramFilters,
        subjectProgramOptions,
        subjectSectionFilters,
        subjectSectionOptions,
        subjectYearLevelFilters,
        subjectYearLevelOptions,
    ])

    const filteredFormSubjects = React.useMemo(() => {
        return sectionScopedSubjects
            .filter((subject) => {
                const subjectCollegeValues = getSubjectCollegeNameValues(subject)
                const subjectProgramValues = getSubjectProgramNameValues(subject)
                const subjectYearValues = getSubjectYearLevelFilterValues(subject)
                const subjectAcademicTermValues = getSubjectAcademicTermNameValues(subject)

                return (
                    matchesSelectedSubjectFilter(subjectCollegeFilter, subjectCollegeValues) &&
                    matchesAnySelectedSubjectFilter(subjectProgramFilters, subjectProgramValues) &&
                    matchesAnySelectedSubjectFilter(subjectYearLevelFilters, subjectYearValues) &&
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
        getSubjectAcademicTermNameValues,
        getSubjectCollegeNameValues,
        getSubjectProgramNameValues,
        matchesAnySelectedSubjectFilter,
        sectionScopedSubjects,
        subjectAcademicTermFilter,
        subjectCollegeFilter,
        subjectProgramFilters,
        subjectYearLevelFilters,
    ])

    const activeSubjectFilterBadges = React.useMemo(
        () =>
            [
                subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE ? `College: ${subjectCollegeFilter}` : null,
                subjectProgramFilters.length > 0 ? `Programs: ${subjectProgramFilters.join(", ")}` : null,
                subjectSectionFilters.length > 0
                    ? `Sections: ${subjectSectionFilters
                        .map((sectionId) => subjectSectionOptions.find((option) => option.value === sectionId)?.label || sectionId)
                        .join(", ")}`
                    : null,
                subjectYearLevelFilters.length > 0 ? `Year Levels: ${subjectYearLevelFilters.join(", ")}` : null,
                subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE ? `Semester: ${subjectAcademicTermFilter}` : null,
            ].filter(Boolean) as string[],
        [
            subjectAcademicTermFilter,
            subjectCollegeFilter,
            subjectProgramFilters,
            subjectSectionFilters,
            subjectSectionOptions,
            subjectYearLevelFilters,
        ]
    )

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [tRes, dRes, pRes] = await Promise.all([
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

            const tDocs = (tRes?.documents ?? []) as AcademicTermDoc[]
            const dDocs = ((dRes?.documents ?? []) as DepartmentDoc[])
                .filter((department) => department.isActive !== false)
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }))

            const pDocs = ((pRes?.documents ?? []) as any[])
                .map((program) => ({
                    $id: String(program.$id || ""),
                    departmentId: String(program.departmentId || "").trim() || null,
                    code: String(program.code || "").trim() || null,
                    name: String(program.name || "").trim() || null,
                    isActive: program.isActive !== false,
                }))
                .filter((program) => program.isActive !== false)
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })) as ScheduleProgramDoc[]

            setTerms(tDocs)
            setDepartments(dDocs)
            setPrograms(pDocs)
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
        if (activeAcademicTermIds.length === 0) {
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
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, [
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SUBJECTS, [Query.limit(5000)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROOMS, [Query.limit(2000)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SECTIONS, [
                    Query.limit(2000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.orderAsc("name"),
                    Query.limit(5000),
                ]),
            ])

            const activeTermIdSet = new Set(activeAcademicTermIds)

            const scopedClasses = ((cRes?.documents ?? []) as ClassDoc[])
                .filter((classDoc) => activeTermIdSet.has(String(classDoc.termId || "").trim()))

            const scopedClassIds = new Set(scopedClasses.map((classDoc) => String(classDoc.$id || "").trim()).filter(Boolean))

            const scopedMeetings = ((mRes?.documents ?? []) as ClassMeetingDoc[])
                .filter((meeting) => scopedClassIds.has(String((meeting as any).classId || "").trim()))

            const allSubjects = (subjRes?.documents ?? []) as SubjectDoc[]
            const scopedSubjects = allSubjects
                .filter((subject) => (subject as any).isActive !== false)
                .filter((subject) => hasLinkedSubjectMetadata(subject))
                .filter((subject) => {
                    const subjectTermId = String((subject as any).termId || "").trim()
                    return Boolean(subjectTermId) && activeTermIdSet.has(subjectTermId)
                })
                .sort((a, b) => {
                    const ac = String((a as any).code || "").toLowerCase()
                    const bc = String((b as any).code || "").toLowerCase()
                    if (ac !== bc) return ac.localeCompare(bc)
                    return String((a as any).title || "").localeCompare(String((b as any).title || ""))
                })

            const scopedRooms = ((roomRes?.documents ?? []) as RoomDoc[])
                .filter((room) => (room as any).isActive !== false)
                .sort((a, b) => String((a as any).code || "").localeCompare(String((b as any).code || "")))

            const programById = new Map(
                programs
                    .filter((program) => Boolean(String(program.$id || "").trim()))
                    .map((program) => [String(program.$id || "").trim(), program] as const)
            )

            const scopedSections = ((secRes?.documents ?? []) as SectionDoc[])
                .filter((section) => (section as any).isActive !== false)
                .filter((section) => hasLinkedSectionMetadata(section))
                .filter((section) => activeTermIdSet.has(String(section.termId || "").trim()))
                .map((section) => {
                    const relatedTerm = termMap.get(String(section.termId || "").trim()) ?? null
                    const relatedProgram = programById.get(String((section as any).programId || "").trim()) ?? null
                    const departmentName =
                        getDepartmentNameById((section as any).departmentId) ||
                        String((section as any).departmentName || "").trim() ||
                        String((section as any).collegeName || "").trim()
                    const semester =
                        String((section as any).semester || "").trim() ||
                        String((relatedTerm as any)?.semester || "").trim()
                    const academicTermLabel =
                        String((section as any).academicTermLabel || "").trim() ||
                        buildAcademicTermOptionLabel(relatedTerm)

                    return {
                        ...section,
                        departmentName,
                        collegeName: departmentName,
                        programName:
                            String((section as any).programName || "").trim() ||
                            String((relatedProgram as any)?.name || "").trim(),
                        programCode:
                            String((section as any).programCode || "").trim() ||
                            String((relatedProgram as any)?.code || "").trim(),
                        semester,
                        academicTermLabel,
                    } as SectionDoc
                })
                .sort(sortSectionsForDisplay)

            const scopedFaculty = ((userRes?.documents ?? []) as UserProfileDoc[])
                .filter((facultyProfile) => (facultyProfile as any).isActive !== false)
                .sort((a, b) =>
                    String((a as any).name || (a as any).email || (a as any).userId || "").localeCompare(
                        String((b as any).name || (b as any).email || (b as any).userId || "")
                    )
                )

            setClasses(scopedClasses)
            setMeetings(scopedMeetings)
            setSubjects(scopedSubjects)
            setRooms(scopedRooms)
            setSections(scopedSections)
            setFacultyProfiles(scopedFaculty)
        } catch (e: any) {
            setEntriesError(e?.message || "Failed to load schedule entries.")
        } finally {
            setEntriesLoading(false)
        }
    }, [activeAcademicTermIds])

    React.useEffect(() => {
        void fetchScheduleContext()
    }, [fetchScheduleContext])

    const inferSectionTrackCode = React.useCallback((section?: SectionDoc | null) => {
        if (!section) return ""
        const values = [
            (section as any)?.yearLevel,
            (section as any)?.programCode,
            (section as any)?.programName,
            (section as any)?.label,
            (section as any)?.name,
        ]

        for (const value of values) {
            const normalized = normalizeDisplayValue(value).toUpperCase()
            if (!normalized) continue
            if (normalized.startsWith("CS")) return "CS"
            if (normalized.startsWith("IS")) return "IS"
            if (normalized.includes("COMPUTER SCIENCE")) return "CS"
            if (normalized.includes("INFORMATION SYSTEM")) return "IS"
        }

        return ""
    }, [normalizeDisplayValue])

    const normalizeYearLevelValueForStorage = React.useCallback((value: string, section?: SectionDoc | null) => {
        const raw = normalizeDisplayValue(value)
        if (!raw) return ""

        const prefixedMatch = raw.match(/^(CS|IS)\s*(\d+)$/i)
        if (prefixedMatch) {
            return `${prefixedMatch[1].toUpperCase()} ${prefixedMatch[2]}`
        }

        const numberMatch = raw.match(/(\d+)/)
        const numberToken = numberMatch?.[1] || ""
        if (!numberToken) return raw

        const inferredTrackCode = inferSectionTrackCode(section)
        if (inferredTrackCode) {
            return `${inferredTrackCode} ${numberToken}`
        }

        return numberToken
    }, [inferSectionTrackCode, normalizeDisplayValue])

    const getYearLevelSectionName = React.useCallback((section?: SectionDoc | null) => {
        const rawName = normalizeDisplayValue(section?.name)
        if (!rawName) return DEFAULT_YEAR_LEVEL_SECTION_NAME

        const normalizedName = rawName.toLowerCase()
        if (normalizedName === "others") return DEFAULT_YEAR_LEVEL_SECTION_NAME

        if (/^[a-z]$/i.test(rawName)) {
            return rawName.toUpperCase()
        }

        return DEFAULT_YEAR_LEVEL_SECTION_NAME
    }, [normalizeDisplayValue])

    const createYearLevelSection = React.useCallback(async (value: string) => {
        const scopeSection = selectedFormSection || sections[0] || null
        const nextYearLevel = normalizeYearLevelValueForStorage(value, scopeSection)
        const nextLabel = normalizeDisplayValue(formatYearLevelFilterLabel(nextYearLevel))

        const scopeTermId =
            normalizeDisplayValue(scopeSection?.termId) ||
            normalizeDisplayValue(activeAcademicTermIds[0])

        const scopeDepartmentId = normalizeDisplayValue(scopeSection?.departmentId)
        const scopeProgramId = normalizeDisplayValue((scopeSection as any)?.programId)
        const sectionName = getYearLevelSectionName(scopeSection)

        if (!scopeTermId || !scopeDepartmentId || !nextYearLevel || !nextLabel) {
            toast.error("Please select a scoped section or ensure there is an active term before adding a year level.")
            return
        }

        const exists = sections.some((section) => {
            if (!subjectFilterValuesMatch(formatYearLevelFilterLabel(section.yearLevel), nextLabel)) {
                return false
            }

            if (normalizeDisplayValue(section.termId) !== scopeTermId) return false
            if (normalizeDisplayValue(section.departmentId) !== scopeDepartmentId) return false

            const sectionProgramId = normalizeDisplayValue((section as any)?.programId)
            if (scopeProgramId || sectionProgramId) {
                return sectionProgramId === scopeProgramId
            }

            return true
        })
        if (exists) {
            toast.error("That year level already exists in sections for the current scope.")
            return
        }

        setYearLevelMutating(true)
        try {
            await databases.createDocument(DATABASE_ID, COLLECTIONS.SECTIONS, ID.unique(), {
                termId: scopeTermId,
                departmentId: scopeDepartmentId,
                programId: scopeProgramId || null,
                yearLevel: nextYearLevel,
                name: sectionName,
                studentCount: null,
                isActive: true,
            })
            toast.success("Year level added.")
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to add year level.")
        } finally {
            setYearLevelMutating(false)
        }
    }, [activeAcademicTermIds, fetchScheduleContext, getYearLevelSectionName, normalizeDisplayValue, normalizeYearLevelValueForStorage, sections, selectedFormSection])

    const renameYearLevelSections = React.useCallback(async (currentValue: string, nextValue: string) => {
        const currentLabel = normalizeDisplayValue(currentValue)
        const matchingSections = sections.filter((section) => subjectFilterValuesMatch(formatYearLevelFilterLabel(section.yearLevel), currentLabel))

        const referenceSection = matchingSections[0] || selectedFormSection || null
        const nextYearLevel = normalizeYearLevelValueForStorage(nextValue, referenceSection)
        const nextLabel = normalizeDisplayValue(formatYearLevelFilterLabel(nextYearLevel))
        const fallbackSectionName = getYearLevelSectionName(referenceSection)

        if (!currentLabel || !nextYearLevel || !nextLabel) {
            toast.error("Please enter a valid year level.")
            return
        }

        if (matchingSections.length === 0) {
            toast.error("No matching sections found for that year level.")
            return
        }

        setYearLevelMutating(true)
        try {
            await Promise.all(
                matchingSections.map((section) => {
                    const currentSectionName = normalizeDisplayValue((section as any)?.name)
                    const nextSectionName =
                        !currentSectionName || subjectFilterValuesMatch(currentSectionName, currentLabel)
                            ? fallbackSectionName
                            : getYearLevelSectionName(section)

                    return databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, section.$id, {
                        yearLevel: nextYearLevel,
                        name: nextSectionName,
                    })
                })
            )
            toast.success("Year level updated.")
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update year level.")
        } finally {
            setYearLevelMutating(false)
        }
    }, [fetchScheduleContext, getYearLevelSectionName, normalizeDisplayValue, normalizeYearLevelValueForStorage, sections, selectedFormSection])

    const deleteSection = React.useCallback(async (value: string) => {
        const sectionId = normalizeDisplayValue(value)
        if (!sectionId) {
            toast.error("Please choose a section to delete.")
            return
        }

        const matchingSection = sections.find((section) => normalizeDisplayValue(section.$id) === sectionId)
        if (!matchingSection) {
            toast.error("No matching section found.")
            return
        }

        setSectionMutating(true)
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, matchingSection.$id)
            setSubjectSectionFilters((current) => current.filter((item) => item !== sectionId))
            if (normalizeDisplayValue(formSectionId) === sectionId) {
                setFormSectionId("")
            }
            toast.success("Section deleted.")
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete section.")
        } finally {
            setSectionMutating(false)
        }
    }, [fetchScheduleContext, formSectionId, normalizeDisplayValue, sections])

    const deleteYearLevelSections = React.useCallback(async (value: string) => {
        const yearLevelLabel = normalizeDisplayValue(value)
        if (!yearLevelLabel) {
            toast.error("Please choose a year level to delete.")
            return
        }

        const matchingSections = sections.filter((section) => subjectFilterValuesMatch(formatYearLevelFilterLabel(section.yearLevel), yearLevelLabel))
        if (matchingSections.length === 0) {
            toast.error("No matching sections found for that year level.")
            return
        }

        setYearLevelMutating(true)
        try {
            await Promise.all(
                matchingSections.map((section) => databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, section.$id))
            )
            setSubjectYearLevelFilters((current) => current.filter((item) => item !== yearLevelLabel))
            toast.success("Year level deleted.")
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete year level.")
        } finally {
            setYearLevelMutating(false)
        }
    }, [fetchScheduleContext, normalizeDisplayValue, sections])

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
            const secProgramCode = String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim()
            const secProgramName = String(sectionAny.programName || sectionAny.sectionProgramName || "").trim()
            const sectionLabel =
                buildSectionDisplayLabel(section) ||
                String((section as any)?.label || sectionAny.sectionLabel || "").trim() ||
                String((c as any).sectionId || "")

            const roomCode = String((room as any)?.code || "").trim()
            const roomName = String((room as any)?.name || "").trim()
            const roomLabel = [roomCode, roomName].filter(Boolean).join(" • ") || "Unassigned"
            const normalizedMeetingDayOfWeek = getCanonicalDayValue(String((m as any).dayOfWeek || "").trim())

            rows.push({
                meetingId: String((m as any).$id || ""),
                classId: String((c as any).$id || ""),

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
        const normalizedSectionFilterIds = subjectSectionFilters
            .map((value) => normalizeDisplayValue(value))
            .filter(Boolean)
        const preservedSelectedSections = normalizedSectionFilterIds.length > 0
            ? filteredScopedSections.filter((section) =>
                normalizedSectionFilterIds.includes(normalizeDisplayValue(section.$id))
            )
            : []
        const nextSection = preservedSelectedSections[0] || filteredScopedSections[0] || sections[0] || null
        const nextSectionId = nextSection?.$id || ""
        const nextSubjects = filterSubjectsForSections(
            subjects,
            preservedSelectedSections.length > 0 ? preservedSelectedSections : nextSection ? [nextSection] : []
        )

        setFormSectionId(nextSectionId)
        if (normalizedSectionFilterIds.length === 0) {
            setSubjectSectionFilters(nextSectionId ? [nextSectionId] : [])
        }
        setFormSubjectIds(nextSubjects[0]?.$id ? [nextSubjects[0].$id] : [])
        setFormFacultyChoice(FACULTY_OPTION_NONE)
        setFormManualFaculty("")
        setFormRoomId(rooms[0]?.$id || "")
        setFormDayOfWeek(getCanonicalDayValue("Monday"))
        setFormStartTime("07:00")
        setFormEndTime("08:00")
        setFormMeetingType("LECTURE")
        setFormAllowConflictSave(false)
    }, [filteredScopedSections, normalizeDisplayValue, rooms, sections, subjectSectionFilters, subjects])

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
        setSubjectSectionFilters(String(row.sectionId || "").trim() ? [String(row.sectionId || "")] : [])
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

            if (
                targetSectionIdsForConflict.size > 0 &&
                r.sectionId &&
                targetSectionIdsForConflict.has(normalizeDisplayValue(r.sectionId))
            ) {
                out.push({ type: "section", row: r })
            }
        }

        return out
    }, [
        entryDialogOpen,
        formDayOfWeek,
        formStartTime,
        formEndTime,
        formRoomId,
        formFacultyChoice,
        formManualFaculty,
        normalizeDisplayValue,
        scheduleRows,
        editingEntry,
        targetSectionIdsForConflict,
    ])

    const candidateConflictCounts = React.useMemo(() => {
        const counts = { room: 0, faculty: 0, section: 0 }
        for (const c of candidateConflicts) {
            counts[c.type] += 1
        }
        return counts
    }, [candidateConflicts])


    const saveEntry = async () => {
        const sectionsToSave = targetSectionsForSave
        const selectedSectionForPayload = sectionsToSave[0] || null

        if (!selectedSectionForPayload) {
            toast.error(editingEntry ? "Unable to resolve the section for this schedule entry." : "Select at least one section before saving.")
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

            const selectedSubjectForPayload =
                subjects.find((subject) => subject.$id === selectedSubjectId) || null

            if (editingEntry) {
                const selectedSectionId = normalizeDisplayValue(selectedSectionForPayload.$id)

                if (!selectedSectionId) {
                    toast.error("Unable to resolve the section for this schedule entry.")
                    return
                }

                const resolvedTermId =
                    normalizeDisplayValue((selectedSectionForPayload as any)?.termId) ||
                    normalizeDisplayValue((selectedSubjectForPayload as any)?.termId) ||
                    normalizeDisplayValue(activeAcademicTermIds[0])

                const resolvedDepartmentId =
                    normalizeDisplayValue((selectedSectionForPayload as any)?.departmentId) ||
                    normalizeDisplayValue((selectedSubjectForPayload as any)?.departmentId)

                if (!resolvedTermId || !resolvedDepartmentId) {
                    toast.error("Unable to resolve the semester or college for this schedule entry.")
                    return
                }

                const classPayload = buildScheduleClassWritePayload({
                    termId: resolvedTermId,
                    departmentId: resolvedDepartmentId,
                    programId: (selectedSectionForPayload as any)?.programId || (selectedSubjectForPayload as any)?.programId || null,
                    sectionId: selectedSectionId,
                    subjectId: selectedSubjectId,
                    facultyUserId,
                    manualFaculty,
                    status: editingEntry.classStatus || null,
                })

                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingEntry.classId,
                    classPayload
                )

                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    editingEntry.meetingId,
                    buildScheduleMeetingWritePayload({
                        classId: editingEntry.classId,
                        dayOfWeek: formDayOfWeek,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        roomId: formRoomId,
                        meetingType: formMeetingType,
                    })
                )

                toast.success("Schedule entry updated.")
                handleEntryDialogOpenChange(false)
                await fetchScheduleContext()
                return
            }

            const existingDuplicateKeys = new Set(
                scheduleRows.map((row) =>
                    buildScheduleDuplicateKey({
                        termId: row.termId,
                        sectionId: row.sectionId,
                        subjectId: row.subjectId,
                        dayOfWeek: row.dayOfWeek,
                        startTime: row.startTime,
                        endTime: row.endTime,
                        meetingType: row.meetingType,
                    })
                )
            )

            let createdCount = 0
            const skippedDuplicateSections: string[] = []
            const skippedInvalidSections: string[] = []

            for (const section of sectionsToSave) {
                const sectionId = normalizeDisplayValue(section.$id)
                if (!sectionId) continue

                const resolvedTermId =
                    normalizeDisplayValue((section as any)?.termId) ||
                    normalizeDisplayValue((selectedSubjectForPayload as any)?.termId) ||
                    normalizeDisplayValue(activeAcademicTermIds[0])

                const resolvedDepartmentId =
                    normalizeDisplayValue((section as any)?.departmentId) ||
                    normalizeDisplayValue((selectedSubjectForPayload as any)?.departmentId)

                if (!resolvedTermId || !resolvedDepartmentId) {
                    skippedInvalidSections.push(buildSectionDisplayLabel(section) || sectionId)
                    continue
                }

                const duplicateKey = buildScheduleDuplicateKey({
                    termId: resolvedTermId,
                    sectionId,
                    subjectId: selectedSubjectId,
                    dayOfWeek: formDayOfWeek,
                    startTime: formStartTime,
                    endTime: formEndTime,
                    meetingType: formMeetingType,
                })

                if (existingDuplicateKeys.has(duplicateKey)) {
                    skippedDuplicateSections.push(buildSectionDisplayLabel(section) || sectionId)
                    continue
                }

                const classPayload = buildScheduleClassWritePayload({
                    termId: resolvedTermId,
                    departmentId: resolvedDepartmentId,
                    programId: (section as any)?.programId || (selectedSubjectForPayload as any)?.programId || null,
                    sectionId,
                    subjectId: selectedSubjectId,
                    facultyUserId,
                    manualFaculty,
                    status: "Planned",
                })

                const createdClass = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    ID.unique(),
                    classPayload
                )

                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    ID.unique(),
                    buildScheduleMeetingWritePayload({
                        classId: (createdClass as any).$id,
                        dayOfWeek: formDayOfWeek,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        roomId: formRoomId,
                        meetingType: formMeetingType,
                    })
                )

                existingDuplicateKeys.add(duplicateKey)
                createdCount += 1
            }

            if (createdCount === 0) {
                if (skippedDuplicateSections.length > 0) {
                    toast.error(
                        skippedDuplicateSections.length === 1
                            ? `Skipped duplicate entry for ${skippedDuplicateSections[0]}.`
                            : `Skipped ${skippedDuplicateSections.length} duplicate schedule entries.`
                    )
                    return
                }

                if (skippedInvalidSections.length > 0) {
                    toast.error("Unable to resolve the semester or college for the selected sections.")
                    return
                }

                toast.error("No schedule entries were created.")
                return
            }

            if (skippedDuplicateSections.length > 0 || skippedInvalidSections.length > 0) {
                const details = [
                    skippedDuplicateSections.length > 0
                        ? `Skipped ${skippedDuplicateSections.length} duplicate${skippedDuplicateSections.length === 1 ? "" : "s"}`
                        : "",
                    skippedInvalidSections.length > 0
                        ? `Skipped ${skippedInvalidSections.length} invalid section${skippedInvalidSections.length === 1 ? "" : "s"}`
                        : "",
                ]
                    .filter(Boolean)
                    .join(" • ")

                toast.success(
                    `Created ${createdCount} schedule entr${createdCount === 1 ? "y" : "ies"}${details ? ` • ${details}` : ""}.`
                )
            } else {
                toast.success(
                    `Created ${createdCount} schedule entr${createdCount === 1 ? "y" : "ies"}.`
                )
            }

            handleEntryDialogOpenChange(false)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(getScheduleSaveErrorMessage(e))
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


    const scheduleScopeLabel = React.useMemo(() => {
        if (activeAcademicTerms.length === 0) return "—"

        const departmentCount = Array.from(
            new Set(
                sections
                    .map((section) => normalizeDisplayValue(section.departmentId))
                    .filter(Boolean)
            )
        ).length

        const termLabelText =
            activeAcademicTerms.length === 1
                ? buildAcademicTermOptionLabel(activeAcademicTerms[0]) || "Active semester"
                : `${activeAcademicTerms.length} active semesters`

        const departmentLabelText =
            selectedDepartmentName ||
            (departmentCount > 1 ? `${departmentCount} colleges` : "All colleges")

        return [termLabelText, departmentLabelText].filter(Boolean).join(" • ")
    }, [activeAcademicTerms, buildAcademicTermOptionLabel, normalizeDisplayValue, sections, selectedDepartmentName])

    const applySelectedAcademicTerms = React.useCallback(async () => {
        const normalizedSelection = Array.from(new Set(termScopeSelection.map((value) => String(value || "").trim()).filter(Boolean)))

        if (normalizedSelection.length === 0) {
            toast.error("Select at least one semester to activate.")
            return
        }

        setTermScopeSaving(true)
        try {
            const selectedSet = new Set(normalizedSelection)
            await Promise.all(
                terms.map((term) =>
                    databases.updateDocument(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, term.$id, {
                        isActive: selectedSet.has(String(term.$id || "").trim()),
                    })
                )
            )

            toast.success("Active semesters updated.")
            setTermScopePopoverOpen(false)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update active semesters.")
        } finally {
            setTermScopeSaving(false)
        }
    }, [fetchAll, termScopeSelection, terms])

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
                <ExtraSmallScheduleCardShell
                    value="semester-scope"
                    title="Semester Scope"
                    description="Set the active semesters directly from this page. Schedule sections, subjects, and entries only load from the selected active semester records."
                >
                    <Card className="rounded-2xl border-0 shadow-none">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base wrap-anywhere">Semester Scope</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                                <div className="text-sm text-muted-foreground wrap-anywhere">
                                    Set the active semesters directly from this page. Schedule sections, subjects, and entries only load from the selected active semester records.
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {activeAcademicTerms.length > 0 ? (
                                        activeAcademicTerms.map((term) => (
                                            <Badge key={term.$id} variant="secondary" className="max-w-full rounded-lg whitespace-normal wrap-anywhere">
                                                {termLabel(term)}
                                            </Badge>
                                        ))
                                    ) : (
                                        <Badge variant="outline" className="max-w-full rounded-lg whitespace-normal wrap-anywhere">No active semester</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Popover open={termScopePopoverOpen} onOpenChange={setTermScopePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="min-w-0 w-full justify-between rounded-xl"
                                        >
                                            <span className="block min-w-0 flex-1 truncate text-left">
                                                {selectedAcademicTermScopeLabel}
                                            </span>
                                            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
                                        </Button>
                                    </PopoverTrigger>

                                    <PopoverContent align="start" className="w-[320px] max-h-75 overflow-auto p-0">
                                        <div className="border-b px-4 py-3">
                                            <div className="text-sm font-medium wrap-anywhere">Select active semesters</div>
                                            <div className="text-xs text-muted-foreground wrap-anywhere">
                                                Multiple semesters can stay active at the same time.
                                            </div>
                                        </div>

                                        <ScrollArea className="max-h-72">
                                            <div className="space-y-2 p-3">
                                                {academicTermScopeOptions.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground wrap-anywhere">
                                                        No semesters available.
                                                    </div>
                                                ) : (
                                                    academicTermScopeOptions.map((term) => {
                                                        const checked = termScopeSelection.includes(term.$id)

                                                        return (
                                                            <label
                                                                key={term.$id}
                                                                htmlFor={`term-scope-${term.$id}`}
                                                                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition hover:bg-muted/40"
                                                            >
                                                                <Checkbox
                                                                    id={`term-scope-${term.$id}`}
                                                                    checked={checked}
                                                                    onCheckedChange={(value) => {
                                                                        const nextChecked = Boolean(value)

                                                                        setTermScopeSelection((current) => {
                                                                            if (nextChecked) {
                                                                                return current.includes(term.$id)
                                                                                    ? current
                                                                                    : [...current, term.$id]
                                                                            }

                                                                            return current.filter((item) => item !== term.$id)
                                                                        })
                                                                    }}
                                                                />

                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 font-medium">
                                                                        <span className="block min-w-0 flex-1 truncate">
                                                                            {term.label}
                                                                        </span>
                                                                        {term.isActive ? (
                                                                            <Check className="size-3.5 shrink-0 text-muted-foreground" />
                                                                        ) : null}
                                                                    </div>

                                                                    <div className="text-xs text-muted-foreground wrap-anywhere">
                                                                        {term.isActive ? "Currently active" : "Currently inactive"}
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </ScrollArea>
                                        <div className="flex flex-col items-stretch gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTermScopeSelection(activeAcademicTermIds)}
                                                disabled={termScopeSaving}
                                                className="w-full text-primary whitespace-normal wrap-anywhere"
                                            >
                                                Reset
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => void applySelectedAcademicTerms()}
                                                disabled={termScopeSaving}
                                                className="w-full whitespace-normal wrap-anywhere"
                                            >
                                                {termScopeSaving ? "Saving..." : "Apply Active Terms"}
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>


                            </div>
                        </CardContent>
                    </Card>
                </ExtraSmallScheduleCardShell>

                <Card className="hidden rounded-2xl sm:block">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base wrap-anywhere">Semester Scope</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground wrap-anywhere">
                                Set the active semesters directly from this page. Schedule sections, subjects, and entries only load from the selected active semester records.
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {activeAcademicTerms.length > 0 ? (
                                    activeAcademicTerms.map((term) => (
                                        <Badge key={term.$id} variant="secondary" className="max-w-full rounded-lg whitespace-normal wrap-anywhere">
                                            {termLabel(term)}
                                        </Badge>
                                    ))
                                ) : (
                                    <Badge variant="outline" className="max-w-full rounded-lg whitespace-normal wrap-anywhere">No active semester</Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex w-full max-w-sm flex-col items-stretch gap-2 self-start">
                            <Popover open={termScopePopoverOpen} onOpenChange={setTermScopePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="min-w-0 w-full justify-between rounded-xl">
                                        <span className="block min-w-0 flex-1 truncate text-left">{selectedAcademicTermScopeLabel}</span>
                                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-[320px] max-h-75 overflow-auto p-0">
                                    <div className="border-b px-4 py-3">
                                        <div className="text-sm font-medium wrap-anywhere">Select active semesters</div>
                                        <div className="text-xs text-muted-foreground wrap-anywhere">
                                            Multiple semesters can stay active at the same time.
                                        </div>
                                    </div>
                                    <ScrollArea className="max-h-72">
                                        <div className="space-y-2 p-3">
                                            {academicTermScopeOptions.length === 0 ? (
                                                <div className="text-sm text-muted-foreground wrap-anywhere">No semesters available.</div>
                                            ) : (
                                                academicTermScopeOptions.map((term) => {
                                                    const checked = termScopeSelection.includes(term.$id)
                                                    return (
                                                        <label
                                                            key={term.$id}
                                                            htmlFor={`term-scope-${term.$id}`}
                                                            className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition hover:bg-muted/40"
                                                        >
                                                            <Checkbox
                                                                id={`term-scope-${term.$id}`}
                                                                checked={checked}
                                                                onCheckedChange={(value) => {
                                                                    const nextChecked = Boolean(value)
                                                                    setTermScopeSelection((current) => {
                                                                        if (nextChecked) {
                                                                            return current.includes(term.$id) ? current : [...current, term.$id]
                                                                        }
                                                                        return current.filter((item) => item !== term.$id)
                                                                    })
                                                                }}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 font-medium">
                                                                    <span className="block min-w-0 flex-1 truncate">{term.label}</span>
                                                                    {term.isActive ? <Check className="size-3.5 shrink-0 text-muted-foreground" /> : null}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground wrap-anywhere">
                                                                    {term.isActive ? "Currently active" : "Currently inactive"}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>

                                </PopoverContent>
                                <div className="flex flex-col items-stretch justify-end gap-2 px-3 py-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setTermScopeSelection(activeAcademicTermIds)}
                                        disabled={termScopeSaving}
                                        className="w-full text-primary whitespace-normal wrap-anywhere"
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void applySelectedAcademicTerms()}
                                        disabled={termScopeSaving}
                                        className="w-full whitespace-normal wrap-anywhere"
                                    >
                                        {termScopeSaving ? "Saving..." : "Apply Active Terms"}
                                    </Button>
                                </div>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <ExtraSmallScheduleCardShell
                    value="subject-matching-filters"
                    title="Subject Matching Filters"
                    description="Use the same scope fields from Add Subject so the schedule entry dialog only offers the subjects that match the selected college, programs, sections, year levels, and linked semester record."
                >
                    <SubjectMatchingFiltersCard
                        subjectCollegeFilter={subjectCollegeFilter}
                        setSubjectCollegeFilter={setSubjectCollegeFilterCascade}
                        subjectProgramFilters={subjectProgramFilters}
                        setSubjectProgramFilters={setSubjectProgramFiltersCascade}
                        subjectSectionFilters={subjectSectionFilters}
                        setSubjectSectionFilters={setSubjectSectionFilters}
                        subjectYearLevelFilters={subjectYearLevelFilters}
                        setSubjectYearLevelFilters={setSubjectYearLevelFiltersCascade}
                        subjectAcademicTermFilter={subjectAcademicTermFilter}
                        setSubjectAcademicTermFilter={setSubjectAcademicTermFilterCascade}
                        subjectCollegeOptions={subjectCollegeOptions}
                        subjectProgramOptions={subjectProgramOptions}
                        subjectSectionOptions={subjectSectionOptions}
                        subjectYearLevelOptions={subjectYearLevelOptions}
                        subjectYearLevelCounts={subjectYearLevelCounts}
                        sectionMutating={sectionMutating}
                        yearLevelMutating={yearLevelMutating}
                        onCreateYearLevel={createYearLevelSection}
                        onRenameYearLevel={renameYearLevelSections}
                        onDeleteSection={deleteSection}
                        onDeleteYearLevel={deleteYearLevelSections}
                        subjectAcademicTermOptions={subjectAcademicTermOptions}
                        filteredSubjectCount={filteredFormSubjects.length}
                        activeSubjectFilterBadges={activeSubjectFilterBadges}
                        onClearSubjectFilters={clearSubjectFilters}
                        onApplyScheduleContextSubjectFilters={applyScheduleContextSubjectFilters}
                        className="border-0 shadow-none"
                        idPrefix="subject-matching-filters-mobile"
                    />
                </ExtraSmallScheduleCardShell>

                <SubjectMatchingFiltersCard
                    subjectCollegeFilter={subjectCollegeFilter}
                    setSubjectCollegeFilter={setSubjectCollegeFilterCascade}
                    subjectProgramFilters={subjectProgramFilters}
                    setSubjectProgramFilters={setSubjectProgramFiltersCascade}
                    subjectSectionFilters={subjectSectionFilters}
                    setSubjectSectionFilters={setSubjectSectionFilters}
                    subjectYearLevelFilters={subjectYearLevelFilters}
                    setSubjectYearLevelFilters={setSubjectYearLevelFiltersCascade}
                    subjectAcademicTermFilter={subjectAcademicTermFilter}
                    setSubjectAcademicTermFilter={setSubjectAcademicTermFilterCascade}
                    subjectCollegeOptions={subjectCollegeOptions}
                    subjectProgramOptions={subjectProgramOptions}
                    subjectSectionOptions={subjectSectionOptions}
                    subjectYearLevelOptions={subjectYearLevelOptions}
                    subjectYearLevelCounts={subjectYearLevelCounts}
                    sectionMutating={sectionMutating}
                    yearLevelMutating={yearLevelMutating}
                    onCreateYearLevel={createYearLevelSection}
                    onRenameYearLevel={renameYearLevelSections}
                    onDeleteSection={deleteSection}
                    onDeleteYearLevel={deleteYearLevelSections}
                    subjectAcademicTermOptions={subjectAcademicTermOptions}
                    filteredSubjectCount={filteredFormSubjects.length}
                    activeSubjectFilterBadges={activeSubjectFilterBadges}
                    onClearSubjectFilters={clearSubjectFilters}
                    onApplyScheduleContextSubjectFilters={applyScheduleContextSubjectFilters}
                    className="hidden sm:block"
                />

                <PlannerManagementSection
                    hasScheduleScope={hasScheduleScope}
                    scheduleScopeKey={activeScheduleScopeKey}
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
                    scheduleScopeLabel={scheduleScopeLabel}
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
                    setSubjectCollegeFilter={setSubjectCollegeFilterCascade}
                    subjectProgramFilters={subjectProgramFilters}
                    setSubjectProgramFilters={setSubjectProgramFiltersCascade}
                    subjectSectionFilters={subjectSectionFilters}
                    subjectYearLevelFilters={subjectYearLevelFilters}
                    setSubjectYearLevelFilters={setSubjectYearLevelFiltersCascade}
                    subjectAcademicTermFilter={subjectAcademicTermFilter}
                    setSubjectAcademicTermFilter={setSubjectAcademicTermFilterCascade}
                    subjectCollegeOptions={subjectCollegeOptions}
                    subjectProgramOptions={subjectProgramOptions}
                    subjectSectionOptions={subjectSectionOptions}
                    subjectYearLevelOptions={subjectYearLevelOptions}
                    subjectYearLevelCounts={subjectYearLevelCounts}
                    yearLevelMutating={yearLevelMutating}
                    onCreateYearLevel={createYearLevelSection}
                    onRenameYearLevel={renameYearLevelSections}
                    onDeleteYearLevel={deleteYearLevelSections}
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