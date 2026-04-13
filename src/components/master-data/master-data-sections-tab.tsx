"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { databases, DATABASE_ID, COLLECTIONS } from "@/lib/db"
import type { MasterDataManagementVM } from "./use-master-data"

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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
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
    const normalizedName = String(section.name ?? "").trim().toUpperCase()
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
    const values = Array.isArray(subject.yearLevels)
        ? subject.yearLevels
        : []

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
    const sectionTermId = String(section.termId ?? "").trim()
    const subjectTermId = String(subject.termId ?? "").trim()
    if (sectionTermId && subjectTermId && sectionTermId !== subjectTermId) return false

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

    const sectionSemester = String(section.semester ?? "").trim()
    const subjectSemester = String(subject.semester ?? "").trim()
    if (sectionSemester && subjectSemester && sectionSemester !== subjectSemester) return false

    return true
}

function buildSectionSubjectSummary(
    vm: MasterDataManagementVM,
    section: { subjectId?: string | null; subjectIds?: string[] | null }
) {
    const labels = resolveSectionSubjectIds(section)
        .map((subjectId) => vm.subjects.find((subject) => subject.$id === subjectId))
        .filter(Boolean)
        .map((subject) => `${subject?.code} — ${subject?.title}`)

    return labels.length > 0 ? labels.join(", ") : "—"
}

function buildSectionSubjectDetails(
    vm: MasterDataManagementVM,
    section: { subjectId?: string | null; subjectIds?: string[] | null } | null
) {
    if (!section) return []

    return resolveSectionSubjectIds(section).map((subjectId) => {
        const subject = vm.subjects.find((item) => item.$id === subjectId)

        return {
            id: subjectId,
            label: subject ? `${subject.code} — ${subject.title}` : subjectId,
        }
    })
}

function formatSectionBulkEditError(error: any) {
    const message = String(error?.message ?? "").trim()

    if (message && /subjectids/i.test(message) && /(attribute|column|schema|unknown|invalid)/i.test(message)) {
        return "Backend is missing sections.subjectIds. Run migration 013_add_section_subject_ids."
    }

    return message || "Update failed."
}

export function MasterDataSectionsTab({ vm }: Props) {
    const [bulkEditOpen, setBulkEditOpen] = React.useState(false)
    const [bulkEditProgramId, setBulkEditProgramId] = React.useState("__keep__")
    const [bulkEditStudentCount, setBulkEditStudentCount] = React.useState("")
    const [bulkEditSubjectIds, setBulkEditSubjectIds] = React.useState<string[]>([])
    const [bulkEditSectionIds, setBulkEditSectionIds] = React.useState<string[]>([])
    const [bulkEditing, setBulkEditing] = React.useState(false)
    const [sectionSubjectsOpen, setSectionSubjectsOpen] = React.useState(false)
    const [selectedSectionForSubjects, setSelectedSectionForSubjects] = React.useState<any | null>(null)

    const eligibleSections = React.useMemo(
        () =>
            vm.filteredSections.filter(
                (section) =>
                    !String(section.programId ?? "").trim() ||
                    section.studentCount == null
            ),
        [vm.filteredSections]
    )

    const eligibleSectionMap = React.useMemo(
        () => new Map(eligibleSections.map((section) => [String(section.$id), section])),
        [eligibleSections]
    )

    const selectedSectionSubjectDetails = React.useMemo(
        () => buildSectionSubjectDetails(vm, selectedSectionForSubjects),
        [selectedSectionForSubjects, vm]
    )

    const bulkProgramOptions = React.useMemo(() => {
        const departmentIds = new Set(
            eligibleSections
                .map((section) => String(section.departmentId ?? "").trim())
                .filter(Boolean)
        )

        if (departmentIds.size === 0) return vm.programs

        return vm.programs.filter((program) =>
            departmentIds.has(String(program.departmentId ?? "").trim())
        )
    }, [eligibleSections, vm.programs])

    const bulkSelectedSections = React.useMemo(
        () => eligibleSections.filter((section) => bulkEditSectionIds.includes(String(section.$id))),
        [eligibleSections, bulkEditSectionIds]
    )

    const bulkEditSubjectOptions = React.useMemo(() => {
        const sourceSections = bulkSelectedSections.length > 0 ? bulkSelectedSections : eligibleSections

        return vm.subjects
            .filter((subject) =>
                sourceSections.some((section) =>
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
    }, [bulkSelectedSections, eligibleSections, vm.subjects])

    const openBulkEditDialog = React.useCallback(() => {
        setBulkEditProgramId("__keep__")
        setBulkEditStudentCount("")
        setBulkEditSubjectIds([])
        setBulkEditSectionIds(eligibleSections.map((section) => String(section.$id)))
        setBulkEditOpen(true)
    }, [eligibleSections])

    const handleBulkEditOpenChange = React.useCallback((nextOpen: boolean) => {
        setBulkEditOpen(nextOpen)

        if (!nextOpen) {
            setBulkEditProgramId("__keep__")
            setBulkEditStudentCount("")
            setBulkEditSubjectIds([])
            setBulkEditSectionIds([])
        }
    }, [])

    const toggleBulkEditSection = React.useCallback(
        (sectionId: string, checked: boolean) => {
            setBulkEditSectionIds((current) => {
                if (checked) {
                    if (current.includes(sectionId)) return current
                    return [...current, sectionId]
                }

                return current.filter((id) => id !== sectionId)
            })
        },
        []
    )

    const saveBulkEditSections = React.useCallback(async () => {
        const selectedSectionIds = Array.from(
            new Set(
                bulkEditSectionIds
                    .map((sectionId) => String(sectionId).trim())
                    .filter(Boolean)
            )
        )

        const hasProgramChange = bulkEditProgramId !== "__keep__"
        const hasStudentCountChange = bulkEditStudentCount.trim() !== ""
        const normalizedBulkSubjectIds = Array.from(new Set(bulkEditSubjectIds.map((subjectId) => String(subjectId).trim()).filter(Boolean)))
        const hasSubjectChange = normalizedBulkSubjectIds.length > 0

        if (!hasProgramChange && !hasStudentCountChange && !hasSubjectChange) {
            toast.error("Choose a program, linked subjects, a student count, or any combination.")
            return
        }

        if (selectedSectionIds.length === 0) {
            toast.error("Please select at least one section.")
            return
        }

        const numericStudentCount =
            bulkEditStudentCount.trim() === ""
                ? null
                : Number(bulkEditStudentCount)

        if (
            hasStudentCountChange &&
            (!Number.isFinite(numericStudentCount) || Number(numericStudentCount) < 0)
        ) {
            toast.error("Student count must be a valid non-negative number.")
            return
        }

        setBulkEditing(true)
        try {
            let updated = 0
            const failed: string[] = []

            for (const sectionId of selectedSectionIds) {
                const section = eligibleSectionMap.get(sectionId)

                if (!section) {
                    failed.push(sectionId)
                    continue
                }

                const payload: Record<string, unknown> = {}
                const nextProgramId =
                    hasProgramChange
                        ? bulkEditProgramId === "__none__"
                            ? null
                            : bulkEditProgramId
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

                if (hasSubjectChange) {
                    payload.subjectId = normalizedBulkSubjectIds[0] ?? null
                    payload.subjectIds = normalizedBulkSubjectIds
                }

                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SECTIONS,
                        sectionId,
                        payload
                    )
                    updated += 1
                } catch (error: any) {
                    const label = buildSectionDisplayLabel(vm, {
                        ...section,
                        programId: hasProgramChange ? nextProgramId : section.programId ?? null,
                        yearLevel:
                            hasProgramChange
                                ? (payload.yearLevel as string | number | null | undefined)
                                : section.yearLevel,
                    })
                    failed.push(`${label} (${formatSectionBulkEditError(error)})`)
                }
            }

            if (updated > 0) {
                await vm.refreshAll()
            }

            if (updated > 0 && failed.length === 0) {
                toast.success(
                    `${updated} section${updated === 1 ? "" : "s"} updated.`
                )
                handleBulkEditOpenChange(false)
                return
            }

            if (updated > 0) {
                toast.error(
                    `Updated ${updated} section${updated === 1 ? "" : "s"}, but failed for: ${failed.join(", ")}`
                )
                return
            }

            if (failed.length > 0) {
                toast.error(`Failed to update selected sections: ${failed.join(", ")}`)
                return
            }

            toast.error("No sections were updated.")
        } finally {
            setBulkEditing(false)
        }
    }, [
        bulkEditProgramId,
        bulkEditSectionIds,
        bulkEditStudentCount,
        bulkEditSubjectIds,
        eligibleSectionMap,
        handleBulkEditOpenChange,
        vm,
    ])

    return (
        <TabsContent value="sections" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="font-medium">Sections</div>
                    <div className="text-sm text-muted-foreground">
                        Manage class sections per semester (A–Z + Others), including linked college, program, subject or multiple subjects, year level, semester, and student count.
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="w-full sm:w-80">
                        <Select value={vm.selectedTermId} onValueChange={vm.setSelectedTermId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Semester" />
                            </SelectTrigger>
                            <SelectContent>
                                {vm.terms.length === 0 ? (
                                    <SelectItem value="__none__" disabled>
                                        No semesters found
                                    </SelectItem>
                                ) : (
                                    vm.terms.map((t) => (
                                        <SelectItem key={t.$id} value={t.$id}>
                                            {vm.termLabel(vm.terms, t.$id)}
                                            {t.isActive ? " • Active" : ""}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={openBulkEditDialog}
                        disabled={eligibleSections.length === 0 || bulkEditing}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            vm.setSectionEditing(null)
                            vm.setSectionOpen(true)
                        }}
                        disabled={vm.terms.length === 0}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Section
                    </Button>
                </div>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : vm.terms.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No semesters found. Create a Semester first to manage
                    Sections.
                </div>
            ) : vm.filteredSections.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No sections found for this semester.
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Section</TableHead>
                                <TableHead className="w-72">College</TableHead>
                                <TableHead>Program (optional)</TableHead>
                                <TableHead>Subjects</TableHead>
                                <TableHead className="w-44">Semester</TableHead>
                                <TableHead className="w-32">Students</TableHead>
                                <TableHead className="w-24">Active</TableHead>
                                <TableHead className="w-40 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vm.filteredSections
                                .slice()
                                .sort((a, b) => {
                                    const left = `${a.departmentId}-${a.yearLevel}-${a.name}`
                                    const right = `${b.departmentId}-${b.yearLevel}-${b.name}`
                                    return left.localeCompare(right)
                                })
                                .map((s) => (
                                    <TableRow key={s.$id}>
                                        <TableCell className="font-medium">
                                            {buildSectionDisplayLabel(vm, s)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {vm.collegeLabel(vm.colleges, s.departmentId)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {vm.programLabel(vm.programs, s.programId ?? null)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="sm"
                                                className="h-8 px-3"
                                                onClick={() => {
                                                    setSelectedSectionForSubjects(s)
                                                    setSectionSubjectsOpen(true)
                                                }}
                                            >
                                                Subjects ({resolveSectionSubjectIds(s).length})
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {s.academicTermLabel || vm.termLabel(vm.terms, s.termId) || s.semester || "—"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {s.studentCount != null ? s.studentCount : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={s.isActive ? "default" : "secondary"}>
                                                {s.isActive ? "Yes" : "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        vm.setSectionEditing(s)
                                                        vm.setSectionOpen(true)
                                                    }}
                                                >
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() =>
                                                        vm.setDeleteIntent({
                                                            type: "section",
                                                            doc: s,
                                                        })
                                                    }
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog
                open={sectionSubjectsOpen}
                onOpenChange={(open) => {
                    setSectionSubjectsOpen(open)

                    if (!open) {
                        setSelectedSectionForSubjects(null)
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Section Subjects
                            {selectedSectionForSubjects ? ` • ${buildSectionDisplayLabel(vm, selectedSectionForSubjects)}` : ""}
                        </DialogTitle>
                        <DialogDescription>
                            All linked subjects for the selected section.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60svh] rounded-md border">
                        <div className="space-y-2 p-3">
                            {selectedSectionSubjectDetails.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No linked subjects found for this section.
                                </div>
                            ) : (
                                selectedSectionSubjectDetails.map((subject) => (
                                    <div
                                        key={subject.id}
                                        className="rounded-md border px-3 py-2 text-sm"
                                    >
                                        {subject.label}
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setSectionSubjectsOpen(false)
                                setSelectedSectionForSubjects(null)
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkEditOpen} onOpenChange={handleBulkEditOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[95svh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Sections</DialogTitle>
                        <DialogDescription>
                            Apply a program, linked subjects, a student count, or any combination to the eligible sections below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Program</label>
                                <Select
                                    value={bulkEditProgramId}
                                    onValueChange={setBulkEditProgramId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Keep current program" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__keep__">Keep Current Program</SelectItem>
                                        <SelectItem value="__none__">Clear Program</SelectItem>
                                        {bulkProgramOptions.map((program) => (
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
                                    value={bulkEditStudentCount}
                                    onChange={(event) =>
                                        setBulkEditStudentCount(event.target.value)
                                    }
                                    placeholder="Leave blank to keep current"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-sm font-medium">Linked Subjects</label>
                                <span className="text-xs text-muted-foreground">
                                    {bulkEditSubjectIds.length} selected
                                </span>
                            </div>
                            <ScrollArea className="h-44 rounded-md border">
                                <div className="space-y-2 p-3">
                                    {bulkEditSubjectOptions.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            No matching subjects found for the selected sections.
                                        </div>
                                    ) : (
                                        bulkEditSubjectOptions.map((subject) => {
                                            const checked = bulkEditSubjectIds.includes(subject.$id)

                                            return (
                                                <label
                                                    key={subject.$id}
                                                    htmlFor={`bulk-edit-subject-${subject.$id}`}
                                                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={`bulk-edit-subject-${subject.$id}`}
                                                        checked={checked}
                                                        onCheckedChange={(value) => {
                                                            const isChecked = Boolean(value)
                                                            setBulkEditSubjectIds((current) => {
                                                                if (isChecked) {
                                                                    return current.includes(subject.$id)
                                                                        ? current
                                                                        : [...current, subject.$id]
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
                                Leave this empty to keep the current subject links for the selected sections.
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            <div className="text-muted-foreground">
                                Eligible sections:{" "}
                                <span className="font-medium text-foreground">
                                    {eligibleSections.length}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setBulkEditSectionIds(
                                            eligibleSections.map((section) =>
                                                String(section.$id)
                                            )
                                        )
                                    }
                                    disabled={eligibleSections.length === 0}
                                >
                                    Select All
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkEditSectionIds([])}
                                    disabled={bulkEditSectionIds.length === 0}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>

                        <ScrollArea className="h-80 rounded-md border">
                            <div className="space-y-2 p-3">
                                {eligibleSections.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No eligible sections found in the current list.
                                    </div>
                                ) : (
                                    eligibleSections.map((section) => {
                                        const sectionId = String(section.$id)
                                        const checked = bulkEditSectionIds.includes(sectionId)

                                        return (
                                            <label
                                                key={sectionId}
                                                htmlFor={`bulk-edit-section-${sectionId}`}
                                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    id={`bulk-edit-section-${sectionId}`}
                                                    checked={checked}
                                                    onCheckedChange={(value) =>
                                                        toggleBulkEditSection(
                                                            sectionId,
                                                            Boolean(value)
                                                        )
                                                    }
                                                />

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">
                                                            {buildSectionDisplayLabel(vm, section)}
                                                        </span>
                                                        {!String(section.programId ?? "").trim() ? (
                                                            <Badge variant="outline">
                                                                No Program
                                                            </Badge>
                                                        ) : null}
                                                        {section.studentCount == null ? (
                                                            <Badge variant="outline">
                                                                No Students
                                                            </Badge>
                                                        ) : null}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        {`${vm.collegeLabel(
                                                            vm.colleges,
                                                            section.departmentId
                                                        )} • ${section.academicTermLabel || vm.termLabel(vm.terms, section.termId) || section.semester || "No Semester"}`}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        Subjects: {buildSectionSubjectSummary(vm, section)}
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
                            onClick={() => handleBulkEditOpenChange(false)}
                            disabled={bulkEditing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void saveBulkEditSections()}
                            disabled={bulkEditing || bulkEditSectionIds.length === 0}
                        >
                            {bulkEditing ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    )
}