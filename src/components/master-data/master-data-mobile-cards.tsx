/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Pencil, Trash2 } from "lucide-react"

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

type Props = {
    vm: MasterDataManagementVM
}

type RecordCardsProps = {
    rows: any[]
    resolveTermLabel: (r: any) => string
    conflictRecordIds: Set<string>
    onEdit: (r: any) => void
}

function safeRecordId(r: any) {
    return String(r?.id ?? r?.$id ?? r?.recordId ?? r?.record_id ?? "").trim()
}

function pad2(n: number) {
    return String(n).padStart(2, "0")
}

function formatTimeAmPm(value: any) {
    const raw = String(value ?? "").trim()
    if (!raw || raw === "—") return "—"

    if (/\b(am|pm)\b/i.test(raw)) {
        return raw.replace(/\s+/g, " ").trim()
    }

    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
    if (!m) return raw

    const hh = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return raw
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return raw

    const suffix = hh >= 12 ? "PM" : "AM"
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    return `${h12}:${pad2(mm)} ${suffix}`
}

export function FacultyMobileCards({ vm }: Props) {
    return (
        <div className="space-y-2">
            {vm.filteredFaculty.map((f) => {
                const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                const facultyName = u ? vm.facultyDisplay(u) : "Unknown faculty"
                const collegeName = vm.collegeLabel(vm.colleges, f.departmentId)

                return (
                    <Card key={f.$id} className="min-w-0 w-full max-w-full overflow-hidden">
                        <CardHeader className="space-y-2 px-3 py-3">
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="min-w-0 space-y-1">
                                    <CardTitle className="wrap-break-word text-sm leading-5">
                                        {facultyName}
                                    </CardTitle>
                                    <CardDescription className="wrap-break-word text-xs leading-5">
                                        {collegeName}
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant="secondary"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {f.employeeNo || "No employee no"}
                                </Badge>
                            </div>

                            <div className="flex min-w-0 flex-col gap-2">
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {f.rank || "No rank"}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    Units: {f.maxUnits ?? "—"}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    Hours: {f.maxHours ?? "—"}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-2 px-3 pb-3 pt-0">
                            <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-2.5 text-sm">
                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">User ID</div>
                                    <div className="wrap-break-word text-sm leading-5">{f.userId}</div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Employee No</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {f.employeeNo || "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">College</div>
                                    <div className="wrap-break-word text-sm leading-5">{collegeName}</div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Rank</div>
                                    <div className="wrap-break-word text-sm leading-5">{f.rank || "—"}</div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Max Units</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {f.maxUnits ?? "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Max Hours</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {f.maxHours ?? "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Notes</div>
                                    <div className="wrap-break-word whitespace-pre-wrap text-sm leading-5">
                                        {f.notes || "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-full justify-start px-3"
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
                                    className="h-9 w-full justify-start px-3"
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

export function RecordMobileCards({
    rows,
    resolveTermLabel,
    conflictRecordIds,
    onEdit,
}: RecordCardsProps) {
    const [selectedRecord, setSelectedRecord] = React.useState<any | null>(null)

    const selectedRecordId = selectedRecord ? safeRecordId(selectedRecord) : ""
    const selectedHasConflict = selectedRecordId
        ? conflictRecordIds.has(selectedRecordId)
        : false

    return (
        <>
            <div className="overflow-hidden rounded-md border">
                <Accordion type="single" collapsible className="w-full">
                    {rows.map((r, idx) => {
                        const recordId = safeRecordId(r) || `record-${idx}`
                        const hasConflict = recordId ? conflictRecordIds.has(recordId) : false

                        return (
                            <AccordionItem key={recordId} value={recordId} className="px-4">
                                <AccordionTrigger className="text-left hover:no-underline">
                                    <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                                        {r.subjectCode || r.subjectTitle || `Record ${idx + 1}`}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-3 pb-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={hasConflict ? "destructive" : "secondary"}>
                                            {hasConflict ? "Conflict" : "Clear"}
                                        </Badge>
                                        <Badge variant="outline">{resolveTermLabel(r)}</Badge>
                                        <Badge variant="outline">{r.dayOfWeek || "—"}</Badge>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button size="sm" onClick={() => setSelectedRecord(r)}>
                                            Details
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            </div>

            <Dialog
                open={Boolean(selectedRecord)}
                onOpenChange={(open) => {
                    if (!open) setSelectedRecord(null)
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedRecord?.subjectCode || selectedRecord?.subjectTitle || "Record Details"}
                        </DialogTitle>
                        <DialogDescription>
                            View the selected record details.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord ? (
                        <div className="grid gap-3 text-sm">
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Subject</div>
                                <div className="font-medium">{selectedRecord.subjectCode || "TBA"}</div>
                                <div className="text-muted-foreground">
                                    {selectedRecord.subjectTitle || "Unknown Subject"}
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Term</div>
                                <div>{resolveTermLabel(selectedRecord)}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Day</div>
                                <div>{selectedRecord.dayOfWeek || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Time</div>
                                <div>
                                    {formatTimeAmPm(selectedRecord.startTime)} - {formatTimeAmPm(selectedRecord.endTime)}
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Room</div>
                                <div>{selectedRecord.roomLabel || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">College</div>
                                <div>{selectedRecord.collegeLabel || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Program</div>
                                <div>{selectedRecord.programLabel || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Section</div>
                                <div>{selectedRecord.sectionLabel || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Class Code</div>
                                <div>{selectedRecord.classCode || "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Units</div>
                                <div>{selectedRecord.units ?? "—"}</div>
                            </div>
                            <div className="grid gap-1">
                                <div className="text-xs font-medium text-muted-foreground">Conflict Status</div>
                                <div>
                                    <Badge variant={selectedHasConflict ? "destructive" : "secondary"}>
                                        {selectedHasConflict ? "Conflict" : "Clear"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedRecord(null)}>
                            Close
                        </Button>
                        <Button
                            onClick={() => {
                                if (!selectedRecord) return
                                onEdit(selectedRecord)
                                setSelectedRecord(null)
                            }}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}