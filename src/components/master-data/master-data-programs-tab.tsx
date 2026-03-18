"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataProgramsTab({ vm }: Props) {
    return (
        <TabsContent value="programs" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Programs / Courses</div>
                    <div className="text-sm text-muted-foreground">
                        Manage programs handled by colleges.
                    </div>
                </div>

                <Button
                    size="sm"
                    onClick={() => {
                        vm.setProgramEditing(null)
                        vm.setProgramOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Program
                </Button>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : vm.filteredPrograms.length === 0 ? (
                <div className="text-sm text-muted-foreground">No programs found.</div>
            ) : (
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-32">Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-72">College</TableHead>
                                <TableHead className="w-24">Active</TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vm.filteredPrograms.map((p) => (
                                <TableRow key={p.$id}>
                                    <TableCell className="font-medium">{p.code}</TableCell>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {vm.collegeLabel(vm.colleges, p.departmentId)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={p.isActive ? "default" : "secondary"}>
                                            {p.isActive ? "Yes" : "No"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    vm.setProgramEditing(p)
                                                    vm.setProgramOpen(true)
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
                                                        type: "program",
                                                        doc: p,
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