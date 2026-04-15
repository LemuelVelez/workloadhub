"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Link2, Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

type SectionGroup = {
    key: string
    label: string
    scopeSummary: string
    sections: any[]
    uniqueSubjectIds: string[]
    linkedSubjects: any[]
    inheritedSubjectCount: number
    representative: any
}

type PendingSectionAction =
    | { kind: "unlink"; sectionIds: string[]; label: string; count: number }
    | { kind: "mergeSections"; groupKeys: string[]; groupCount: number; duplicateCount: number }
    | { kind: "mergeSubjects"; groupCount: number; duplicateCount: number }

function uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value ?? "").trim())
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

function normalizeSectionYearLevelValue(value?: string | number | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function normalizeSectionNameValue(value?: string | null) {
    return String(value ?? "").trim().toUpperCase()
}

function normalizeSubjectCode(value?: string | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function normalizeSubjectTitle(value?: string | null) {
    return String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
}

function resolveProgramPrefix(vm: MasterDataManagementVM, programId?: string | null) {
    const normalizedProgramId = String(programId ?? "").trim()
    if (!normalizedProgramId) return ""

    const program = vm.programs.find((item) => String(item.$id) === normalizedProgramId)
    const normalizedCode = normalizeProgramCode(program?.code)

    if (!normalizedCode) return ""
    if (normalizedCode === "CS" || normalizedCode === "BSCS" || normalizedCode.endsWith("CS")) {
        return "CS"
    }
    if (normalizedCode === "IS" || normalizedCode === "BSIS" || normalizedCode.endsWith("IS")) {
        return "IS"
    }

    return ""
}

function buildStoredSectionYearLevel(
    vm: MasterDataManagementVM,
    value?: string | number | null,
    programId?: string | null
) {
    const normalizedYearLevel = normalizeSectionYearLevelValue(value)
    const yearNumber = normalizedYearLevel.match(/([1-9]\d*)$/)?.[1] ?? normalizedYearLevel
    const programPrefix = resolveProgramPrefix(vm, programId ?? null)

    if (!normalizedYearLevel) return ""
    if (!yearNumber) return normalizedYearLevel
    if (!programPrefix) return normalizedYearLevel
    if (normalizedYearLevel.startsWith(`${programPrefix} `)) return normalizedYearLevel

    return `${programPrefix} ${yearNumber}`
}

function buildSectionDisplayLabel(
    vm: MasterDataManagementVM,
    section: {
        yearLevel?: string | number | null
        name?: string | null
        programId?: string | null
    }
) {
    const normalizedYearLevel = normalizeSectionYearLevelValue(section.yearLevel)
    const normalizedName = normalizeSectionNameValue(section.name)
    const yearNumber = normalizedYearLevel.match(/([1-9]\d*)$/)?.[1] ?? normalizedYearLevel
    const programPrefix = resolveProgramPrefix(vm, section.programId ?? null)

    const displayYearLevel =
        normalizedYearLevel && programPrefix && !normalizedYearLevel.startsWith(`${programPrefix} `)
            ? `${programPrefix} ${yearNumber}`
            : normalizedYearLevel

    if (!displayYearLevel && !normalizedName) return "—"
    if (!displayYearLevel) return normalizedName
    if (!normalizedName) return displayYearLevel

    return `${displayYearLevel} - ${normalizedName}`
}

function extractSectionYearNumber(value?: string | number | null) {
    const normalized = normalizeSectionYearLevelValue(value)
    if (!normalized) return ""

    const direct = normalized.match(/^([1-9]\d*)$/)
    if (direct) return direct[1]

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/)
    if (prefixed) return prefixed[1]

    const trailing = normalized.match(/(?:^|[\s-])([1-9]\d*)$/)
    return trailing?.[1] ?? ""
}

function resolveSectionSubjectIds(section: { subjectId?: string | null; subjectIds?: string[] | string | null }) {
    const values = Array.isArray(section.subjectIds)
        ? section.subjectIds
        : typeof section.subjectIds === "string"
            ? section.subjectIds.split(",")
            : []

    const normalized = values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)

    if (normalized.length > 0) return Array.from(new Set(normalized))

    const fallback = String(section.subjectId ?? "").trim()
    return fallback ? [fallback] : []
}

function resolveSubjectProgramIds(subject: { programId?: string | null; programIds?: string[] | string | null }) {
    const values = Array.isArray(subject.programIds)
        ? subject.programIds
        : typeof subject.programIds === "string"
            ? subject.programIds.split(",")
            : []

    const normalized = values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)

    if (normalized.length > 0) return Array.from(new Set(normalized))

    const fallback = String(subject.programId ?? "").trim()
    return fallback ? [fallback] : []
}

function resolveSubjectYearLevels(subject: { yearLevel?: string | number | null; yearLevels?: Array<string | number> | null }) {
    const values = Array.isArray(subject.yearLevels) ? subject.yearLevels : []

    const normalized = values
        .map((value) => extractSectionYearNumber(value) || normalizeSectionYearLevelValue(value))
        .filter(Boolean)

    if (normalized.length > 0) return Array.from(new Set(normalized))

    const fallback = extractSectionYearNumber(subject.yearLevel) || normalizeSectionYearLevelValue(subject.yearLevel)
    return fallback ? [fallback] : []
}

function subjectMatchesSectionScope(
    subject: {
        $id: string
        termId?: string | null
        departmentId?: string | null
        semester?: string | null
        programId?: string | null
        programIds?: string[] | null
        yearLevel?: string | number | null
        yearLevels?: Array<string | number> | null
    },
    section: {
        termId?: string | null
        departmentId?: string | null
        programId?: string | null
        yearLevel?: string | number | null
        semester?: string | null
    }
) {
    const sectionDepartmentId = String(section.departmentId ?? "").trim()
    const subjectDepartmentId = String(subject.departmentId ?? "").trim()
    if (sectionDepartmentId && subjectDepartmentId && sectionDepartmentId !== subjectDepartmentId) return false

    const sectionProgramId = String(section.programId ?? "").trim()
    const subjectProgramIds = resolveSubjectProgramIds(subject)
    if (sectionProgramId && subjectProgramIds.length > 0 && !subjectProgramIds.includes(sectionProgramId)) {
        return false
    }

    const sectionYearNumber = extractSectionYearNumber(section.yearLevel)
    const subjectYearLevels = resolveSubjectYearLevels(subject)
    if (sectionYearNumber && subjectYearLevels.length > 0 && !subjectYearLevels.includes(sectionYearNumber)) {
        return false
    }

    return true
}

function buildSectionSubjectSummary(vm: MasterDataManagementVM, section: { subjectId?: string | null; subjectIds?: string[] | null }) {
    const labels = resolveSectionSubjectIds(section)
        .map((subjectId) => vm.subjects.find((subject) => subject.$id === subjectId))
        .filter(Boolean)
        .map((subject) => `${subject?.code} — ${subject?.title}`)

    return labels.length > 0 ? labels.join(", ") : "—"
}

function formatSectionBulkEditError(error: any) {
    const message = String(error?.message ?? "").trim()

    if (message && /subjectids/i.test(message) && /(attribute|column|schema|unknown|invalid)/i.test(message)) {
        return "Backend is missing sections.subjectIds. Run migration 013_add_section_subject_ids."
    }

    return message || "Update failed."
}

function normalizeSectionCoverageLabel(value?: string | null) {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim()

    if (!normalized) return ""
    if (/^(?:—|-|–|n\/a|na|null|none)$/i.test(normalized)) return ""

    return normalized
}

function resolveSectionReferenceTermLabel(vm: MasterDataManagementVM, section: any) {
    return (
        normalizeSectionCoverageLabel(section?.academicTermLabel) ||
        normalizeSectionCoverageLabel(vm.termLabel(vm.terms, section?.termId)) ||
        "All Academic Terms"
    )
}

function resolveSubjectTermId(subject?: any) {
    return String(subject?.termId ?? "").trim()
}

function buildSectionDuplicateScopeKey(vm: MasterDataManagementVM, section: any) {
    return buildSectionDisplayLabel(vm, section)
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase()
}

function buildSectionGroupKey(vm: MasterDataManagementVM, section: any) {
    return buildSectionDuplicateScopeKey(vm, section)
}

function getPreferredStringValue(values: Array<string | null | undefined>) {
    const counts = new Map<string, number>()

    for (const value of values) {
        const normalized = String(value ?? "").trim()
        if (!normalized) continue
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }

    return Array.from(counts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1]
            return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" })
        })[0]?.[0] ?? ""
}

function buildSectionGroupScopeSummary(vm: MasterDataManagementVM, sections: any[]) {
    const collegeLabels = uniqueStrings(
        sections.map((section) => {
            const label = String(vm.collegeLabel(vm.colleges, section?.departmentId) ?? "").trim()
            return /^(?:—|-|–|unknown)$/i.test(label) ? "" : label
        })
    )
    const programLabels = uniqueStrings(
        sections.map((section) => {
            const label = String(vm.programLabel(vm.programs, section?.programId ?? null) ?? "").trim()
            return /^(?:—|-|–)$/i.test(label) ? "" : label
        })
    )

    if (collegeLabels.length <= 1 && programLabels.length <= 1) {
        return [collegeLabels[0], programLabels[0]].filter(Boolean).join(" • ") || "Scope not set"
    }

    const collegeSummary = collegeLabels.length === 0 ? null : collegeLabels.length === 1 ? collegeLabels[0] : `${collegeLabels.length} colleges`
    const programSummary = programLabels.length === 0 ? null : programLabels.length === 1 ? programLabels[0] : `${programLabels.length} programs`

    return [collegeSummary, programSummary].filter(Boolean).join(" • ") || "Scope not set"
}

function buildSubjectDuplicateKey(subject: any) {
    return [
        String(subject.departmentId ?? "").trim(),
        normalizeSubjectCode(subject.code),
        normalizeSubjectTitle(subject.title),
    ].join("::")
}

function compareByCreatedAt(a: any, b: any) {
    const aTime = Date.parse(String(a?.$createdAt ?? "")) || 0
    const bTime = Date.parse(String(b?.$createdAt ?? "")) || 0
    if (aTime !== bTime) return aTime - bTime
    return String(a?.$id ?? "").localeCompare(String(b?.$id ?? ""))
}

function getCanonicalRecord(records: any[]) {
    return records.slice().sort(compareByCreatedAt)[0]
}

function getBestStudentCount(sections: any[]) {
    const counts = sections
        .map((section) => (section?.studentCount == null ? null : Number(section.studentCount)))
        .filter((value) => Number.isFinite(value)) as number[]

    if (counts.length === 0) return null
    return Math.max(...counts)
}

function buildMergedSectionPayload(vm: MasterDataManagementVM, sections: any[], canonical: any) {
    const mergedSubjectIds = uniqueStrings(sections.flatMap((section) => resolveSectionSubjectIds(section)))
    const mergedDepartmentId =
        getPreferredStringValue(sections.map((section) => String(section?.departmentId ?? "").trim())) || null
    const mergedProgramId =
        getPreferredStringValue(sections.map((section) => String(section?.programId ?? "").trim())) || null
    const mergedYearLevel =
        buildStoredSectionYearLevel(vm, canonical?.yearLevel, mergedProgramId) ||
        buildStoredSectionYearLevel(vm, sections[0]?.yearLevel, mergedProgramId) ||
        normalizeSectionYearLevelValue(canonical?.yearLevel) ||
        normalizeSectionYearLevelValue(sections[0]?.yearLevel)

    return {
        departmentId: mergedDepartmentId,
        programId: mergedProgramId,
        subjectId: mergedSubjectIds[0] ?? null,
        subjectIds: mergedSubjectIds,
        yearLevel: mergedYearLevel,
        name: normalizeSectionNameValue(canonical?.name ?? sections[0]?.name),
        studentCount: getBestStudentCount(sections),
        isActive: sections.some((section) => Boolean(section?.isActive)),
    }
}

function buildMergedSubjectPayload(subjects: any[], canonical: any) {
    const mergedProgramIds = uniqueStrings(subjects.flatMap((subject) => resolveSubjectProgramIds(subject)))
    const mergedYearLevels = uniqueStrings(subjects.flatMap((subject) => resolveSubjectYearLevels(subject)))
    const canonicalYearLevel =
        extractSectionYearNumber(canonical?.yearLevel) || normalizeSectionYearLevelValue(canonical?.yearLevel) || mergedYearLevels[0] || null

    const bestUnits =
        subjects.find((subject) => Number.isFinite(Number(subject?.units)))?.units ??
        canonical?.units ??
        0
    const bestLectureHours =
        subjects.find((subject) => Number.isFinite(Number(subject?.lectureHours)))?.lectureHours ??
        canonical?.lectureHours ??
        0
    const bestLabHours =
        subjects.find((subject) => Number.isFinite(Number(subject?.labHours)))?.labHours ??
        canonical?.labHours ??
        0
    const bestSemester =
        uniqueStrings(subjects.map((subject) => String(subject?.semester ?? "").trim()))[0] || null

    return {
        departmentId: String(canonical?.departmentId ?? subjects[0]?.departmentId ?? "").trim() || null,
        programId: mergedProgramIds[0] ?? null,
        programIds: mergedProgramIds,
        yearLevel: canonicalYearLevel,
        yearLevels: mergedYearLevels,
        termId: null,
        semester: bestSemester,
        code: String(canonical?.code ?? subjects[0]?.code ?? "").trim(),
        title: String(canonical?.title ?? subjects[0]?.title ?? "").trim(),
        units: Number(bestUnits) || 0,
        lectureHours: Number(bestLectureHours) || 0,
        labHours: Number(bestLabHours) || 0,
        totalHours: (Number(bestLectureHours) || 0) + (Number(bestLabHours) || 0),
        isActive: subjects.some((subject) => Boolean(subject?.isActive)),
    }
}

export function MasterDataSectionsTab({ vm }: Props) {
    const [selectedSectionIds, setSelectedSectionIds] = React.useState<string[]>([])
    const [scopeEditOpen, setScopeEditOpen] = React.useState(false)
    const [scopeEditProgramId, setScopeEditProgramId] = React.useState("__keep__")
    const [scopeEditStudentCount, setScopeEditStudentCount] = React.useState("")
    const [scopeEditActive, setScopeEditActive] = React.useState("__keep__")
    const [scopeEditSubjectIds, setScopeEditSubjectIds] = React.useState<string[]>([])
    const [scopeEditing, setScopeEditing] = React.useState(false)

    const [linkDialogOpen, setLinkDialogOpen] = React.useState(false)
    const [linkDialogTitle, setLinkDialogTitle] = React.useState("Linked Subjects")
    const [linkDialogDescription, setLinkDialogDescription] = React.useState("")
    const [linkTargetSectionIds, setLinkTargetSectionIds] = React.useState<string[]>([])
    const [linkSelectedSubjectIds, setLinkSelectedSubjectIds] = React.useState<string[]>([])
    const [linkUpdating, setLinkUpdating] = React.useState(false)

    const [selectedSectionDetail, setSelectedSectionDetail] = React.useState<SectionGroup | null>(null)

    const [subjectViewerOpen, setSubjectViewerOpen] = React.useState(false)
    const [subjectViewerTitle, setSubjectViewerTitle] = React.useState("Linked Subjects")
    const [subjectViewerDescription, setSubjectViewerDescription] = React.useState("")
    const [subjectViewerSubjects, setSubjectViewerSubjects] = React.useState<any[]>([])

    const [sectionDedupeBusy, setSectionDedupeBusy] = React.useState(false)
    const [subjectDedupeBusy, setSubjectDedupeBusy] = React.useState(false)
    const [pendingSectionAction, setPendingSectionAction] = React.useState<PendingSectionAction | null>(null)
    const [pendingSectionActionSubmitting, setPendingSectionActionSubmitting] = React.useState(false)
    const [sectionMergeKeepByGroup, setSectionMergeKeepByGroup] = React.useState<Record<string, string>>({})

    const compactActionButtonClassName = "h-8 w-full justify-center px-2 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
    const compactInlineButtonClassName = "h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
    const wrappingBadgeClassName = "h-auto max-w-full whitespace-normal break-words px-2 py-1 text-center leading-4"

    const sortedSections = React.useMemo(
        () =>
            vm.filteredSections
                .slice()
                .sort((a, b) => {
                    const left = `${a.departmentId}-${a.programId ?? ""}-${a.yearLevel}-${a.name}`
                    const right = `${b.departmentId}-${b.programId ?? ""}-${b.yearLevel}-${b.name}`
                    return left.localeCompare(right)
                }),
        [vm.filteredSections]
    )

    const visibleSectionIdSet = React.useMemo(
        () => new Set(sortedSections.map((section) => String(section.$id))),
        [sortedSections]
    )

    React.useEffect(() => {
        setSelectedSectionIds((current) => current.filter((sectionId) => visibleSectionIdSet.has(sectionId)))
    }, [visibleSectionIdSet])

    const visibleGroups = React.useMemo<SectionGroup[]>(() => {
        const grouped = new Map<string, any[]>()

        for (const section of sortedSections) {
            const key = buildSectionGroupKey(vm, section)
            const current = grouped.get(key) || []
            current.push(section)
            grouped.set(key, current)
        }

        return Array.from(grouped.entries())
            .map(([key, sections]) => {
                const representative = getCanonicalRecord(sections)
                const uniqueSubjectIds = uniqueStrings(sections.flatMap((section) => resolveSectionSubjectIds(section)))
                const linkedSubjects = uniqueSubjectIds
                    .map((subjectId) => vm.subjects.find((subject) => subject.$id === subjectId))
                    .filter(Boolean)
                    .sort((a, b) => `${a?.code} ${a?.title}`.localeCompare(`${b?.code} ${b?.title}`))
                const inheritedSubjectCount = linkedSubjects.filter((subject) => !resolveSubjectTermId(subject)).length
                return {
                    key,
                    label: buildSectionDisplayLabel(vm, representative),
                    scopeSummary: buildSectionGroupScopeSummary(vm, sections),
                    sections,
                    uniqueSubjectIds,
                    linkedSubjects,
                    inheritedSubjectCount,
                    representative,
                }
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
    }, [sortedSections, vm])

    const allSectionGroups = React.useMemo<SectionGroup[]>(() => {
        const grouped = new Map<string, any[]>()

        for (const section of vm.sections) {
            const key = buildSectionGroupKey(vm, section)
            const current = grouped.get(key) || []
            current.push(section)
            grouped.set(key, current)
        }

        return Array.from(grouped.entries())
            .map(([key, sections]) => {
                const representative = getCanonicalRecord(sections)
                const uniqueSubjectIds = uniqueStrings(sections.flatMap((section) => resolveSectionSubjectIds(section)))
                const linkedSubjects = uniqueSubjectIds
                    .map((subjectId) => vm.subjects.find((subject) => subject.$id === subjectId))
                    .filter(Boolean)
                    .sort((a, b) => `${a?.code} ${a?.title}`.localeCompare(`${b?.code} ${b?.title}`))
                const inheritedSubjectCount = linkedSubjects.filter((subject) => !resolveSubjectTermId(subject)).length

                return {
                    key,
                    label: buildSectionDisplayLabel(vm, representative),
                    scopeSummary: buildSectionGroupScopeSummary(vm, sections),
                    sections,
                    uniqueSubjectIds,
                    linkedSubjects,
                    inheritedSubjectCount,
                    representative,
                }
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
    }, [vm])

    const allDuplicateSectionGroups = React.useMemo(
        () => allSectionGroups.filter((group) => group.sections.length > 1),
        [allSectionGroups]
    )

    const pendingMergeSectionGroups = React.useMemo(
        () =>
            pendingSectionAction?.kind === "mergeSections"
                ? allSectionGroups.filter((group) => pendingSectionAction.groupKeys.includes(group.key))
                : [],
        [allSectionGroups, pendingSectionAction]
    )

    const pendingSectionActionBusy = pendingSectionActionSubmitting || linkUpdating || sectionDedupeBusy || subjectDedupeBusy

    const duplicateSubjectGroups = React.useMemo(() => {
        const grouped = new Map<string, any[]>()

        for (const subject of vm.subjects) {
            const key = buildSubjectDuplicateKey(subject)
            const current = grouped.get(key) || []
            current.push(subject)
            grouped.set(key, current)
        }

        return Array.from(grouped.values())
            .filter((group) => group.length > 1)
            .sort((a, b) => {
                const left = `${a[0]?.code ?? ""} ${a[0]?.title ?? ""}`
                const right = `${b[0]?.code ?? ""} ${b[0]?.title ?? ""}`
                return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
            })
    }, [vm.subjects])

    const selectedSectionIdSet = React.useMemo(
        () => new Set(selectedSectionIds),
        [selectedSectionIds]
    )

    const selectedVisibleSections = React.useMemo(
        () => sortedSections.filter((section) => selectedSectionIdSet.has(String(section.$id))),
        [selectedSectionIdSet, sortedSections]
    )

    const scopeEditTargetSections = React.useMemo(
        () => (selectedVisibleSections.length > 0 ? selectedVisibleSections : sortedSections),
        [selectedVisibleSections, sortedSections]
    )

    const scopeEditTargetIds = React.useMemo(
        () => scopeEditTargetSections.map((section) => String(section.$id)),
        [scopeEditTargetSections]
    )

    const scopeEditProgramOptions = React.useMemo(() => {
        const departmentIds = uniqueStrings(scopeEditTargetSections.map((section) => String(section.departmentId ?? "").trim()))
        if (departmentIds.length === 0) return vm.programs

        return vm.programs.filter((program) => departmentIds.includes(String(program.departmentId ?? "").trim()))
    }, [scopeEditTargetSections, vm.programs])

    const scopeEditSubjectOptions = React.useMemo(() => {
        if (scopeEditTargetSections.length === 0) return []

        return vm.subjects
            .filter((subject) =>
                scopeEditTargetSections.some((section) =>
                    subjectMatchesSectionScope(subject, {
                        termId: section.termId,
                        departmentId: section.departmentId,
                        programId: section.programId ?? null,
                        yearLevel: section.yearLevel,
                        semester: section.semester ?? null,
                    })
                )
            )
            .slice()
            .sort((a, b) => `${a.code} ${a.title}`.localeCompare(`${b.code} ${b.title}`))
    }, [scopeEditTargetSections, vm.subjects])

    const linkTargetSections = React.useMemo(
        () =>
            linkTargetSectionIds
                .map((sectionId) => vm.sections.find((section) => String(section.$id) === sectionId))
                .filter(Boolean) as any[],
        [linkTargetSectionIds, vm.sections]
    )

    const linkSubjectOptions = React.useMemo(() => {
        if (linkTargetSections.length === 0) return []

        return vm.subjects
            .filter((subject) =>
                linkTargetSections.some((section) =>
                    subjectMatchesSectionScope(subject, {
                        termId: section.termId,
                        departmentId: section.departmentId,
                        programId: section.programId ?? null,
                        yearLevel: section.yearLevel,
                        semester: section.semester ?? null,
                    })
                )
            )
            .slice()
            .sort((a, b) => `${a.code} ${a.title}`.localeCompare(`${b.code} ${b.title}`))
    }, [linkTargetSections, vm.subjects])

    const allVisibleSelected = sortedSections.length > 0 && selectedSectionIds.length === sortedSections.length
    const someVisibleSelected = selectedSectionIds.length > 0 && !allVisibleSelected

    const toggleVisibleSelection = React.useCallback((checked: boolean) => {
        setSelectedSectionIds(checked ? sortedSections.map((section) => String(section.$id)) : [])
    }, [sortedSections])

    const openScopeEditDialog = React.useCallback(() => {
        setScopeEditProgramId("__keep__")
        setScopeEditStudentCount("")
        setScopeEditActive("__keep__")
        setScopeEditSubjectIds([])
        setScopeEditOpen(true)
    }, [])

    const handleScopeEditOpenChange = React.useCallback((nextOpen: boolean) => {
        setScopeEditOpen(nextOpen)
        if (!nextOpen) {
            setScopeEditProgramId("__keep__")
            setScopeEditStudentCount("")
            setScopeEditActive("__keep__")
            setScopeEditSubjectIds([])
        }
    }, [])

    const saveScopeEdit = React.useCallback(async () => {
        const targetIds = Array.from(new Set(scopeEditTargetIds))
        const hasProgramChange = scopeEditProgramId !== "__keep__"
        const hasStudentCountChange = scopeEditStudentCount.trim() !== ""
        const hasActiveChange = scopeEditActive !== "__keep__"
        const normalizedSubjectIds = uniqueStrings(scopeEditSubjectIds)
        const hasSubjectChange = normalizedSubjectIds.length > 0

        if (!hasProgramChange && !hasStudentCountChange && !hasActiveChange && !hasSubjectChange) {
            toast.error("Choose a program, linked subjects, active state, or student count.")
            return
        }

        if (targetIds.length === 0) {
            toast.error("No visible sections are available for editing.")
            return
        }

        const numericStudentCount =
            scopeEditStudentCount.trim() === ""
                ? null
                : Number(scopeEditStudentCount)

        if (
            hasStudentCountChange &&
            (!Number.isFinite(numericStudentCount) || Number(numericStudentCount) < 0)
        ) {
            toast.error("Student count must be a valid non-negative number.")
            return
        }

        setScopeEditing(true)
        try {
            let updated = 0
            const failed: string[] = []

            for (const sectionId of targetIds) {
                const section = vm.sections.find((item) => String(item.$id) === sectionId)
                if (!section) {
                    failed.push(sectionId)
                    continue
                }

                const payload: Record<string, unknown> = {}
                const nextProgramId =
                    hasProgramChange
                        ? scopeEditProgramId === "__none__"
                            ? null
                            : scopeEditProgramId
                        : (section.programId ?? null)

                if (hasProgramChange) {
                    payload.programId = nextProgramId
                    payload.yearLevel =
                        buildStoredSectionYearLevel(vm, section.yearLevel, nextProgramId) ||
                        normalizeSectionYearLevelValue(section.yearLevel)
                }


                if (hasStudentCountChange) {
                    payload.studentCount = numericStudentCount
                }

                if (hasActiveChange) {
                    payload.isActive = scopeEditActive === "yes"
                }

                if (hasSubjectChange) {
                    payload.subjectId = normalizedSubjectIds[0] ?? null
                    payload.subjectIds = normalizedSubjectIds
                }

                try {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionId, payload)
                    updated += 1
                } catch (error: any) {
                    failed.push(`${buildSectionDisplayLabel(vm, section)} (${formatSectionBulkEditError(error)})`)
                }
            }

            if (updated > 0) {
                await vm.refreshAll()
            }

            if (updated > 0 && failed.length === 0) {
                toast.success(`${updated} section${updated === 1 ? "" : "s"} updated.`)
                handleScopeEditOpenChange(false)
                return
            }

            if (updated > 0) {
                toast.error(`Updated ${updated} section${updated === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`)
                return
            }

            toast.error(failed.length > 0 ? `Failed to update selected sections: ${failed.join(", ")}` : "No sections were updated.")
        } finally {
            setScopeEditing(false)
        }
    }, [
        handleScopeEditOpenChange,
        scopeEditActive,
        scopeEditProgramId,
        scopeEditStudentCount,
        scopeEditSubjectIds,
        scopeEditTargetIds,
        vm,
    ])

    const openLinkDialog = React.useCallback((config: { title: string; description: string; sectionIds: string[]; initialSubjectIds?: string[] }) => {
        setLinkDialogTitle(config.title)
        setLinkDialogDescription(config.description)
        setLinkTargetSectionIds(uniqueStrings(config.sectionIds))
        setLinkSelectedSubjectIds(uniqueStrings(config.initialSubjectIds ?? []))
        setLinkDialogOpen(true)
    }, [])

    const openSelectedLinkDialog = React.useCallback(() => {
        if (scopeEditTargetSections.length === 0) {
            toast.error("No visible sections are available.")
            return
        }

        openLinkDialog({
            title: selectedVisibleSections.length > 0 ? "Edit Selected Section Links" : "Edit Visible Section Links",
            description:
                selectedVisibleSections.length > 0
                    ? "Update linked subjects for the selected visible sections across all academic terms."
                    : "Update linked subjects for all visible sections across all academic terms.",
            sectionIds: scopeEditTargetIds,
            initialSubjectIds: uniqueStrings(scopeEditTargetSections.flatMap((section) => resolveSectionSubjectIds(section))),
        })
    }, [openLinkDialog, scopeEditTargetIds, scopeEditTargetSections, selectedVisibleSections.length])

    const saveLinkDialog = React.useCallback(async () => {
        const targetIds = uniqueStrings(linkTargetSectionIds)
        const normalizedSubjectIds = uniqueStrings(linkSelectedSubjectIds)

        if (targetIds.length === 0) {
            toast.error("No sections selected for link editing.")
            return
        }
        if (normalizedSubjectIds.length === 0) {
            toast.error("Select at least one linked subject or use Unlink Group.")
            return
        }

        setLinkUpdating(true)
        try {
            let updated = 0
            const failed: string[] = []

            for (const sectionId of targetIds) {
                const section = vm.sections.find((item) => String(item.$id) === sectionId)
                if (!section) {
                    failed.push(sectionId)
                    continue
                }

                try {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionId, {
                        subjectId: normalizedSubjectIds[0] ?? null,
                        subjectIds: normalizedSubjectIds,
                    })
                    updated += 1
                } catch (error: any) {
                    failed.push(`${buildSectionDisplayLabel(vm, section)} (${formatSectionBulkEditError(error)})`)
                }
            }

            if (updated > 0) {
                await vm.refreshAll()
            }

            if (updated > 0 && failed.length === 0) {
                toast.success(`${updated} section${updated === 1 ? "" : "s"} updated.`)
                setLinkDialogOpen(false)
                return
            }

            if (updated > 0) {
                toast.error(`Updated ${updated} section${updated === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`)
                return
            }

            toast.error(failed.length > 0 ? `Failed to update linked subjects: ${failed.join(", ")}` : "No sections were updated.")
        } finally {
            setLinkUpdating(false)
        }
    }, [linkSelectedSubjectIds, linkTargetSectionIds, vm])

    const unlinkSectionIds = React.useCallback(async (sectionIds: string[], label: string) => {
        const targetIds = uniqueStrings(sectionIds)
        if (targetIds.length === 0) {
            toast.error("No sections selected.")
            return
        }

        setLinkUpdating(true)
        try {
            let updated = 0
            const failed: string[] = []

            for (const sectionId of targetIds) {
                const section = vm.sections.find((item) => String(item.$id) === sectionId)
                if (!section) {
                    failed.push(sectionId)
                    continue
                }

                try {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, sectionId, {
                        subjectId: null,
                        subjectIds: [],
                    })
                    updated += 1
                } catch (error: any) {
                    failed.push(`${buildSectionDisplayLabel(vm, section)} (${formatSectionBulkEditError(error)})`)
                }
            }

            if (updated > 0) {
                await vm.refreshAll()
            }

            if (updated > 0 && failed.length === 0) {
                toast.success(`Removed linked subjects from ${updated} section${updated === 1 ? "" : "s"}.`)
                return
            }

            if (updated > 0) {
                toast.error(`Updated ${updated} section${updated === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`)
                return
            }

            toast.error(failed.length > 0 ? `Failed to unlink sections from ${label}: ${failed.join(", ")}` : "No sections were updated.")
        } finally {
            setLinkUpdating(false)
        }
    }, [vm])


    const mergeSectionGroups = React.useCallback(async (groups: SectionGroup[], keepByGroup: Record<string, string> = {}) => {
        if (groups.length === 0) {
            toast.error("No duplicate reusable section groups found.")
            return
        }

        setSectionDedupeBusy(true)
        try {
            let mergedGroups = 0
            let deleted = 0
            let rewiredClasses = 0
            const failed: string[] = []

            for (const group of groups) {
                const selectedKeepId = String(keepByGroup[group.key] ?? "").trim()
                const canonical =
                    group.sections.find((section) => String(section.$id) === selectedKeepId) ??
                    getCanonicalRecord(group.sections)
                const duplicates = group.sections.filter((section) => String(section.$id) !== String(canonical.$id))
                if (duplicates.length === 0) continue

                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SECTIONS,
                        canonical.$id,
                        buildMergedSectionPayload(vm, group.sections, canonical)
                    )

                    for (const duplicate of duplicates) {
                        const referencingClasses = vm.classes.filter((classDoc) => String(classDoc.sectionId ?? "").trim() === String(duplicate.$id))

                        for (const classDoc of referencingClasses) {
                            await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASSES, classDoc.$id, {
                                sectionId: canonical.$id,
                            })
                            rewiredClasses += 1
                        }

                        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, duplicate.$id)
                        deleted += 1
                    }

                    mergedGroups += 1
                } catch (error: any) {
                    failed.push(`${group.label} (${formatSectionBulkEditError(error)})`)
                }
            }

            if (mergedGroups > 0) {
                await vm.refreshAll()
                setSelectedSectionIds([])
            }

            if (mergedGroups > 0 && failed.length === 0) {
                toast.success(`Merged ${mergedGroups} duplicate section group${mergedGroups === 1 ? "" : "s"}, deleted ${deleted} duplicate record${deleted === 1 ? "" : "s"}, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`)
                return
            }

            if (mergedGroups > 0) {
                toast.error(`Merged ${mergedGroups} section group${mergedGroups === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`)
                return
            }

            toast.error(failed.length > 0 ? `Failed to merge duplicate sections: ${failed.join(", ")}` : "No duplicate sections were merged.")
        } finally {
            setSectionDedupeBusy(false)
        }
    }, [vm])

    const requestMergeSectionGroups = React.useCallback((groups: SectionGroup[]) => {
        if (groups.length === 0) {
            toast.error("No duplicate reusable section groups found.")
            return
        }

        const duplicateCount = groups.reduce((count, group) => count + Math.max(group.sections.length - 1, 0), 0)
        setSectionMergeKeepByGroup(
            Object.fromEntries(
                groups.map((group) => [group.key, String(getCanonicalRecord(group.sections)?.$id ?? "")])
            )
        )
        setPendingSectionAction({
            kind: "mergeSections",
            groupKeys: groups.map((group) => group.key),
            groupCount: groups.length,
            duplicateCount,
        })
    }, [])

    const mergeDuplicateSubjects = React.useCallback(async () => {
        if (duplicateSubjectGroups.length === 0) {
            toast.error("No duplicate subjects found.")
            return
        }

        setSubjectDedupeBusy(true)
        try {
            let mergedGroups = 0
            let deleted = 0
            let rewiredSections = 0
            let rewiredClasses = 0
            const failed: string[] = []

            for (const group of duplicateSubjectGroups) {
                const canonical = getCanonicalRecord(group)
                const duplicates = group.filter((subject) => String(subject.$id) !== String(canonical.$id))
                const duplicateIdSet = new Set(duplicates.map((subject) => String(subject.$id)))
                if (duplicates.length === 0) continue

                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SUBJECTS,
                        canonical.$id,
                        buildMergedSubjectPayload(group, canonical)
                    )

                    const sectionsToRewire = vm.sections.filter((section) =>
                        resolveSectionSubjectIds(section).some((subjectId) => duplicateIdSet.has(subjectId))
                    )

                    for (const section of sectionsToRewire) {
                        const nextSubjectIds = uniqueStrings(
                            resolveSectionSubjectIds(section).map((subjectId) =>
                                duplicateIdSet.has(subjectId) ? canonical.$id : subjectId
                            )
                        )

                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, section.$id, {
                            subjectId: nextSubjectIds[0] ?? null,
                            subjectIds: nextSubjectIds,
                        })
                        rewiredSections += 1
                    }

                    const classesToRewire = vm.classes.filter((classDoc) => duplicateIdSet.has(String(classDoc.subjectId ?? "").trim()))
                    for (const classDoc of classesToRewire) {
                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASSES, classDoc.$id, {
                            subjectId: canonical.$id,
                        })
                        rewiredClasses += 1
                    }

                    for (const duplicate of duplicates) {
                        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, duplicate.$id)
                        deleted += 1
                    }

                    mergedGroups += 1
                } catch (error: any) {
                    failed.push(`${canonical.code} — ${canonical.title} (${String(error?.message ?? "Failed")})`)
                }
            }

            if (mergedGroups > 0) {
                await vm.refreshAll()
            }

            if (mergedGroups > 0 && failed.length === 0) {
                toast.success(`Merged ${mergedGroups} duplicate subject group${mergedGroups === 1 ? "" : "s"}, deleted ${deleted} duplicate record${deleted === 1 ? "" : "s"}, rewired ${rewiredSections} section reference${rewiredSections === 1 ? "" : "s"}, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`)
                return
            }

            if (mergedGroups > 0) {
                toast.error(`Merged ${mergedGroups} subject group${mergedGroups === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`)
                return
            }

            toast.error(failed.length > 0 ? `Failed to merge duplicate subjects: ${failed.join(", ")}` : "No duplicate subjects were merged.")
        } finally {
            setSubjectDedupeBusy(false)
        }
    }, [duplicateSubjectGroups, vm])

    const requestMergeDuplicateSubjects = React.useCallback(() => {
        if (duplicateSubjectGroups.length === 0) {
            toast.error("No duplicate subjects found.")
            return
        }

        const duplicateCount = duplicateSubjectGroups.reduce((count, group) => count + Math.max(group.length - 1, 0), 0)
        setPendingSectionAction({
            kind: "mergeSubjects",
            groupCount: duplicateSubjectGroups.length,
            duplicateCount,
        })
    }, [duplicateSubjectGroups])

    const handleConfirmPendingSectionAction = React.useCallback(async () => {
        if (!pendingSectionAction || pendingSectionActionSubmitting) return

        const action = pendingSectionAction
        setPendingSectionActionSubmitting(true)

        try {
            if (action.kind === "unlink") {
                await unlinkSectionIds(action.sectionIds, action.label)
                setPendingSectionAction(null)
                return
            }

            if (action.kind === "mergeSections") {
                const groups = allSectionGroups.filter((group) => action.groupKeys.includes(group.key))
                const normalizedKeepByGroup = Object.fromEntries(
                    groups.map((group) => {
                        const selectedKeepId = String(sectionMergeKeepByGroup[group.key] ?? "").trim()
                        const fallbackKeepId = String(getCanonicalRecord(group.sections)?.$id ?? "")
                        return [group.key, selectedKeepId || fallbackKeepId]
                    })
                )
                await mergeSectionGroups(groups, normalizedKeepByGroup)
                setSectionMergeKeepByGroup({})
                setPendingSectionAction(null)
                return
            }

            await mergeDuplicateSubjects()
            setPendingSectionAction(null)
        } finally {
            setPendingSectionActionSubmitting(false)
        }
    }, [allSectionGroups, mergeDuplicateSubjects, mergeSectionGroups, pendingSectionAction, pendingSectionActionSubmitting, sectionMergeKeepByGroup, unlinkSectionIds])
    const openSubjectViewer = React.useCallback((config: { title: string; description: string; subjects: any[] }) => {
        setSubjectViewerTitle(config.title)
        setSubjectViewerDescription(config.description)
        setSubjectViewerSubjects(config.subjects)
        setSubjectViewerOpen(true)
    }, [])

    const selectedSectionDetailTermLabels = React.useMemo(
        () =>
            selectedSectionDetail
                ? uniqueStrings(selectedSectionDetail.sections.map((section) => resolveSectionReferenceTermLabel(vm, section)))
                : [],
        [selectedSectionDetail, vm]
    )

    const selectedSectionDetailActiveCount = React.useMemo(
        () => (selectedSectionDetail ? selectedSectionDetail.sections.filter((section) => Boolean(section?.isActive)).length : 0),
        [selectedSectionDetail]
    )

    return (
        <TabsContent value="sections" className="space-y-4">
            <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                        <div className="font-medium">Sections</div>
                        <div className="text-sm text-muted-foreground">
                            Manage reusable section records that stay available across all academic terms. Use the group actions below for linked-subject updates and duplicate cleanup.
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className={compactActionButtonClassName}
                            onClick={openScopeEditDialog}
                            disabled={sortedSections.length === 0 || scopeEditing}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            <span className="min-w-0 truncate">Edit Visible Section Scope</span>
                        </Button>

                        <Button
                            size="sm"
                            className={compactActionButtonClassName}
                            onClick={() => {
                                vm.setSectionEditing(null)
                                vm.setSectionOpen(true)
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            <span className="min-w-0 truncate">Add Section</span>
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className={`rounded-full ${wrappingBadgeClassName}`}>
                                {sortedSections.length} visible
                            </Badge>
                            <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                {selectedSectionIds.length} selected
                            </Badge>
                            <span>Bulk actions use the current visible list or your checkbox selection.</span>
                        </div>

                        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <label className="inline-flex min-w-0 items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                                    <Checkbox
                                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                        onCheckedChange={(value) => toggleVisibleSelection(Boolean(value))}
                                        aria-label="Select all visible sections"
                                        disabled={sortedSections.length === 0}
                                    />
                                    <span className="min-w-0 truncate">Select all visible</span>
                                </label>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={compactActionButtonClassName}
                                    onClick={() => setSelectedSectionIds([])}
                                    disabled={selectedSectionIds.length === 0}
                                >
                                    <span className="min-w-0 truncate">Clear Selection</span>
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={compactActionButtonClassName}
                                    onClick={openSelectedLinkDialog}
                                    disabled={scopeEditTargetSections.length === 0 || linkUpdating}
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    <span className="min-w-0 truncate">{selectedVisibleSections.length > 0 ? "Edit Selected Section Links" : "Edit Visible Section Links"}</span>
                                </Button>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                    Applies to all academic terms
                                </Badge>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={compactActionButtonClassName}
                                    onClick={() => requestMergeSectionGroups(allDuplicateSectionGroups)}
                                    disabled={allDuplicateSectionGroups.length === 0 || sectionDedupeBusy}
                                >
                                    <span className="min-w-0 truncate">Delete Duplicated Sections ({allDuplicateSectionGroups.length})</span>
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={compactActionButtonClassName}
                                    onClick={requestMergeDuplicateSubjects}
                                    disabled={duplicateSubjectGroups.length === 0 || subjectDedupeBusy}
                                >
                                    <span className="min-w-0 truncate">Delete Duplicated Subjects ({duplicateSubjectGroups.length})</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {vm.loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : visibleGroups.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No reusable sections found.</div>
                ) : (
                    <Accordion type="multiple" className="space-y-4">
                        <AccordionItem value="sections" className="overflow-hidden rounded-2xl border">
                            <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                <span className="text-base font-semibold sm:hidden">Section</span>

                                <div className="hidden min-w-0 flex-1 flex-col gap-2 text-left sm:flex">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-base font-semibold">Section</span>
                                        <Badge variant="secondary" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {visibleGroups.length}
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {selectedSectionIds.length} selected
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {allDuplicateSectionGroups.length} duplicate group{allDuplicateSectionGroups.length === 1 ? "" : "s"} across all terms
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Open to view all visible sections below. Duplicate detection checks all section records across all academic terms.
                                    </div>
                                </div>
                            </AccordionTrigger>

                            <AccordionContent className="border-t px-4 pb-4 pt-4">
                                <div className="space-y-3 sm:hidden">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {visibleGroups.length} section{visibleGroups.length === 1 ? "" : "s"}
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {sortedSections.length} visible record{sortedSections.length === 1 ? "" : "s"}
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {allDuplicateSectionGroups.length} duplicate group{allDuplicateSectionGroups.length === 1 ? "" : "s"}
                                        </Badge>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border bg-background">
                                        {visibleGroups.map((group) => (
                                            <div
                                                key={group.key}
                                                className="flex items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="wrap-break-word text-sm font-medium leading-5">{group.label}</div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className={compactInlineButtonClassName}
                                                    onClick={() => setSelectedSectionDetail(group)}
                                                >
                                                    Details
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="hidden sm:block">
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        <Badge variant="secondary" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {visibleGroups.length} section{visibleGroups.length === 1 ? "" : "s"}
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {sortedSections.length} visible record{sortedSections.length === 1 ? "" : "s"}
                                        </Badge>
                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                            {allDuplicateSectionGroups.length} duplicate group{allDuplicateSectionGroups.length === 1 ? "" : "s"}
                                        </Badge>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Section</TableHead>
                                                    <TableHead className="w-32 text-right">Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visibleGroups.map((group) => (
                                                    <TableRow key={group.key}>
                                                        <TableCell className="font-medium">
                                                            <div className="wrap-break-word">{group.label}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className={compactInlineButtonClassName}
                                                                onClick={() => setSelectedSectionDetail(group)}
                                                            >
                                                                Details
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
            </div>

            <AlertDialog
                open={Boolean(pendingSectionAction)}
                onOpenChange={(open) => {
                    if (!open && !pendingSectionActionBusy) {
                        setPendingSectionAction(null)
                        setSectionMergeKeepByGroup({})
                    }
                }}
            >
                <AlertDialogContent className="max-h-[90svh] overflow-hidden sm:max-w-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingSectionAction?.kind === "unlink"
                                ? "Unlink Section Group"
                                : pendingSectionAction?.kind === "mergeSections"
                                    ? "Delete Duplicated Sections"
                                    : "Delete Duplicated Subjects"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingSectionAction?.kind === "unlink"
                                ? `This will remove all linked subjects from ${pendingSectionAction.count} section record${pendingSectionAction.count === 1 ? "" : "s"} in ${pendingSectionAction.label}.`
                                : pendingSectionAction?.kind === "mergeSections"
                                    ? `Review each duplicate section group below. Choose the section record to keep, then continue. The other duplicate record${pendingSectionAction.duplicateCount === 1 ? " will" : "s will"} be deleted and their class references will be moved automatically.`
                                    : pendingSectionAction
                                        ? `This will merge ${pendingSectionAction.groupCount} duplicate subject group${pendingSectionAction.groupCount === 1 ? "" : "s"} and delete ${pendingSectionAction.duplicateCount} extra duplicate subject record${pendingSectionAction.duplicateCount === 1 ? "" : "s"}. Sections and classes that point to the duplicates will be rewired automatically.`
                                        : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {pendingSectionAction?.kind === "mergeSections" ? (
                        <ScrollArea className="max-h-[52svh] rounded-md border">
                            <div className="space-y-3 p-3">
                                {pendingMergeSectionGroups.map((group) => {
                                    const selectedKeepId =
                                        String(sectionMergeKeepByGroup[group.key] ?? "").trim() ||
                                        String(getCanonicalRecord(group.sections)?.$id ?? "")

                                    return (
                                        <div key={group.key} className="rounded-xl border bg-muted/20 p-3">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-sm font-semibold">{group.label}</div>
                                                    <Badge variant="secondary" className={`rounded-full ${wrappingBadgeClassName}`}>
                                                        {group.sections.length} duplicate records
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{group.scopeSummary}</div>
                                            </div>

                                            <div className="mt-3 grid gap-3">
                                                {group.sections.map((section) => {
                                                    const sectionId = String(section.$id)
                                                    const keepSelected = sectionId === selectedKeepId
                                                    return (
                                                        <div
                                                            key={sectionId}
                                                            className={
                                                                keepSelected
                                                                    ? "rounded-xl border border-primary bg-primary/5 p-3"
                                                                    : "rounded-xl border bg-background p-3"
                                                            }
                                                        >
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="min-w-0 flex-1 space-y-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <div className="font-medium wrap-break-word">{buildSectionDisplayLabel(vm, section)}</div>
                                                                        <Badge variant={keepSelected ? "default" : "outline"} className={`rounded-full ${wrappingBadgeClassName}`}>
                                                                            {keepSelected ? "Keep" : "Delete"}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Academic term: {resolveSectionReferenceTermLabel(vm, section)}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Students: {section.studentCount != null ? section.studentCount : "—"} • Active: {section.isActive ? "Yes" : "No"}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground wrap-break-word">
                                                                        Subjects: {buildSectionSubjectSummary(vm, section)}
                                                                    </div>
                                                                </div>

                                                                <Button
                                                                    type="button"
                                                                    variant={keepSelected ? "default" : "outline"}
                                                                    size="sm"
                                                                    className="h-8 w-full px-3 text-xs sm:w-auto"
                                                                    onClick={() =>
                                                                        setSectionMergeKeepByGroup((current) => ({
                                                                            ...current,
                                                                            [group.key]: sectionId,
                                                                        }))
                                                                    }
                                                                >
                                                                    {keepSelected ? "Keeping this record" : "Keep this record"}
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

                    {pendingSectionActionBusy ? (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                            Processing your request. Please wait...
                        </div>
                    ) : null}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pendingSectionActionBusy}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                void handleConfirmPendingSectionAction()
                            }}
                            disabled={pendingSectionActionBusy}
                            className="bg-destructive text-white! hover:bg-destructive/90"
                        >
                            {pendingSectionActionBusy ? (
                                <span className="inline-flex items-center gap-2 text-white">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                "Continue"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={Boolean(selectedSectionDetail)} onOpenChange={(open) => !open && setSelectedSectionDetail(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedSectionDetail?.label ?? "Section Details"}</DialogTitle>
                        <DialogDescription>View the selected section group details.</DialogDescription>
                    </DialogHeader>

                    {selectedSectionDetail ? (
                        <div className="space-y-4 text-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Section</div>
                                    <div className="font-medium wrap-break-word">{selectedSectionDetail.label}</div>
                                </div>
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Scope</div>
                                    <div className="wrap-break-word">{selectedSectionDetail.scopeSummary}</div>
                                </div>
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Academic Term Coverage</div>
                                    <div className="wrap-break-word">{selectedSectionDetailTermLabels.join(", ") || "All Academic Terms"}</div>
                                </div>
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Section Records</div>
                                    <div>{selectedSectionDetail.sections.length}</div>
                                </div>
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Active Records</div>
                                    <div>{selectedSectionDetailActiveCount}</div>
                                </div>
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Linked Subjects</div>
                                    <div>{selectedSectionDetail.linkedSubjects.length}</div>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <div className="text-xs font-medium text-muted-foreground">Section Records</div>
                                <ScrollArea className="max-h-[40svh] rounded-xl border">
                                    <div className="space-y-2 p-3">
                                        {selectedSectionDetail.sections.map((section) => (
                                            <div key={section.$id} className="rounded-lg border px-3 py-3">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="font-medium wrap-break-word">{buildSectionDisplayLabel(vm, section)}</div>
                                                        <div className="text-xs text-muted-foreground wrap-break-word">
                                                            {resolveSectionReferenceTermLabel(vm, section)}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline" className={`rounded-full ${wrappingBadgeClassName}`}>
                                                            Students: {section.studentCount != null ? section.studentCount : "—"}
                                                        </Badge>
                                                        <Badge
                                                            variant={section.isActive ? "default" : "secondary"}
                                                            className={wrappingBadgeClassName}
                                                        >
                                                            {section.isActive ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!selectedSectionDetail) return
                                openSubjectViewer({
                                    title: `Subjects • ${selectedSectionDetail.label}`,
                                    description: "All linked subjects for this reusable section group.",
                                    subjects: selectedSectionDetail.linkedSubjects,
                                })
                            }}
                            disabled={!selectedSectionDetail || selectedSectionDetail.linkedSubjects.length === 0}
                        >
                            Subjects
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedSectionDetail(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={subjectViewerOpen} onOpenChange={setSubjectViewerOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{subjectViewerTitle}</DialogTitle>
                        <DialogDescription>{subjectViewerDescription}</DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60svh] rounded-md border">
                        <div className="space-y-2 p-3">
                            {subjectViewerSubjects.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No linked subjects found.</div>
                            ) : (
                                subjectViewerSubjects.map((subject) => (
                                    <div key={subject.$id} className="rounded-md border px-3 py-2 text-sm">
                                        <div className="font-medium">{subject.code} — {subject.title}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant={resolveSubjectTermId(subject) ? "secondary" : "outline"} className={wrappingBadgeClassName}>
                                                {resolveSubjectTermId(subject)
                                                    ? vm.termLabel(vm.terms, resolveSubjectTermId(subject))
                                                    : "All Academic Terms"}
                                            </Badge>
                                            <span>{vm.programLabel(vm.programs, subject.programId ?? null)}</span>
                                            <span>Semester: {String(subject.semester ?? "").trim() || "—"}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setSubjectViewerOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[95svh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{linkDialogTitle}</DialogTitle>
                        <DialogDescription>{linkDialogDescription}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            Target sections: <span className="font-medium text-foreground">{linkTargetSections.length}</span>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-sm font-medium">Linked Subjects</label>
                                <span className="text-xs text-muted-foreground">{linkSelectedSubjectIds.length} selected</span>
                            </div>
                            <ScrollArea className="h-56 rounded-md border">
                                <div className="space-y-2 p-3">
                                    {linkSubjectOptions.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">No matching subjects found for the selected sections.</div>
                                    ) : (
                                        linkSubjectOptions.map((subject) => {
                                            const checked = linkSelectedSubjectIds.includes(subject.$id)
                                            return (
                                                <label
                                                    key={subject.$id}
                                                    htmlFor={`section-link-subject-${subject.$id}`}
                                                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={`section-link-subject-${subject.$id}`}
                                                        checked={checked}
                                                        onCheckedChange={(value) => {
                                                            const nextChecked = Boolean(value)
                                                            setLinkSelectedSubjectIds((current) => {
                                                                if (nextChecked) {
                                                                    return current.includes(subject.$id) ? current : [...current, subject.$id]
                                                                }
                                                                return current.filter((id) => id !== subject.$id)
                                                            })
                                                        }}
                                                    />

                                                    <div className="min-w-0 flex-1 text-sm">
                                                        <div className="font-medium">{subject.code}</div>
                                                        <div className="text-muted-foreground">{subject.title}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {resolveSubjectTermId(subject)
                                                                ? vm.termLabel(vm.terms, resolveSubjectTermId(subject))
                                                                : "No direct term link"}
                                                        </div>
                                                    </div>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)} disabled={linkUpdating}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void saveLinkDialog()} disabled={linkUpdating || linkTargetSectionIds.length === 0}>
                            {linkUpdating ? "Saving..." : "Save Links"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={scopeEditOpen} onOpenChange={handleScopeEditOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[95svh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Visible Section Scope</DialogTitle>
                        <DialogDescription>
                            Apply a program, linked subjects, student count, or active state to the selected visible sections. When nothing is selected, the whole visible list is used.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                            Target sections: <span className="font-medium text-foreground">{scopeEditTargetSections.length}</span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Program</label>
                                <Select value={scopeEditProgramId} onValueChange={setScopeEditProgramId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Keep current program" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__keep__">Keep Current Program</SelectItem>
                                        <SelectItem value="__none__">Clear Program</SelectItem>
                                        {scopeEditProgramOptions.map((program) => (
                                            <SelectItem key={program.$id} value={program.$id}>
                                                {vm.programLabel(vm.programs, program.$id)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>


                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Student Count</label>
                                <Input
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={scopeEditStudentCount}
                                    onChange={(event) => setScopeEditStudentCount(event.target.value)}
                                    placeholder="Leave blank to keep current"
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Active State</label>
                                <Select value={scopeEditActive} onValueChange={setScopeEditActive}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Keep current active state" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__keep__">Keep Current Active State</SelectItem>
                                        <SelectItem value="yes">Set Active</SelectItem>
                                        <SelectItem value="no">Set Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-sm font-medium">Linked Subjects</label>
                                <span className="text-xs text-muted-foreground">{scopeEditSubjectIds.length} selected</span>
                            </div>
                            <ScrollArea className="h-52 rounded-md border">
                                <div className="space-y-2 p-3">
                                    {scopeEditSubjectOptions.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">No matching subjects found for the selected visible sections.</div>
                                    ) : (
                                        scopeEditSubjectOptions.map((subject) => {
                                            const checked = scopeEditSubjectIds.includes(subject.$id)
                                            return (
                                                <label
                                                    key={subject.$id}
                                                    htmlFor={`scope-edit-subject-${subject.$id}`}
                                                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={`scope-edit-subject-${subject.$id}`}
                                                        checked={checked}
                                                        onCheckedChange={(value) => {
                                                            const nextChecked = Boolean(value)
                                                            setScopeEditSubjectIds((current) => {
                                                                if (nextChecked) {
                                                                    return current.includes(subject.$id) ? current : [...current, subject.$id]
                                                                }
                                                                return current.filter((id) => id !== subject.$id)
                                                            })
                                                        }}
                                                    />
                                                    <div className="min-w-0 flex-1 text-sm">
                                                        <div className="font-medium">{subject.code}</div>
                                                        <div className="text-muted-foreground">{subject.title}</div>
                                                    </div>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="text-xs text-muted-foreground">
                                Leave this empty to keep the current subject links for the target sections.
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => handleScopeEditOpenChange(false)} disabled={scopeEditing}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void saveScopeEdit()} disabled={scopeEditing || scopeEditTargetSections.length === 0}>
                            {scopeEditing ? "Saving..." : "Save Scope"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    )
}