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
    return (
        <div className="space-y-2">
            {rows.map((r, idx) => {
                const recordId = safeRecordId(r) || `record-${idx}`
                const hasConflict = recordId ? conflictRecordIds.has(recordId) : false

                return (
                    <Card key={recordId} className="min-w-0 w-full max-w-full overflow-hidden">
                        <CardHeader className="space-y-2 px-3 py-3">
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="min-w-0 space-y-1">
                                    <CardTitle className="wrap-break-word text-sm leading-5">
                                        {r.subjectCode || "TBA"}
                                    </CardTitle>
                                    <CardDescription className="wrap-break-word text-xs leading-5">
                                        {r.subjectTitle || "Unknown Subject"}
                                    </CardDescription>
                                </div>

                                <Badge
                                    variant={hasConflict ? "destructive" : "secondary"}
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {hasConflict ? "Conflict" : "Clear"}
                                </Badge>
                            </div>

                            <div className="flex min-w-0 flex-col gap-2">
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {resolveTermLabel(r)}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {r.dayOfWeek || "—"}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="h-auto w-fit max-w-full wrap-break-word whitespace-normal px-2 py-1 text-left text-xs leading-5"
                                >
                                    {r.units ?? "—"} unit{Number(r.units) > 1 ? "s" : ""}
                                </Badge>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-2 px-3 pb-3 pt-0">
                            <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-2.5 text-sm">
                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Time</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {formatTimeAmPm(r.startTime)} - {formatTimeAmPm(r.endTime)}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Room</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {r.roomLabel || "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">College</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {r.collegeLabel || "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Program</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {r.programLabel || "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Section</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {r.sectionLabel || "—"}
                                    </div>
                                </div>

                                <div className="grid min-w-0 gap-1">
                                    <div className="text-xs font-medium text-muted-foreground">Class Code</div>
                                    <div className="wrap-break-word text-sm leading-5">
                                        {r.classCode || "—"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 w-full justify-start px-3"
                                    onClick={() => onEdit(r)}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}