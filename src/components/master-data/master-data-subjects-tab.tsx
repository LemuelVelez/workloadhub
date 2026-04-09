"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Link2, Pencil, Plus, Trash2, Unlink2 } from "lucide-react"
import { toast } from "sonner"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"

import type { AcademicTermDoc, SubjectDoc } from "../../../model/schemaModel"
import type { MasterDataManagementVM } from "./use-master-data"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

type LooseSubjectDoc = SubjectDoc & Record<string, unknown>
type LooseAcademicTermDoc = AcademicTermDoc & Record<string, unknown>

const SUBJECT_TERM_KEYS = ["termId", "academicTermId", "term", "term_id", "termID"] as const
const SUBJECT_PROGRAM_KEYS = ["programId", "program", "program_id", "programID"] as const
const SUBJECT_PROGRAM_ARRAY_KEYS = ["programIds", "program_ids"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_KEYS = ["yearLevel", "sectionYearLevel", "sectionYear", "year_level"] as const
const SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS = ["yearLevels", "year_levels"] as const
const SUBJECT_SEMESTER_KEYS = [
    "semester",
    "semesterLabel",
    "termSemester",
    "termSem",
] as const
const TERM_YEAR_KEYS = [
    "academicYear",
    "academicYearLabel",
    "schoolYear",
    "schoolYearLabel",
    "year",
    "yearLabel",
    "academic_year",
    "school_year",
] as const
const SUBJECT_YEAR_KEYS = [
    "academicYear",
    "academicYearLabel",
    "schoolYear",
    "schoolYearLabel",
    "year",
    "yearLabel",
    "termYear",
    "academicTermYear",
] as const

const INHERIT_SEMESTER_LABEL = "No Semester / Inherit from Selected Term"

function readFirstStringValue(
    source: Record<string, unknown> | null | undefined,
    keys: readonly string[]
) {
    for (const key of keys) {
        const value = source?.[key]
        if (typeof value === "string" && value.trim()) {
            return value.trim()
        }
    }
    return ""
}

function readStringArrayValues(
    source: Record<string, unknown> | null | undefined,
    arrayKeys: readonly string[],
    fallbackKeys: readonly string[] = []
) {
    const values: string[] = []

    for (const key of arrayKeys) {
        const value = source?.[key]

        if (Array.isArray(value)) {
            for (const item of value) {
                const normalized = String(item ?? "").trim()
                if (normalized) values.push(normalized)
            }
            continue
        }

        if (typeof value === "string" && value.trim()) {
            const parts = value.includes(",") ? value.split(",") : [value]
            for (const part of parts) {
                const normalized = String(part ?? "").trim()
                if (normalized) values.push(normalized)
            }
        }
    }

    if (values.length === 0) {
        for (const key of fallbackKeys) {
            const normalized = String(source?.[key] ?? "").trim()
            if (normalized) values.push(normalized)
        }
    }

    return Array.from(new Set(values))
}

function normalizeSectionYearLevelValue(value?: string | number | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function extractSubjectYearNumber(value?: string | number | null) {
    const normalized = normalizeSectionYearLevelValue(value)
    return normalized.match(/([1-9]\d*)$/)?.[1] ?? normalized
}

function resolveSubjectProgramIds(subject: LooseSubjectDoc) {
    return readStringArrayValues(subject, SUBJECT_PROGRAM_ARRAY_KEYS, SUBJECT_PROGRAM_KEYS)
}


function resolveSubjectYearLevels(subject: LooseSubjectDoc) {
    return Array.from(
        new Set(
            readStringArrayValues(
                subject,
                SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS,
                SUBJECT_SCOPE_YEAR_LEVEL_KEYS
            )
                .map((value) => extractSubjectYearNumber(value))
                .filter(Boolean)
        )
    )
}

function normalizeProgramCode(value?: string | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
}

function resolveProgramPrefix(programs: MasterDataManagementVM["programs"], programId?: string | null) {
    const normalizedProgramId = String(programId ?? "").trim()
    if (!normalizedProgramId) return ""

    const matchedProgram = programs.find((program) => String(program.$id) === normalizedProgramId)
    const normalizedCode = normalizeProgramCode(matchedProgram?.code)

    if (!normalizedCode) return ""
    if (normalizedCode === "CS" || normalizedCode === "BSCS" || normalizedCode.endsWith("CS")) {
        return "CS"
    }
    if (normalizedCode === "IS" || normalizedCode === "BSIS" || normalizedCode.endsWith("IS")) {
        return "IS"
    }

    return ""
}

function buildStoredSubjectYearLevel(
    programs: MasterDataManagementVM["programs"],
    value?: string | number | null,
    programId?: string | null
) {
    const normalizedYearLevel = normalizeSectionYearLevelValue(value)
    const yearNumber = normalizedYearLevel.match(/([1-9]\d*)$/)?.[1] ?? normalizedYearLevel
    const programPrefix = resolveProgramPrefix(programs, programId ?? null)

    if (!normalizedYearLevel) return ""
    if (!yearNumber) return normalizedYearLevel
    if (!programPrefix) return normalizedYearLevel
    if (normalizedYearLevel.startsWith(`${programPrefix} `)) return normalizedYearLevel

    return `${programPrefix} ${yearNumber}`
}

function formatProgramScopeLabels(
    programs: MasterDataManagementVM["programs"],
    programIds: string[]
) {
    const labels = programIds
        .map((programId) => programs.find((program) => String(program.$id) === String(programId)))
        .filter(Boolean)
        .map((program) => `${program!.code} — ${program!.name}`)

    return Array.from(new Set(labels))
}

function formatYearLevelScopeLabels(yearLevels: string[]) {
    return Array.from(new Set(yearLevels.map((value) => extractSubjectYearNumber(value)).filter(Boolean)))
}

function normalizeSemesterLabel(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, " ").trim()
    if (!normalized) return ""
    if (normalized.includes("1st") || normalized.includes("first")) {
        return "1st Semester"
    }
    if (normalized.includes("2nd") || normalized.includes("second")) {
        return "2nd Semester"
    }
    if (normalized.includes("summer")) {
        return "Summer"
    }
    return value.trim()
}

function normalizeAcademicYearLabel(value: string) {
    return value
        .replace(/\s*[–—]\s*/g, "-")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim()
}

function extractAcademicYearFromText(value: string) {
    const normalized = normalizeAcademicYearLabel(value)
    if (!normalized) return ""

    const rangeMatch = normalized.match(/\b(20\d{2}-20\d{2})\b/)
    if (rangeMatch) {
        return rangeMatch[1]
    }

    const singleYearMatch = normalized.match(/\b(20\d{2})\b/)
    if (singleYearMatch) {
        return singleYearMatch[1]
    }

    return ""
}

function getSemesterSortOrder(label: string) {
    const normalized = normalizeSemesterLabel(label)
    if (normalized === "1st Semester") return 1
    if (normalized === "2nd Semester") return 2
    if (normalized === "Summer") return 3
    if (normalized === INHERIT_SEMESTER_LABEL) return 99
    return 50
}

function getAcademicYearSortOrder(label: string) {
    const normalized = normalizeAcademicYearLabel(label)
    if (!normalized) return -1

    const rangeMatch = normalized.match(/^(\d{4})-(\d{4})$/)
    if (rangeMatch) {
        return Number(rangeMatch[1])
    }

    const singleYearMatch = normalized.match(/^(\d{4})$/)
    if (singleYearMatch) {
        return Number(singleYearMatch[1])
    }

    const firstYearMatch = normalized.match(/(\d{4})/)
    return firstYearMatch ? Number(firstYearMatch[1]) : -1
}

function resolveSubjectTermId(subject: LooseSubjectDoc) {
    return readFirstStringValue(subject, SUBJECT_TERM_KEYS)
}

function resolveTermSemester(
    termMap: Map<string, LooseAcademicTermDoc>,
    termId: string
) {
    if (!termId) return ""
    const term = termMap.get(termId)
    return normalizeSemesterLabel(String(term?.semester ?? ""))
}

function resolveTermAcademicYear(
    termMap: Map<string, LooseAcademicTermDoc>,
    termId: string
) {
    if (!termId) return ""
    const term = termMap.get(termId)
    return normalizeAcademicYearLabel(readFirstStringValue(term, TERM_YEAR_KEYS))
}

function resolveSubjectSemester(
    subject: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const linkedTermId = resolveSubjectTermId(subject)
    const linkedSemester = resolveTermSemester(termMap, linkedTermId)
    if (linkedSemester) return linkedSemester

    return normalizeSemesterLabel(readFirstStringValue(subject, SUBJECT_SEMESTER_KEYS))
}

function resolveSubjectAcademicYear(
    subject: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const linkedTermId = resolveSubjectTermId(subject)
    const linkedYear = resolveTermAcademicYear(termMap, linkedTermId)
    if (linkedYear) return linkedYear

    return normalizeAcademicYearLabel(readFirstStringValue(subject, SUBJECT_YEAR_KEYS))
}

function sortSubjects(subjects: LooseSubjectDoc[]) {
    return [...subjects].sort((a, b) => {
        const aCode = String(a.code ?? "").toLowerCase()
        const bCode = String(b.code ?? "").toLowerCase()
        if (aCode !== bCode) return aCode.localeCompare(bCode)

        return String(a.title ?? "").localeCompare(String(b.title ?? ""))
    })
}

export function MasterDataSubjectsTab({ vm }: Props) {
    const [bulkLinkOpen, setBulkLinkOpen] = React.useState(false)
    const [bulkLinkTermId, setBulkLinkTermId] = React.useState("")
    const [bulkLinkSemesterHint, setBulkLinkSemesterHint] = React.useState("")
    const [bulkLinkSubjectIds, setBulkLinkSubjectIds] = React.useState<string[]>([])
    const [bulkLinkLockedSubjectIds, setBulkLinkLockedSubjectIds] = React.useState<string[]>([])
    const [bulkLinkSourceSubjectIds, setBulkLinkSourceSubjectIds] = React.useState<string[]>([])
    const [bulkLinking, setBulkLinking] = React.useState(false)
    const [bulkUnlinking, setBulkUnlinking] = React.useState(false)
    const [expandedGroups, setExpandedGroups] = React.useState<string[]>([])

    const [bulkCollegeOpen, setBulkCollegeOpen] = React.useState(false)
    const [bulkCollegeId, setBulkCollegeId] = React.useState("")
    const [bulkCollegeProgramIds, setBulkCollegeProgramIds] = React.useState<string[]>([])
    const [bulkCollegeYearLevels, setBulkCollegeYearLevels] = React.useState<string[]>([])
    const [bulkCollegeSemester, setBulkCollegeSemester] = React.useState("")
    const [bulkCollegeSubjectIds, setBulkCollegeSubjectIds] = React.useState<string[]>([])
    const [bulkCollegeSaving, setBulkCollegeSaving] = React.useState(false)

    const termMap = React.useMemo(() => {
        const map = new Map<string, LooseAcademicTermDoc>()
        for (const term of vm.terms as LooseAcademicTermDoc[]) {
            map.set(String(term.$id), term)
        }
        return map
    }, [vm.terms])

    const filteredSubjects = React.useMemo(
        () => vm.filteredSubjects as LooseSubjectDoc[],
        [vm.filteredSubjects]
    )

    const allVisibleSubjects = React.useMemo(
        () => sortSubjects(filteredSubjects),
        [filteredSubjects]
    )


    const bulkScopeProgramOptions = React.useMemo(() => {
        const collegeId = String(bulkCollegeId ?? "").trim()
        if (!collegeId) return []

        return vm.programs
            .filter((program) => String(program.departmentId ?? "").trim() === collegeId)
            .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`))
    }, [bulkCollegeId, vm.programs])

    const groupedSubjects = React.useMemo(() => {
        const groups = new Map<
            string,
            {
                key: string
                title: string
                semesterLabel: string
                academicYearLabel: string
                subjects: LooseSubjectDoc[]
                linkedCount: number
                inheritedCount: number
            }
        >()

        for (const subject of filteredSubjects) {
            const linkedTermId = resolveSubjectTermId(subject)
            const semesterLabel =
                resolveSubjectSemester(subject, termMap) ||
                INHERIT_SEMESTER_LABEL

            const linkedTermLabel = linkedTermId
                ? vm.termLabel(vm.terms, linkedTermId)
                : ""

            const academicYearLabel =
                resolveSubjectAcademicYear(subject, termMap) ||
                extractAcademicYearFromText(linkedTermLabel)

            const groupKey = `${semesterLabel}::${academicYearLabel || "__no_year__"}`

            const existing = groups.get(groupKey) ?? {
                key: groupKey,
                title: academicYearLabel
                    ? `${semesterLabel} • ${academicYearLabel}`
                    : semesterLabel,
                semesterLabel,
                academicYearLabel,
                subjects: [],
                linkedCount: 0,
                inheritedCount: 0,
            }

            existing.subjects.push(subject)
            if (linkedTermId) {
                existing.linkedCount += 1
            } else {
                existing.inheritedCount += 1
            }

            groups.set(groupKey, existing)
        }

        return Array.from(groups.values())
            .sort((a, b) => {
                const orderDelta =
                    getSemesterSortOrder(a.semesterLabel) -
                    getSemesterSortOrder(b.semesterLabel)

                if (orderDelta !== 0) return orderDelta

                const yearDelta =
                    getAcademicYearSortOrder(b.academicYearLabel) -
                    getAcademicYearSortOrder(a.academicYearLabel)

                if (yearDelta !== 0) return yearDelta

                if (a.academicYearLabel !== b.academicYearLabel) {
                    return a.academicYearLabel.localeCompare(b.academicYearLabel)
                }

                return a.title.localeCompare(b.title)
            })
            .map((group) => ({
                ...group,
                subjects: sortSubjects(group.subjects),
            }))
    }, [filteredSubjects, termMap, vm])

    React.useEffect(() => {
        const nextValues = groupedSubjects.map((group) => group.key)

        setExpandedGroups((current) => {
            if (current.length === 0) return nextValues

            const filtered = current.filter((value) => nextValues.includes(value))
            const missing = nextValues.filter((value) => !filtered.includes(value))

            return [...filtered, ...missing]
        })
    }, [groupedSubjects])

    const normalizedBulkLinkSemesterHint = React.useMemo(() => {
        const normalized = normalizeSemesterLabel(bulkLinkSemesterHint)
        if (normalized === normalizeSemesterLabel(INHERIT_SEMESTER_LABEL)) return ""
        return normalized
    }, [bulkLinkSemesterHint])

    const bulkLinkTermOptions = React.useMemo(() => {
        const terms = [...(vm.terms as LooseAcademicTermDoc[])]

        if (!normalizedBulkLinkSemesterHint) {
            return terms
        }

        return terms.filter((term) => {
            const semester = normalizeSemesterLabel(String(term.semester ?? ""))
            return semester === normalizedBulkLinkSemesterHint
        })
    }, [normalizedBulkLinkSemesterHint, vm.terms])

    const selectedBulkLinkSemester = React.useMemo(() => {
        return resolveTermSemester(termMap, bulkLinkTermId.trim())
    }, [bulkLinkTermId, termMap])

    const bulkLinkBaseSubjects = React.useMemo(() => {
        if (bulkLinkSourceSubjectIds.length === 0) {
            return allVisibleSubjects
        }

        const allowedIds = new Set(bulkLinkSourceSubjectIds)
        return allVisibleSubjects.filter((subject) =>
            allowedIds.has(String(subject.$id))
        )
    }, [allVisibleSubjects, bulkLinkSourceSubjectIds])

    const bulkLinkEligibleSubjects = React.useMemo(() => {
        const baseSubjects =
            bulkLinkLockedSubjectIds.length > 0
                ? bulkLinkBaseSubjects.filter((subject) =>
                      bulkLinkLockedSubjectIds.includes(String(subject.$id))
                  )
                : bulkLinkBaseSubjects

        return baseSubjects.filter((subject) => {
            const subjectSemester = resolveSubjectSemester(subject, termMap)

            if (normalizedBulkLinkSemesterHint && subjectSemester) {
                return subjectSemester === normalizedBulkLinkSemesterHint
            }

            if (selectedBulkLinkSemester && subjectSemester) {
                return subjectSemester === selectedBulkLinkSemester
            }

            return true
        })
    }, [
        bulkLinkBaseSubjects,
        bulkLinkLockedSubjectIds,
        normalizedBulkLinkSemesterHint,
        selectedBulkLinkSemester,
        termMap,
    ])

    React.useEffect(() => {
        if (!bulkLinkOpen) return

        const hasCurrentTerm = bulkLinkTermOptions.some(
            (term) => String(term.$id) === bulkLinkTermId
        )

        if (hasCurrentTerm) return

        const nextTerm =
            bulkLinkTermOptions.find((term) => Boolean(term.isActive)) ??
            bulkLinkTermOptions[0] ??
            null

        setBulkLinkTermId(nextTerm ? String(nextTerm.$id) : "")
    }, [bulkLinkOpen, bulkLinkTermId, bulkLinkTermOptions])

    React.useEffect(() => {
        if (!bulkLinkOpen) return

        if (bulkLinkLockedSubjectIds.length > 0) {
            setBulkLinkSubjectIds(
                bulkLinkEligibleSubjects.map((subject) => String(subject.$id))
            )
            return
        }

        setBulkLinkSubjectIds(
            bulkLinkEligibleSubjects.map((subject) => String(subject.$id))
        )
    }, [bulkLinkEligibleSubjects, bulkLinkLockedSubjectIds, bulkLinkOpen])

    const openBulkLinkDialog = React.useCallback(
        ({
            semesterHint = "",
            subjectIds = [],
            lockedSubjectIds = [],
        }: {
            semesterHint?: string
            subjectIds?: string[]
            lockedSubjectIds?: string[]
        } = {}) => {
            const normalizedSubjectIds = subjectIds.map((value) => String(value))
            const normalizedLockedSubjectIds = lockedSubjectIds.map((value) =>
                String(value)
            )

            setBulkLinkSemesterHint(semesterHint)
            setBulkLinkTermId("")
            setBulkLinkSourceSubjectIds(normalizedSubjectIds)
            setBulkLinkSubjectIds(
                normalizedLockedSubjectIds.length > 0
                    ? normalizedLockedSubjectIds
                    : normalizedSubjectIds
            )
            setBulkLinkLockedSubjectIds(normalizedLockedSubjectIds)
            setBulkLinkOpen(true)
        },
        []
    )


    const handleBulkLinkOpenChange = React.useCallback((nextOpen: boolean) => {
        setBulkLinkOpen(nextOpen)

        if (!nextOpen) {
            setBulkLinkTermId("")
            setBulkLinkSemesterHint("")
            setBulkLinkSubjectIds([])
            setBulkLinkLockedSubjectIds([])
            setBulkLinkSourceSubjectIds([])
        }
    }, [])

    const toggleBulkLinkSubject = React.useCallback(
        (subjectId: string, checked: boolean) => {
            setBulkLinkSubjectIds((current) => {
                if (checked) {
                    if (current.includes(subjectId)) return current
                    return [...current, subjectId]
                }
                return current.filter((id) => id !== subjectId)
            })
        },
        []
    )

    const linkSelectedSubjectsToTerm = React.useCallback(async () => {
        setBulkLinking(true)
        try {
            const result = await vm.bulkLinkSubjectsToTerm(
                bulkLinkSubjectIds,
                bulkLinkTermId
            )

            if (result.updated > 0 && result.failed.length === 0) {
                handleBulkLinkOpenChange(false)
            }
        } finally {
            setBulkLinking(false)
        }
    }, [bulkLinkSubjectIds, bulkLinkTermId, handleBulkLinkOpenChange, vm])

    const unlinkSubjectIds = React.useCallback(
        async (subjectIds: string[]) => {
            const uniqueIds = Array.from(
                new Set(
                    subjectIds
                        .map((value) => String(value).trim())
                        .filter(Boolean)
                )
            )

            if (uniqueIds.length === 0) return

            setBulkUnlinking(true)
            try {
                await Promise.allSettled(
                    uniqueIds.map((subjectId) =>
                        Promise.resolve(vm.setSubjectTermLink(subjectId, null))
                    )
                )
            } finally {
                setBulkUnlinking(false)
            }
        },
        [vm]
    )

    React.useEffect(() => {
        if (!bulkCollegeOpen) return
        if (bulkCollegeId) return

        const nextCollegeId =
            String(vm.defaultCollegeId ?? "").trim() ||
            String(vm.colleges[0]?.$id ?? "").trim()

        setBulkCollegeId(nextCollegeId)
    }, [bulkCollegeId, bulkCollegeOpen, vm.colleges, vm.defaultCollegeId])

    React.useEffect(() => {
        if (!bulkCollegeOpen) return

        const validProgramIds = new Set(bulkScopeProgramOptions.map((program) => String(program.$id)))
        setBulkCollegeProgramIds((current) => current.filter((programId) => validProgramIds.has(String(programId))))
    }, [bulkCollegeOpen, bulkScopeProgramOptions])

    const openBulkCollegeDialog = React.useCallback(() => {
        setBulkCollegeSubjectIds(
            allVisibleSubjects.map((subject) => String(subject.$id))
        )
        setBulkCollegeOpen(true)
    }, [allVisibleSubjects])

    const handleBulkCollegeOpenChange = React.useCallback((nextOpen: boolean) => {
        setBulkCollegeOpen(nextOpen)

        if (!nextOpen) {
            setBulkCollegeId("")
            setBulkCollegeProgramIds([])
            setBulkCollegeYearLevels([])
            setBulkCollegeSemester("")
            setBulkCollegeSubjectIds([])
        }
    }, [])

    const toggleBulkCollegeSubject = React.useCallback(
        (subjectId: string, checked: boolean) => {
            setBulkCollegeSubjectIds((current) => {
                if (checked) {
                    if (current.includes(subjectId)) return current
                    return [...current, subjectId]
                }

                return current.filter((id) => id !== subjectId)
            })
        },
        []
    )

    const saveBulkCollegeSubjects = React.useCallback(async () => {
        const normalizedCollegeId = String(bulkCollegeId ?? "").trim()
        const normalizedProgramIds = Array.from(
            new Set(bulkCollegeProgramIds.map((programId) => String(programId).trim()).filter(Boolean))
        )
        const normalizedYearLevels = Array.from(
            new Set(bulkCollegeYearLevels.map((yearLevel) => extractSubjectYearNumber(yearLevel)).filter(Boolean))
        )
        const normalizedSemester = normalizeSemesterLabel(String(bulkCollegeSemester ?? "").trim())
        const primaryProgramId = normalizedProgramIds[0] ?? null
        const primaryYearLevel = normalizedYearLevels[0] ?? ""
        const legacyYearLevel = buildStoredSubjectYearLevel(
            vm.programs,
            primaryYearLevel,
            primaryProgramId
        )
        const selectedSubjectIds = Array.from(
            new Set(
                bulkCollegeSubjectIds
                    .map((subjectId) => String(subjectId).trim())
                    .filter(Boolean)
            )
        ) as string[]

        if (!normalizedCollegeId) {
            toast.error("Please select a college.")
            return
        }

        if (normalizedProgramIds.length === 0) {
            toast.error("Please select at least one program.")
            return
        }

        if (normalizedYearLevels.length === 0) {
            toast.error("Please select at least one year level.")
            return
        }

        if (!normalizedSemester) {
            toast.error("Please select a semester.")
            return
        }

        if (selectedSubjectIds.length === 0) {
            toast.error("Please select at least one subject.")
            return
        }

        setBulkCollegeSaving(true)
        try {
            const subjectMap = new Map<string, LooseSubjectDoc>(
                allVisibleSubjects.map((subject) => [String(subject.$id), subject] as const)
            )

            let updated = 0
            const failed: string[] = []

            for (const subjectId of selectedSubjectIds) {
                const subject = subjectMap.get(subjectId)

                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SUBJECTS,
                        subjectId,
                        {
                            departmentId: normalizedCollegeId,
                            programId: primaryProgramId,
                            programIds: normalizedProgramIds,
                            yearLevel: legacyYearLevel || null,
                            yearLevels: normalizedYearLevels,
                            semester: normalizedSemester,
                        }
                    )
                    updated += 1
                } catch {
                    failed.push(String(subject?.code ?? subjectId))
                }
            }

            if (updated > 0) {
                await vm.refreshAll()
            }

            if (updated > 0 && failed.length === 0) {
                toast.success(
                    `${updated} subject${updated === 1 ? "" : "s"} updated with the visible scope.`
                )
                handleBulkCollegeOpenChange(false)
                return
            }

            if (updated > 0) {
                toast.error(
                    `Updated ${updated} subject${updated === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`
                )
                return
            }

            toast.error("No subjects were updated.")
        } finally {
            setBulkCollegeSaving(false)
        }
    }, [
        allVisibleSubjects,
        bulkCollegeId,
        bulkCollegeProgramIds,
        bulkCollegeSemester,
        bulkCollegeSubjectIds,
        bulkCollegeYearLevels,
        handleBulkCollegeOpenChange,
        vm,
    ])

    const handleTableActionClick = React.useCallback(
        (action: () => void | Promise<unknown>) =>
            (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault()
                event.stopPropagation()
                void Promise.resolve(action())
            },
        []
    )

    const stopActionAreaInteraction = React.useCallback(
        (event: React.SyntheticEvent) => {
            event.stopPropagation()
        },
        []
    )

    const isSingleSubjectLinkMode =
        bulkLinkLockedSubjectIds.length === 1 &&
        bulkLinkSourceSubjectIds.length === 1


    return (
        <TabsContent value="subjects" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Subjects</div>
                    <div className="text-sm text-muted-foreground">
                        Manage subject list, units, hours, and semester segregation.
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkCollegeSaving || bulkLinking || bulkUnlinking}
                        onClick={openBulkCollegeDialog}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Visible Subject Scope
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                            vm.setSubjectEditing(null)
                            vm.setSubjectOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Subject
                    </Button>
                </div>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : filteredSubjects.length === 0 ? (
                <div className="text-sm text-muted-foreground">No subjects found.</div>
            ) : (
                <Accordion
                    type="multiple"
                    value={expandedGroups}
                    onValueChange={setExpandedGroups}
                    className="space-y-4"
                >
                    {groupedSubjects.map((group) => (
                        <AccordionItem
                            key={group.key}
                            value={group.key}
                            className="overflow-hidden rounded-lg border"
                        >
                            <div className="border-b bg-muted/30">
                                <AccordionTrigger className="px-4 py-3 text-left hover:no-underline sm:py-4">
                                    <div className="space-y-1 pr-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="font-medium">
                                                {group.title}
                                            </div>
                                            <Badge variant="secondary">
                                                {group.subjects.length}
                                            </Badge>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            {group.linkedCount} linked subject
                                            {group.linkedCount === 1 ? "" : "s"} •{" "}
                                            {group.inheritedCount} subject
                                            {group.inheritedCount === 1 ? "" : "s"} without
                                            direct term link
                                        </div>
                                    </div>
                                </AccordionTrigger>

                                <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={bulkLinking || bulkUnlinking}
                                        onClick={handleTableActionClick(() =>
                                            openBulkLinkDialog({
                                                semesterHint:
                                                    group.semesterLabel ===
                                                    INHERIT_SEMESTER_LABEL
                                                        ? ""
                                                        : group.semesterLabel,
                                                subjectIds: group.subjects.map((subject) =>
                                                    String(subject.$id)
                                                ),
                                            })
                                        )}
                                    >
                                        <Link2 className="mr-2 h-4 w-4" />
                                        Edit Group Links
                                    </Button>

                                    {group.inheritedCount > 0 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={bulkLinking || bulkUnlinking}
                                            onClick={handleTableActionClick(() =>
                                                openBulkLinkDialog({
                                                    semesterHint:
                                                        group.semesterLabel ===
                                                        INHERIT_SEMESTER_LABEL
                                                            ? ""
                                                            : group.semesterLabel,
                                                    subjectIds: group.subjects
                                                        .filter(
                                                            (subject) =>
                                                                !resolveSubjectTermId(subject)
                                                        )
                                                        .map((subject) =>
                                                            String(subject.$id)
                                                        ),
                                                })
                                            )}
                                        >
                                            <Link2 className="mr-2 h-4 w-4" />
                                            Link Existing to Term
                                        </Button>
                                    ) : null}

                                    {group.linkedCount > 0 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={bulkLinking || bulkUnlinking}
                                            onClick={handleTableActionClick(() =>
                                                unlinkSubjectIds(
                                                    group.subjects
                                                        .filter((subject) =>
                                                            Boolean(
                                                                resolveSubjectTermId(subject)
                                                            )
                                                        )
                                                        .map((subject) =>
                                                            String(subject.$id)
                                                        )
                                                )
                                            )}
                                        >
                                            <Unlink2 className="mr-2 h-4 w-4" />
                                            Unlink Group
                                        </Button>
                                    ) : null}

                                    <Badge variant="outline">
                                        Visible actions affect the current list or group only.
                                    </Badge>
                                </div>
                            </div>

                            <AccordionContent className="pb-0">
                                <div className="border-b px-4 py-2 text-xs text-muted-foreground">
                                    Drag horizontally on the table to view more columns.
                                </div>

                                <Table className="min-w-max">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">Code</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead className="w-72">College</TableHead>
                                            <TableHead className="w-72">Program</TableHead>
                                            <TableHead className="w-36">Year Level</TableHead>
                                            <TableHead className="w-60">Semester / Term</TableHead>
                                            <TableHead className="w-44">Units / Hours</TableHead>
                                            <TableHead className="w-32 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {group.subjects.map((subject) => {
                                            const linkedTermId = resolveSubjectTermId(subject)
                                            const semesterLabel =
                                                resolveSubjectSemester(subject, termMap) ||
                                                INHERIT_SEMESTER_LABEL

                                            const termLabel = linkedTermId
                                                ? vm.termLabel(vm.terms, linkedTermId)
                                                : "No direct academic term link. Semester scope is still saved on the subject."

                                            return (
                                                <TableRow key={subject.$id}>
                                                    <TableCell className="font-medium">
                                                        {subject.code}
                                                    </TableCell>

                                                    <TableCell>{subject.title}</TableCell>

                                                    <TableCell className="text-muted-foreground">
                                                        {vm.collegeLabel(
                                                            vm.colleges,
                                                            (subject.departmentId as string | null) ??
                                                                null
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-muted-foreground">
                                                        <div className="flex flex-wrap gap-1">
                                                            {formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(subject)).length === 0 ? (
                                                                <span>—</span>
                                                            ) : (
                                                                formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(subject)).map((label) => (
                                                                    <Badge key={label} variant="outline">{label}</Badge>
                                                                ))
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-muted-foreground">
                                                        {formatYearLevelScopeLabels(resolveSubjectYearLevels(subject)).join(", ") || "—"}
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge
                                                                    variant={
                                                                        linkedTermId
                                                                            ? "secondary"
                                                                            : "outline"
                                                                    }
                                                                >
                                                                    {semesterLabel}
                                                                </Badge>
                                                            </div>

                                                            <div className="text-xs text-muted-foreground">
                                                                {termLabel}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="text-xs text-muted-foreground">
                                                            Units:{" "}
                                                            <span className="font-medium text-foreground">
                                                                {subject.units}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Lec {subject.lectureHours} / Lab{" "}
                                                            {subject.labHours} ={" "}
                                                            <span className="font-medium text-foreground">
                                                                {Number.isFinite(
                                                                    Number(subject.totalHours)
                                                                )
                                                                    ? subject.totalHours
                                                                    : Number(subject.lectureHours ?? 0) +
                                                                      Number(subject.labHours ?? 0)}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <div
                                                            className="flex flex-wrap justify-end gap-2"
                                                            onPointerDown={stopActionAreaInteraction}
                                                            onMouseDown={stopActionAreaInteraction}
                                                            onTouchStart={stopActionAreaInteraction}
                                                        >
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleTableActionClick(() => {
                                                                    vm.setSubjectEditing(subject as any)
                                                                    vm.setSubjectOpen(true)
                                                                })}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={handleTableActionClick(() =>
                                                                    vm.setDeleteIntent({
                                                                        type: "subject",
                                                                        doc: subject as any,
                                                                    })
                                                                )}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}

            <Dialog open={bulkCollegeOpen} onOpenChange={handleBulkCollegeOpenChange}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Visible Subject Scope</DialogTitle>
                        <DialogDescription>
                            Apply a college, multiple programs, multiple year levels, and one semester to the selected visible subjects.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,280px)]">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">College</label>
                                <Select value={bulkCollegeId} onValueChange={setBulkCollegeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select College" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vm.colleges.length === 0 ? (
                                            <SelectItem value="__none__" disabled>
                                                No colleges found
                                            </SelectItem>
                                        ) : (
                                            vm.colleges.map((college) => (
                                                <SelectItem key={college.$id} value={college.$id}>
                                                    {vm.collegeLabel(vm.colleges, college.$id)}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>

                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Semester</label>
                                    <Select value={bulkCollegeSemester || "__none__"} onValueChange={(value) => setBulkCollegeSemester(value === "__none__" ? "" : value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Semester" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No Semester</SelectItem>
                                            <SelectItem value="1st Semester">1st Semester</SelectItem>
                                            <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                                            <SelectItem value="Summer">Summer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-sm font-medium">Programs</label>
                                    <span className="text-xs text-muted-foreground">{bulkCollegeProgramIds.length} selected</span>
                                </div>
                                <ScrollArea className="h-44 rounded-md border">
                                    <div className="space-y-2 p-3">
                                        {bulkScopeProgramOptions.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                No programs found for the selected college.
                                            </div>
                                        ) : (
                                            bulkScopeProgramOptions.map((program) => {
                                                const checked = bulkCollegeProgramIds.includes(program.$id)
                                                return (
                                                    <label
                                                        key={program.$id}
                                                        htmlFor={`bulk-college-program-${program.$id}`}
                                                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                    >
                                                        <Checkbox
                                                            id={`bulk-college-program-${program.$id}`}
                                                            checked={checked}
                                                            onCheckedChange={(value) => {
                                                                const nextChecked = Boolean(value)
                                                                setBulkCollegeProgramIds((current) => {
                                                                    if (nextChecked) {
                                                                        return current.includes(program.$id)
                                                                            ? current
                                                                            : [...current, program.$id]
                                                                    }
                                                                    return current.filter((id) => id !== program.$id)
                                                                })
                                                            }}
                                                        />
                                                        <div className="min-w-0 flex-1 text-sm">
                                                            <div className="font-medium">{program.code}</div>
                                                            <div className="text-muted-foreground">{program.name}</div>
                                                        </div>
                                                    </label>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-sm font-medium">Year Levels</label>
                                    <span className="text-xs text-muted-foreground">{bulkCollegeYearLevels.length} selected</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                                    {["1", "2", "3", "4", "5", "6"].map((yearLevel) => {
                                        const checked = bulkCollegeYearLevels.includes(yearLevel)
                                        return (
                                            <label
                                                key={yearLevel}
                                                htmlFor={`bulk-college-year-${yearLevel}`}
                                                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    id={`bulk-college-year-${yearLevel}`}
                                                    checked={checked}
                                                    onCheckedChange={(value) => {
                                                        const nextChecked = Boolean(value)
                                                        setBulkCollegeYearLevels((current) => {
                                                            if (nextChecked) {
                                                                return current.includes(yearLevel)
                                                                    ? current
                                                                    : [...current, yearLevel]
                                                            }
                                                            return current.filter((item) => item !== yearLevel)
                                                        })
                                                    }}
                                                />
                                                <span>{yearLevel}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            <div className="text-muted-foreground">
                                Visible subjects:{" "}
                                <span className="font-medium text-foreground">
                                    {allVisibleSubjects.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setBulkCollegeSubjectIds(
                                            allVisibleSubjects.map((subject) =>
                                                String(subject.$id)
                                            )
                                        )
                                    }
                                    disabled={allVisibleSubjects.length === 0}
                                >
                                    Select All
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkCollegeSubjectIds([])}
                                    disabled={bulkCollegeSubjectIds.length === 0}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>

                        <ScrollArea className="h-80 rounded-md border">
                            <div className="space-y-2 p-3">
                                {allVisibleSubjects.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No visible subjects found in the current list.
                                    </div>
                                ) : (
                                    allVisibleSubjects.map((subject) => {
                                        const subjectId = String(subject.$id)
                                        const checked = bulkCollegeSubjectIds.includes(subjectId)

                                        return (
                                            <label
                                                key={subjectId}
                                                htmlFor={`bulk-college-subject-${subjectId}`}
                                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    id={`bulk-college-subject-${subjectId}`}
                                                    checked={checked}
                                                    onCheckedChange={(value) =>
                                                        toggleBulkCollegeSubject(
                                                            subjectId,
                                                            Boolean(value)
                                                        )
                                                    }
                                                />

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">
                                                            {subject.code}
                                                        </span>
                                                        <Badge variant="outline">{formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(subject)).join(", ") || "No Program Scope"}</Badge>
                                                    </div>

                                                    <div className="text-sm text-foreground">
                                                        {subject.title}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        College: {vm.collegeLabel(vm.colleges, (subject.departmentId as string | null) ?? null)}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        Year Level: {formatYearLevelScopeLabels(resolveSubjectYearLevels(subject)).join(", ") || "—"}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        Semester:{" "}
                                                        {resolveSubjectSemester(subject, termMap) ||
                                                            INHERIT_SEMESTER_LABEL}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleBulkCollegeOpenChange(false)}
                            disabled={bulkCollegeSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void saveBulkCollegeSubjects()}
                            disabled={
                                bulkCollegeSaving ||
                                !bulkCollegeId ||
                                bulkCollegeProgramIds.length === 0 ||
                                bulkCollegeYearLevels.length === 0 ||
                                !bulkCollegeSemester ||
                                bulkCollegeSubjectIds.length === 0
                            }
                        >
                            {bulkCollegeSaving ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkLinkOpen} onOpenChange={handleBulkLinkOpenChange}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {isSingleSubjectLinkMode
                                ? "Link Subject to Term"
                                : "Edit Subject Term Links"}
                        </DialogTitle>
                        <DialogDescription>
                            {isSingleSubjectLinkMode
                                ? "Permanently connect this subject to an academic term for proper semester segregation."
                                : "Bulk edit the selected subjects and link or relink them to the correct academic term."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Academic Term</label>
                            <Select
                                value={bulkLinkTermId}
                                onValueChange={setBulkLinkTermId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Term" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bulkLinkTermOptions.length === 0 ? (
                                        <SelectItem value="__none__" disabled>
                                            No matching academic terms found
                                        </SelectItem>
                                    ) : (
                                        bulkLinkTermOptions.map((term) => (
                                            <SelectItem key={term.$id} value={term.$id}>
                                                {vm.termLabel(vm.terms, term.$id)}
                                                {term.isActive ? " • Active" : ""}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                {normalizedBulkLinkSemesterHint
                                    ? `Filtered for ${normalizedBulkLinkSemesterHint} subjects.`
                                    : "Choose the target term for the selected subjects."}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            <div className="text-muted-foreground">
                                Visible subjects:{" "}
                                <span className="font-medium text-foreground">
                                    {bulkLinkEligibleSubjects.length}
                                </span>
                            </div>

                            {!isSingleSubjectLinkMode ? (
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setBulkLinkSubjectIds(
                                                bulkLinkEligibleSubjects.map((subject) =>
                                                    String(subject.$id)
                                                )
                                            )
                                        }
                                        disabled={bulkLinkEligibleSubjects.length === 0}
                                    >
                                        Select All
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setBulkLinkSubjectIds([])}
                                        disabled={bulkLinkSubjectIds.length === 0}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        <ScrollArea className="h-80 rounded-md border">
                            <div className="space-y-2 p-3">
                                {bulkLinkEligibleSubjects.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No subjects match the selected term or semester filter.
                                    </div>
                                ) : (
                                    bulkLinkEligibleSubjects.map((subject) => {
                                        const subjectId = String(subject.$id)
                                        const linkedTermId = resolveSubjectTermId(subject)
                                        const subjectSemester =
                                            resolveSubjectSemester(subject, termMap) ||
                                            INHERIT_SEMESTER_LABEL
                                        const checked = bulkLinkSubjectIds.includes(subjectId)
                                        const currentTermLabel = linkedTermId
                                            ? vm.termLabel(vm.terms, linkedTermId)
                                            : "Not linked to a term yet"

                                        return (
                                            <label
                                                key={subjectId}
                                                htmlFor={`bulk-link-subject-${subjectId}`}
                                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    id={`bulk-link-subject-${subjectId}`}
                                                    checked={checked}
                                                    onCheckedChange={(value) =>
                                                        toggleBulkLinkSubject(
                                                            subjectId,
                                                            Boolean(value)
                                                        )
                                                    }
                                                    disabled={bulkLinkLockedSubjectIds.includes(subjectId)}
                                                />

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">
                                                            {subject.code}
                                                        </span>
                                                        <Badge variant="outline">
                                                            {subjectSemester}
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                linkedTermId
                                                                    ? "secondary"
                                                                    : "outline"
                                                            }
                                                        >
                                                            {linkedTermId ? "Linked" : "Unlinked"}
                                                        </Badge>
                                                    </div>

                                                    <div className="text-sm text-foreground">
                                                        {subject.title}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        {vm.collegeLabel(
                                                            vm.colleges,
                                                            (subject.departmentId as string | null) ??
                                                                null
                                                        )}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        Current term: {currentTermLabel}
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleBulkLinkOpenChange(false)}
                            disabled={bulkLinking}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void linkSelectedSubjectsToTerm()}
                            disabled={
                                bulkLinking ||
                                !bulkLinkTermId ||
                                bulkLinkSubjectIds.length === 0
                            }
                        >
                            {bulkLinking ? "Saving..." : "Save Term Links"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    )
}