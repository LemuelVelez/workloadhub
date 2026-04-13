"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"
import {
    buildFacultyAssignedLoad,
    EMPTY_FACULTY_LOAD,
    formatLoadNumber,
    normalizeGroupKey,
} from "./master-data-utils"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataFacultyTab({ vm }: Props) {
    const sourceRecordRows = React.useMemo(() => {
        const rawRecordRows = (vm as any).recordRows
        return Array.isArray(rawRecordRows) ? rawRecordRows : vm.filteredRecordRows
    }, [vm, vm.filteredRecordRows])

    const facultyAssignedLoadMap = React.useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildFacultyAssignedLoad>>()

        for (const faculty of vm.filteredFaculty) {
            map.set(
                normalizeGroupKey(faculty.userId),
                buildFacultyAssignedLoad(
                    String(faculty.userId ?? ""),
                    sourceRecordRows,
                    vm.subjects
                )
            )
        }

        return map
    }, [sourceRecordRows, vm.filteredFaculty, vm.subjects])

    const [selectedFacultyDetail, setSelectedFacultyDetail] = React.useState<any | null>(null)

    const selectedFacultyUser = selectedFacultyDetail
        ? vm.facultyUserMap.get(String(selectedFacultyDetail.userId ?? "").trim()) ?? null
        : null
    const selectedFacultyName = selectedFacultyUser
        ? vm.facultyDisplay(selectedFacultyUser)
        : "Unknown faculty"
    const selectedFacultyCollegeName = selectedFacultyDetail
        ? vm.collegeLabel(vm.colleges, selectedFacultyDetail.departmentId)
        : "—"
    const selectedFacultyLoad = selectedFacultyDetail
        ? facultyAssignedLoadMap.get(normalizeGroupKey(selectedFacultyDetail.userId)) ?? EMPTY_FACULTY_LOAD
        : EMPTY_FACULTY_LOAD

    return (
        <TabsContent value="faculty" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Faculty</div>
                    <div className="text-sm text-muted-foreground">
                        Faculty info, rank, and auto-calculated teaching load based on
                        assigned subjects.
                    </div>
                </div>

                <Button
                    size="sm"
                    onClick={() => {
                        vm.setFacultyEditing(null)
                        vm.setFacultyOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Faculty
                </Button>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : vm.filteredFaculty.length === 0 ? (
                <div className="text-sm text-muted-foreground">No faculty found.</div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-md border sm:hidden">
                        <Accordion type="single" collapsible className="w-full">
                            {vm.filteredFaculty.map((f) => {
                                const u =
                                    vm.facultyUserMap.get(String(f.userId ?? "").trim()) ?? null
                                const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"

                                return (
                                    <AccordionItem key={f.$id} value={f.$id} className="px-4">
                                        <AccordionTrigger className="text-left hover:no-underline">
                                            <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                                                {facultyName}
                                            </div>
                                        </AccordionTrigger>

                                        <AccordionContent className="pb-4">
                                            <div className="flex justify-end">
                                                <Button
                                                    size="sm"
                                                    onClick={() => setSelectedFacultyDetail(f)}
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

                    <div className="hidden overflow-hidden rounded-md border sm:block">
                        <Accordion type="single" collapsible className="w-full">
                            {vm.filteredFaculty.map((f) => {
                                const u =
                                    vm.facultyUserMap.get(String(f.userId ?? "").trim()) ?? null
                                const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"
                                const collegeName = vm.collegeLabel(vm.colleges, f.departmentId)
                                const load =
                                    facultyAssignedLoadMap.get(normalizeGroupKey(f.userId)) ??
                                    EMPTY_FACULTY_LOAD

                                return (
                                    <AccordionItem key={f.$id} value={f.$id} className="px-4">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex min-w-0 flex-1 flex-col text-left">
                                                <div className="truncate text-sm font-semibold">
                                                    {facultyName}
                                                </div>

                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{collegeName}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {f.employeeNo || "No employee no"}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        Subjects: {load.assignedSubjectCount}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        Units: {formatLoadNumber(load.totalUnits)}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        Hours: {formatLoadNumber(load.totalHours)}
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>

                                        <AccordionContent>
                                            <div className="grid gap-4">
                                                <div className="grid gap-4 lg:grid-cols-2">
                                                    <div className="rounded-md border p-4">
                                                        <div className="mb-3 text-sm font-medium">
                                                            Faculty Details
                                                        </div>

                                                        <div className="grid gap-3 text-sm">
                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Faculty
                                                                </div>
                                                                <div className="wrap-break-word font-medium">
                                                                    {facultyName}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    User ID
                                                                </div>
                                                                <div className="break-all text-muted-foreground">
                                                                    {f.userId}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Employee No
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {f.employeeNo || "—"}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    College
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {collegeName}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Rank
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {f.rank || "—"}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Notes
                                                                </div>
                                                                <div className="whitespace-pre-wrap wrap-break-word text-muted-foreground">
                                                                    {f.notes || "—"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-md border p-4">
                                                        <div className="mb-3 text-sm font-medium">
                                                            Auto-Calculated Teaching Load
                                                        </div>

                                                        <div className="grid gap-3 text-sm">
                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Assigned Subjects
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {load.assignedSubjectCount}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Assigned Records
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {load.assignedRecordCount}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Total Units
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {formatLoadNumber(load.totalUnits)}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Total Hours
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {formatLoadNumber(load.totalHours)}
                                                                </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                                <div className="text-xs font-medium text-muted-foreground">
                                                                    Source
                                                                </div>
                                                                <div className="whitespace-pre-wrap wrap-break-word text-muted-foreground">
                                                                    Load is derived automatically
                                                                    from the faculty
                                                                    member&apos;s assigned
                                                                    subjects and records, so
                                                                    units and hours no longer
                                                                    need manual encoding in
                                                                    Faculty.
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            vm.setFacultyEditing(f)
                                                            vm.setFacultyOpen(true)
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
                                                                type: "faculty",
                                                                doc: f,
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                    </div>

                    <Dialog
                        open={Boolean(selectedFacultyDetail)}
                        onOpenChange={(open) => {
                            if (!open) setSelectedFacultyDetail(null)
                        }}
                    >
                        <DialogContent className="sm:max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{selectedFacultyName}</DialogTitle>
                                <DialogDescription>
                                    View the selected faculty profile and teaching load.
                                </DialogDescription>
                            </DialogHeader>

                            {selectedFacultyDetail ? (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-md border p-4">
                                        <div className="mb-3 text-sm font-medium">Faculty Details</div>
                                        <div className="grid gap-3 text-sm">
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Faculty</div>
                                                <div className="font-medium">{selectedFacultyName}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">User ID</div>
                                                <div className="break-all text-muted-foreground">
                                                    {selectedFacultyDetail.userId}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Employee No</div>
                                                <div className="text-muted-foreground">
                                                    {selectedFacultyDetail.employeeNo || "—"}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">College</div>
                                                <div className="text-muted-foreground">{selectedFacultyCollegeName}</div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Rank</div>
                                                <div className="text-muted-foreground">
                                                    {selectedFacultyDetail.rank || "—"}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Notes</div>
                                                <div className="whitespace-pre-wrap text-muted-foreground">
                                                    {selectedFacultyDetail.notes || "—"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-md border p-4">
                                        <div className="mb-3 text-sm font-medium">Auto-Calculated Teaching Load</div>
                                        <div className="grid gap-3 text-sm">
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Assigned Subjects</div>
                                                <div className="text-muted-foreground">
                                                    {selectedFacultyLoad.assignedSubjectCount}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Assigned Records</div>
                                                <div className="text-muted-foreground">
                                                    {selectedFacultyLoad.assignedRecordCount}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Total Units</div>
                                                <div className="text-muted-foreground">
                                                    {formatLoadNumber(selectedFacultyLoad.totalUnits)}
                                                </div>
                                            </div>
                                            <div className="grid gap-1">
                                                <div className="text-xs font-medium text-muted-foreground">Total Hours</div>
                                                <div className="text-muted-foreground">
                                                    {formatLoadNumber(selectedFacultyLoad.totalHours)}
                                                </div>
                                            </div>
                                            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                                Teaching load is computed automatically from the faculty
                                                member&apos;s assigned subjects and records.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedFacultyDetail(null)}>
                                    Close
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (!selectedFacultyDetail) return
                                        vm.setFacultyEditing(selectedFacultyDetail)
                                        vm.setFacultyOpen(true)
                                        setSelectedFacultyDetail(null)
                                    }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (!selectedFacultyDetail) return
                                        vm.setDeleteIntent({
                                            type: "faculty",
                                            doc: selectedFacultyDetail,
                                        })
                                        setSelectedFacultyDetail(null)
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Optional: Encode List of Faculties</CardTitle>
                    <CardDescription>
                        Useful when the same faculty roster repeats every semester. Format per
                        line: userId,employeeNo,rank,maxUnits,maxHours,notes. Max units and max
                        hours remain legacy optional caps, while the displayed teaching load is
                        automatically computed from assigned subjects.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Default College</label>
                            <Select
                                value={vm.facBulkCollegeId}
                                onValueChange={vm.setFacBulkCollegeId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Textarea
                        value={vm.facBulkText}
                        onChange={(e) => vm.setFacBulkText(e.target.value)}
                        placeholder={`faculty-user-id-1,2026-001,Instructor I,18,24,Regular load
faculty-user-id-2,2026-002,Assistant Professor,18,24,Thesis adviser`}
                        className="min-h-40"
                    />

                    <div className="flex items-center justify-end">
                        <Button onClick={() => void vm.saveFacultyBulkList()}>
                            Encode Faculty List
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
    )
}