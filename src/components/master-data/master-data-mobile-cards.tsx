/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

type Props = {
    vm: MasterDataManagementVM
}

export function FacultyMobileCards({ vm }: Props) {
    return (
        <div className="space-y-3">
            {vm.filteredFaculty.map((f) => {
                const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"
                const collegeName = vm.collegeLabel(vm.colleges, f.departmentId)

                return (
                    <Card key={f.$id}>
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <CardTitle className="text-base leading-6 wrap-break-word">
                                        {facultyName}
                                    </CardTitle>
                                    <CardDescription className="wrap-break-word">
                                        {collegeName}
                                    </CardDescription>
                                </div>

                                <Badge variant="secondary" className="shrink-0">
                                    {f.employeeNo || "No employee no"}
                                </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{f.rank || "No rank"}</Badge>
                                <Badge variant="outline">
                                    Units: {f.maxUnits ?? "—"}
                                </Badge>
                                <Badge variant="outline">
                                    Hours: {f.maxHours ?? "—"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                            <div className="grid gap-3 rounded-lg border p-3 text-sm">
                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">User ID</div>
                                    <div className="break-all">{f.userId}</div>
                                </div>

                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Employee No</div>
                                    <div>{f.employeeNo || "—"}</div>
                                </div>

                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">College</div>
                                    <div>{collegeName}</div>
                                </div>

                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Rank</div>
                                    <div>{f.rank || "—"}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Max Units</div>
                                        <div>{f.maxUnits ?? "—"}</div>
                                    </div>

                                    <div className="grid gap-1">
                                        <div className="text-xs font-medium text-muted-foreground">Max Hours</div>
                                        <div>{f.maxHours ?? "—"}</div>
                                    </div>
                                </div>

                                <div className="grid gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Notes</div>
                                    <div className="whitespace-pre-wrap wrap-break-word">
                                        {f.notes || "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
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
                                    onClick={() => vm.setDeleteIntent({ type: "faculty", doc: f })}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}