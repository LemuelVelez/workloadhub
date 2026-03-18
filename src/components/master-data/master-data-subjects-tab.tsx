"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Pencil, Trash2, Link2 } from "lucide-react"

import type { AcademicTermDoc, SubjectDoc } from "../../../model/schemaModel"
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
const SUBJECT_SEMESTER_KEYS = [
    "semester",
    "semesterLabel",
    "termSemester",
    "termSem",
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

function getSemesterSortOrder(label: string) {
    const normalized = normalizeSemesterLabel(label)
    if (normalized === "1st Semester") return 1
    if (normalized === "2nd Semester") return 2
    if (normalized === "Summer") return 3
    if (normalized === INHERIT_SEMESTER_LABEL) return 99
    return 50
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

function resolveSubjectSemester(
    subject: LooseSubjectDoc,
    termMap: Map<string, LooseAcademicTermDoc>
) {
    const linkedTermId = resolveSubjectTermId(subject)
    const linkedSemester = resolveTermSemester(termMap, linkedTermId)
    if (linkedSemester) return linkedSemester

    return normalizeSemesterLabel(readFirstStringValue(subject, SUBJECT_SEMESTER_KEYS))
}

export function MasterDataSubjectsTab({ vm }: Props) {
    const [bulkLinkOpen, setBulkLinkOpen] = React.useState(false)
    const [bulkLinkTermId, setBulkLinkTermId] = React.useState("")
    const [bulkLinkSemesterHint, setBulkLinkSemesterHint] = React.useState("")
    const [bulkLinkSubjectIds, setBulkLinkSubjectIds] = React.useState<string[]>([])
    const [bulkLinking, setBulkLinking] = React.useState(false)

    const termMap = React.useMemo(() => {
        const map = new Map<string, LooseAcademicTermDoc>()
        for (const term of vm.terms as LooseAcademicTermDoc[]) {
            map.set(String(term.$id), term)
        }
        return map
    }, [vm.terms])

    const allUnlinkedSubjects = React.useMemo(() => {
        return (vm.subjects as LooseSubjectDoc[]).filter(
            (subject) => !resolveSubjectTermId(subject)
        )
    }, [vm.subjects])

    const groupedSubjects = React.useMemo(() => {
        const groups = new Map<
            string,
            {
                semesterLabel: string
                subjects: LooseSubjectDoc[]
                linkedCount: number
                inheritedCount: number
            }
        >()

        for (const subject of vm.filteredSubjects as LooseSubjectDoc[]) {
            const linkedTermId = resolveSubjectTermId(subject)
            const semesterLabel =
                resolveSubjectSemester(subject, termMap) ||
                INHERIT_SEMESTER_LABEL

            const existing = groups.get(semesterLabel) ?? {
                semesterLabel,
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

            groups.set(semesterLabel, existing)
        }

        return Array.from(groups.values())
            .sort((a, b) => {
                const orderDelta =
                    getSemesterSortOrder(a.semesterLabel) -
                    getSemesterSortOrder(b.semesterLabel)

                if (orderDelta !== 0) return orderDelta

                return a.semesterLabel.localeCompare(b.semesterLabel)
            })
            .map((group) => ({
                ...group,
                subjects: [...group.subjects].sort((a, b) => {
                    const aCode = String(a.code ?? "").toLowerCase()
                    const bCode = String(b.code ?? "").toLowerCase()
                    if (aCode !== bCode) return aCode.localeCompare(bCode)

                    return String(a.title ?? "").localeCompare(String(b.title ?? ""))
                }),
            }))
    }, [termMap, vm.filteredSubjects])

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

    const bulkLinkEligibleSubjects = React.useMemo(() => {
        return allUnlinkedSubjects
            .filter((subject) => {
                const subjectSemester = resolveSubjectSemester(subject, termMap)

                if (normalizedBulkLinkSemesterHint && subjectSemester) {
                    return subjectSemester === normalizedBulkLinkSemesterHint
                }

                if (selectedBulkLinkSemester && subjectSemester) {
                    return subjectSemester === selectedBulkLinkSemester
                }

                return true
            })
            .sort((a, b) => {
                const aCode = String(a.code ?? "").toLowerCase()
                const bCode = String(b.code ?? "").toLowerCase()
                if (aCode !== bCode) return aCode.localeCompare(bCode)

                return String(a.title ?? "").localeCompare(String(b.title ?? ""))
            })
    }, [
        allUnlinkedSubjects,
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

        setBulkLinkSubjectIds(
            bulkLinkEligibleSubjects.map((subject) => String(subject.$id))
        )
    }, [bulkLinkOpen, bulkLinkEligibleSubjects])

    const openBulkLinkDialog = React.useCallback((semesterHint = "") => {
        setBulkLinkSemesterHint(semesterHint)
        setBulkLinkTermId("")
        setBulkLinkSubjectIds([])
        setBulkLinkOpen(true)
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
                setBulkLinkOpen(false)
                setBulkLinkSubjectIds([])
            }
        } finally {
            setBulkLinking(false)
        }
    }, [bulkLinkSubjectIds, bulkLinkTermId, vm])

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
                        variant="outline"
                        size="sm"
                        disabled={allUnlinkedSubjects.length === 0}
                        onClick={() => openBulkLinkDialog()}
                    >
                        <Link2 className="mr-2 h-4 w-4" />
                        Edit All Link to Term
                    </Button>

                    <Button
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
            ) : vm.filteredSubjects.length === 0 ? (
                <div className="text-sm text-muted-foreground">No subjects found.</div>
            ) : (
                <div className="space-y-4">
                    {groupedSubjects.map((group) => (
                        <div
                            key={group.semesterLabel}
                            className="overflow-hidden rounded-lg border"
                        >
                            <div className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-medium">
                                            {group.semesterLabel}
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

                                <div className="flex flex-wrap items-center gap-2">
                                    {group.inheritedCount > 0 ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                openBulkLinkDialog(
                                                    group.semesterLabel === INHERIT_SEMESTER_LABEL
                                                        ? ""
                                                        : group.semesterLabel
                                                )
                                            }
                                        >
                                            <Link2 className="mr-2 h-4 w-4" />
                                            Link Existing to Term
                                        </Button>
                                    ) : null}

                                    {group.inheritedCount > 0 ? (
                                        <Badge variant="outline">
                                            Unlinked subjects can now be bulk linked to a term
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-40">Code</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead className="w-72">College</TableHead>
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
                                            : "Not yet linked. Use Edit All Link to Term to permanently connect."

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
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                vm.setSubjectEditing(subject as any)
                                                                vm.setSubjectOpen(true)
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
                                                                    type: "subject",
                                                                    doc: subject as any,
                                                                })
                                                            }
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
                    ))}
                </div>
            )}

            <Dialog open={bulkLinkOpen} onOpenChange={setBulkLinkOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Link Existing Subjects to Term</DialogTitle>
                        <DialogDescription>
                            Bulk edit already-added subjects and permanently connect them
                            to an academic term for proper semester segregation.
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
                                    : "Choose the target term for the selected existing subjects."}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                            <div className="text-muted-foreground">
                                Eligible existing subjects:{" "}
                                <span className="font-medium text-foreground">
                                    {bulkLinkEligibleSubjects.length}
                                </span>
                            </div>

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
                        </div>

                        <ScrollArea className="h-80 rounded-md border">
                            <div className="space-y-2 p-3">
                                {bulkLinkEligibleSubjects.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No existing unlinked subjects match the selected term
                                        or semester filter.
                                    </div>
                                ) : (
                                    bulkLinkEligibleSubjects.map((subject) => {
                                        const subjectId = String(subject.$id)
                                        const subjectSemester =
                                            resolveSubjectSemester(subject, termMap) ||
                                            INHERIT_SEMESTER_LABEL
                                        const checked = bulkLinkSubjectIds.includes(subjectId)

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
                                                />

                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">
                                                            {subject.code}
                                                        </span>
                                                        <Badge variant="outline">
                                                            {subjectSemester}
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
                            variant="outline"
                            onClick={() => setBulkLinkOpen(false)}
                            disabled={bulkLinking}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void linkSelectedSubjectsToTerm()}
                            disabled={bulkLinking || !bulkLinkTermId}
                        >
                            {bulkLinking ? "Linking..." : "Save Term Links"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    )
}