"use client"

import {
    CalendarDays,
    CheckCircle2,
    Eye,
    MoreHorizontal,
    Plus,
    RefreshCcw,
    ShieldCheck,
    ShieldX,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

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

    // View dialog
    viewOpen: boolean
    setViewOpen: (v: boolean) => void
    active: ScheduleVersionDoc | null
    setActive: (v: ScheduleVersionDoc | null) => void
    onOpenView: (it: ScheduleVersionDoc) => void

    // Create dialog
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
    existingSemesterSchedule: ScheduleVersionDoc | null
    canCreateVersion: boolean
    onCreateVersion: () => Promise<void> | void
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
    setSelectedVersionId,
    onRefresh,
    onOpenCreate,
    onSetStatus,
    viewOpen,
    setViewOpen,
    active,
    setActive,
    onOpenView,
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
    matchedCreateTerm,
    createDeptId,
    setCreateDeptId,
    createLabel,
    setCreateLabel,
    createNotes,
    setCreateNotes,
    createSetActive,
    setCreateSetActive,
    existingSemesterSchedule,
    canCreateVersion,
    onCreateVersion,
    resetCreateForm,
}: Props) {
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
                                Filter by semester/college, search, and manage semester schedule status.
                            </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || saving}>
                                <RefreshCcw className="mr-2 size-4" />
                                Refresh
                            </Button>
                            <Button size="sm" onClick={onOpenCreate} disabled={loading || saving}>
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
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="Draft">Draft</TabsTrigger>
                                <TabsTrigger value="Active">Active</TabsTrigger>
                                <TabsTrigger value="Archived">Archived</TabsTrigger>
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
                                placeholder="Search by label, status, termId, departmentId..."
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
                                        <TableHead>Semester</TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Academic Term</TableHead>
                                        <TableHead>College</TableHead>
                                        <TableHead className="text-right">Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {filtered.map((it) => {
                                        const Icon = statusIcon(String(it.status))
                                        const term = termMap.get(String(it.termId)) ?? null
                                        const dept = deptMap.get(String(it.departmentId)) ?? null
                                        const isSelected = it.$id === selectedVersionId

                                        return (
                                            <TableRow key={it.$id} className="align-top">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="size-4 text-muted-foreground" />
                                                        <span className="truncate">
                                                            {term ? termLabel(term) : it.label || shortId(it.$id)}
                                                        </span>
                                                        {isSelected ? (
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

                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="rounded-xl">
                                                                <MoreHorizontal className="size-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>

                                                        <DropdownMenuContent align="end" className="w-60">
                                                            <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />

                                                            <DropdownMenuItem onClick={() => setSelectedVersionId(it.$id)}>
                                                                <CalendarDays className="mr-2 size-4" />
                                                                Open in planner
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem onClick={() => onOpenView(it)}>
                                                                <Eye className="mr-2 size-4" />
                                                                View details
                                                            </DropdownMenuItem>

                                                            <DropdownMenuSeparator />

                                                            <DropdownMenuItem
                                                                onClick={() => void onSetStatus(it, "Active")}
                                                                disabled={saving || String(it.status) === "Active"}
                                                            >
                                                                <ShieldCheck className="mr-2 size-4" />
                                                                Set Active
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem
                                                                onClick={() => void onSetStatus(it, "Archived")}
                                                                disabled={saving || String(it.status) === "Archived"}
                                                            >
                                                                <ShieldX className="mr-2 size-4" />
                                                                Archive
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={viewOpen}
                onOpenChange={(v) => {
                    if (!v) setActive(null)
                    setViewOpen(v)
                }}
            >
                <DialogContent className="max-h-[78vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Semester Schedule</DialogTitle>
                        <DialogDescription>Review semester schedule information and manage status.</DialogDescription>
                    </DialogHeader>

                    {!active ? (
                        <div className="space-y-3">
                            <Skeleton className="h-6 w-1/3" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Semester</CardTitle>
                                        <CardDescription>Semester schedule record</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-2xl font-semibold">
                                        {termLabel(termMap.get(String(active.termId)) ?? null)}
                                    </CardContent>
                                    <CardFooter className="pt-0 text-xs text-muted-foreground">
                                        {shortId(active.$id)}
                                    </CardFooter>
                                </Card>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Status</CardTitle>
                                        <CardDescription>Current state</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant={statusBadgeVariant(String(active.status))}>
                                            {normalizeScheduleStatus(active.status)}
                                        </Badge>
                                    </CardContent>
                                    <CardFooter className="pt-0 text-xs text-muted-foreground">
                                        Updated: {fmtDate(active.$updatedAt)}
                                    </CardFooter>
                                </Card>
                            </div>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Metadata</CardTitle>
                                    <CardDescription>Term + College</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Label</span>
                                        <span className="font-medium">{active.label || "—"}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Term</span>
                                        <span className="font-medium">
                                            {termLabel(termMap.get(String(active.termId)) ?? null)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">College</span>
                                        <span className="font-medium">
                                            {deptLabel(deptMap.get(String(active.departmentId)) ?? null)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Created</span>
                                        <span className="font-medium">{fmtDate(active.$createdAt)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Created By</span>
                                        <span className="font-medium">{active.createdBy || "—"}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {active.notes ? (
                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">Notes</CardTitle>
                                        <CardDescription>Admin notes</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm leading-relaxed">{active.notes}</CardContent>
                                </Card>
                            ) : null}
                        </div>
                    )}

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" onClick={() => setViewOpen(false)} disabled={saving}>
                            Close
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!active || saving || String(active?.status) === "Active"}
                                onClick={() => active && void onSetStatus(active, "Active")}
                            >
                                <CheckCircle2 className="mr-2 size-4" />
                                Set Active
                            </Button>

                            <Button
                                type="button"
                                variant="destructive"
                                disabled={!active || saving || String(active?.status) === "Archived"}
                                onClick={() => active && void onSetStatus(active, "Archived")}
                            >
                                <ShieldX className="mr-2 size-4" />
                                Archive
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={createOpen}
                onOpenChange={(v) => {
                    if (!v) resetCreateForm()
                    setCreateOpen(v)
                }}
            >
                <DialogContent className="max-h-[78vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create Semester Schedule</DialogTitle>
                        <DialogDescription>
                            Create or reuse a semester schedule for an existing academic term, or create a new semester under the current school year.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
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
                                        <Select value={createSchoolYear} onValueChange={setCreateSchoolYear}>
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue placeholder="Select school year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {schoolYearOptions.map((schoolYear) => (
                                                    <SelectItem key={schoolYear} value={schoolYear}>
                                                        {schoolYear}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground">Defaults to the current school year.</div>
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

                                <div className="rounded-xl border border-dashed p-3 text-sm">
                                    {matchedCreateTerm ? (
                                        <div className="space-y-1">
                                            <div className="font-medium">Existing term detected</div>
                                            <div className="text-muted-foreground">
                                                {termLabel(matchedCreateTerm)} already exists, so this semester schedule will reuse that term instead of creating a duplicate.
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="font-medium">New academic term preview</div>
                                            <div className="text-muted-foreground">
                                                {createSchoolYear || "School Year"} • {createSemester || "Semester"}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <Label>Schedule Label</Label>
                            <Input
                                value={createLabel}
                                onChange={(e) => setCreateLabel(e.target.value)}
                                placeholder="Semester Schedule"
                            />
                            <div className="text-xs text-muted-foreground">
                                If empty, it will default to a semester-based schedule label.
                            </div>
                        </div>

                        <div className="rounded-xl border border-dashed p-3 text-sm">
                            {existingSemesterSchedule ? (
                                <div className="space-y-1">
                                    <div className="font-medium">Existing semester schedule found</div>
                                    <div className="text-muted-foreground">
                                        This will reuse the existing semester schedule for this term and college so existing entries stay intact.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="font-medium">New semester schedule</div>
                                    <div className="text-muted-foreground">
                                        A fresh semester schedule will be created for the selected term and college.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                value={createNotes}
                                onChange={(e) => setCreateNotes(e.target.value)}
                                placeholder="Add notes about this semester schedule..."
                                className="min-h-24"
                            />
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border p-3">
                            <Checkbox
                                id="setActive"
                                checked={createSetActive}
                                onCheckedChange={(v) => setCreateSetActive(Boolean(v))}
                            />
                            <Label htmlFor="setActive" className="cursor-pointer">
                                Set this semester schedule as <span className="font-medium">Active</span> after saving
                            </Label>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={() => void onCreateVersion()}
                            disabled={saving || !canCreateVersion}
                            className={cn(saving && "opacity-90")}
                        >
                            {saving ? (
                                <>
                                    <RefreshCcw className="mr-2 size-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    Save Semester
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
