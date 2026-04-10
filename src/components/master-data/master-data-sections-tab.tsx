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

export function MasterDataSectionsTab({ vm }: Props) {
    const [bulkEditOpen, setBulkEditOpen] = React.useState(false)
    const [bulkEditProgramId, setBulkEditProgramId] = React.useState("__keep__")
    const [bulkEditStudentCount, setBulkEditStudentCount] = React.useState("")
    const [bulkEditSectionIds, setBulkEditSectionIds] = React.useState<string[]>([])
    const [bulkEditing, setBulkEditing] = React.useState(false)

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

    const openBulkEditDialog = React.useCallback(() => {
        setBulkEditProgramId("__keep__")
        setBulkEditStudentCount("")
        setBulkEditSectionIds(eligibleSections.map((section) => String(section.$id)))
        setBulkEditOpen(true)
    }, [eligibleSections])

    const handleBulkEditOpenChange = React.useCallback((nextOpen: boolean) => {
        setBulkEditOpen(nextOpen)

        if (!nextOpen) {
            setBulkEditProgramId("__keep__")
            setBulkEditStudentCount("")
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

        if (!hasProgramChange && !hasStudentCountChange) {
            toast.error("Choose a program, a student count, or both.")
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

                try {
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.SECTIONS,
                        sectionId,
                        payload
                    )
                    updated += 1
                } catch {
                    failed.push(
                        buildSectionDisplayLabel(vm, {
                            ...section,
                            programId: hasProgramChange ? nextProgramId : section.programId ?? null,
                            yearLevel:
                                hasProgramChange
                                    ? (payload.yearLevel as string | number | null | undefined)
                                    : section.yearLevel,
                        })
                    )
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

            toast.error("No sections were updated.")
        } finally {
            setBulkEditing(false)
        }
    }, [
        bulkEditProgramId,
        bulkEditSectionIds,
        bulkEditStudentCount,
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
                        Manage class sections per semester (A–Z + Others), including linked college, program, year level, semester, and student count.
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
                                <TableHead>Subject</TableHead>
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
                                        <TableCell className="text-muted-foreground">
                                            {s.subjectId
                                                ? (() => {
                                                    const subject = vm.subjects.find((item) => item.$id === s.subjectId)
                                                    return subject ? `${subject.code} — ${subject.title}` : "—"
                                                })()
                                                : "—"}
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

            <Dialog open={bulkEditOpen} onOpenChange={handleBulkEditOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[95svh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Sections Without Program or Students</DialogTitle>
                        <DialogDescription>
                            Apply a program, a student count, or both to the sections that still
                            have missing values.
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
                                        No sections without program or students found in the
                                        current list.
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