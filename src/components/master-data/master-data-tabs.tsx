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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

    return (
        <>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

            <Card>
                <CardHeader className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Manage Records</CardTitle>
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
                </CardHeader>

                <CardContent>
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
                            <TabsTrigger value="colleges">Colleges</TabsTrigger>
                            <TabsTrigger value="programs">Programs/Courses</TabsTrigger>
                            <TabsTrigger value="subjects">Subjects</TabsTrigger>
                            <TabsTrigger value="faculty">Faculty</TabsTrigger>
                            <TabsTrigger value="sections">Sections</TabsTrigger>
                            <TabsTrigger value="records">List of Records</TabsTrigger>
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
                </CardContent>
            </Card>
        </>
    )
}