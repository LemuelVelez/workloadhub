"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Pencil } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"
import { RecordMobileCards } from "./master-data-mobile-cards"
import { RecordsExcelActions } from "./records-excel-actions"
import { RecordsPdfActions } from "./records-pdf-actions"
import { buildGroupedRecordRows, formatTimeAmPm } from "./master-data-utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
    resolveTermLabel: (row: any) => string
    onEditRecord: (row: any) => void
}

export function MasterDataRecordsTab({
    vm,
    resolveTermLabel,
    onEditRecord,
}: Props) {
    const recordSubjectFilterLabel = React.useMemo(() => {
        const v = String((vm as any).recordSubjectFilter ?? "__all__")
        if (!v || v === "__all__") return "All Subjects"

        const subject = (vm.subjects ?? []).find((x: any) => String(x.$id) === v)
        if (!subject) return "Selected Subject"

        return `${subject.code} — ${subject.title}`
    }, [vm])

    const recordUnitFilterLabel = React.useMemo(() => {
        const v = String((vm as any).recordUnitFilter ?? "__all__")
        if (!v || v === "__all__") return "All Units"

        const n = Number(v)
        if (!Number.isFinite(n)) return "Selected Units"

        return `${n} unit${n > 1 ? "s" : ""}`
    }, [vm])

    const groupedRecordRows = React.useMemo(() => {
        return buildGroupedRecordRows(
            vm.filteredRecordRows,
            vm.conflictRecordIds,
            resolveTermLabel
        )
    }, [vm.filteredRecordRows, vm.conflictRecordIds, resolveTermLabel])

    return (
        <TabsContent value="records" className="space-y-4">
            <div className="space-y-3">
                <div>
                    <div className="font-medium">List of Records</div>
                    <div className="text-sm text-muted-foreground">
                        Conflict detection focuses on room + day/time overlap. Same subject
                        across different faculty is allowed.
                    </div>
                </div>

                <Alert>
                    <AlertTitle>Conflict Rule in Use</AlertTitle>
                    <AlertDescription>
                        Detected conflict = same term + same room + same day + overlapping
                        time. Faculty and subject repetition are allowed.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Subject</label>
                        <Select
                            value={vm.recordSubjectFilter}
                            onValueChange={vm.setRecordSubjectFilter}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Subjects</SelectItem>
                                {vm.subjects.map((s) => (
                                    <SelectItem key={s.$id} value={s.$id}>
                                        {s.code} — {s.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Units</label>
                        <Select
                            value={vm.recordUnitFilter}
                            onValueChange={vm.setRecordUnitFilter}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Units" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Units</SelectItem>
                                {vm.recordUnitOptions.map((u) => (
                                    <SelectItem key={u} value={String(u)}>
                                        {u} unit{u > 1 ? "s" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing{" "}
                        <span className="font-medium text-foreground">
                            {vm.filteredRecordRows.length}
                        </span>{" "}
                        record{vm.filteredRecordRows.length === 1 ? "" : "s"} •{" "}
                        <span className="font-medium text-foreground">
                            {recordSubjectFilterLabel}
                        </span>{" "}
                        •{" "}
                        <span className="font-medium text-foreground">
                            {recordUnitFilterLabel}
                        </span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <RecordsExcelActions
                            rows={vm.filteredRecordRows}
                            resolveTermLabel={resolveTermLabel}
                            conflictRecordIds={vm.conflictRecordIds}
                            subjectFilterLabel={recordSubjectFilterLabel}
                            unitFilterLabel={recordUnitFilterLabel}
                            showBatchFacultyExport={false}
                        />

                        <RecordsPdfActions
                            rows={vm.filteredRecordRows}
                            resolveTermLabel={resolveTermLabel}
                            conflictRecordIds={vm.conflictRecordIds}
                            subjectFilterLabel={recordSubjectFilterLabel}
                            unitFilterLabel={recordUnitFilterLabel}
                            showBatchFacultyExport={false}
                        />
                    </div>
                </div>
            </div>

            {vm.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : vm.filteredRecordRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No records found using current filters.
                </div>
            ) : (
                <div className="overflow-hidden rounded-md border">
                    <Accordion type="single" collapsible className="w-full">
                        {groupedRecordRows.map((group, index) => (
                            <AccordionItem
                                key={`${group.key}-${index}`}
                                value={`${group.key}-${index}`}
                                className="px-3 sm:px-4"
                            >
                                <AccordionTrigger className="min-w-0 gap-2 py-3 text-left hover:no-underline sm:gap-4">
                                    <div className="flex min-w-0 flex-1 flex-col pr-2 text-left">
                                        <div className="wrap-break-word text-sm font-semibold leading-5 sm:truncate">
                                            {group.facultyLabel}
                                        </div>

                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                                            <span>
                                                {group.rows.length} record
                                                {group.rows.length === 1 ? "" : "s"}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {group.conflictCount} conflict
                                                {group.conflictCount === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className="space-y-4 pb-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        <RecordsExcelActions
                                            rows={group.rows}
                                            resolveTermLabel={resolveTermLabel}
                                            conflictRecordIds={vm.conflictRecordIds}
                                            subjectFilterLabel={recordSubjectFilterLabel}
                                            unitFilterLabel={recordUnitFilterLabel}
                                            showBatchFacultyExport={false}
                                        />

                                        <RecordsPdfActions
                                            rows={group.rows}
                                            resolveTermLabel={resolveTermLabel}
                                            conflictRecordIds={vm.conflictRecordIds}
                                            subjectFilterLabel={recordSubjectFilterLabel}
                                            unitFilterLabel={recordUnitFilterLabel}
                                            showBatchFacultyExport={false}
                                        />
                                    </div>

                                    <div className="sm:hidden">
                                        <RecordMobileCards
                                            rows={group.rows}
                                            resolveTermLabel={resolveTermLabel}
                                            conflictRecordIds={vm.conflictRecordIds}
                                            onEdit={onEditRecord}
                                        />
                                    </div>

                                    <div className="hidden rounded-md border sm:block">
                                        <ScrollArea className="w-full">
                                            <div className="min-w-max">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-48">
                                                                Term
                                                            </TableHead>
                                                            <TableHead className="w-28">
                                                                Day
                                                            </TableHead>
                                                            <TableHead className="w-36">
                                                                Time
                                                            </TableHead>
                                                            <TableHead className="w-48">
                                                                Room
                                                            </TableHead>
                                                            <TableHead className="w-80">
                                                                Subject
                                                            </TableHead>
                                                            <TableHead className="w-20">
                                                                Units
                                                            </TableHead>
                                                            <TableHead className="w-28">
                                                                Conflict
                                                            </TableHead>
                                                            <TableHead className="w-32 text-right">
                                                                Actions
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {group.rows.map((r) => {
                                                            const hasConflict =
                                                                vm.conflictRecordIds.has(
                                                                    String(r.id ?? "").trim()
                                                                )
                                                            const termText =
                                                                resolveTermLabel(r)

                                                            return (
                                                                <TableRow key={r.id}>
                                                                    <TableCell className="text-muted-foreground">
                                                                        {termText}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {r.dayOfWeek || "—"}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {formatTimeAmPm(
                                                                            r.startTime
                                                                        )}{" "}
                                                                        -{" "}
                                                                        {formatTimeAmPm(
                                                                            r.endTime
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {r.roomLabel}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="font-medium">
                                                                            {r.subjectCode}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {r.subjectTitle}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {r.units ?? "—"}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge
                                                                            variant={
                                                                                hasConflict
                                                                                    ? "destructive"
                                                                                    : "secondary"
                                                                            }
                                                                        >
                                                                            {hasConflict
                                                                                ? "Conflict"
                                                                                : "Clear"}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                onEditRecord(r)
                                                                            }
                                                                        >
                                                                            <Pencil className="mr-2 h-4 w-4" />
                                                                            Edit
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            )}
        </TabsContent>
    )
}