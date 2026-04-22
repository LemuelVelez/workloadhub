"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Link2, Loader2, Pencil, Plus, Trash2, Unlink2 } from "lucide-react"
import { toast } from "sonner"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"

import type { AcademicTermDoc, SectionDoc, SubjectDoc } from "../../../model/schemaModel"
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
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
type LooseSectionDoc = SectionDoc & Record<string, unknown>

type SubjectDuplicateGroup = {
    key: string
    label: string
    scopeSummary: string
    subjects: LooseSubjectDoc[]
    linkedClassCount: number
    linkedSectionCount: number
    representative: LooseSubjectDoc
}

type PendingSubjectAction = {
    kind: "mergeSubjects"
    groupKeys: string[]
    groupCount: number
    duplicateCount: number
}

const SUBJECT_TERM_KEYS = ["termId", "academicTermId", "term", "term_id", "termID"] as const
const SECTION_SUBJECT_KEYS = ["subjectId", "subject", "subject_id", "subjectID"] as const
const SECTION_SUBJECT_ARRAY_KEYS = ["subjectIds", "subject_ids"] as const
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

const alphanumericCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
})

function compareAlphaNumeric(left: string, right: string) {
    return alphanumericCollator.compare(left, right)
}

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))
    )
}

function hasOwnKey(source: Record<string, unknown> | null | undefined, key: string) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key)
}

function compareByCreatedAt(a: { $id?: string; $createdAt?: string }, b: { $id?: string; $createdAt?: string }) {
    const aTime = Date.parse(String(a?.$createdAt ?? "")) || 0
    const bTime = Date.parse(String(b?.$createdAt ?? "")) || 0
    if (aTime !== bTime) return aTime - bTime
    return String(a?.$id ?? "").localeCompare(String(b?.$id ?? ""))
}

function getCanonicalRecord<T extends { $id?: string; $createdAt?: string }>(records: T[]) {
    return records.slice().sort(compareByCreatedAt)[0]
}

function getPreferredStringValue(values: Array<string | null | undefined>) {
    const counts = new Map<string, number>()

    for (const value of values) {
        const normalized = String(value ?? "").trim()
        if (!normalized) continue
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }

    return (
        Array.from(counts.entries()).sort((left, right) => {
            if (right[1] !== left[1]) return right[1] - left[1]
            return compareAlphaNumeric(left[0], right[0])
        })[0]?.[0] ?? ""
    )
}

function normalizeSubjectCodeValue(value?: string | null) {
    return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ")
}

function normalizeSubjectTitleValue(value?: string | null) {
    return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ")
}

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
    return normalized.match(/([1-9]\d*)/)?.[1] ?? normalized
}

function normalizeSectionNameValue(value?: string | null) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")

    if (!normalized) return ""
    if (normalized.length === 1) return normalized.toUpperCase()
    return normalized
}

function buildSectionYearLevelLabel(section: LooseSectionDoc) {
    const storedYearLevel = normalizeSectionYearLevelValue(section.yearLevel)
    const sectionName = normalizeSectionNameValue(String(section.name ?? ""))

    if (!storedYearLevel) return sectionName
    if (!sectionName) return storedYearLevel

    return `${storedYearLevel} - ${sectionName}`
}

function compareYearLevelValues(left?: string | number | null, right?: string | number | null) {
    const leftYearNumber = Number(extractSubjectYearNumber(left))
    const rightYearNumber = Number(extractSubjectYearNumber(right))
    const leftHasYearNumber = Number.isFinite(leftYearNumber)
    const rightHasYearNumber = Number.isFinite(rightYearNumber)

    if (leftHasYearNumber && rightHasYearNumber && leftYearNumber !== rightYearNumber) {
        return leftYearNumber - rightYearNumber
    }

    return compareAlphaNumeric(
        normalizeSectionYearLevelValue(left),
        normalizeSectionYearLevelValue(right)
    )
}

function buildCanonicalSubjectYearLevels(values: Array<string | number | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => extractSubjectYearNumber(value))
                .filter(Boolean)
        )
    )
}

function resolveSubjectProgramIds(subject: LooseSubjectDoc) {
    return readStringArrayValues(subject, SUBJECT_PROGRAM_ARRAY_KEYS, SUBJECT_PROGRAM_KEYS)
}

function resolveSubjectYearLevelLabels(subject: LooseSubjectDoc) {
    return Array.from(
        new Set(
            readStringArrayValues(
                subject,
                SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS,
                SUBJECT_SCOPE_YEAR_LEVEL_KEYS
            )
                .map((value) => normalizeSectionYearLevelValue(value))
                .filter(Boolean)
        )
    )
}

function resolveSubjectYearLevels(subject: LooseSubjectDoc) {
    return Array.from(
        new Set(
            resolveSubjectYearLevelLabels(subject)
                .map((value) => extractSubjectYearNumber(value))
                .filter(Boolean)
        )
    )
}

function resolveSectionSubjectIds(section: LooseSectionDoc) {
    return readStringArrayValues(section, SECTION_SUBJECT_ARRAY_KEYS, SECTION_SUBJECT_KEYS)
}

function buildSectionSubjectPayload(
    source: Record<string, unknown> | null | undefined,
    subjectIdInput?: string | null
) {
    const nextValue = String(subjectIdInput ?? "").trim() || null
    const existingKeys = SECTION_SUBJECT_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["subjectId"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSectionSubjectIdsPayload(
    source: Record<string, unknown> | null | undefined,
    subjectIdsInput: string[] = []
) {
    const nextValue = uniqueStrings(subjectIdsInput)
    const existingKeys = SECTION_SUBJECT_ARRAY_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["subjectIds"]

    return keysToUpdate.reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectTermPayload(
    source: Record<string, unknown> | null | undefined,
    termIdInput?: string | null
) {
    const nextValue = String(termIdInput ?? "").trim() || null
    const existingKeys = SUBJECT_TERM_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["termId"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectProgramPayload(
    source: Record<string, unknown> | null | undefined,
    programIdInput?: string | null
) {
    const nextValue = String(programIdInput ?? "").trim() || null
    const existingKeys = SUBJECT_PROGRAM_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["programId"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectProgramIdsPayload(
    source: Record<string, unknown> | null | undefined,
    programIdsInput: string[] = []
) {
    const nextValue = uniqueStrings(programIdsInput)
    const existingKeys = SUBJECT_PROGRAM_ARRAY_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["programIds"]

    return keysToUpdate.reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectYearLevelPayload(
    source: Record<string, unknown> | null | undefined,
    yearLevelInput?: string | null
) {
    const nextValue = String(yearLevelInput ?? "").trim() || null
    const existingKeys = SUBJECT_SCOPE_YEAR_LEVEL_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["yearLevel"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectYearLevelsPayload(
    source: Record<string, unknown> | null | undefined,
    yearLevelsInput: string[] = []
) {
    const nextValue = uniqueStrings(yearLevelsInput)
    const existingKeys = SUBJECT_SCOPE_YEAR_LEVEL_ARRAY_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["yearLevels"]

    return keysToUpdate.reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function buildSubjectSemesterPayload(
    source: Record<string, unknown> | null | undefined,
    semesterInput?: string | null
) {
    const nextValue = String(semesterInput ?? "").trim() || null
    const existingKeys = SUBJECT_SEMESTER_KEYS.filter((key) => hasOwnKey(source, key))
    const keysToUpdate = existingKeys.length > 0 ? existingKeys : ["semester"]

    return keysToUpdate.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = nextValue
        return acc
    }, {})
}

function readNumberValue(value: unknown, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

async function updateDocumentIgnoringUnknownAttributes(
    collectionId: string,
    documentId: string,
    payload: Record<string, any>
) {
    const nextPayload = { ...payload }

    while (true) {
        const writableKeys = Object.keys(nextPayload)
        if (writableKeys.length === 0) {
            return { applied: false }
        }

        try {
            await databases.updateDocument(DATABASE_ID, collectionId, documentId, nextPayload)
            return { applied: true }
        } catch (error: any) {
            const message = String(error?.message ?? "").trim()
            const unknownAttributeMatch = message.match(/Unknown attribute:\s*"([^"]+)"/i)
            const rawUnknownKey = String(unknownAttributeMatch?.[1] ?? "").trim()

            if (!rawUnknownKey) {
                throw error
            }

            const matchedKey = writableKeys.find(
                (key) => key.toLowerCase() === rawUnknownKey.toLowerCase()
            )

            if (!matchedKey) {
                throw error
            }

            delete nextPayload[matchedKey]
        }
    }
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

function compareSemesterGroupLabels(left: string, right: string) {
    const leftOrder = getSemesterSortOrder(left)
    const rightOrder = getSemesterSortOrder(right)

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
    }

    return compareAlphaNumeric(left, right)
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
        const aCode = String(a.code ?? "")
        const bCode = String(b.code ?? "")
        const codeOrder = compareAlphaNumeric(aCode, bCode)
        if (codeOrder !== 0) return codeOrder

        return compareAlphaNumeric(String(a.title ?? ""), String(b.title ?? ""))
    })
}

function buildSubjectDuplicateKey(
    subject: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    return [
        String(subject.departmentId ?? "").trim(),
        normalizeSubjectCodeValue(subject.code as string | null),
        normalizeSubjectTitleValue(subject.title as string | null),
        normalizeSemesterLabel(resolveSubjectSemester(subject, termMap)),
        normalizeAcademicYearLabel(resolveSubjectAcademicYear(subject, termMap)),
        resolveSubjectProgramIds(subject).slice().sort(compareAlphaNumeric).join(","),
        resolveSubjectYearLevels(subject).slice().sort(compareAlphaNumeric).join(","),
        String(readNumberValue(subject.units)).trim(),
        String(readNumberValue(subject.lectureHours)).trim(),
        String(readNumberValue(subject.labHours)).trim(),
    ].join("::")
}

function buildSubjectDuplicateLabel(subject: LooseSubjectDoc) {
    const code = String(subject.code ?? "").trim()
    const title = String(subject.title ?? "").trim()
    if (code && title) return `${code} — ${title}`
    return code || title || "Untitled Subject"
}

function buildSubjectDuplicateScopeSummary(
    vm: MasterDataManagementVM,
    termMap: Map<string, LooseAcademicTermDoc>,
    subjects: LooseSubjectDoc[]
) {
    const collegeLabels = uniqueStrings(
        subjects.map((subject) => {
            const label = String(
                vm.collegeLabel(vm.colleges, (subject.departmentId as string | null) ?? null) ?? ""
            ).trim()
            return /^(?:—|-|–|unknown)$/i.test(label) ? "" : label
        })
    )

    const programLabels = uniqueStrings(
        subjects.flatMap((subject) => formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(subject)))
    )

    const yearLevels = uniqueStrings(
        subjects.flatMap((subject) => formatYearLevelScopeLabels(resolveSubjectYearLevels(subject)))
    )

    const termLabels = uniqueStrings(
        subjects.map((subject) => {
            const termId = resolveSubjectTermId(subject)
            if (termId) {
                return vm.termLabel(vm.terms, termId)
            }

            const semesterLabel = resolveSubjectSemester(subject, termMap)
            const academicYearLabel = resolveSubjectAcademicYear(subject, termMap)
            return [semesterLabel, academicYearLabel].filter(Boolean).join(" • ")
        })
    )

    const parts = [
        collegeLabels.length === 1 ? collegeLabels[0] : collegeLabels.length > 1 ? `${collegeLabels.length} colleges` : "",
        programLabels.length === 1 ? programLabels[0] : programLabels.length > 1 ? `${programLabels.length} program scopes` : "",
        yearLevels.length === 1 ? `Year ${yearLevels[0]}` : yearLevels.length > 1 ? `${yearLevels.length} year levels` : "",
        termLabels.length === 1 ? termLabels[0] : termLabels.length > 1 ? `${termLabels.length} academic terms` : "",
    ].filter(Boolean)

    return parts.join(" • ") || "Scope not set"
}

function buildMergedSubjectPayload(
    subjects: LooseSubjectDoc[],
    canonical: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const mergedProgramIds = uniqueStrings(subjects.flatMap((subject) => resolveSubjectProgramIds(subject)))
    const mergedYearLevels = uniqueStrings(subjects.flatMap((subject) => resolveSubjectYearLevelLabels(subject)))
    const mergedDepartmentId =
        getPreferredStringValue(subjects.map((subject) => String(subject.departmentId ?? "").trim())) || null
    const mergedTermId = getPreferredStringValue(subjects.map((subject) => resolveSubjectTermId(subject))) || null
    const mergedSemester =
        getPreferredStringValue(subjects.map((subject) => resolveSubjectSemester(subject, termMap))) || null
    const primaryProgramId =
        getPreferredStringValue(subjects.map((subject) => resolveSubjectProgramIds(subject)[0] ?? "")) ||
        mergedProgramIds[0] ||
        null
    const primaryYearLevel =
        getPreferredStringValue(subjects.map((subject) => resolveSubjectYearLevelLabels(subject)[0] ?? "")) ||
        mergedYearLevels[0] ||
        null
    const lectureHours = readNumberValue(
        canonical.lectureHours,
        Math.max(...subjects.map((subject) => readNumberValue(subject.lectureHours)))
    )
    const labHours = readNumberValue(
        canonical.labHours,
        Math.max(...subjects.map((subject) => readNumberValue(subject.labHours)))
    )
    const units = readNumberValue(
        canonical.units,
        Math.max(...subjects.map((subject) => readNumberValue(subject.units)))
    )

    return {
        code: String(canonical.code ?? "").trim() || getPreferredStringValue(subjects.map((subject) => String(subject.code ?? "").trim())),
        title: String(canonical.title ?? "").trim() || getPreferredStringValue(subjects.map((subject) => String(subject.title ?? "").trim())),
        units,
        lectureHours,
        labHours,
        totalHours: lectureHours + labHours,
        isActive: subjects.some((subject) => Boolean(subject.isActive)),
        departmentId: mergedDepartmentId,
        ...buildSubjectTermPayload(canonical, mergedTermId),
        ...buildSubjectSemesterPayload(canonical, mergedSemester),
        ...buildSubjectProgramPayload(canonical, primaryProgramId),
        ...buildSubjectProgramIdsPayload(canonical, mergedProgramIds),
        ...buildSubjectYearLevelPayload(canonical, primaryYearLevel),
        ...buildSubjectYearLevelsPayload(canonical, mergedYearLevels),
    }
}

export function MasterDataSubjectsTab({ vm }: Props) {
    const [bulkLinkOpen, setBulkLinkOpen] = React.useState(false)
    const [bulkTermActionMode, setBulkTermActionMode] = React.useState<"link" | "transfer">("link")
    const [bulkLinkTermId, setBulkLinkTermId] = React.useState("")
    const [bulkLinkSemesterHint, setBulkLinkSemesterHint] = React.useState("")
    const [bulkLinkSubjectIds, setBulkLinkSubjectIds] = React.useState<string[]>([])
    const [bulkLinkLockedSubjectIds, setBulkLinkLockedSubjectIds] = React.useState<string[]>([])
    const [bulkLinkSourceSubjectIds, setBulkLinkSourceSubjectIds] = React.useState<string[]>([])
    const [bulkLinking, setBulkLinking] = React.useState(false)
    const [bulkUnlinking, setBulkUnlinking] = React.useState(false)
    const [selectedSubjectDetail, setSelectedSubjectDetail] = React.useState<LooseSubjectDoc | null>(null)
    const [expandedGroups, setExpandedGroups] = React.useState<string[]>([])

    const [bulkCollegeOpen, setBulkCollegeOpen] = React.useState(false)
    const [bulkCollegeId, setBulkCollegeId] = React.useState("")
    const [bulkCollegeProgramIds, setBulkCollegeProgramIds] = React.useState<string[]>([])
    const [bulkCollegeYearLevels, setBulkCollegeYearLevels] = React.useState<string[]>([])
    const [bulkCollegeTermId, setBulkCollegeTermId] = React.useState("")
    const [bulkCollegeSubjectIds, setBulkCollegeSubjectIds] = React.useState<string[]>([])
    const [bulkCollegeSaving, setBulkCollegeSaving] = React.useState(false)
    const [selectedSubjectIds, setSelectedSubjectIds] = React.useState<string[]>([])
    const [subjectDedupeBusy, setSubjectDedupeBusy] = React.useState(false)
    const [pendingSubjectAction, setPendingSubjectAction] = React.useState<PendingSubjectAction | null>(null)
    const [pendingSubjectActionSubmitting, setPendingSubjectActionSubmitting] = React.useState(false)
    const [subjectMergeKeepByGroup, setSubjectMergeKeepByGroup] = React.useState<Record<string, string>>({})

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

    const visibleSubjectIds = React.useMemo(
        () => allVisibleSubjects.map((subject) => String(subject.$id)),
        [allVisibleSubjects]
    )

    const visibleSubjectIdSet = React.useMemo(
        () => new Set(visibleSubjectIds),
        [visibleSubjectIds]
    )

    React.useEffect(() => {
        setSelectedSubjectIds((current) =>
            current.filter((subjectId) => visibleSubjectIdSet.has(subjectId))
        )
    }, [visibleSubjectIdSet])

    const selectedSubjectIdSet = React.useMemo(
        () => new Set(selectedSubjectIds),
        [selectedSubjectIds]
    )

    const selectedVisibleSubjects = React.useMemo(
        () =>
            allVisibleSubjects.filter((subject) =>
                selectedSubjectIdSet.has(String(subject.$id))
            ),
        [allVisibleSubjects, selectedSubjectIdSet]
    )

    const allDuplicateSubjectGroups = React.useMemo<SubjectDuplicateGroup[]>(() => {
        const groups = new Map<string, LooseSubjectDoc[]>()

        for (const subject of vm.subjects as LooseSubjectDoc[]) {
            const key = buildSubjectDuplicateKey(subject, termMap)
            const current = groups.get(key) ?? []
            current.push(subject)
            groups.set(key, current)
        }

        return Array.from(groups.entries())
            .filter(([, subjects]) => subjects.length > 1)
            .map(([key, subjects]) => {
                const representative = getCanonicalRecord(subjects)
                const subjectIdSet = new Set(subjects.map((subject) => String(subject.$id)))
                const linkedClassCount = vm.classes.filter((classDoc) =>
                    subjectIdSet.has(String(classDoc.subjectId ?? "").trim())
                ).length
                const linkedSectionCount = vm.sections.filter((section) =>
                    resolveSectionSubjectIds(section as LooseSectionDoc).some((subjectId) =>
                        subjectIdSet.has(subjectId)
                    )
                ).length

                return {
                    key,
                    label: buildSubjectDuplicateLabel(representative),
                    scopeSummary: buildSubjectDuplicateScopeSummary(vm, termMap, subjects),
                    subjects: sortSubjects(subjects),
                    linkedClassCount,
                    linkedSectionCount,
                    representative,
                }
            })
            .sort((left, right) => compareAlphaNumeric(left.label, right.label))
    }, [termMap, vm])

    const pendingMergeSubjectGroups = React.useMemo(
        () =>
            pendingSubjectAction?.kind === "mergeSubjects"
                ? allDuplicateSubjectGroups.filter((group) =>
                      pendingSubjectAction.groupKeys.includes(group.key)
                  )
                : [],
        [allDuplicateSubjectGroups, pendingSubjectAction]
    )

    const pendingSubjectActionBusy = pendingSubjectActionSubmitting || subjectDedupeBusy

    const allVisibleSelected =
        visibleSubjectIds.length > 0 &&
        selectedVisibleSubjects.length === visibleSubjectIds.length

    const someVisibleSelected =
        selectedVisibleSubjects.length > 0 && !allVisibleSelected

    const bulkScopeProgramOptions = React.useMemo(() => {
        const collegeId = String(bulkCollegeId ?? "").trim()
        if (!collegeId) return []

        return vm.programs
            .filter((program) => String(program.departmentId ?? "").trim() === collegeId)
            .sort((a, b) => compareAlphaNumeric(`${a.code} ${a.name}`, `${b.code} ${b.name}`))
    }, [bulkCollegeId, vm.programs])


    const bulkCollegeTermOptions = React.useMemo(() => {
        return [...(vm.terms as LooseAcademicTermDoc[])].sort((a, b) =>
            vm.termLabel(vm.terms, String(a.$id)).localeCompare(vm.termLabel(vm.terms, String(b.$id)), undefined, {
                numeric: true,
                sensitivity: "base",
            })
        )
    }, [vm])

    const bulkCollegeFilteredSections = React.useMemo(() => {
        const normalizedCollegeId = String(bulkCollegeId ?? "").trim()
        const normalizedProgramIds = new Set(
            bulkCollegeProgramIds.map((value) => String(value).trim()).filter(Boolean)
        )

        if (normalizedProgramIds.size === 0) {
            return [] as LooseSectionDoc[]
        }

        return (vm.sections as LooseSectionDoc[]).filter((section) => {
            const sectionCollegeId = String(section.departmentId ?? "").trim()
            if (normalizedCollegeId && sectionCollegeId !== normalizedCollegeId) {
                return false
            }

            const sectionProgramId = String(section.programId ?? "").trim()
            if (!sectionProgramId) {
                return false
            }

            return normalizedProgramIds.has(sectionProgramId)
        })
    }, [bulkCollegeId, bulkCollegeProgramIds, vm.sections])

    const bulkCollegeYearLevelOptions = React.useMemo(() => {
        const options = new Map<
            string,
            {
                value: string
                label: string
                sectionCount: number
                sectionLabels: string[]
            }
        >()

        for (const section of bulkCollegeFilteredSections) {
            const yearNumber = extractSubjectYearNumber(section.yearLevel)
            if (!yearNumber) continue

            const sectionLabel = buildSectionYearLevelLabel(section)
            const existing = options.get(yearNumber)
            if (existing) {
                existing.sectionCount += 1
                if (sectionLabel && !existing.sectionLabels.includes(sectionLabel)) {
                    existing.sectionLabels.push(sectionLabel)
                }
                continue
            }

            options.set(yearNumber, {
                value: yearNumber,
                label: yearNumber,
                sectionCount: 1,
                sectionLabels: sectionLabel ? [sectionLabel] : [],
            })
        }

        return Array.from(options.values())
            .map((option) => ({
                ...option,
                sectionLabels: [...option.sectionLabels].sort(compareAlphaNumeric),
            }))
            .sort((left, right) => {
                const yearLevelDelta = compareYearLevelValues(left.value, right.value)
                if (yearLevelDelta !== 0) return yearLevelDelta

                return compareAlphaNumeric(left.label, right.label)
            })
    }, [bulkCollegeFilteredSections])

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
                const semesterDelta = compareSemesterGroupLabels(a.semesterLabel, b.semesterLabel)
                if (semesterDelta !== 0) return semesterDelta

                const academicYearDelta = compareAlphaNumeric(
                    normalizeAcademicYearLabel(a.academicYearLabel),
                    normalizeAcademicYearLabel(b.academicYearLabel)
                )
                if (academicYearDelta !== 0) return academicYearDelta

                return compareAlphaNumeric(a.title, b.title)
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
            mode = "link",
            semesterHint = "",
            subjectIds = [],
            lockedSubjectIds = [],
        }: {
            mode?: "link" | "transfer"
            semesterHint?: string
            subjectIds?: string[]
            lockedSubjectIds?: string[]
        } = {}) => {
            const normalizedSubjectIds = subjectIds.map((value) => String(value))
            const normalizedLockedSubjectIds = lockedSubjectIds.map((value) =>
                String(value)
            )

            setBulkTermActionMode(mode)
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
            setBulkTermActionMode("link")
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

    const transferSelectedSubjectsToTerm = React.useCallback(async () => {
        setBulkLinking(true)
        try {
            const result = await vm.transferSubjectsToTerm(
                bulkLinkSubjectIds,
                bulkLinkTermId
            )

            if (result.created > 0 && result.failed.length === 0) {
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
        if (bulkCollegeTermId) return

        const nextTermId =
            String(vm.selectedTermId ?? "").trim() ||
            String(vm.terms.find((term) => Boolean(term.isActive))?.$id ?? "").trim() ||
            String(vm.terms[0]?.$id ?? "").trim()

        setBulkCollegeTermId(nextTermId)
    }, [bulkCollegeOpen, bulkCollegeTermId, vm.selectedTermId, vm.terms])

    React.useEffect(() => {
        if (!bulkCollegeOpen) return

        const validProgramIds = new Set(bulkScopeProgramOptions.map((program) => String(program.$id)))
        setBulkCollegeProgramIds((current) => current.filter((programId) => validProgramIds.has(String(programId))))
    }, [bulkCollegeOpen, bulkScopeProgramOptions])

    React.useEffect(() => {
        if (!bulkCollegeOpen) return

        const validYearLevels = new Set(
            bulkCollegeYearLevelOptions.map((option) => normalizeSectionYearLevelValue(option.value))
        )
        setBulkCollegeYearLevels((current) =>
            current.filter((yearLevel) => validYearLevels.has(normalizeSectionYearLevelValue(yearLevel)))
        )
    }, [bulkCollegeOpen, bulkCollegeYearLevelOptions])

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
            setBulkCollegeTermId("")
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
        const explicitProgramIds = Array.from(
            new Set(bulkCollegeProgramIds.map((programId) => String(programId).trim()).filter(Boolean))
        )
        const selectedSectionYearLevels = Array.from(
            new Set(bulkCollegeYearLevels.map((yearLevel) => extractSubjectYearNumber(yearLevel)).filter(Boolean))
        )
        const normalizedTermId = String(bulkCollegeTermId ?? "").trim()
        const normalizedSemester = normalizeSemesterLabel(resolveTermSemester(termMap, normalizedTermId))
        const normalizedProgramIds = explicitProgramIds
        const normalizedYearLevels = buildCanonicalSubjectYearLevels(selectedSectionYearLevels)
        const primaryProgramId = normalizedProgramIds[0] ?? null
        const primaryStoredYearLevel = normalizedYearLevels[0] ?? null
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

        if (selectedSectionYearLevels.length === 0 || normalizedYearLevels.length === 0) {
            toast.error("Please select at least one year level.")
            return
        }

        if (!normalizedTermId) {
            toast.error("Please select an academic term.")
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
                            yearLevel: primaryStoredYearLevel || null,
                            yearLevels: normalizedYearLevels,
                            termId: normalizedTermId,
                            semester: normalizedSemester || null,
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
        bulkCollegeTermId,
        bulkCollegeSubjectIds,
        bulkCollegeYearLevels,
        handleBulkCollegeOpenChange,
        termMap,
        vm,
    ])

    const toggleSubjectSelection = React.useCallback(
        (subjectId: string, checked: boolean) => {
            setSelectedSubjectIds((current) => {
                if (checked) {
                    if (current.includes(subjectId)) return current
                    return [...current, subjectId]
                }

                return current.filter((id) => id !== subjectId)
            })
        },
        []
    )

    const toggleVisibleSubjectSelection = React.useCallback(
        (checked: boolean) => {
            setSelectedSubjectIds(checked ? visibleSubjectIds : [])
        },
        [visibleSubjectIds]
    )

    const toggleGroupedSubjectSelection = React.useCallback(
        (subjectIds: string[], checked: boolean) => {
            setSelectedSubjectIds((current) => {
                const next = new Set(current)

                if (checked) {
                    subjectIds.forEach((subjectId) => next.add(subjectId))
                } else {
                    subjectIds.forEach((subjectId) => next.delete(subjectId))
                }

                return Array.from(next)
            })
        },
        []
    )

    const openDeleteSelectedSubjects = React.useCallback(() => {
        if (selectedVisibleSubjects.length === 0) {
            toast.error("Select at least one subject to delete.")
            return
        }

        vm.setDeleteIntent({
            type: "subjects",
            docs: selectedVisibleSubjects as any,
            scope: "selected",
        })
    }, [selectedVisibleSubjects, vm])

    const openDeleteAllVisibleSubjects = React.useCallback(() => {
        if (allVisibleSubjects.length === 0) {
            toast.error("No visible subjects available for deletion.")
            return
        }

        vm.setDeleteIntent({
            type: "subjects",
            docs: allVisibleSubjects as any,
            scope: "visible",
        })
    }, [allVisibleSubjects, vm])

    const mergeSubjectGroups = React.useCallback(
        async (
            groups: SubjectDuplicateGroup[],
            keepByGroup: Record<string, string> = {}
        ) => {
            if (groups.length === 0) {
                toast.error("No duplicate subject groups found.")
                return
            }

            setSubjectDedupeBusy(true)

            try {
                let mergedGroups = 0
                let deleted = 0
                let rewiredSections = 0
                let rewiredClasses = 0
                const failed: string[] = []

                for (const group of groups) {
                    const selectedKeepId = String(keepByGroup[group.key] ?? "").trim()
                    const canonical =
                        group.subjects.find((subject) => String(subject.$id) === selectedKeepId) ??
                        getCanonicalRecord(group.subjects)
                    const duplicates = group.subjects.filter(
                        (subject) => String(subject.$id) !== String(canonical.$id)
                    )

                    if (duplicates.length === 0) continue

                    try {
                        await updateDocumentIgnoringUnknownAttributes(
                            COLLECTIONS.SUBJECTS,
                            String(canonical.$id),
                            buildMergedSubjectPayload(group.subjects, canonical, termMap)
                        )

                        for (const duplicate of duplicates) {
                            const duplicateId = String(duplicate.$id)
                            const canonicalId = String(canonical.$id)

                            const referencingSections = (vm.sections as LooseSectionDoc[]).filter((section) =>
                                resolveSectionSubjectIds(section).includes(duplicateId)
                            )

                            for (const section of referencingSections) {
                                const nextSubjectIds = uniqueStrings(
                                    resolveSectionSubjectIds(section).map((subjectId) =>
                                        subjectId === duplicateId ? canonicalId : subjectId
                                    )
                                )
                                const primarySubjectId = nextSubjectIds[0] ?? canonicalId

                                await updateDocumentIgnoringUnknownAttributes(
                                    COLLECTIONS.SECTIONS,
                                    String(section.$id),
                                    {
                                        ...buildSectionSubjectPayload(section, primarySubjectId),
                                        ...buildSectionSubjectIdsPayload(section, nextSubjectIds),
                                    }
                                )
                                rewiredSections += 1
                            }

                            const referencingClasses = vm.classes.filter(
                                (classDoc) => String(classDoc.subjectId ?? "").trim() === duplicateId
                            )

                            for (const classDoc of referencingClasses) {
                                await databases.updateDocument(
                                    DATABASE_ID,
                                    COLLECTIONS.CLASSES,
                                    classDoc.$id,
                                    { subjectId: canonicalId }
                                )
                                rewiredClasses += 1
                            }

                            await databases.deleteDocument(
                                DATABASE_ID,
                                COLLECTIONS.SUBJECTS,
                                duplicateId
                            )
                            deleted += 1
                        }

                        mergedGroups += 1
                    } catch (error: any) {
                        failed.push(
                            `${group.label} (${String(error?.message ?? "Update failed.").trim() || "Update failed."})`
                        )
                    }
                }

                if (mergedGroups > 0) {
                    await vm.refreshAll()
                }

                if (mergedGroups > 0 && failed.length === 0) {
                    toast.success(
                        `Merged ${mergedGroups} duplicate subject group${mergedGroups === 1 ? "" : "s"}, deleted ${deleted} duplicate record${deleted === 1 ? "" : "s"}, rewired ${rewiredSections} section reference${rewiredSections === 1 ? "" : "s"}, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`
                    )
                    return
                }

                if (mergedGroups > 0) {
                    toast.error(
                        `Merged ${mergedGroups} subject group${mergedGroups === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`
                    )
                    return
                }

                toast.error(
                    failed.length > 0
                        ? `Failed to merge duplicate subjects: ${failed.join(", ")}`
                        : "No duplicate subjects were merged."
                )
            } finally {
                setSubjectDedupeBusy(false)
            }
        },
        [termMap, vm]
    )

    const requestMergeSubjectGroups = React.useCallback((groups: SubjectDuplicateGroup[]) => {
        if (groups.length === 0) {
            toast.error("No duplicate subject groups found.")
            return
        }

        const duplicateCount = groups.reduce(
            (count, group) => count + Math.max(group.subjects.length - 1, 0),
            0
        )

        setSubjectMergeKeepByGroup(
            Object.fromEntries(
                groups.map((group) => [
                    group.key,
                    String(getCanonicalRecord(group.subjects)?.$id ?? ""),
                ])
            )
        )
        setPendingSubjectAction({
            kind: "mergeSubjects",
            groupKeys: groups.map((group) => group.key),
            groupCount: groups.length,
            duplicateCount,
        })
    }, [])

    const handleConfirmPendingSubjectAction = React.useCallback(async () => {
        if (!pendingSubjectAction || pendingSubjectActionSubmitting) return

        const action = pendingSubjectAction
        setPendingSubjectActionSubmitting(true)

        try {
            const groups = allDuplicateSubjectGroups.filter((group) =>
                action.groupKeys.includes(group.key)
            )
            const normalizedKeepByGroup = Object.fromEntries(
                groups.map((group) => {
                    const selectedKeepId = String(subjectMergeKeepByGroup[group.key] ?? "").trim()
                    const fallbackKeepId = String(getCanonicalRecord(group.subjects)?.$id ?? "")
                    return [group.key, selectedKeepId || fallbackKeepId]
                })
            )
            await mergeSubjectGroups(groups, normalizedKeepByGroup)
            setSubjectMergeKeepByGroup({})
            setPendingSubjectAction(null)
        } finally {
            setPendingSubjectActionSubmitting(false)
        }
    }, [
        allDuplicateSubjectGroups,
        mergeSubjectGroups,
        pendingSubjectAction,
        pendingSubjectActionSubmitting,
        subjectMergeKeepByGroup,
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

    const compactActionButtonClassName = "h-8 w-full justify-center px-2 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
    const compactInlineButtonClassName = "h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"

    const stopActionAreaInteraction = React.useCallback(
        (event: React.SyntheticEvent) => {
            event.stopPropagation()
        },
        []
    )

    const isSingleSubjectLinkMode =
        bulkTermActionMode === "link" &&
        bulkLinkLockedSubjectIds.length === 1 &&
        bulkLinkSourceSubjectIds.length === 1

    const bulkTransferTargetSubjectIds =
        selectedVisibleSubjects.length > 0
            ? selectedVisibleSubjects.map((subject) => String(subject.$id))
            : visibleSubjectIds

    const selectedSubjectDetailLinkedTermId = selectedSubjectDetail
        ? resolveSubjectTermId(selectedSubjectDetail)
        : ""

    const selectedSubjectDetailSemesterLabel = selectedSubjectDetail
        ? resolveSubjectSemester(selectedSubjectDetail, termMap) || INHERIT_SEMESTER_LABEL
        : "—"

    const selectedSubjectDetailTermLabel = selectedSubjectDetail
        ? selectedSubjectDetailLinkedTermId
            ? vm.termLabel(vm.terms, selectedSubjectDetailLinkedTermId)
            : "No direct semester link. Semester scope is still saved on the subject."
        : "—"

    const selectedSubjectDetailProgramLabels = selectedSubjectDetail
        ? formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(selectedSubjectDetail))
        : []

    const selectedSubjectDetailYearLevels = selectedSubjectDetail
        ? formatYearLevelScopeLabels(resolveSubjectYearLevels(selectedSubjectDetail))
        : []

    const selectedSubjectDetailTotalHours = selectedSubjectDetail
        ? Number.isFinite(Number(selectedSubjectDetail.totalHours))
            ? selectedSubjectDetail.totalHours
            : Number(selectedSubjectDetail.lectureHours ?? 0) +
              Number(selectedSubjectDetail.labHours ?? 0)
        : "—"

    return (
        <TabsContent value="subjects" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="font-medium">Subjects</div>
                    <div className="text-sm text-muted-foreground">
                        Manage subject list, units, hours, semester scope, reusable subject copies across academic terms, and duplicate cleanup.
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={compactActionButtonClassName}
                        disabled={bulkCollegeSaving || bulkLinking || bulkUnlinking}
                        onClick={openBulkCollegeDialog}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        <span className="min-w-0 truncate">Edit Visible Subject Scope</span>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={() => {
                            vm.setSubjectEditing(null)
                            vm.setSubjectOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="min-w-0 truncate">Add Subject</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">
                        {allVisibleSubjects.length} visible
                    </Badge>
                    <Badge
                        variant={selectedVisibleSubjects.length > 0 ? "default" : "outline"}
                    >
                        {selectedVisibleSubjects.length} selected
                    </Badge>
                    <Badge variant="outline">
                        {allDuplicateSubjectGroups.length} duplicate group{allDuplicateSubjectGroups.length === 1 ? "" : "s"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        Bulk delete uses the current visible list or your checkbox selection.
                    </span>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-3 py-2">
                        <Checkbox
                            checked={
                                allVisibleSelected
                                    ? true
                                    : someVisibleSelected
                                        ? "indeterminate"
                                        : false
                            }
                            onCheckedChange={(value) =>
                                toggleVisibleSubjectSelection(Boolean(value))
                            }
                            aria-label="Select all visible subjects"
                        />
                        <span className="min-w-0 truncate text-sm font-medium">Select all visible</span>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={() => setSelectedSubjectIds([])}
                        disabled={selectedVisibleSubjects.length === 0}
                    >
                        <span className="min-w-0 truncate">Clear Selection</span>
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={() =>
                            openBulkLinkDialog({
                                mode: "transfer",
                                subjectIds: bulkTransferTargetSubjectIds,
                            })
                        }
                        disabled={bulkTransferTargetSubjectIds.length === 0 || bulkLinking || bulkUnlinking}
                    >
                        <Link2 className="mr-2 h-4 w-4" />
                        <span className="min-w-0 truncate">
                            {selectedVisibleSubjects.length > 0 ? "Transfer Selected to Another Term" : "Transfer Visible to Another Term"}
                        </span>
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={() => requestMergeSubjectGroups(allDuplicateSubjectGroups)}
                        disabled={allDuplicateSubjectGroups.length === 0 || subjectDedupeBusy}
                    >
                        {subjectDedupeBusy ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Working...
                            </span>
                        ) : (
                            <span className="min-w-0 truncate">
                                Delete Duplicated Subjects ({allDuplicateSubjectGroups.length})
                            </span>
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={openDeleteSelectedSubjects}
                        disabled={selectedVisibleSubjects.length === 0}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span className="min-w-0 truncate">Delete Selected</span>
                    </Button>

                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className={compactActionButtonClassName}
                        onClick={openDeleteAllVisibleSubjects}
                        disabled={allVisibleSubjects.length === 0}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span className="min-w-0 truncate">Delete All Visible</span>
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
                    {groupedSubjects.map((group) => {
                        const groupSubjectIds = group.subjects.map((subject) =>
                            String(subject.$id)
                        )
                        const selectedGroupCount = groupSubjectIds.filter((subjectId) =>
                            selectedSubjectIdSet.has(subjectId)
                        ).length
                        const allGroupSelected =
                            groupSubjectIds.length > 0 &&
                            selectedGroupCount === groupSubjectIds.length
                        const someGroupSelected =
                            selectedGroupCount > 0 && !allGroupSelected

                        return (
                        <AccordionItem
                            key={group.key}
                            value={group.key}
                            className="overflow-hidden rounded-lg border"
                        >
                            <div className="border-b bg-muted/30">
                                <AccordionTrigger className="min-w-0 gap-2 px-4 py-3 text-left hover:no-underline sm:py-4">
                                    <div className="min-w-0 flex-1 overflow-hidden space-y-1 pr-2 sm:pr-4">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <div className="min-w-0 truncate font-medium">
                                                {group.title}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0">
                                                {group.subjects.length}
                                            </Badge>
                                            <Badge
                                                variant={selectedGroupCount > 0 ? "default" : "outline"}
                                                className="shrink-0"
                                            >
                                                {selectedGroupCount} selected
                                            </Badge>
                                        </div>

                                        <div className="min-w-0 wrap-break-word pr-2 text-xs text-muted-foreground">
                                            {group.linkedCount} linked subject
                                            {group.linkedCount === 1 ? "" : "s"} •{" "}
                                            {group.inheritedCount} subject
                                            {group.inheritedCount === 1 ? "" : "s"} without
                                            direct term link
                                        </div>
                                    </div>
                                </AccordionTrigger>

                                <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                                    <div
                                        className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
                                        onPointerDown={stopActionAreaInteraction}
                                        onMouseDown={stopActionAreaInteraction}
                                        onTouchStart={stopActionAreaInteraction}
                                    >
                                        <Checkbox
                                            checked={
                                                allGroupSelected
                                                    ? true
                                                    : someGroupSelected
                                                        ? "indeterminate"
                                                        : false
                                            }
                                            onCheckedChange={(value) =>
                                                toggleGroupedSubjectSelection(
                                                    groupSubjectIds,
                                                    Boolean(value)
                                                )
                                            }
                                            aria-label={`Select ${group.title} subjects`}
                                        />
                                        <span className="text-sm font-medium">Select group</span>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={compactActionButtonClassName}
                                        disabled={bulkLinking || bulkUnlinking}
                                        onClick={handleTableActionClick(() =>
                                            openBulkLinkDialog({
                                                mode: "link",
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
                                        <span className="min-w-0 truncate">Edit Group Links</span>
                                    </Button>

                                    {group.inheritedCount > 0 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={compactActionButtonClassName}
                                            disabled={bulkLinking || bulkUnlinking}
                                            onClick={handleTableActionClick(() =>
                                                openBulkLinkDialog({
                                                    mode: "link",
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
                                            <span className="min-w-0 truncate">Link Existing to Term</span>
                                        </Button>
                                    ) : null}

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={compactActionButtonClassName}
                                        disabled={bulkLinking || bulkUnlinking}
                                        onClick={handleTableActionClick(() =>
                                            openBulkLinkDialog({
                                                mode: "transfer",
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
                                        <span className="min-w-0 truncate">Transfer Group to Another Term</span>
                                    </Button>

                                    {group.linkedCount > 0 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={compactActionButtonClassName}
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

                                    <Badge variant="outline" className="max-w-full wrap-break-word text-center sm:text-left">
                                        Visible actions affect the current list or group only.
                                    </Badge>
                                </div>
                            </div>

                            <AccordionContent className="pb-0">
                                <div className="sm:hidden">
                                    <Accordion type="single" collapsible className="w-full border-t">
                                        {group.subjects.map((subject) => {
                                            const subjectValue = String(subject.$id)
                                            const isSelected = selectedSubjectIdSet.has(subjectValue)

                                            return (
                                                <AccordionItem key={subjectValue} value={subjectValue} className="px-4">
                                                    <AccordionTrigger className="min-w-0 gap-2 text-left hover:no-underline">
                                                        <div className="min-w-0 flex-1 wrap-break-word pr-2 text-sm font-semibold line-clamp-2">
                                                            {subject.code} — {subject.title}
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pb-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div
                                                                className="flex items-center gap-2 text-sm"
                                                                onPointerDown={stopActionAreaInteraction}
                                                                onMouseDown={stopActionAreaInteraction}
                                                                onTouchStart={stopActionAreaInteraction}
                                                            >
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={(value) =>
                                                                        toggleSubjectSelection(
                                                                            subjectValue,
                                                                            Boolean(value)
                                                                        )
                                                                    }
                                                                    aria-label={`Select ${subject.code} ${subject.title}`}
                                                                />
                                                                <span className="text-muted-foreground">Select</span>
                                                            </div>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className={compactInlineButtonClassName}
                                                                onClick={handleTableActionClick(() =>
                                                                    setSelectedSubjectDetail(subject)
                                                                )}
                                                            >
                                                                Details
                                                            </Button>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            )
                                        })}
                                    </Accordion>
                                </div>

                                <div className="hidden sm:block">
                                    <div className="border-b px-4 py-2 text-xs text-muted-foreground">
                                        Drag horizontally on the table to view more columns.
                                    </div>

                                    <Table className="min-w-max">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-14">
                                                    <div
                                                        className="flex items-center justify-center"
                                                        onPointerDown={stopActionAreaInteraction}
                                                        onMouseDown={stopActionAreaInteraction}
                                                        onTouchStart={stopActionAreaInteraction}
                                                    >
                                                        <Checkbox
                                                            checked={
                                                                allVisibleSelected
                                                                    ? true
                                                                    : someVisibleSelected
                                                                        ? "indeterminate"
                                                                        : false
                                                            }
                                                            onCheckedChange={(value) =>
                                                                toggleVisibleSubjectSelection(
                                                                    Boolean(value)
                                                                )
                                                            }
                                                            aria-label="Select all visible subjects"
                                                        />
                                                    </div>
                                                </TableHead>
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
                                                    : "No direct semester link. Semester scope is still saved on the subject."

                                                return (
                                                    <TableRow key={subject.$id}>
                                                        <TableCell className="align-middle">
                                                            <div
                                                                className="flex items-center justify-center"
                                                                onPointerDown={stopActionAreaInteraction}
                                                                onMouseDown={stopActionAreaInteraction}
                                                                onTouchStart={stopActionAreaInteraction}
                                                            >
                                                                <Checkbox
                                                                    checked={selectedSubjectIdSet.has(String(subject.$id))}
                                                                    onCheckedChange={(value) =>
                                                                        toggleSubjectSelection(
                                                                            String(subject.$id),
                                                                            Boolean(value)
                                                                        )
                                                                    }
                                                                    aria-label={`Select ${subject.code} ${subject.title}`}
                                                                />
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="max-w-40 font-medium"><div className="truncate">{subject.code}</div></TableCell>

                                                        <TableCell className="max-w-72"><div className="truncate">{subject.title}</div></TableCell>

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

                                                                <div className="truncate text-xs text-muted-foreground">
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
                                                                    className={compactInlineButtonClassName}
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
                                                                    className={compactInlineButtonClassName}
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
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )})}
                </Accordion>
            )}

            <AlertDialog
                open={Boolean(pendingSubjectAction)}
                onOpenChange={(open) => {
                    if (!open && !pendingSubjectActionBusy) {
                        setPendingSubjectAction(null)
                        setSubjectMergeKeepByGroup({})
                    }
                }}
            >
                <AlertDialogContent className="max-h-[90svh] overflow-hidden sm:max-w-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Duplicated Subjects</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingSubjectAction
                                ? `Review each duplicate subject group below. Choose the subject record to keep, then continue. The other duplicate record${pendingSubjectAction.duplicateCount === 1 ? " will" : "s will"} be deleted and their section and class references will be moved automatically.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {pendingSubjectAction?.kind === "mergeSubjects" ? (
                        <ScrollArea className="max-h-[52svh] rounded-md border">
                            <div className="space-y-3 p-3">
                                {pendingMergeSubjectGroups.map((group) => {
                                    const selectedKeepId =
                                        String(subjectMergeKeepByGroup[group.key] ?? "").trim() ||
                                        String(getCanonicalRecord(group.subjects)?.$id ?? "")

                                    return (
                                        <div key={group.key} className="rounded-xl border bg-muted/20 p-3">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-sm font-semibold">{group.label}</div>
                                                    <Badge variant="secondary">
                                                        {group.subjects.length} duplicate records
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {group.scopeSummary}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Linked sections: {group.linkedSectionCount} • Linked classes: {group.linkedClassCount}
                                                </div>
                                            </div>

                                            <div className="mt-3 grid gap-3">
                                                {group.subjects.map((subject) => {
                                                    const subjectId = String(subject.$id)
                                                    const keepSelected = subjectId === selectedKeepId
                                                    const termId = resolveSubjectTermId(subject)
                                                    const termLabel = termId
                                                        ? vm.termLabel(vm.terms, termId)
                                                        : [
                                                              resolveSubjectSemester(subject, termMap),
                                                              resolveSubjectAcademicYear(subject, termMap),
                                                          ]
                                                              .filter(Boolean)
                                                              .join(" • ") || "No direct term link"

                                                    return (
                                                        <div
                                                            key={subjectId}
                                                            className={
                                                                keepSelected
                                                                    ? "rounded-xl border border-primary bg-primary/5 p-3"
                                                                    : "rounded-xl border bg-background p-3"
                                                            }
                                                        >
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="min-w-0 flex-1 space-y-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="font-medium wrap-break-word">
                                                                            {buildSubjectDuplicateLabel(subject)}
                                                                        </div>
                                                                        <Badge variant={keepSelected ? "default" : "outline"}>
                                                                            {keepSelected ? "Keep" : "Delete"}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        College: {vm.collegeLabel(vm.colleges, (subject.departmentId as string | null) ?? null)}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Programs: {formatProgramScopeLabels(vm.programs, resolveSubjectProgramIds(subject)).join(", ") || "—"}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Year levels: {formatYearLevelScopeLabels(resolveSubjectYearLevels(subject)).join(", ") || "—"}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Semester / Term: {termLabel}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Units: {subject.units} • Lec {subject.lectureHours} • Lab {subject.labHours}
                                                                    </div>
                                                                </div>

                                                                <Button
                                                                    type="button"
                                                                    variant={keepSelected ? "default" : "outline"}
                                                                    size="sm"
                                                                    className={compactInlineButtonClassName}
                                                                    onClick={() =>
                                                                        setSubjectMergeKeepByGroup((current) => ({
                                                                            ...current,
                                                                            [group.key]: subjectId,
                                                                        }))
                                                                    }
                                                                    disabled={pendingSubjectActionBusy}
                                                                >
                                                                    {keepSelected ? "Keeping" : "Keep This"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    ) : null}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pendingSubjectActionBusy}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void handleConfirmPendingSubjectAction()}
                            disabled={pendingSubjectActionBusy}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {pendingSubjectActionBusy ? (
                                <span className="inline-flex items-center gap-2 text-white">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </span>
                            ) : pendingSubjectAction ? (
                                `Delete Duplicates (${pendingSubjectAction.duplicateCount})`
                            ) : (
                                "Delete Duplicates"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={Boolean(selectedSubjectDetail)}
                onOpenChange={(open) => {
                    if (!open) setSelectedSubjectDetail(null)
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedSubjectDetail
                                ? `${selectedSubjectDetail.code} — ${selectedSubjectDetail.title}`
                                : "Subject Details"}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedSubjectDetail ? (
                        <div className="grid gap-3 text-sm">
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Subject Code</div>
                                <div className="font-medium">{selectedSubjectDetail.code || "—"}</div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Subject Title</div>
                                <div>{selectedSubjectDetail.title || "—"}</div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">College</div>
                                <div>
                                    {vm.collegeLabel(
                                        vm.colleges,
                                        (selectedSubjectDetail.departmentId as string | null) ?? null
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Programs</div>
                                <div className="flex flex-wrap gap-1">
                                    {selectedSubjectDetailProgramLabels.length === 0 ? (
                                        <span>—</span>
                                    ) : (
                                        selectedSubjectDetailProgramLabels.map((label) => (
                                            <Badge key={label} variant="outline">{label}</Badge>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Year Levels</div>
                                <div>{selectedSubjectDetailYearLevels.join(", ") || "—"}</div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Semester</div>
                                <div>
                                    <Badge variant={selectedSubjectDetailLinkedTermId ? "secondary" : "outline"}>
                                        {selectedSubjectDetailSemesterLabel}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Term</div>
                                <div className="text-muted-foreground">{selectedSubjectDetailTermLabel}</div>
                            </div>

                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Units / Hours</div>
                                <div className="text-muted-foreground">
                                    Units: <span className="font-medium text-foreground">{selectedSubjectDetail.units ?? "—"}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    Lec {selectedSubjectDetail.lectureHours ?? 0} / Lab {selectedSubjectDetail.labHours ?? 0} = <span className="font-medium text-foreground">{selectedSubjectDetailTotalHours}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSelectedSubjectDetail(null)}
                        >
                            Close
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!selectedSubjectDetail) return
                                vm.setSubjectEditing(selectedSubjectDetail as any)
                                vm.setSubjectOpen(true)
                                setSelectedSubjectDetail(null)
                            }}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (!selectedSubjectDetail) return
                                vm.setDeleteIntent({
                                    type: "subject",
                                    doc: selectedSubjectDetail as any,
                                })
                                setSelectedSubjectDetail(null)
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkCollegeOpen} onOpenChange={handleBulkCollegeOpenChange}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Visible Subject Scope</DialogTitle>
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
                                    <label className="text-sm font-medium">Academic Term</label>
                                    <Select value={bulkCollegeTermId} onValueChange={setBulkCollegeTermId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Academic Term" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bulkCollegeTermOptions.length === 0 ? (
                                                <SelectItem value="__no_term_options__" disabled>
                                                    No academic terms available
                                                </SelectItem>
                                            ) : (
                                                bulkCollegeTermOptions.map((term) => (
                                                    <SelectItem key={term.$id} value={term.$id}>
                                                        {vm.termLabel(vm.terms, term.$id)}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-sm font-medium">Programs</label>
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
                                </div>
                                <ScrollArea className="h-44 rounded-md border">
                                    <div className="space-y-2 p-3">
                                        {bulkCollegeProgramIds.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                Select at least one program first to load real year levels from Sections.
                                            </div>
                                        ) : bulkCollegeYearLevelOptions.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                No year levels were found in Sections for the selected program filter.
                                            </div>
                                        ) : (
                                            bulkCollegeYearLevelOptions.map((option) => {
                                                const checked = bulkCollegeYearLevels.includes(option.value)
                                                return (
                                                    <label
                                                        key={option.value}
                                                        htmlFor={`bulk-college-year-${option.value}`}
                                                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition hover:bg-muted/40"
                                                    >
                                                        <Checkbox
                                                            id={`bulk-college-year-${option.value}`}
                                                            checked={checked}
                                                            onCheckedChange={(value) => {
                                                                const nextChecked = Boolean(value)
                                                                setBulkCollegeYearLevels((current) => {
                                                                    if (nextChecked) {
                                                                        return current.includes(option.value)
                                                                            ? current
                                                                            : [...current, option.value]
                                                                    }
                                                                    return current.filter((item) => item !== option.value)
                                                                })
                                                            }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium">{option.label}</div>
                                                            <div className="wrap-break-word text-xs text-muted-foreground">
                                                                {option.sectionLabels.join(", ") || "No matching section label"}
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {option.sectionCount} section{option.sectionCount === 1 ? "" : "s"}
                                                        </span>
                                                    </label>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                                <div className="text-xs text-muted-foreground">
                                    Loaded directly from {bulkCollegeFilteredSections.length} matching section record{bulkCollegeFilteredSections.length === 1 ? "" : "s"}. Each option stores the subject scope as a year number while showing the real section labels from Sections.
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
                                                        Academic Term:{" "}
                                                        {resolveSubjectTermId(subject)
                                                            ? vm.termLabel(vm.terms, resolveSubjectTermId(subject))
                                                            : resolveSubjectSemester(subject, termMap) || INHERIT_SEMESTER_LABEL}
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
                                !bulkCollegeTermId ||
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
                            {bulkTermActionMode === "transfer"
                                ? "Transfer Subjects to Another Term"
                                : isSingleSubjectLinkMode
                                    ? "Link Subject to Semester"
                                    : "Edit Subject Semester Links"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Semester</label>
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
                                            No matching semesters found
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
                                        className={compactInlineButtonClassName}
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
                                        className={compactInlineButtonClassName}
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
                                        No subjects match the selected semester scope.
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
                            className={compactActionButtonClassName}
                            onClick={() => handleBulkLinkOpenChange(false)}
                            disabled={bulkLinking}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className={compactActionButtonClassName}
                            onClick={() => void (bulkTermActionMode === "transfer" ? transferSelectedSubjectsToTerm() : linkSelectedSubjectsToTerm())}
                            disabled={
                                bulkLinking ||
                                !bulkLinkTermId ||
                                bulkLinkSubjectIds.length === 0
                            }
                        >
                            {bulkLinking
                                ? bulkTermActionMode === "transfer"
                                    ? "Transferring..."
                                    : "Saving..."
                                : bulkTermActionMode === "transfer"
                                    ? "Transfer Selected"
                                    : "Save Term Links"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    )
}