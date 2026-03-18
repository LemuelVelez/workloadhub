"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataSectionsTab({ vm }: Props) {
    return (
        <TabsContent value="sections" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="font-medium">Sections</div>
                    <div className="text-sm text-muted-foreground">
                        Manage class sections per term (A–Z + Others), including year level
                        and student count.
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="w-full sm:w-80">
                        <Select value={vm.selectedTermId} onValueChange={vm.setSelectedTermId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Academic Term" />
                            </SelectTrigger>
                            <SelectContent>
                                {vm.terms.length === 0 ? (
                                    <SelectItem value="__none__" disabled>
                                        No academic terms found
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
                    No academic terms found. Create an Academic Term first to manage
                    Sections.
                </div>
            ) : vm.filteredSections.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No sections found for this term.
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Section</TableHead>
                                <TableHead className="w-72">College</TableHead>
                                <TableHead>Program (optional)</TableHead>
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
                                            {`${String(s.yearLevel ?? "").trim()}${
                                                s.name ? ` - ${s.name}` : ""
                                            }`.trim() || "—"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {vm.collegeLabel(vm.colleges, s.departmentId)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {vm.programLabel(vm.programs, s.programId ?? null)}
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
        </TabsContent>
    )
}