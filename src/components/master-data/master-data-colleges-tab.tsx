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

export function MasterDataCollegesTab({ vm }: Props) {
    return (
        <TabsContent value="colleges" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium">Colleges</div>
                    <div className="text-sm text-muted-foreground">
                        Add/edit college records.
                    </div>
                </div>

                <Button
                    size="sm"
                    onClick={() => {
                        vm.setCollegeEditing(null)
                        vm.setCollegeOpen(true)
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add College
                </Button>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : vm.filteredColleges.length === 0 ? (
                <div className="text-sm text-muted-foreground">No colleges found.</div>
            ) : (
                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-24">Active</TableHead>
                                <TableHead className="w-40 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vm.filteredColleges.map((d) => (
                                <TableRow key={d.$id}>
                                    <TableCell className="font-medium">{d.code}</TableCell>
                                    <TableCell>{d.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={d.isActive ? "default" : "secondary"}>
                                            {d.isActive ? "Yes" : "No"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    vm.setCollegeEditing(d)
                                                    vm.setCollegeOpen(true)
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
                                                        type: "college",
                                                        doc: d,
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