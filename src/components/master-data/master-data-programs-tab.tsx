"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataProgramsTab({ vm }: Props) {
    const [selectedProgramDetail, setSelectedProgramDetail] = React.useState<any | null>(null)

    return (
        <TabsContent value="programs" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Programs / Courses</div>

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
                <>
                    <div className="overflow-hidden rounded-md border sm:hidden">
                        <Accordion type="single" collapsible className="w-full">
                            {vm.filteredPrograms.map((p) => (
                                <AccordionItem key={p.$id} value={p.$id} className="px-4">
                                    <AccordionTrigger className="min-w-0 gap-2 text-left hover:no-underline">
                                        <div className="min-w-0 flex-1 overflow-hidden truncate pr-2 text-sm font-semibold">
                                            {p.name || p.code || "Program"}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                onClick={() => setSelectedProgramDetail(p)}
                                            >
                                                Details
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    <div className="hidden overflow-hidden rounded-md border sm:block">
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

                    <Dialog
                        open={Boolean(selectedProgramDetail)}
                        onOpenChange={(open) => {
                            if (!open) setSelectedProgramDetail(null)
                        }}
                    >
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>
                                    {selectedProgramDetail?.name || selectedProgramDetail?.code || "Program Details"}
                                </DialogTitle>
                            </DialogHeader>

                            {selectedProgramDetail ? (
                                <div className="grid gap-3 text-sm">
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Program Code</div>
                                        <div className="font-medium">{selectedProgramDetail.code || "—"}</div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Program Name</div>
                                        <div>{selectedProgramDetail.name || "—"}</div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">College</div>
                                        <div>{vm.collegeLabel(vm.colleges, selectedProgramDetail.departmentId)}</div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Description</div>
                                        <div className="whitespace-pre-wrap text-muted-foreground">
                                            {selectedProgramDetail.description || selectedProgramDetail.desc || "—"}
                                        </div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Active</div>
                                        <div>
                                            <Badge variant={selectedProgramDetail.isActive ? "default" : "secondary"}>
                                                {selectedProgramDetail.isActive ? "Yes" : "No"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedProgramDetail(null)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (!selectedProgramDetail) return
                                        vm.setProgramEditing(selectedProgramDetail)
                                        vm.setProgramOpen(true)
                                        setSelectedProgramDetail(null)
                                    }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (!selectedProgramDetail) return
                                        vm.setDeleteIntent({
                                            type: "program",
                                            doc: selectedProgramDetail,
                                        })
                                        setSelectedProgramDetail(null)
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
        </TabsContent>
    )
}