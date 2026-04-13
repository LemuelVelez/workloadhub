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
    DialogDescription,
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

export function MasterDataCollegesTab({ vm }: Props) {
    const [selectedCollegeDetail, setSelectedCollegeDetail] = React.useState<any | null>(null)

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
                <>
                    <div className="overflow-hidden rounded-md border sm:hidden">
                        <Accordion type="single" collapsible className="w-full">
                            {vm.filteredColleges.map((d) => (
                                <AccordionItem key={d.$id} value={d.$id} className="px-4">
                                    <AccordionTrigger className="min-w-0 gap-2 text-left hover:no-underline">
                                        <div className="min-w-0 flex-1 overflow-hidden truncate pr-2 text-sm font-semibold">
                                            {d.name || d.code || "College"}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                onClick={() => setSelectedCollegeDetail(d)}
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

                    <Dialog
                        open={Boolean(selectedCollegeDetail)}
                        onOpenChange={(open) => {
                            if (!open) setSelectedCollegeDetail(null)
                        }}
                    >
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>
                                    {selectedCollegeDetail?.name || selectedCollegeDetail?.code || "College Details"}
                                </DialogTitle>
                                <DialogDescription>
                                    View the selected college record.
                                </DialogDescription>
                            </DialogHeader>

                            {selectedCollegeDetail ? (
                                <div className="grid gap-3 text-sm">
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">College Code</div>
                                        <div className="font-medium">{selectedCollegeDetail.code || "—"}</div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">College Name</div>
                                        <div>{selectedCollegeDetail.name || "—"}</div>
                                    </div>
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Active</div>
                                        <div>
                                            <Badge variant={selectedCollegeDetail.isActive ? "default" : "secondary"}>
                                                {selectedCollegeDetail.isActive ? "Yes" : "No"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedCollegeDetail(null)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (!selectedCollegeDetail) return
                                        vm.setCollegeEditing(selectedCollegeDetail)
                                        vm.setCollegeOpen(true)
                                        setSelectedCollegeDetail(null)
                                    }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (!selectedCollegeDetail) return
                                        vm.setDeleteIntent({
                                            type: "college",
                                            doc: selectedCollegeDetail,
                                        })
                                        setSelectedCollegeDetail(null)
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