"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"

import type { MasterDataManagementVM } from "./use-master-data"
import { MasterDataCollegesTab } from "./master-data-colleges-tab"
import { MasterDataProgramsTab } from "./master-data-programs-tab"
import { MasterDataSubjectsTab } from "./master-data-subjects-tab"
import { MasterDataFacultyTab } from "./master-data-faculty-tab"
import { MasterDataSectionsTab } from "./master-data-sections-tab"
import { MasterDataRecordsTab } from "./master-data-records-tab"
import { MasterDataRecordEditDialog } from "./master-data-record-edit-dialog"
import { isUnknownLabel } from "./master-data-utils"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataTabs({ vm }: Props) {
    const [recordEditOpen, setRecordEditOpen] = React.useState(false)
    const [recordEditingRow, setRecordEditingRow] = React.useState<any | null>(null)

    const TAB_OPTIONS = React.useMemo(
        () => [
            { value: "colleges", label: "Colleges" },
            { value: "programs", label: "Programs/Courses" },
            { value: "subjects", label: "Subjects" },
            { value: "faculty", label: "Faculty" },
            { value: "sections", label: "Sections" },
            { value: "records", label: "List of Records" },
        ],
        []
    )

    const openEditRecord = React.useCallback((row: any) => {
        setRecordEditingRow(row)
        setRecordEditOpen(true)
    }, [])

    const resolveTermLabel = React.useCallback(
        (row: any) => {
            const termId =
                (row?.termId ??
                    row?.academicTermId ??
                    row?.term ??
                    row?.term_id ??
                    row?.termID ??
                    "") as string

            const computed = termId ? vm.termLabel(vm.terms, termId) : ""
            if (computed && !isUnknownLabel(computed)) return computed

            const fromRow = row?.termLabel ?? row?.term_name ?? row?.termText ?? ""
            if (fromRow && !isUnknownLabel(fromRow)) return String(fromRow)

            return "—"
        },
        [vm]
    )

    const tabsContent = (
        <>
            <Tabs
                value={vm.tab}
                onValueChange={(value) => vm.setTab(value as any)}
                className="w-full"
            >
                <div className="sm:hidden">
                    <Select
                        value={vm.tab}
                        onValueChange={(value) => vm.setTab(value as any)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                            {TAB_OPTIONS.map((tab) => (
                                <SelectItem key={tab.value} value={tab.value}>
                                    {tab.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <TabsList className="hidden w-full grid-cols-2 sm:grid lg:grid-cols-6">
                    <TabsTrigger
                        value="colleges"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        Colleges
                    </TabsTrigger>
                    <TabsTrigger
                        value="programs"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        Programs/Courses
                    </TabsTrigger>
                    <TabsTrigger
                        value="subjects"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        Subjects
                    </TabsTrigger>
                    <TabsTrigger
                        value="faculty"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        Faculty
                    </TabsTrigger>
                    <TabsTrigger
                        value="sections"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        Sections
                    </TabsTrigger>
                    <TabsTrigger
                        value="records"
                        className="data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!"
                    >
                        List of Records
                    </TabsTrigger>
                </TabsList>

                <Separator className="my-4" />

                <MasterDataCollegesTab vm={vm} />
                <MasterDataProgramsTab vm={vm} />
                <MasterDataSubjectsTab vm={vm} />
                <MasterDataFacultyTab vm={vm} />
                <MasterDataSectionsTab vm={vm} />
                <MasterDataRecordsTab
                    vm={vm}
                    resolveTermLabel={resolveTermLabel}
                    onEditRecord={openEditRecord}
                />
            </Tabs>

            <MasterDataRecordEditDialog
                vm={vm}
                open={recordEditOpen}
                onOpenChange={setRecordEditOpen}
                editingRow={recordEditingRow}
                onEditingRowChange={setRecordEditingRow}
            />
        </>
    )

    return (
        <>
            <div className="sm:hidden">
                <div className="overflow-hidden rounded-md border bg-card text-card-foreground">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="master-data-summary" className="border-b-0">
                            <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                                <div className="text-sm font-semibold">Master Data Summary</div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <div className="space-y-2">
                                    {vm.stats.map((s) => (
                                        <div
                                            key={s.label}
                                            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium">{s.label}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-lg font-semibold">{s.value}</div>
                                                <Badge variant="secondary">Total</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>

            <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5">
                {vm.stats.map((s) => (
                    <Card key={s.label}>
                        <CardHeader className="pb-2">
                            <CardDescription>{s.label}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{s.value}</div>
                            <Badge variant="secondary">Total</Badge>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="overflow-hidden rounded-md border bg-card text-card-foreground shadow-sm">
                <Accordion
                    type="single"
                    collapsible
                    defaultValue="manage-records"
                    className="w-full"
                >
                    <AccordionItem value="manage-records" className="border-b-0">
                        <div className="hidden border-b px-6 py-6 sm:block">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="text-lg font-semibold leading-none tracking-tight">
                                        Manage Records
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Input
                                        value={vm.search}
                                        onChange={(e) => vm.setSearch(e.target.value)}
                                        placeholder="Search code / name..."
                                        className="sm:w-80"
                                    />
                                </div>
                            </div>
                        </div>

                        <AccordionTrigger className="px-4 py-3 text-left hover:no-underline sm:hidden">
                            <div className="text-sm font-semibold">Manage Records</div>
                        </AccordionTrigger>

                        <AccordionContent className="px-4 pb-4 sm:px-6 sm:py-6">
                            <div className="mb-4 sm:hidden">
                                <Input
                                    value={vm.search}
                                    onChange={(e) => vm.setSearch(e.target.value)}
                                    placeholder="Search code / name..."
                                />
                            </div>

                            {tabsContent}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </>
    )
}