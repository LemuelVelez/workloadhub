"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Link2, Pencil, Plus, Trash2, Unlink2 } from "lucide-react"
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
    sections: any[]
    uniqueSubjectIds: string[]
    linkedSubjects: any[]
    inheritedSubjectCount: number
    representative: any
}

type SectionTermBucket = {
    key: string
    label: string
    groups: SectionGroup[]
    sectionRecordCount: number
    directTermLinkedCount: number
    withoutDirectTermLinkCount: number
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

function resolveSectionReferenceTermLabel(vm: MasterDataManagementVM, section: any) {
    return section.academicTermLabel || vm.termLabel(vm.terms, section.termId) || "All Academic Terms"
}

function resolveSubjectTermId(subject?: any) {
    return String(subject?.termId ?? "").trim()
}

function hasDirectSectionTermLink(section?: any) {
    return Boolean(String(section?.termId ?? "").trim())
}

function buildSectionGroupKey(vm: MasterDataManagementVM, section: any) {
    return [
        String(section.departmentId ?? "").trim(),
        String(section.programId ?? "").trim(),
        buildStoredSectionYearLevel(vm, section.yearLevel, section.programId ?? null) || normalizeSectionYearLevelValue(section.yearLevel),
        normalizeSectionNameValue(section.name),
    ].join("::")
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
    const mergedProgramId =
        uniqueStrings(sections.map((section) => String(section?.programId ?? "").trim()))[0] || null
    const mergedYearLevel =
        buildStoredSectionYearLevel(vm, canonical?.yearLevel, mergedProgramId) ||
        buildStoredSectionYearLevel(vm, sections[0]?.yearLevel, mergedProgramId) ||
        normalizeSectionYearLevelValue(canonical?.yearLevel) ||
        normalizeSectionYearLevelValue(sections[0]?.yearLevel)

    return {
        departmentId: String(canonical?.departmentId ?? sections[0]?.departmentId ?? "").trim(),
        programId: mergedProgramId,
        subjectId: mergedSubjectIds[0] ?? null,
        subjectIds: mergedSubjectIds,
        yearLevel: mergedYearLevel,
        name: normalizeSectionNameValue(canonical?.name ?? sections[0]?.name),
        studentCount: getBestStudentCount(sections),
        isActive: sections.some((section) => Boolean(section?.isActive)),
        termId: null,
        semester: null,
        academicTermLabel: null,
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

    const [selectedSectionDetail, setSelectedSectionDetail] = React.useState<any | null>(null)

    const [subjectViewerOpen, setSubjectViewerOpen] = React.useState(false)
    const [subjectViewerTitle, setSubjectViewerTitle] = React.useState("Linked Subjects")
    const [subjectViewerDescription, setSubjectViewerDescription] = React.useState("")
    const [subjectViewerSubjects, setSubjectViewerSubjects] = React.useState<any[]>([])

    const [sectionDedupeBusy, setSectionDedupeBusy] = React.useState(false)
    const [subjectDedupeBusy, setSubjectDedupeBusy] = React.useState(false)
    const [pendingSectionAction, setPendingSectionAction] = React.useState<PendingSectionAction | null>(null)

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
                    sections,
                    uniqueSubjectIds,
                    linkedSubjects,
                    inheritedSubjectCount,
                    representative,
                }
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }))
    }, [sortedSections, vm])

    const duplicateVisibleGroups = React.useMemo(
        () => visibleGroups.filter((group) => group.sections.length > 1),
        [visibleGroups]
    )

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

    const visibleTermBuckets = React.useMemo<SectionTermBucket[]>(() => {
        const termOrder = new Map<string, number>()
        vm.terms.forEach((term, index) => {
            termOrder.set(vm.termLabel(vm.terms, term.$id), index)
        })

        const grouped = new Map<string, SectionTermBucket>()

        for (const group of visibleGroups) {
            const bucketLabel = resolveSectionReferenceTermLabel(vm, group.representative)
            const existing = grouped.get(bucketLabel)
            const sectionRecordCount = group.sections.length
            const directTermLinkedCount = group.sections.filter((section) => hasDirectSectionTermLink(section)).length
            const withoutDirectTermLinkCount = sectionRecordCount - directTermLinkedCount

            if (existing) {
                existing.groups.push(group)
                existing.sectionRecordCount += sectionRecordCount
                existing.directTermLinkedCount += directTermLinkedCount
                existing.withoutDirectTermLinkCount += withoutDirectTermLinkCount
                continue
            }

            grouped.set(bucketLabel, {
                key: bucketLabel,
                label: bucketLabel,
                groups: [group],
                sectionRecordCount,
                directTermLinkedCount,
                withoutDirectTermLinkCount,
            })
        }

        return Array.from(grouped.values())
            .map((bucket) => ({
                ...bucket,
                groups: bucket.groups.slice().sort((a, b) =>
                    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
                ),
            }))
            .sort((a, b) => {
                const leftRank = termOrder.has(a.label) ? termOrder.get(a.label)! : Number.MAX_SAFE_INTEGER
                const rightRank = termOrder.has(b.label) ? termOrder.get(b.label)! : Number.MAX_SAFE_INTEGER
                if (leftRank !== rightRank) return leftRank - rightRank
                return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
            })
    }, [visibleGroups, vm])

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

    const toggleSectionSelection = React.useCallback((sectionId: string, checked: boolean) => {
        setSelectedSectionIds((current) => {
            if (checked) {
                if (current.includes(sectionId)) return current
                return [...current, sectionId]
            }
            return current.filter((id) => id !== sectionId)
        })
    }, [])

    const toggleGroupSelection = React.useCallback((sectionIds: string[], checked: boolean) => {
        setSelectedSectionIds((current) => {
            const currentSet = new Set(current)
            for (const sectionId of sectionIds) {
                if (checked) currentSet.add(sectionId)
                else currentSet.delete(sectionId)
            }
            return Array.from(currentSet)
        })
    }, [])

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

    const requestUnlinkSections = React.useCallback((sectionIds: string[], label: string) => {
        const targetIds = uniqueStrings(sectionIds)
        if (targetIds.length === 0) {
            toast.error("No sections selected.")
            return
        }

        setPendingSectionAction({
            kind: "unlink",
            sectionIds: targetIds,
            label,
            count: targetIds.length,
        })
    }, [])

    const mergeSectionGroups = React.useCallback(async (groups: SectionGroup[]) => {
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
                const canonical = getCanonicalRecord(group.sections)
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
                toast.success(`Merged ${mergedGroups} duplicate section group${mergedGroups === 1 ? "" : "s"}, removed ${deleted} duplicates, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`)
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
                toast.success(`Merged ${mergedGroups} duplicate subject group${mergedGroups === 1 ? "" : "s"}, removed ${deleted} duplicates, rewired ${rewiredSections} section reference${rewiredSections === 1 ? "" : "s"}, and rewired ${rewiredClasses} class reference${rewiredClasses === 1 ? "" : "s"}.`)
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
        if (!pendingSectionAction) return

        const action = pendingSectionAction
        setPendingSectionAction(null)

        if (action.kind === "unlink") {
            await unlinkSectionIds(action.sectionIds, action.label)
            return
        }

        if (action.kind === "mergeSections") {
            const groups = visibleGroups.filter((group) => action.groupKeys.includes(group.key))
            await mergeSectionGroups(groups)
            return
        }

        await mergeDuplicateSubjects()
    }, [mergeDuplicateSubjects, mergeSectionGroups, pendingSectionAction, unlinkSectionIds, visibleGroups])
    const openSubjectViewer = React.useCallback((config: { title: string; description: string; subjects: any[] }) => {
        setSubjectViewerTitle(config.title)
        setSubjectViewerDescription(config.description)
        setSubjectViewerSubjects(config.subjects)
        setSubjectViewerOpen(true)
    }, [])

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
                            onClick={openScopeEditDialog}
                            disabled={sortedSections.length === 0 || scopeEditing}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Visible Section Scope
                        </Button>

                        <Button
                            size="sm"
                            onClick={() => {
                                vm.setSectionEditing(null)
                                vm.setSectionOpen(true)
                            }}
                           
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Section
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="rounded-full">
                                {sortedSections.length} visible
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                                {selectedSectionIds.length} selected
                            </Badge>
                            <span>Bulk actions use the current visible list or your checkbox selection.</span>
                        </div>

                        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                                    <Checkbox
                                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                        onCheckedChange={(value) => toggleVisibleSelection(Boolean(value))}
                                        aria-label="Select all visible sections"
                                        disabled={sortedSections.length === 0}
                                    />
                                    Select all visible
                                </label>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedSectionIds([])}
                                    disabled={selectedSectionIds.length === 0}
                                >
                                    Clear Selection
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={openSelectedLinkDialog}
                                    disabled={scopeEditTargetSections.length === 0 || linkUpdating}
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    {selectedVisibleSections.length > 0 ? "Edit Selected Section Links" : "Edit Visible Section Links"}
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full">
                                    Applies to all academic terms
                                </Badge>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => requestMergeSectionGroups(duplicateVisibleGroups)}
                                    disabled={duplicateVisibleGroups.length === 0 || sectionDedupeBusy}
                                >
                                    Remove Duplicated Sections ({duplicateVisibleGroups.length})
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={requestMergeDuplicateSubjects}
                                    disabled={duplicateSubjectGroups.length === 0 || subjectDedupeBusy}
                                >
                                    Remove Duplicated Subjects ({duplicateSubjectGroups.length})
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
                ) : visibleTermBuckets.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No reusable sections found.</div>
                ) : (
                    <Accordion type="multiple" className="space-y-4">
                        {visibleTermBuckets.map((bucket) => {
                            const bucketSectionIds = bucket.groups.flatMap((group) => group.sections.map((section) => String(section.$id)))
                            const bucketSelectedCount = bucketSectionIds.filter((sectionId) => selectedSectionIdSet.has(sectionId)).length
                            const allBucketSelected = bucketSectionIds.length > 0 && bucketSelectedCount === bucketSectionIds.length
                            const someBucketSelected = bucketSelectedCount > 0 && !allBucketSelected

                            return (
                                <AccordionItem key={bucket.key} value={bucket.key} className="overflow-hidden rounded-2xl border">
                                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                        <div className="flex min-w-0 flex-1 flex-col gap-2 text-left">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-base font-semibold">{bucket.label}</span>
                                                <Badge variant="secondary" className="rounded-full">
                                                    {bucket.sectionRecordCount}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-full">
                                                    {bucketSelectedCount} selected
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {bucket.directTermLinkedCount} legacy term-linked section{bucket.directTermLinkedCount === 1 ? "" : "s"} • {bucket.withoutDirectTermLinkCount} shared across all academic terms section{bucket.withoutDirectTermLinkCount === 1 ? "" : "s"}
                                            </div>
                                        </div>
                                    </AccordionTrigger>

                                    <AccordionContent className="border-t px-4 pb-4 pt-4">
                                        <div className="mb-4 flex flex-wrap items-center gap-2">
                                            <label className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                                                <Checkbox
                                                    checked={allBucketSelected ? true : someBucketSelected ? "indeterminate" : false}
                                                    onCheckedChange={(value) => toggleGroupSelection(bucketSectionIds, Boolean(value))}
                                                    aria-label={`Select ${bucket.label} section group`}
                                                    disabled={bucketSectionIds.length === 0}
                                                />
                                                Select group
                                            </label>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={linkUpdating || bucketSectionIds.length === 0}
                                                onClick={() =>
                                                    openLinkDialog({
                                                        title: `Edit Group Links • ${bucket.label}`,
                                                        description: "Apply linked subjects to every visible section record in this term group.",
                                                        sectionIds: bucketSectionIds,
                                                        initialSubjectIds: uniqueStrings(
                                                            bucket.groups.flatMap((group) => group.uniqueSubjectIds)
                                                        ),
                                                    })
                                                }
                                            >
                                                <Link2 className="mr-2 h-4 w-4" />
                                                Edit Group Links
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={linkUpdating || bucketSectionIds.length === 0}
                                                onClick={() => requestUnlinkSections(bucketSectionIds, bucket.label)}
                                            >
                                                <Unlink2 className="mr-2 h-4 w-4" />
                                                Unlink Group
                                            </Button>

                                            <Badge variant="outline" className="rounded-full">
                                                Visible actions affect the current list or group only.
                                            </Badge>
                                        </div>

                                        <div className="space-y-3">
                                            {bucket.groups.map((group) => {
                                                const groupSectionIds = group.sections.map((section) => String(section.$id))
                                                const groupSelectedCount = groupSectionIds.filter((sectionId) => selectedSectionIdSet.has(sectionId)).length
                                                const allGroupSelected = groupSelectedCount > 0 && groupSelectedCount === groupSectionIds.length
                                                const someGroupSelected = groupSelectedCount > 0 && !allGroupSelected

                                                return (
                                                    <div key={group.key} className="rounded-2xl border bg-background p-3 sm:p-4">
                                                        <div className="flex flex-col gap-3">
                                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-sm font-semibold">{group.label}</span>
                                                                        <Badge variant="secondary" className="rounded-full">
                                                                            {group.sections.length} section record{group.sections.length === 1 ? "" : "s"}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="rounded-full">
                                                                            {group.linkedSubjects.length} linked subject{group.linkedSubjects.length === 1 ? "" : "s"}
                                                                        </Badge>
                                                                        <Badge variant="outline" className="rounded-full">
                                                                            {group.inheritedSubjectCount} subjects without direct term link
                                                                        </Badge>
                                                                    </div>

                                                                    <div className="text-xs text-muted-foreground">
                                                                        {vm.collegeLabel(vm.colleges, group.representative.departmentId)} • {vm.programLabel(vm.programs, group.representative.programId ?? null)}
                                                                    </div>

                                                                    <div className="text-xs text-muted-foreground">
                                                                        Linked subjects: {group.linkedSubjects.length > 0 ? group.linkedSubjects.map((subject) => `${subject.code} — ${subject.title}`).join(", ") : "—"}
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <label className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted">
                                                                        <Checkbox
                                                                            checked={allGroupSelected ? true : someGroupSelected ? "indeterminate" : false}
                                                                            onCheckedChange={(value) => toggleGroupSelection(groupSectionIds, Boolean(value))}
                                                                            aria-label={`Select ${group.label} group`}
                                                                            disabled={groupSectionIds.length === 0}
                                                                        />
                                                                        Select group
                                                                    </label>

                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            openSubjectViewer({
                                                                                title: `Linked Subjects • ${group.label}`,
                                                                                description: "All linked subjects for this reusable section group.",
                                                                                subjects: group.linkedSubjects,
                                                                            })
                                                                        }
                                                                    >
                                                                        Linked Subjects
                                                                    </Button>

                                                                    {group.sections.length > 1 ? (
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            disabled={sectionDedupeBusy}
                                                                            onClick={() => requestMergeSectionGroups([group])}
                                                                        >
                                                                            Merge Group Duplicates
                                                                        </Button>
                                                                    ) : null}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3 sm:hidden">
                                                                {group.sections.map((section) => {
                                                                    const sectionId = String(section.$id)
                                                                    const selected = selectedSectionIdSet.has(sectionId)
                                                                    return (
                                                                        <div key={sectionId} className="rounded-xl border p-3">
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <label className="flex min-w-0 flex-1 items-start gap-3">
                                                                                    <Checkbox
                                                                                        checked={selected}
                                                                                        onCheckedChange={(value) => toggleSectionSelection(sectionId, Boolean(value))}
                                                                                    />
                                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                                        <div className="font-medium">{buildSectionDisplayLabel(vm, section)}</div>
                                                                                        <div className="text-xs text-muted-foreground">{resolveSectionReferenceTermLabel(vm, section)}</div>
                                                                                        <div className="text-xs text-muted-foreground">Subjects: {buildSectionSubjectSummary(vm, section)}</div>
                                                                                    </div>
                                                                                </label>
                                                                            </div>

                                                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                                                <Badge variant={section.isActive ? "default" : "secondary"}>
                                                                                    {section.isActive ? "Active" : "Inactive"}
                                                                                </Badge>
                                                                                <Badge variant="outline" className="rounded-full">
                                                                                    Students: {section.studentCount != null ? section.studentCount : "—"}
                                                                                </Badge>
                                                                            </div>

                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedSectionDetail(section)}>
                                                                                    Details
                                                                                </Button>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => {
                                                                                        vm.setSectionEditing(section)
                                                                                        vm.setSectionOpen(true)
                                                                                    }}
                                                                                >
                                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                                    Edit
                                                                                </Button>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant="destructive"
                                                                                    onClick={() => vm.setDeleteIntent({ type: "section", doc: section })}
                                                                                >
                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                    Delete
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>

                                                            <div className="hidden overflow-hidden rounded-xl border sm:block">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="w-14">Pick</TableHead>
                                                                            <TableHead className="w-44">Section</TableHead>
                                                                            <TableHead className="w-64">Academic Term Coverage</TableHead>
                                                                            <TableHead>Linked Subjects</TableHead>
                                                                            <TableHead className="w-28">Students</TableHead>
                                                                            <TableHead className="w-24">Active</TableHead>
                                                                            <TableHead className="w-44 text-right">Actions</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {group.sections.map((section) => {
                                                                            const sectionId = String(section.$id)
                                                                            return (
                                                                                <TableRow key={sectionId}>
                                                                                    <TableCell>
                                                                                        <Checkbox
                                                                                            checked={selectedSectionIdSet.has(sectionId)}
                                                                                            onCheckedChange={(value) => toggleSectionSelection(sectionId, Boolean(value))}
                                                                                            aria-label={`Select ${buildSectionDisplayLabel(vm, section)}`}
                                                                                        />
                                                                                    </TableCell>
                                                                                    <TableCell className="font-medium">{buildSectionDisplayLabel(vm, section)}</TableCell>
                                                                                    <TableCell className="text-muted-foreground">{resolveSectionReferenceTermLabel(vm, section)}</TableCell>
                                                                                    <TableCell className="text-muted-foreground">{buildSectionSubjectSummary(vm, section)}</TableCell>
                                                                                    <TableCell className="text-muted-foreground">{section.studentCount != null ? section.studentCount : "—"}</TableCell>
                                                                                    <TableCell>
                                                                                        <Badge variant={section.isActive ? "default" : "secondary"}>
                                                                                            {section.isActive ? "Yes" : "No"}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-right">
                                                                                        <div className="flex justify-end gap-2">
                                                                                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedSectionDetail(section)}>
                                                                                                Details
                                                                                            </Button>
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => {
                                                                                                    vm.setSectionEditing(section)
                                                                                                    vm.setSectionOpen(true)
                                                                                                }}
                                                                                            >
                                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                                Edit
                                                                                            </Button>
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="destructive"
                                                                                                size="sm"
                                                                                                onClick={() => vm.setDeleteIntent({ type: "section", doc: section })}
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
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                )}
            </div>

            <AlertDialog open={Boolean(pendingSectionAction)} onOpenChange={(open) => !open && setPendingSectionAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingSectionAction?.kind === "unlink"
                                ? "Unlink Section Group"
                                : pendingSectionAction?.kind === "mergeSections"
                                    ? "Remove Duplicated Sections"
                                    : "Remove Duplicated Subjects"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingSectionAction?.kind === "unlink"
                                ? `This will remove all linked subjects from ${pendingSectionAction.count} section record${pendingSectionAction.count === 1 ? "" : "s"} in ${pendingSectionAction.label}.`
                                : pendingSectionAction?.kind === "mergeSections"
                                    ? `This will merge ${pendingSectionAction.groupCount} duplicate section group${pendingSectionAction.groupCount === 1 ? "" : "s"} and remove ${pendingSectionAction.duplicateCount} extra duplicate record${pendingSectionAction.duplicateCount === 1 ? "" : "s"}.`
                                    : pendingSectionAction
                                        ? `This will merge ${pendingSectionAction.groupCount} duplicate subject group${pendingSectionAction.groupCount === 1 ? "" : "s"} and remove ${pendingSectionAction.duplicateCount} extra duplicate subject record${pendingSectionAction.duplicateCount === 1 ? "" : "s"}. Sections and classes that point to the duplicates will be rewired automatically.`
                                        : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={linkUpdating || sectionDedupeBusy || subjectDedupeBusy}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault()
                                void handleConfirmPendingSectionAction()
                            }}
                            disabled={linkUpdating || sectionDedupeBusy || subjectDedupeBusy}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {linkUpdating || sectionDedupeBusy || subjectDedupeBusy ? "Processing..." : "Continue"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={Boolean(selectedSectionDetail)} onOpenChange={(open) => !open && setSelectedSectionDetail(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedSectionDetail ? buildSectionDisplayLabel(vm, selectedSectionDetail) : "Section Details"}
                        </DialogTitle>
                        <DialogDescription>View the selected section details.</DialogDescription>
                    </DialogHeader>

                    {selectedSectionDetail ? (
                        <div className="grid gap-3 text-sm">
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Section</div>
                                <div className="font-medium">{buildSectionDisplayLabel(vm, selectedSectionDetail)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">College</div>
                                <div>{vm.collegeLabel(vm.colleges, selectedSectionDetail.departmentId)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Program</div>
                                <div>{vm.programLabel(vm.programs, selectedSectionDetail.programId ?? null)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Academic Term Coverage</div>
                                <div>{resolveSectionReferenceTermLabel(vm, selectedSectionDetail)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Students</div>
                                <div>{selectedSectionDetail.studentCount != null ? selectedSectionDetail.studentCount : "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Linked Subjects</div>
                                <div>{buildSectionSubjectSummary(vm, selectedSectionDetail)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Active</div>
                                <div>
                                    <Badge variant={selectedSectionDetail.isActive ? "default" : "secondary"}>
                                        {selectedSectionDetail.isActive ? "Yes" : "No"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedSectionDetail(null)}>
                            Close
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!selectedSectionDetail) return
                                openSubjectViewer({
                                    title: `Linked Subjects • ${buildSectionDisplayLabel(vm, selectedSectionDetail)}`,
                                    description: "All linked subjects for this section record.",
                                    subjects: resolveSectionSubjectIds(selectedSectionDetail)
                                        .map((subjectId) => vm.subjects.find((subject) => subject.$id === subjectId))
                                        .filter(Boolean),
                                })
                            }}
                        >
                            Linked Subjects
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!selectedSectionDetail) return
                                vm.setSectionEditing(selectedSectionDetail)
                                vm.setSectionOpen(true)
                                setSelectedSectionDetail(null)
                            }}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (!selectedSectionDetail) return
                                vm.setDeleteIntent({ type: "section", doc: selectedSectionDetail })
                                setSelectedSectionDetail(null)
                            }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
                                            <Badge variant={resolveSubjectTermId(subject) ? "secondary" : "outline"}>
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