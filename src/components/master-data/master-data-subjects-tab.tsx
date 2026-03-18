"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataSubjectsTab({ vm }: Props) {
    return (
        <TabsContent value="subjects" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Subjects</div>
                    <div className="text-sm text-muted-foreground">
                        Manage subject list, units, and hours.
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
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Code</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead className="w-72">College</TableHead>
                                <TableHead className="w-44">Units / Hours</TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vm.filteredSubjects.map((s) => (
                                <TableRow key={s.$id}>
                                    <TableCell className="font-medium">{s.code}</TableCell>
                                    <TableCell>{s.title}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {vm.collegeLabel(vm.colleges, s.departmentId ?? null)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-xs text-muted-foreground">
                                            Units:{" "}
                                            <span className="font-medium text-foreground">
                                                {s.units}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Lec {s.lectureHours} / Lab {s.labHours} ={" "}
                                            <span className="font-medium text-foreground">
                                                {Number.isFinite(Number(s.totalHours))
                                                    ? s.totalHours
                                                    : s.lectureHours + s.labHours}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    vm.setSubjectEditing(s)
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
        </TabsContent>
    )
}