"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"

import type { AcademicTermDoc, SubjectDoc } from "../../../model/schemaModel"
import type { MasterDataManagementVM } from "./use-master-data"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    if (normalized === "No Semester / Inherit from Selected Term") return 99
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
    const termMap = React.useMemo(() => {
        const map = new Map<string, LooseAcademicTermDoc>()
        for (const term of vm.terms as LooseAcademicTermDoc[]) {
            map.set(String(term.$id), term)
        }
        return map
    }, [vm.terms])

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
                "No Semester / Inherit from Selected Term"

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

    return (
        <TabsContent value="subjects" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Subjects</div>
                    <div className="text-sm text-muted-foreground">
                        Manage subject list, units, hours, and semester segregation.
                    </div>
                </div>

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

                                {group.inheritedCount > 0 ? (
                                    <Badge variant="outline">
                                        Unlinked subjects inherit selected term when used
                                    </Badge>
                                ) : null}
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
                                            "No Semester / Inherit from Selected Term"

                                        const termLabel = linkedTermId
                                            ? vm.termLabel(vm.terms, linkedTermId)
                                            : "Will inherit from selected term when used in records"

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
                                                                vm.setSubjectEditing(subject)
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
                                                                    doc: subject,
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
        </TabsContent>
    )
}