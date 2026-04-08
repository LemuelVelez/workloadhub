"use client"

import * as React from "react"

import { CalendarDays, Plus, RefreshCcw, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type {
    AcademicTermDoc,
    DepartmentDoc,
    ScheduleStatus,
    ScheduleVersionDoc,
    TabKey,
    VersionStats,
} from "./schedule-types"
import {
    deptLabel,
    fmtDate,
    normalizeScheduleStatus,
    shortId,
    statusBadgeVariant,
    statusIcon,
    termLabel,
} from "./schedule-utils"

type CreateTermMode = "existing" | "new"

const CUSTOM_SCHOOL_YEAR_VALUE = "__custom_school_year__"

type Props = {
    loading: boolean
    saving: boolean
    error: string | null

    terms: AcademicTermDoc[]
    departments: DepartmentDoc[]
    termMap: Map<string, AcademicTermDoc>
    deptMap: Map<string, DepartmentDoc>

    stats: VersionStats
    filtered: ScheduleVersionDoc[]

    tab: TabKey
    setTab: (v: TabKey) => void
    search: string
    setSearch: (v: string) => void

    filterTermId: string
    setFilterTermId: (v: string) => void
    filterDeptId: string
    setFilterDeptId: (v: string) => void

    selectedVersionId: string
    setSelectedVersionId: (id: string) => void

    onRefresh: () => void
    onOpenCreate: () => void
    onSetStatus: (it: ScheduleVersionDoc, next: ScheduleStatus) => Promise<void> | void
    editingVersion: ScheduleVersionDoc | null
    onEditVersion: (it: ScheduleVersionDoc) => void
    onDeleteVersion: (it: ScheduleVersionDoc) => Promise<void> | void

    viewOpen: boolean
    setViewOpen: (v: boolean) => void
    active: ScheduleVersionDoc | null
    setActive: (v: ScheduleVersionDoc | null) => void
    onOpenView: (it: ScheduleVersionDoc) => void

    createOpen: boolean
    setCreateOpen: (v: boolean) => void
    createTermMode: CreateTermMode
    setCreateTermMode: (v: CreateTermMode) => void
    createTermId: string
    setCreateTermId: (v: string) => void
    createSchoolYear: string
    setCreateSchoolYear: (v: string) => void
    createSemester: string
    setCreateSemester: (v: string) => void
    schoolYearOptions: string[]
    semesterOptions: string[]
    matchedCreateTerm: AcademicTermDoc | null
    createDeptId: string
    setCreateDeptId: (v: string) => void
    createLabel: string
    setCreateLabel: (v: string) => void
    createNotes: string
    setCreateNotes: (v: string) => void
    createSetActive: boolean
    setCreateSetActive: (v: boolean) => void
    existingSemesterSchedule?: ScheduleVersionDoc | null
    nextVersionNumber: number
    canCreateVersion: boolean
    onSaveVersion: () => Promise<void> | void
    resetCreateForm: () => void
}

export function VersionManagementSection({
    loading,
    saving,
    error,
    terms,
    departments,
    termMap,
    deptMap,
    stats,
    filtered,
    tab,
    setTab,
    search,
    setSearch,
    filterTermId,
    setFilterTermId,
    filterDeptId,
    setFilterDeptId,
    selectedVersionId,
    onRefresh,
    onOpenCreate,
    editingVersion,
    onDeleteVersion,
    createOpen,
    setCreateOpen,
    createTermMode,
    setCreateTermMode,
    createTermId,
    setCreateTermId,
    createSchoolYear,
    setCreateSchoolYear,
    createSemester,
    setCreateSemester,
    schoolYearOptions,
    semesterOptions,
    createDeptId,
    setCreateDeptId,
    createLabel,
    setCreateLabel,
    createNotes,
    setCreateNotes,
    createSetActive,
    setCreateSetActive,
    nextVersionNumber,
    canCreateVersion,
    onSaveVersion,
    resetCreateForm,
}: Props) {
    const isEditing = Boolean(editingVersion)
    const schoolYearSelectValue = schoolYearOptions.includes(createSchoolYear)
        ? createSchoolYear
        : CUSTOM_SCHOOL_YEAR_VALUE

    const showCustomSchoolYearInput = createTermMode === "new" && schoolYearSelectValue === CUSTOM_SCHOOL_YEAR_VALUE
    const [selectedScheduleIds, setSelectedScheduleIds] = React.useState<string[]>([])
    const [deleteTargets, setDeleteTargets] = React.useState<ScheduleVersionDoc[]>([])

    React.useEffect(() => {
        const visibleIdSet = new Set(filtered.map((item) => String(item.$id || "")))
        setSelectedScheduleIds((current) => current.filter((id) => visibleIdSet.has(id)))
    }, [filtered])

    const selectedSchedules = React.useMemo(
        () => filtered.filter((item) => selectedScheduleIds.includes(String(item.$id || ""))),
        [filtered, selectedScheduleIds]
    )

    const allVisibleSelected = filtered.length > 0 && selectedSchedules.length === filtered.length
    const someVisibleSelected = selectedSchedules.length > 0 && !allVisibleSelected

    const toggleScheduleSelection = React.useCallback((scheduleId: string, checked: boolean) => {
        setSelectedScheduleIds((current) => {
            if (checked) {
                return Array.from(new Set([...current, scheduleId]))
            }

            return current.filter((id) => id !== scheduleId)
        })
    }, [])

    const toggleSelectAllSchedules = React.useCallback(
        (checked: boolean) => {
            setSelectedScheduleIds((current) => {
                const next = new Set(current)

                for (const schedule of filtered) {
                    const scheduleId = String(schedule.$id || "")
                    if (!scheduleId) continue

                    if (checked) {
                        next.add(scheduleId)
                    } else {
                        next.delete(scheduleId)
                    }
                }

                return Array.from(next)
            })
        },
        [filtered]
    )

    const openSingleDeleteDialog = React.useCallback((target: ScheduleVersionDoc) => {
        setDeleteTargets([target])
    }, [])

    const openBulkDeleteDialog = React.useCallback(() => {
        if (selectedSchedules.length === 0) return
        setDeleteTargets(selectedSchedules)
    }, [selectedSchedules])

    const handleConfirmDelete = async () => {
        if (deleteTargets.length === 0) return

        const targets = [...deleteTargets]
        const deletedIdSet = new Set(targets.map((target) => String(target.$id || "")))

        setDeleteTargets([])

        for (const target of targets) {
            await onDeleteVersion(target)
        }

        setSelectedScheduleIds((current) => current.filter((id) => !deletedIdSet.has(id)))
    }

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total</CardTitle>
                        <CardDescription>All semesters</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Draft</CardTitle>
                        <CardDescription>In progress</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{stats.draft}</CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <CardDescription>Current run</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
                </Card>

                <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Archived</CardTitle>
                        <CardDescription>Historical</CardDescription>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{stats.archived}</CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl">
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle>Semester Schedules</CardTitle>
                            <CardDescription>
                                Filter by semester and college, search schedules, and manage semester schedule status.
                            </CardDescription>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {selectedSchedules.length > 0 ? (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={openBulkDeleteDialog}
                                    disabled={loading || saving}
                                    className="rounded-xl"
                                >
                                    <Trash2 className="mr-2 size-4" />
                                    Delete Selected ({selectedSchedules.length})
                                </Button>
                            ) : null}

                            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || saving} className="rounded-xl">
                                <RefreshCcw className="mr-2 size-4" />
                                Refresh
                            </Button>
                            <Button size="sm" onClick={onOpenCreate} disabled={loading || saving} className="rounded-xl">
                                <Plus className="mr-2 size-4" />
                                New Semester
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full lg:w-auto">
                            <TabsList className="grid w-full grid-cols-4 lg:w-auto">
                                <TabsTrigger
                                    value="all"
                                    className="data-[state=active]:bg-primary! data-[state=active]:text-secondary!"
                                >
                                    All
                                </TabsTrigger>
                                <TabsTrigger
                                    value="Draft"
                                    className="data-[state=active]:bg-primary! data-[state=active]:text-secondary!"
                                >
                                    Draft
                                </TabsTrigger>
                                <TabsTrigger
                                    value="Active"
                                    className="data-[state=active]:bg-primary! data-[state=active]:text-secondary!"
                                >
                                    Active
                                </TabsTrigger>
                                <TabsTrigger
                                    value="Archived"
                                    className="data-[state=active]:bg-primary! data-[state=active]:text-secondary!"
                                >
                                    Archived
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="w-full lg:max-w-xl">
                            <Label className="sr-only" htmlFor="search">
                                Search
                            </Label>
                            <Input
                                id="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by label, status, term, or college..."
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                            <Label>Academic Term</Label>
                            <Select value={filterTermId} onValueChange={setFilterTermId}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All terms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All terms</SelectItem>
                                    {terms.map((t) => (
                                        <SelectItem key={t.$id} value={t.$id}>
                                            {termLabel(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>College</Label>
                            <Select value={filterDeptId} onValueChange={setFilterDeptId}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="All colleges" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All colleges</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {deptLabel(d)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end gap-2">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => {
                                    setTab("all")
                                    setSearch("")
                                    setFilterTermId("all")
                                    setFilterDeptId("all")
                                }}
                                disabled={loading || saving}
                            >
                                Reset Filters
                            </Button>
                        </div>
                    </div>

                    {selectedSchedules.length > 0 ? (
                        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">
                                    {selectedSchedules.length} semester schedule{selectedSchedules.length === 1 ? "" : "s"} selected
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Use the row checkboxes or the table header checkbox to manage bulk deletion.
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => setSelectedScheduleIds([])}
                                    disabled={loading || saving}
                                >
                                    Clear Selection
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={openBulkDeleteDialog}
                                    disabled={loading || saving}
                                >
                                    <Trash2 className="mr-2 size-4" />
                                    Delete Selected
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    <Separator />

                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6" />
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <CalendarDays className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No semester schedules found</div>
                            <div className="text-sm text-muted-foreground">
                                Try adjusting filters or creating a new semester schedule.
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-14">
                                            <div className="flex items-center justify-center">
                                                <Checkbox
                                                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                                                    onCheckedChange={(checked) => toggleSelectAllSchedules(Boolean(checked))}
                                                    aria-label="Select all visible semester schedules"
                                                    disabled={loading || saving || filtered.length === 0}
                                                />
                                            </div>
                                        </TableHead>
                                        <TableHead>Semester</TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Academic Term</TableHead>
                                        <TableHead>College</TableHead>
                                        <TableHead className="text-right">Created</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filtered.map((it) => {
                                        const Icon = statusIcon(String(it.status))
                                        const term = termMap.get(String(it.termId)) ?? null
                                        const dept = deptMap.get(String(it.departmentId)) ?? null
                                        const isPlannerSelected = it.$id === selectedVersionId
                                        const isChecked = selectedScheduleIds.includes(String(it.$id || ""))

                                        return (
                                            <TableRow key={it.$id} className="align-top">
                                                <TableCell className="align-middle">
                                                    <div className="flex items-center justify-center">
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) =>
                                                                toggleScheduleSelection(String(it.$id || ""), Boolean(checked))
                                                            }
                                                            aria-label={`Select ${it.label || termLabel(term) || shortId(it.$id)} for deletion`}
                                                            disabled={saving}
                                                        />
                                                    </div>
                                                </TableCell>

                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="size-4 text-muted-foreground" />
                                                        <span className="truncate">
                                                            {term ? termLabel(term) : it.label || shortId(it.$id)}
                                                        </span>
                                                        {isPlannerSelected ? (
                                                            <Badge variant="secondary" className="rounded-lg">
                                                                Selected
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                                                        {shortId(it.$id)}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-sm">
                                                    <div className="max-w-md truncate font-medium">{it.label || "—"}</div>
                                                    {it.notes ? (
                                                        <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                                                            {it.notes}
                                                        </div>
                                                    ) : null}
                                                </TableCell>

                                                <TableCell>
                                                    <Badge variant={statusBadgeVariant(String(it.status))}>
                                                        {normalizeScheduleStatus(it.status)}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="text-sm">{term ? termLabel(term) : it.termId}</TableCell>

                                                <TableCell className="text-sm">
                                                    {dept ? deptLabel(dept) : it.departmentId}
                                                </TableCell>

                                                <TableCell className="text-right text-sm">{fmtDate(it.$createdAt)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog
                open={deleteTargets.length > 0}
                onOpenChange={(open) => {
                    if (!open) setDeleteTargets([])
                }}
            >
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteTargets.length > 1 ? "Delete selected semester schedules?" : "Delete semester schedule?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. It will permanently remove the selected semester schedule{deleteTargets.length > 1 ? "s" : ""} and related classes and meetings.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deleteTargets.length > 0 ? (
                        <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
                            <div className="font-medium text-foreground">
                                {deleteTargets.length > 1
                                    ? `${deleteTargets.length} semester schedules will be deleted`
                                    : deleteTargets[0]?.label || `Semester ${Number(deleteTargets[0]?.version || 0)}`}
                            </div>

                            <div className="space-y-2">
                                {deleteTargets.slice(0, 5).map((target) => (
                                    <div key={target.$id} className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                                        <div className="font-medium text-foreground">
                                            {target.label || `Semester ${Number(target.version || 0)}`}
                                        </div>
                                        <div className="mt-1 text-muted-foreground">
                                            {termLabel(termMap.get(String(target.termId)) ?? null)} • {deptLabel(
                                                deptMap.get(String(target.departmentId)) ?? null
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {deleteTargets.length > 5 ? (
                                    <div className="text-xs text-muted-foreground">
                                        And {deleteTargets.length - 5} more semester schedule{deleteTargets.length - 5 === 1 ? "" : "s"}.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void handleConfirmDelete()}
                            disabled={saving}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {deleteTargets.length > 1 ? "Delete selected" : "Delete semester"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={createOpen}
                onOpenChange={(v) => {
                    if (!v) resetCreateForm()
                    setCreateOpen(v)
                }}
            >
                <DialogContent className="max-h-[78vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Semester Schedule" : "Create Semester Schedule"}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label>Schedule Label</Label>
                            <Input
                                value={createLabel}
                                onChange={(e) => setCreateLabel(e.target.value)}
                                placeholder="Semester Schedule"
                            />
                            <div className="text-xs text-muted-foreground">
                                If empty, it will default to Semester {nextVersionNumber}.
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Term Setup</Label>
                            <Select value={createTermMode} onValueChange={(value) => setCreateTermMode(value as CreateTermMode)}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select setup" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="existing">Use Existing Semester / Term</SelectItem>
                                    <SelectItem value="new">Create New Semester / School Year</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                Choose an existing term or create a new one like <span className="font-medium">2025-2026 • 1st Semester</span>.
                            </div>
                        </div>

                        {createTermMode === "existing" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Academic Term</Label>
                                    <Select value={createTermId} onValueChange={setCreateTermId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select term" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {terms.map((t) => (
                                                <SelectItem key={t.$id} value={t.$id}>
                                                    {termLabel(t)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>College</Label>
                                    <Select value={createDeptId} onValueChange={setCreateDeptId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select college" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d) => (
                                                <SelectItem key={d.$id} value={d.$id}>
                                                    {deptLabel(d)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label>School Year</Label>
                                        <Select
                                            value={schoolYearSelectValue}
                                            onValueChange={(value) => {
                                                if (value === CUSTOM_SCHOOL_YEAR_VALUE) {
                                                    if (schoolYearOptions.includes(createSchoolYear)) {
                                                        setCreateSchoolYear("")
                                                    }
                                                    return
                                                }
                                                setCreateSchoolYear(value)
                                            }}
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select school year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {schoolYearOptions.map((schoolYear) => (
                                                    <SelectItem key={schoolYear} value={schoolYear}>
                                                        {schoolYear}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value={CUSTOM_SCHOOL_YEAR_VALUE}>Custom school year</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground">
                                            Pick from the list or choose custom.
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label>Semester</Label>
                                        <Select value={createSemester} onValueChange={setCreateSemester}>
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select semester" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {semesterOptions.map((semester) => (
                                                    <SelectItem key={semester} value={semester}>
                                                        {semester}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label>College</Label>
                                        <Select value={createDeptId} onValueChange={setCreateDeptId}>
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select college" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map((d) => (
                                                    <SelectItem key={d.$id} value={d.$id}>
                                                        {deptLabel(d)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {showCustomSchoolYearInput ? (
                                    <div className="space-y-1">
                                        <Label>Custom School Year</Label>
                                        <Input
                                            value={createSchoolYear}
                                            onChange={(e) => setCreateSchoolYear(e.target.value)}
                                            placeholder="e.g. 2027-2028"
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            Use the format <span className="font-medium">YYYY-YYYY</span>, such as 2027-2028.
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )}

                        <div className="space-y-1">
                            <Label>Notes</Label>
                            <Input
                                value={createNotes}
                                onChange={(e) => setCreateNotes(e.target.value)}
                                placeholder="Optional notes for this semester schedule"
                            />
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border p-3">
                            <Checkbox
                                id="setActive"
                                checked={createSetActive}
                                onCheckedChange={(v) => setCreateSetActive(Boolean(v))}
                            />
                            <Label htmlFor="setActive" className="cursor-pointer">
                                {isEditing ? (
                                    <>
                                        Keep or mark this semester schedule as <span className="font-medium">Active</span> when saved
                                    </>
                                ) : (
                                    <>
                                        Set this semester schedule as <span className="font-medium">Active</span> after saving
                                    </>
                                )}
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void onSaveVersion()}
                            disabled={saving || !canCreateVersion}
                            className={cn(saving && "opacity-90")}
                        >
                            {saving ? (
                                <>
                                    <RefreshCcw className="mr-2 size-4 animate-spin" />
                                    {isEditing ? "Saving changes..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    {isEditing ? "Save Changes" : "Save Semester"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
