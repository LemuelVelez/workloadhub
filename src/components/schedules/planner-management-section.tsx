/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
    AlertTriangle,
    ArrowRight,
    ArrowUpDown,
    CalendarDays,
    Download,
    Eye,
    FlaskConical,
    Loader2,
    PencilLine,
    Plus,
    Printer,
    RefreshCcw,
    Search,
    SlidersHorizontal,
    Trash2,
    UserCircle2,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"

import { cn } from "@/lib/utils"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import type {
    CandidateConflict,
    ConflictFlags,
    MeetingType,
    PlannerStats,
    RoomDoc,
    ScheduleRow,
    SectionDoc,
    SubjectDoc,
    UserProfileDoc,
} from "./schedule-types"
import { BASE_DAY_OPTIONS, DAY_OPTIONS, FACULTY_OPTION_MANUAL, FACULTY_OPTION_NONE } from "./schedule-types"
import {
    dayExpressionsOverlap,
    dayOrder,
    fmtDate,
    formatCombinedMeetingDayDisplay,
    formatCombinedMeetingTimeDisplay,
    formatCompactDayDisplay,
    formatDayDisplayLabel,
    formatSubjectOptionLabel,
    formatTimeRange,
    joinDisplayValues,
    meetingTypeLabel,
    roomTypeLabel,
    sectionMatchesSubjectFilters,
    SUBJECT_FILTER_ALL_VALUE,
    TIME_OPTIONS,
} from "./schedule-utils"

type SubjectSectionFilterOption = {
    value: string
    label: string
}

type Props = {
    hasScheduleScope: boolean
    scheduleScopeKey: string

    showConflictsOnly: boolean
    onShowConflictsOnlyChange: (v: boolean) => void

    entriesLoading: boolean
    entriesError: string | null
    entrySaving: boolean

    onReloadEntries: () => void
    onOpenCreateEntry: () => void

    plannerStats: PlannerStats
    visibleRows: ScheduleRow[]
    laboratoryRows: ScheduleRow[]
    conflictFlagsByMeetingId: Map<string, ConflictFlags>

    scheduleScopeLabel: string
    selectedTermLabel: string
    selectedDeptLabel: string

    entryDialogOpen: boolean
    setEntryDialogOpen: (v: boolean) => void
    editingEntry: ScheduleRow | null

    formSectionId: string
    setFormSectionId: (v: string) => void
    formSubjectIds: string[]
    setFormSubjectIds: React.Dispatch<React.SetStateAction<string[]>>
    subjectCollegeFilter: string
    setSubjectCollegeFilter: (value: string) => void
    subjectProgramFilters: string[]
    setSubjectProgramFilters: React.Dispatch<React.SetStateAction<string[]>>
    subjectSectionFilters: string[]
    setSubjectSectionFilters?: React.Dispatch<React.SetStateAction<string[]>>
    subjectYearLevelFilters: string[]
    setSubjectYearLevelFilters: React.Dispatch<React.SetStateAction<string[]>>
    subjectAcademicTermFilter: string
    setSubjectAcademicTermFilter: (value: string) => void
    subjectCollegeOptions: string[]
    subjectProgramOptions: string[]
    subjectSectionOptions: SubjectSectionFilterOption[]
    subjectYearLevelOptions: string[]
    subjectYearLevelCounts: Record<string, number>
    yearLevelMutating: boolean
    onCreateYearLevel: (value: string) => Promise<void> | void
    onRenameYearLevel: (currentValue: string, nextValue: string) => Promise<void> | void
    onDeleteYearLevel: (value: string) => Promise<void> | void
    subjectAcademicTermOptions: string[]
    onClearSubjectFilters: () => void
    onApplyScheduleContextSubjectFilters: () => void
    formFacultyChoice: string
    setFormFacultyChoice: (v: string) => void
    formManualFaculty: string
    setFormManualFaculty: (v: string) => void
    formRoomId: string
    setFormRoomId: (v: string) => void
    formDayOfWeek: string
    setFormDayOfWeek: (v: string) => void
    formStartTime: string
    setFormStartTime: (v: string) => void
    formEndTime: string
    setFormEndTime: (v: string) => void
    formMeetingType: MeetingType
    setFormMeetingType: (v: MeetingType) => void
    formAllowConflictSave: boolean
    setFormAllowConflictSave: (v: boolean) => void

    candidateConflicts: CandidateConflict[]
    candidateConflictCounts: { room: number; faculty: number; section: number }
    manualFacultySuggestions: string[]

    sections: SectionDoc[]
    facultyProfiles: UserProfileDoc[]
    rooms: RoomDoc[]
    filteredSubjectOptions: SubjectDoc[]
    activeSubjectFilterBadges: string[]

    onEditEntry: (row: ScheduleRow) => void
    onSaveEntry: () => Promise<void> | void
    onDeleteEntry: () => Promise<void> | void
}

export type SubjectMatchingFiltersCardProps = {
    subjectCollegeFilter: string
    setSubjectCollegeFilter: (value: string) => void
    subjectProgramFilters: string[]
    setSubjectProgramFilters: React.Dispatch<React.SetStateAction<string[]>>
    subjectSectionFilters: string[]
    setSubjectSectionFilters: React.Dispatch<React.SetStateAction<string[]>>
    subjectYearLevelFilters: string[]
    setSubjectYearLevelFilters: React.Dispatch<React.SetStateAction<string[]>>
    subjectAcademicTermFilter: string
    setSubjectAcademicTermFilter: (value: string) => void
    subjectCollegeOptions: string[]
    subjectProgramOptions: string[]
    subjectSectionOptions: SubjectSectionFilterOption[]
    subjectYearLevelOptions: string[]
    subjectYearLevelCounts: Record<string, number>
    sectionMutating: boolean
    yearLevelMutating: boolean
    onCreateYearLevel: (value: string) => Promise<void> | void
    onRenameYearLevel: (currentValue: string, nextValue: string) => Promise<void> | void
    onDeleteSection: (value: string) => Promise<void> | void
    onDeleteYearLevel: (value: string) => Promise<void> | void
    subjectAcademicTermOptions: string[]
    filteredSubjectCount: number
    activeSubjectFilterBadges: string[]
    onClearSubjectFilters: () => void
    onApplyScheduleContextSubjectFilters: () => void
    className?: string
    idPrefix?: string
}

export function SubjectMatchingFiltersCard({
    subjectCollegeFilter,
    setSubjectCollegeFilter,
    subjectProgramFilters,
    setSubjectProgramFilters,
    subjectSectionFilters,
    setSubjectSectionFilters,
    subjectYearLevelFilters,
    setSubjectYearLevelFilters,
    subjectAcademicTermFilter,
    setSubjectAcademicTermFilter,
    subjectCollegeOptions,
    subjectProgramOptions,
    subjectSectionOptions,
    subjectYearLevelOptions,
    subjectYearLevelCounts,
    sectionMutating,
    yearLevelMutating,
    onCreateYearLevel,
    onRenameYearLevel,
    onDeleteSection,
    onDeleteYearLevel,
    subjectAcademicTermOptions,
    filteredSubjectCount,
    onClearSubjectFilters,
    onApplyScheduleContextSubjectFilters,
    className,
    idPrefix = "subject-matching-filters",
}: SubjectMatchingFiltersCardProps) {
    const selectedProgramCount = subjectProgramFilters.length
    const selectedSectionCount = subjectSectionFilters.length
    const selectedYearLevelCount = subjectYearLevelFilters.length
    const [yearLevelDraft, setYearLevelDraft] = React.useState("")
    const [editingYearLevel, setEditingYearLevel] = React.useState<string | null>(null)
    const [editingYearLevelDraft, setEditingYearLevelDraft] = React.useState("")
    const [deletingSection, setDeletingSection] = React.useState<SubjectSectionFilterOption | null>(null)
    const [deletingYearLevel, setDeletingYearLevel] = React.useState<string | null>(null)

    const getCheckboxId = React.useCallback(
        (group: string, value: string) => `${idPrefix}-${group}-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        [idPrefix]
    )

    const sortedSubjectSectionOptions = React.useMemo(
        () =>
            [...subjectSectionOptions].sort((a, b) =>
                String(a.label || "").localeCompare(String(b.label || ""), undefined, {
                    numeric: true,
                    sensitivity: "base",
                })
            ),
        [subjectSectionOptions]
    )

    const hasSelectedCollege = subjectCollegeFilter !== SUBJECT_FILTER_ALL_VALUE
    const hasSelectedSemester = subjectAcademicTermFilter !== SUBJECT_FILTER_ALL_VALUE
    const hasSelectedPrograms = subjectProgramFilters.length > 0
    const hasSelectedYearLevels = subjectYearLevelFilters.length > 0

    const handleCreateYearLevel = React.useCallback(async () => {
        const nextValue = String(yearLevelDraft || "").trim()
        if (!nextValue) return
        await onCreateYearLevel(nextValue)
        setYearLevelDraft("")
    }, [onCreateYearLevel, yearLevelDraft])

    const handleRenameYearLevel = React.useCallback(async () => {
        if (!editingYearLevel) return
        const nextValue = String(editingYearLevelDraft || "").trim()
        if (!nextValue) return
        await onRenameYearLevel(editingYearLevel, nextValue)
        setEditingYearLevel(null)
        setEditingYearLevelDraft("")
    }, [editingYearLevel, editingYearLevelDraft, onRenameYearLevel])

    const handleDeleteSection = React.useCallback(async () => {
        if (!deletingSection) return
        await onDeleteSection(deletingSection.value)
        setDeletingSection(null)
    }, [deletingSection, onDeleteSection])

    const handleDeleteYearLevel = React.useCallback(async () => {
        if (!deletingYearLevel) return
        await onDeleteYearLevel(deletingYearLevel)
        setDeletingYearLevel(null)
    }, [deletingYearLevel, onDeleteYearLevel])

    return (
        <>
            <Card className={cn("rounded-2xl", className)}>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Subject Matching Filters</CardTitle>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                            <Badge variant="secondary" className="rounded-lg">
                                {filteredSubjectCount} match{filteredSubjectCount === 1 ? "" : "es"}
                            </Badge>
                            <Button type="button" variant="outline" size="sm" className="w-full justify-center rounded-xl whitespace-normal wrap-anywhere sm:w-auto" onClick={onApplyScheduleContextSubjectFilters}>
                                Use schedule context
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="w-full justify-center rounded-xl whitespace-normal wrap-anywhere sm:w-auto" onClick={onClearSubjectFilters}>
                                Clear filters
                            </Button>
                        </div>
                    </div>
                </CardHeader>

<CardContent className="space-y-4">
    <div className="space-y-4">
        <div className="grid gap-2">
            <Label>College</Label>
            <Select value={subjectCollegeFilter} onValueChange={setSubjectCollegeFilter}>
                <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                    <SelectValue placeholder="All colleges" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={SUBJECT_FILTER_ALL_VALUE}><span className="block max-w-full truncate">All colleges</span></SelectItem>
                    {subjectCollegeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                            <span className="block max-w-full truncate">{option}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="grid gap-2">
            <Label>Semester</Label>
            <Select value={subjectAcademicTermFilter} onValueChange={setSubjectAcademicTermFilter}>
                <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                    <SelectValue placeholder={hasSelectedCollege ? "Select semester" : "Select college first"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={SUBJECT_FILTER_ALL_VALUE}><span className="block max-w-full truncate">All semesters</span></SelectItem>
                    {subjectAcademicTermOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                            <span className="block max-w-full truncate">{option}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
                <Label>Programs</Label>
                <span className="text-xs text-muted-foreground">
                    {selectedProgramCount} selected
                </span>
            </div>
            <ScrollArea className="h-44 rounded-md border">
                <div className="space-y-2 p-3">
                    {!hasSelectedCollege ? (
                        <div className="text-sm text-muted-foreground">
                            Select a college first.
                        </div>
                    ) : !hasSelectedSemester ? (
                        <div className="text-sm text-muted-foreground">
                            Select a semester first.
                        </div>
                    ) : subjectProgramOptions.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            No programs available for the selected college and semester.
                        </div>
                    ) : (
                        subjectProgramOptions.map((option) => {
                            const checked = subjectProgramFilters.includes(option)
                            return (
                                <label
                                    key={option}
                                    htmlFor={getCheckboxId("program", option)}
                                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                >
                                    <Checkbox
                                        id={getCheckboxId("program", option)}
                                        checked={checked}
                                        onCheckedChange={(value) => {
                                            const nextChecked = Boolean(value)
                                            setSubjectProgramFilters((current) => {
                                                if (nextChecked) {
                                                    return current.includes(option)
                                                        ? current
                                                        : [...current, option]
                                                }
                                                return current.filter((item) => item !== option)
                                            })
                                        }}
                                    />
                                    <div className="min-w-0 flex-1 text-sm font-medium wrap-anywhere">{option}</div>
                                </label>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
        </div>

        <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Label>Year Levels</Label>
                    <span className="text-xs text-muted-foreground">
                        {selectedYearLevelCount} selected
                    </span>
                </div>
                <Dialog>
                    <Button type="button" variant="outline" size="sm" className="w-full justify-center rounded-xl whitespace-normal wrap-anywhere sm:w-auto" asChild>
                        <DialogTrigger>Add Year Level</DialogTrigger>
                    </Button>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Year Level</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-2">
                            <Label htmlFor={`${idPrefix}-add-year-level`}>Year Level</Label>
                            <Input
                                id={`${idPrefix}-add-year-level`}
                                value={yearLevelDraft}
                                onChange={(event) => setYearLevelDraft(event.target.value)}
                                placeholder="Example: 1 or 1st Year"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" onClick={() => void handleCreateYearLevel()} disabled={yearLevelMutating || !String(yearLevelDraft).trim()}>
                                {yearLevelMutating ? "Saving..." : "Add Year Level"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-3">
                {!hasSelectedPrograms ? (
                    <div className="sm:col-span-2 xl:col-span-3 text-sm text-muted-foreground">
                        Select at least one program first.
                    </div>
                ) : subjectYearLevelOptions.length === 0 ? (
                    <div className="sm:col-span-2 xl:col-span-3 text-sm text-muted-foreground">
                        No year levels available from sections yet.
                    </div>
                ) : (
                    subjectYearLevelOptions.map((option) => {
                        const checked = subjectYearLevelFilters.includes(option)
                        const total = subjectYearLevelCounts[option] || 0
                        return (
                            <div key={option} className="rounded-md border px-3 py-2 text-sm transition hover:bg-muted/40">
                                <div className="flex items-start justify-between gap-2">
                                    <label htmlFor={getCheckboxId("year", option)} className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            id={getCheckboxId("year", option)}
                                            checked={checked}
                                            onCheckedChange={(value) => {
                                                const nextChecked = Boolean(value)
                                                setSubjectYearLevelFilters((current) => {
                                                    if (nextChecked) {
                                                        return current.includes(option)
                                                            ? current
                                                            : [...current, option]
                                                    }
                                                    return current.filter((item) => item !== option)
                                                })
                                            }}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{option}</span>
                                    </label>
                                    <Badge variant="secondary" className="rounded-full whitespace-nowrap">
                                        {total} section{total === 1 ? "" : "s"}
                                    </Badge>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto min-h-8 justify-center rounded-lg px-2 whitespace-normal wrap-anywhere"
                                        onClick={() => {
                                            setEditingYearLevel(option)
                                            setEditingYearLevelDraft(option)
                                        }}
                                    >
                                        <PencilLine className="mr-1 size-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto min-h-8 justify-center rounded-lg px-2 whitespace-normal wrap-anywhere text-destructive hover:text-destructive"
                                        onClick={() => setDeletingYearLevel(option)}
                                    >
                                        <Trash2 className="mr-1 size-3.5" />
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>

        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
                <Label>Sections</Label>
                <span className="text-xs text-muted-foreground">
                    {selectedSectionCount} selected
                </span>
            </div>
            <ScrollArea className="h-44 rounded-md border">
                <div className="space-y-2 p-3">
                    {!hasSelectedYearLevels ? (
                        <div className="text-sm text-muted-foreground">
                            Select at least one year level first.
                        </div>
                    ) : sortedSubjectSectionOptions.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            No sections available for the selected scope.
                        </div>
                    ) : (
                        sortedSubjectSectionOptions.map((option) => {
                            const checked = subjectSectionFilters.includes(option.value)
                            return (
                                <div
                                    key={option.value}
                                    className="flex items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                >
                                    <label
                                        htmlFor={getCheckboxId("section", option.value)}
                                        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
                                    >
                                        <Checkbox
                                            id={getCheckboxId("section", option.value)}
                                            checked={checked}
                                            onCheckedChange={(value) => {
                                                const nextChecked = Boolean(value)
                                                setSubjectSectionFilters((current) => {
                                                    if (nextChecked) {
                                                        return current.includes(option.value)
                                                            ? current
                                                            : [...current, option.value]
                                                    }
                                                    return current.filter((item) => item !== option.value)
                                                })
                                            }}
                                        />
                                        <div className="min-w-0 flex-1 text-sm font-medium wrap-anywhere">{option.label}</div>
                                    </label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto min-h-8 justify-center rounded-lg px-2 whitespace-normal wrap-anywhere text-destructive hover:text-destructive"
                                        onClick={() => setDeletingSection(option)}
                                        disabled={sectionMutating}
                                    >
                                        <Trash2 className="mr-1 size-3.5" />
                                        Delete
                                    </Button>
                                </div>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    </div>

</CardContent>
            </Card>

            <AlertDialog open={Boolean(deletingSection)} onOpenChange={(open) => !open && setDeletingSection(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sectionMutating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDeleteSection()} disabled={sectionMutating}>
                            {sectionMutating ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={Boolean(editingYearLevel)} onOpenChange={(open) => !open && setEditingYearLevel(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Year Level</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor={`${idPrefix}-edit-year-level`}>Year Level</Label>
                        <Input
                            id={`${idPrefix}-edit-year-level`}
                            value={editingYearLevelDraft}
                            onChange={(event) => setEditingYearLevelDraft(event.target.value)}
                            placeholder="Example: 2 or 2nd Year"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditingYearLevel(null)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleRenameYearLevel()} disabled={yearLevelMutating || !String(editingYearLevelDraft).trim()}>
                            {yearLevelMutating ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={Boolean(deletingYearLevel)} onOpenChange={(open) => !open && setDeletingYearLevel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Year Level</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDeleteYearLevel()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

type SectionDisplayLookup = Record<string, string>
type PlannerSortKey = "day" | "time" | "subject" | "section" | "faculty" | "room" | "type" | "conflicts"
type PlannerSortDirection = "asc" | "desc"

type PlannerDisplayRow = {
    key: string
    primaryRow: ScheduleRow
    sourceRows: ScheduleRow[]
    conflictFlags: ConflictFlags
    hasConflict: boolean
    subjectCodeDisplay: string
    descriptiveTitleDisplay: string
    dayDisplay: string
    timeDisplay: string
    roomDisplay: string
    roomTypeDisplay: string
    facultyDisplay: string
    meetingTypeDisplay: string
    sectionDisplay: string
    sortDayValue: string
    sortStartTime: string
}

type PlannerCourseAccordionGroup = {
    key: string
    label: string
    subtitle: string
    rowCount: number
    conflictedCount: number
    instructorCount: number
    rows: PlannerDisplayRow[]
}

type PlannerCourseAccordionGroupAccumulator = PlannerCourseAccordionGroup & {
    instructorKeys: Set<string>
    sectionDisplays: Set<string>
}

type LaboratoryAccordionGroup = {
    key: string
    label: string
    rowCount: number
    conflictedCount: number
    rows: PlannerDisplayRow[]
}

type PdfPreviewState = {
    title: string
    rows: PlannerDisplayRow[]
    fileNameBase: string
    scopeLabel?: string
}

type PlannerPdfPaperSize = "A4" | "SHORT_BOND" | "LONG_BOND"

const ROOMS_AND_FACILITIES_ROUTE = "/dashboard/admin/rooms-and-facilities"
const ENTRY_DIALOG_CONTENT_CLASS = "z-120 flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] min-w-0 w-[calc(100vw-1rem)] max-w-[36rem] flex-col overflow-hidden px-3 py-4 sm:h-auto sm:max-h-[95svh] sm:w-full sm:max-w-4xl sm:px-6"
const ENTRY_DIALOG_BODY_CLASS = "min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:space-y-4"
const ENTRY_DIALOG_SELECT_TRIGGER_CLASS = "min-w-0 w-full overflow-hidden rounded-xl text-left [&>span]:block [&>span]:min-w-0 [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate"
const ENTRY_DIALOG_SELECT_CONTENT_CLASS = "z-[200] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] sm:max-w-[36rem]"
const ENTRY_DIALOG_CARD_CLASS = "min-w-0 rounded-2xl border p-3 text-left sm:p-4"
const ENTRY_DIALOG_BADGE_CLASS = "max-w-full rounded-full whitespace-normal wrap-anywhere text-center sm:text-left"
const ENTRY_DIALOG_ACTION_BUTTON_CLASS = "h-auto min-h-10 whitespace-normal wrap-anywhere"
const EMPTY_SUBJECT_SELECT_VALUE = "__no_subject__"

const PLANNER_SORT_OPTIONS: Array<{ value: PlannerSortKey; label: string }> = [
    { value: "day", label: "Day" },
    { value: "time", label: "Time" },
    { value: "subject", label: "Subject" },
    { value: "section", label: "Section" },
    { value: "faculty", label: "Faculty" },
    { value: "room", label: "Room" },
    { value: "type", label: "Meeting Type" },
    { value: "conflicts", label: "Conflict Count" },
]

const LEFT_LOGO_PATH = "/logo.png"
const RIGHT_LOGO_PATH = "/CCS.jpg"

const PAPER_SIZE_OPTIONS: Array<{
    value: PlannerPdfPaperSize
    label: string
}> = [
    { value: "A4", label: "A4" },
    { value: "SHORT_BOND", label: "Short Bond" },
    { value: "LONG_BOND", label: "Long Bond" },
]

const HEADER_REPUBLIC = "Republic of the Philippines"
const HEADER_INSTITUTION = "JOSE RIZAL MEMORIAL STATE UNIVERSITY"
const HEADER_SUBTITLE = "The Premier University in Zamboanga del Norte"
const HEADER_COLLEGE = "COLLEGE OF COMPUTING STUDIES"
const HEADER_DOCUMENT = "SCHEDULE PLANNER REPORT"
const PDF_TABLE_BORDER_COLOR = "#6B7280"
const PDF_TABLE_HEADER_FILL = "#F8FAFC"
const PDF_TABLE_HEADER_TEXT = "#111827"
const PDF_PASTEL_ROW_FILLS = [
    "#F5DEB8",
    "#F4CBD7",
    "#DCE7FB",
    "#DCECAB",
    "#E8DDF8",
    "#FBE4CB",
] as const


const PLANNER_PDF_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const PLANNER_PDF_NOON_BREAK_SLOT = "12:00-1:00"
const PLANNER_PDF_MINUTES_PER_HALF_DAY = 12 * 60
const PLANNER_PDF_MINUTES_PER_DAY = 24 * 60
const PLANNER_PDF_MORNING_END_MINUTES = 12 * 60
const PLANNER_PDF_AFTERNOON_START_MINUTES = 13 * 60
const PLANNER_PDF_SLOT_EDGE_TOLERANCE_MINUTES = 1

const PLANNER_PDF_PAGE_PADDING_TOP = 18
const PLANNER_PDF_PAGE_PADDING_RIGHT = 22
const PLANNER_PDF_PAGE_PADDING_BOTTOM = 18
const PLANNER_PDF_PAGE_PADDING_LEFT = 22

const PLANNER_PDF_TIME_COL_WIDTH = 84
const PLANNER_PDF_DAY_COL_WIDTH = 124
const PLANNER_PDF_ROW_HEIGHT = 30
const PLANNER_PDF_HEADER_ROW_HEIGHT = 24
const PLANNER_PDF_GRID_WIDTH =
    PLANNER_PDF_TIME_COL_WIDTH + PLANNER_PDF_DAYS.length * PLANNER_PDF_DAY_COL_WIDTH

const PLANNER_PDF_BLOCK_PADDING_X = 3
const PLANNER_PDF_BLOCK_PADDING_Y = 2
const PLANNER_PDF_BLOCK_MIN_FONT_SIZE = 4.1
const PLANNER_PDF_BLOCK_MAX_FONT_SIZE = 7.2
const PLANNER_PDF_BLOCK_FONT_STEP = 0.2
const PLANNER_PDF_BLOCK_LINE_HEIGHT_RATIO = 1.08

const PLANNER_PDF_BASE_TIME_SLOTS = [
    "7:00-8:00",
    "8:00-9:00",
    "9:00-10:00",
    "10:00-11:00",
    "11:00-12:00",
    "12:00-1:00",
    "1:00-2:00",
    "2:00-3:00",
    "3:00-4:00",
    "4:00-5:00",
    "5:00-6:00",
    "6:00-7:00",
    "7:00-8:00",
    "8:00-9:00",
] as const

type PlannerPdfSlotDescriptor = {
    label: string
    start: number
    end: number
    isNoonBreak: boolean
}

type PlannerPdfSlotLayoutDescriptor = PlannerPdfSlotDescriptor & {
    rowIndex: number
    top: number
    bottom: number
}

type PlannerPdfLayoutMetrics = {
    tableScale: number
    rowHeight: number
    headerRowHeight: number
    bodyGridHeight: number
    dayHeaderFontSize: number
    timeFontSize: number
    noonFontSize: number
    blockScale: number
}

type PlannerPdfMeetingBlockSource = {
    id: string
    dayOfWeek: string
    startTime: string
    endTime: string
    lines: string[]
    color: string
    textColor: string
    hasConflict: boolean
}

const assetUrlCache = new Map<string, Promise<string>>()


function inchesToPoints(value: number) {
    return value * 72
}

function paperSizeLabel(paperSize: PlannerPdfPaperSize) {
    if (paperSize === "SHORT_BOND") return "Short Bond Paper"
    if (paperSize === "LONG_BOND") return "Long Bond Paper"
    return "A4"
}

function paperSizeFilenameLabel(paperSize: PlannerPdfPaperSize) {
    if (paperSize === "SHORT_BOND") return "short-bond"
    if (paperSize === "LONG_BOND") return "long-bond"
    return "a4"
}

function resolvePdfPageSize(paperSize: PlannerPdfPaperSize) {
    if (paperSize === "SHORT_BOND") {
        return {
            width: inchesToPoints(11),
            height: inchesToPoints(8.5),
        }
    }

    if (paperSize === "LONG_BOND") {
        return {
            width: inchesToPoints(13),
            height: inchesToPoints(8.5),
        }
    }

    return "A4"
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result ?? ""))
        reader.onerror = () => reject(new Error("Failed to read file data."))
        reader.readAsDataURL(blob)
    })
}

function isSvgAsset(path: string, blob: Blob) {
    return /\.svg(?:$|\?)/i.test(path) || /image\/svg\+xml/i.test(blob.type)
}

async function loadImageElement(src: string) {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image()
        image.decoding = "async"
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("Failed to decode image asset."))
        image.src = src
    })
}

async function rasterizeSvgBlobToPngDataUrl(blob: Blob) {
    const objectUrl = URL.createObjectURL(blob)

    try {
        const image = await loadImageElement(objectUrl)
        const width = Math.max(image.naturalWidth || image.width || 1, 1)
        const height = Math.max(image.naturalHeight || image.height || 1, 1)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("Failed to prepare canvas for SVG conversion.")
        }

        context.clearRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)

        return canvas.toDataURL("image/png")
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

async function assetBlobToPdfDataUrl(path: string, blob: Blob) {
    if (isSvgAsset(path, blob)) {
        return await rasterizeSvgBlobToPngDataUrl(blob)
    }

    return await blobToDataUrl(blob)
}

function getAssetAsDataUrl(path: string) {
    if (!assetUrlCache.has(path)) {
        const promise = (async () => {
            try {
                const response = await fetch(path, { cache: "force-cache" })
                if (!response.ok) {
                    throw new Error(`Failed to load asset: ${path}`)
                }

                const blob = await response.blob()
                return await assetBlobToPdfDataUrl(path, blob)
            } catch (error) {
                assetUrlCache.delete(path)
                throw error
            }
        })()

        assetUrlCache.set(path, promise)
    }

    return assetUrlCache.get(path)!
}


function stablePdfRowHash(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(index)
        hash |= 0
    }
    return Math.abs(hash)
}

function normalizePlannerPdfText(value: unknown) {
    return String(value ?? "").trim()
}

function parsePlannerPdfClockMinutes(value: string) {
    const raw = normalizePlannerPdfText(value)
    if (!raw) return null

    const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (ampm) {
        let hh = Number(ampm[1])
        const mm = Number(ampm[2])
        const suffix = ampm[3].toUpperCase()

        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null

        if (suffix === "AM" && hh === 12) hh = 0
        if (suffix === "PM" && hh !== 12) hh += 12

        return hh * 60 + mm
    }

    const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (!timeMatch) return null

    const hh = Number(timeMatch[1])
    const mm = Number(timeMatch[2])

    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null

    return hh * 60 + mm
}

function formatPlannerPdfMinutesToSlotClock(totalMinutes: number) {
    const normalized =
        ((totalMinutes % PLANNER_PDF_MINUTES_PER_DAY) + PLANNER_PDF_MINUTES_PER_DAY) %
        PLANNER_PDF_MINUTES_PER_DAY
    const hh24 = Math.floor(normalized / 60)
    const mm = normalized % 60
    const hh12 = hh24 % 12 || 12
    return `${hh12}:${String(mm).padStart(2, "0")}`
}

function parsePlannerPdfSlotRange(slotLabel: string) {
    const [startRaw, endRaw] = String(slotLabel).split("-")
    const start = parsePlannerPdfClockMinutes(startRaw ?? "")
    const end = parsePlannerPdfClockMinutes(endRaw ?? "")

    if (start == null || end == null) return null
    return { start, end }
}

function isPlannerPdfNoonBreakRange(start: number, end: number) {
    return (
        start === PLANNER_PDF_MORNING_END_MINUTES &&
        end === PLANNER_PDF_AFTERNOON_START_MINUTES
    )
}

function isPlannerPdfNoonBreakSlot(slotLabel: string) {
    const parsed = parsePlannerPdfSlotRange(slotLabel)
    if (!parsed) return normalizePlannerPdfText(slotLabel) === PLANNER_PDF_NOON_BREAK_SLOT

    const normalizedEnd =
        parsed.end <= parsed.start
            ? parsed.end + PLANNER_PDF_MINUTES_PER_HALF_DAY
            : parsed.end

    return isPlannerPdfNoonBreakRange(parsed.start, normalizedEnd)
}

function plannerPdfRangesOverlap(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
    toleranceMinutes = 0
) {
    const normalizedAEnd = aEnd <= aStart ? aStart + 1 : aEnd
    const normalizedBEnd = bEnd <= bStart ? bStart + 1 : bEnd

    return (
        aStart < normalizedBEnd + toleranceMinutes &&
        bStart < normalizedAEnd + toleranceMinutes
    )
}

function parseOrderedPlannerPdfSlotDescriptors(timeSlots: string[]) {
    let previousEnd = -1

    return timeSlots
        .map((slot) => {
            const parsed = parsePlannerPdfSlotRange(slot)
            if (!parsed) return null

            let start = parsed.start
            let end = parsed.end

            while (previousEnd >= 0 && start < previousEnd) {
                start += PLANNER_PDF_MINUTES_PER_HALF_DAY
                end += PLANNER_PDF_MINUTES_PER_HALF_DAY
            }

            while (end <= start) {
                end += PLANNER_PDF_MINUTES_PER_HALF_DAY
            }

            previousEnd = end

            return {
                label: slot,
                start,
                end,
                isNoonBreak: isPlannerPdfNoonBreakRange(start, end),
            } as PlannerPdfSlotDescriptor
        })
        .filter(Boolean) as PlannerPdfSlotDescriptor[]
}

function resolvePlannerPdfPageDimensions(pdfPageSize: "A4" | { width: number; height: number }) {
    if (typeof pdfPageSize === "string") {
        return {
            width: 841.89,
            height: 595.28,
        }
    }

    return pdfPageSize
}

function computePlannerPdfLayoutMetrics(
    rowCount: number,
    pdfPageSize: "A4" | { width: number; height: number }
): PlannerPdfLayoutMetrics {
    const { height: pageHeight } = resolvePlannerPdfPageDimensions(pdfPageSize)
    const usablePageHeight =
        pageHeight - PLANNER_PDF_PAGE_PADDING_TOP - PLANNER_PDF_PAGE_PADDING_BOTTOM

    const reservedHeaderHeight = 92
    const reservedTitleHeight = 44
    const reservedBottomHeight = 42
    const reservedGapHeight = 16

    const maxTableHeight = Math.max(
        150,
        usablePageHeight -
            reservedHeaderHeight -
            reservedTitleHeight -
            reservedBottomHeight -
            reservedGapHeight
    )

    const baseTableHeight =
        PLANNER_PDF_HEADER_ROW_HEIGHT + rowCount * PLANNER_PDF_ROW_HEIGHT
    const tableScale =
        baseTableHeight > 0 ? Math.min(1, maxTableHeight / baseTableHeight) : 1

    const rowHeight = Number((PLANNER_PDF_ROW_HEIGHT * tableScale).toFixed(2))
    const headerRowHeight = Number(
        (PLANNER_PDF_HEADER_ROW_HEIGHT * tableScale).toFixed(2)
    )
    const bodyGridHeight = Number((rowCount * rowHeight).toFixed(2))

    return {
        tableScale,
        rowHeight,
        headerRowHeight,
        bodyGridHeight,
        dayHeaderFontSize: Math.max(5.2, Number((8.2 * tableScale).toFixed(2))),
        timeFontSize: Math.max(4.2, Number((7 * tableScale).toFixed(2))),
        noonFontSize: Math.max(4.2, Number((7.2 * tableScale).toFixed(2))),
        blockScale: Math.max(0.45, tableScale),
    }
}

function resolvePlannerPdfTimeRangeFromTimes(
    startTime: string,
    endTime: string,
    slotMeta: PlannerPdfSlotDescriptor[] = []
) {
    const parsedStart = parsePlannerPdfClockMinutes(startTime)
    const parsedEnd = parsePlannerPdfClockMinutes(endTime)

    if (parsedStart == null || parsedEnd == null) return null


    const normalizeRange = (baseStart: number, baseEnd: number) => {
        let start = baseStart
        let end = baseEnd

        while (end <= start) {
            end += PLANNER_PDF_MINUTES_PER_HALF_DAY
        }

        return { start, end }
    }

    const candidates: Array<{ start: number; end: number }> = []

    const pushCandidate = (start: number, end: number) => {
        const normalized = normalizeRange(start, end)
        if (
            !candidates.some(
                (candidate) =>
                    candidate.start === normalized.start &&
                    candidate.end === normalized.end
            )
        ) {
            candidates.push(normalized)
        }
    }

    pushCandidate(parsedStart, parsedEnd)
    pushCandidate(
        parsedStart + PLANNER_PDF_MINUTES_PER_HALF_DAY,
        parsedEnd + PLANNER_PDF_MINUTES_PER_HALF_DAY
    )

    const matchesAnySlot = (range: { start: number; end: number }) =>
        slotMeta.some(
            (slot) =>
                !slot.isNoonBreak &&
                plannerPdfRangesOverlap(
                    range.start,
                    range.end,
                    slot.start,
                    slot.end,
                    PLANNER_PDF_SLOT_EDGE_TOLERANCE_MINUTES
                )
        )

    if (slotMeta.length > 0) {
        const matchedCandidate = candidates.find(matchesAnySlot)
        if (matchedCandidate) return matchedCandidate
    }

    return candidates[0] ?? null
}

function resolvePlannerPdfRowTimeRange(
    row: Pick<ScheduleRow, "startTime" | "endTime">,
    slotMeta: PlannerPdfSlotDescriptor[] = []
) {
    return resolvePlannerPdfTimeRangeFromTimes(row.startTime, row.endTime, slotMeta)
}

function inferPreferredPlannerPdfSlotDuration(
    rows: ScheduleRow[],
    slotMeta: PlannerPdfSlotDescriptor[]
) {
    const counts = new Map<number, number>()

    const addDuration = (value: number | null) => {
        if (value == null || value <= 0) return
        counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    for (const slot of slotMeta) {
        if (slot.isNoonBreak) continue
        addDuration(slot.end - slot.start)
    }

    for (const row of rows) {
        const range = resolvePlannerPdfRowTimeRange(row)
        if (!range) continue
        addDuration(range.end - range.start)
    }

    const ranked = Array.from(counts.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return b[0] - a[0]
    })

    return ranked[0]?.[0] ?? null
}

function buildPlannerPdfLabelsFromBoundaries(
    boundaries: number[],
    preferredDuration: number | null
) {
    const uniqueSorted = Array.from(
        new Set(boundaries.filter((value) => Number.isFinite(value)))
    ).sort((a, b) => a - b)

    if (uniqueSorted.length < 2) return [] as string[]

    const labels: string[] = []

    for (let index = 0; index < uniqueSorted.length - 1; index += 1) {
        const start = uniqueSorted[index]
        const end = uniqueSorted[index + 1]

        if (end <= start) continue

        if (!preferredDuration || preferredDuration <= 0) {
            labels.push(
                `${formatPlannerPdfMinutesToSlotClock(
                    start
                )}-${formatPlannerPdfMinutesToSlotClock(end)}`
            )
            continue
        }

        let cursor = start
        while (cursor + preferredDuration < end) {
            const next = cursor + preferredDuration
            labels.push(
                `${formatPlannerPdfMinutesToSlotClock(
                    cursor
                )}-${formatPlannerPdfMinutesToSlotClock(next)}`
            )
            cursor = next
        }

        labels.push(
            `${formatPlannerPdfMinutesToSlotClock(
                cursor
            )}-${formatPlannerPdfMinutesToSlotClock(end)}`
        )
    }

    return labels
}

function formatPlannerPdfSlotDescriptorLabel(slot: PlannerPdfSlotDescriptor) {
    if (slot.isNoonBreak) return PLANNER_PDF_NOON_BREAK_SLOT
    return `${formatPlannerPdfMinutesToSlotClock(
        slot.start
    )}-${formatPlannerPdfMinutesToSlotClock(slot.end)}`
}

function splitPlannerPdfSlotDescriptorAtBoundaries(
    slot: PlannerPdfSlotDescriptor,
    boundaries: number[]
) {
    if (slot.isNoonBreak) {
        return [
            {
                ...slot,
                label: formatPlannerPdfSlotDescriptorLabel(slot),
            },
        ] as PlannerPdfSlotDescriptor[]
    }

    const relevantBoundaries = Array.from(
        new Set(
            boundaries.filter((boundary) => boundary > slot.start && boundary < slot.end)
        )
    ).sort((a, b) => a - b)

    if (relevantBoundaries.length === 0) {
        return [
            {
                ...slot,
                label: formatPlannerPdfSlotDescriptorLabel(slot),
            },
        ] as PlannerPdfSlotDescriptor[]
    }

    const edges = [slot.start, ...relevantBoundaries, slot.end]
    const segments: PlannerPdfSlotDescriptor[] = []

    for (let index = 0; index < edges.length - 1; index += 1) {
        const start = edges[index]
        const end = edges[index + 1]

        if (end <= start) continue

        segments.push({
            label: `${formatPlannerPdfMinutesToSlotClock(
                start
            )}-${formatPlannerPdfMinutesToSlotClock(end)}`,
            start,
            end,
            isNoonBreak: isPlannerPdfNoonBreakRange(start, end),
        })
    }

    return segments
}

function resolvePlannerPdfTimeSlots(rows: PlannerDisplayRow[]) {
    const sourceRows = rows.flatMap((row) => row.sourceRows)
    const explicitSlots = parseOrderedPlannerPdfSlotDescriptors([
        ...PLANNER_PDF_BASE_TIME_SLOTS,
    ])
    const preferredDuration = inferPreferredPlannerPdfSlotDuration(sourceRows, explicitSlots)

    const rowRanges = sourceRows
        .map((row) => resolvePlannerPdfRowTimeRange(row))
        .filter(Boolean) as Array<{ start: number; end: number }>

    if (rowRanges.length === 0) {
        return explicitSlots.map((slot) => slot.label)
    }

    const rowBoundaries = Array.from(
        new Set(rowRanges.flatMap((range) => [range.start, range.end]))
    ).sort((a, b) => a - b)

    const descriptors = explicitSlots.flatMap((slot) =>
        splitPlannerPdfSlotDescriptorAtBoundaries(slot, rowBoundaries)
    )

    const minRowStart = Math.min(...rowRanges.map((range) => range.start))
    const maxRowEnd = Math.max(...rowRanges.map((range) => range.end))

    if (preferredDuration && preferredDuration > 0) {
        let firstStart = descriptors[0]?.start ?? minRowStart
        const prepended: PlannerPdfSlotDescriptor[] = []

        while (minRowStart < firstStart) {
            const nextStart = Math.max(minRowStart, firstStart - preferredDuration)
            const slot: PlannerPdfSlotDescriptor = {
                label: `${formatPlannerPdfMinutesToSlotClock(
                    nextStart
                )}-${formatPlannerPdfMinutesToSlotClock(firstStart)}`,
                start: nextStart,
                end: firstStart,
                isNoonBreak: isPlannerPdfNoonBreakRange(nextStart, firstStart),
            }

            prepended.unshift({
                ...slot,
                label: formatPlannerPdfSlotDescriptorLabel(slot),
            })

            if (nextStart === firstStart) break
            firstStart = nextStart
        }

        let lastEnd = descriptors[descriptors.length - 1]?.end ?? maxRowEnd
        const appended: PlannerPdfSlotDescriptor[] = []

        while (maxRowEnd > lastEnd) {
            const nextEnd = Math.min(maxRowEnd, lastEnd + preferredDuration)
            const slot: PlannerPdfSlotDescriptor = {
                label: `${formatPlannerPdfMinutesToSlotClock(
                    lastEnd
                )}-${formatPlannerPdfMinutesToSlotClock(nextEnd)}`,
                start: lastEnd,
                end: nextEnd,
                isNoonBreak: isPlannerPdfNoonBreakRange(lastEnd, nextEnd),
            }

            appended.push({
                ...slot,
                label: formatPlannerPdfSlotDescriptorLabel(slot),
            })

            if (nextEnd === lastEnd) break
            lastEnd = nextEnd
        }

        return [...prepended, ...descriptors, ...appended].map((slot) => slot.label)
    }

    const boundaries = [...descriptors.flatMap((slot) => [slot.start, slot.end])]
    for (const range of rowRanges) {
        boundaries.push(range.start, range.end)
    }

    return buildPlannerPdfLabelsFromBoundaries(boundaries, preferredDuration)
}

function buildPlannerPdfSlotLayoutDescriptors(
    timeSlots: string[],
    rowHeight: number
) {
    const slotMeta = parseOrderedPlannerPdfSlotDescriptors(timeSlots)
    let currentTop = 0

    return slotMeta.map((slot, rowIndex) => {
        const top = currentTop
        const bottom = top + rowHeight
        currentTop = bottom

        return {
            ...slot,
            rowIndex,
            top,
            bottom,
        } as PlannerPdfSlotLayoutDescriptor
    })
}

function resolvePlannerPdfMinutePositionWithinSlot(
    slot: PlannerPdfSlotLayoutDescriptor,
    minute: number
) {
    const duration = Math.max(slot.end - slot.start, 1)
    let normalizedMinute = minute

    if (
        Math.abs(normalizedMinute - slot.start) <=
        PLANNER_PDF_SLOT_EDGE_TOLERANCE_MINUTES
    ) {
        normalizedMinute = slot.start
    } else if (
        Math.abs(normalizedMinute - slot.end) <=
        PLANNER_PDF_SLOT_EDGE_TOLERANCE_MINUTES
    ) {
        normalizedMinute = slot.end
    }

    const clampedMinute = Math.min(
        Math.max(normalizedMinute, slot.start),
        slot.end
    )
    const ratio = (clampedMinute - slot.start) / duration

    return slot.top + ratio * (slot.bottom - slot.top)
}

function collapsePlannerPdfLineText(value: string) {
    return normalizePlannerPdfText(value).replace(/\s+/g, " ")
}

function buildPlannerPdfWrappedLayout(
    lines: string[],
    width: number,
    height: number,
    fontSize: number,
    paddingX: number,
    paddingY: number
) {
    const usableWidth = Math.max(width - paddingX * 2 - 2, 28)
    const usableHeight = Math.max(height - paddingY * 2 - 2, fontSize)

    const maxCharsPerLine = Math.max(
        5,
        Math.floor(usableWidth / Math.max(fontSize * 0.6, 1))
    )

    const wrapped = lines.flatMap((line) =>
        wrapPlannerPdfLineText(line, maxCharsPerLine)
    )
    const maxLines = Math.max(
        1,
        Math.floor(
            usableHeight /
                Math.max(fontSize * PLANNER_PDF_BLOCK_LINE_HEIGHT_RATIO, 1)
        )
    )

    return {
        wrapped,
        maxCharsPerLine,
        maxLines,
    }
}

function wrapPlannerPdfLineText(value: string, maxCharsPerLine: number) {
    const text = collapsePlannerPdfLineText(value)
    if (!text) return [] as string[]
    if (text.length <= maxCharsPerLine) return [text]

    const words = text.split(" ").filter(Boolean)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word

        if (candidate.length <= maxCharsPerLine) {
            current = candidate
            continue
        }

        if (current) {
            lines.push(current)
            current = ""
        }

        if (word.length <= maxCharsPerLine) {
            current = word
            continue
        }

        let remaining = word
        while (remaining.length > maxCharsPerLine) {
            lines.push(
                `${remaining.slice(0, Math.max(1, maxCharsPerLine - 1))}-`
            )
            remaining = remaining.slice(Math.max(1, maxCharsPerLine - 1))
        }
        current = remaining
    }

    if (current) {
        lines.push(current)
    }

    return lines
}

function clampPlannerPdfLineText(value: string, maxLength: number) {
    const text = collapsePlannerPdfLineText(value)
    if (text.length <= maxLength) return text
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function resolvePlannerPdfScaledBlockContent(
    lines: string[],
    width: number,
    height: number,
    scale = 1
) {
    const baseLines = lines
        .map(collapsePlannerPdfLineText)
        .filter(Boolean)
        .slice(0, 4)

    const paddingX = Math.max(
        1,
        Number((PLANNER_PDF_BLOCK_PADDING_X * scale).toFixed(2))
    )
    const paddingY = Math.max(
        0.8,
        Number((PLANNER_PDF_BLOCK_PADDING_Y * scale).toFixed(2))
    )
    const minFontSize = Math.max(
        2.6,
        Number((PLANNER_PDF_BLOCK_MIN_FONT_SIZE * scale).toFixed(2))
    )
    const maxFontSize = Math.max(
        minFontSize,
        Number((PLANNER_PDF_BLOCK_MAX_FONT_SIZE * scale).toFixed(2))
    )
    const fontStep = Math.max(
        0.1,
        Number((PLANNER_PDF_BLOCK_FONT_STEP * scale).toFixed(2))
    )

    if (baseLines.length === 0) {
        return {
            lines: [] as string[],
            fontSize: minFontSize,
            paddingX,
            paddingY,
        }
    }

    for (
        let fontSize = maxFontSize;
        fontSize >= minFontSize;
        fontSize = Number((fontSize - fontStep).toFixed(2))
    ) {
        const layout = buildPlannerPdfWrappedLayout(
            baseLines,
            width,
            height,
            fontSize,
            paddingX,
            paddingY
        )
        if (layout.wrapped.length <= layout.maxLines) {
            return {
                lines: layout.wrapped,
                fontSize,
                paddingX,
                paddingY,
            }
        }
    }

    const fallbackLayout = buildPlannerPdfWrappedLayout(
        baseLines,
        width,
        height,
        minFontSize,
        paddingX,
        paddingY
    )
    const clipped = fallbackLayout.wrapped.slice(0, fallbackLayout.maxLines)

    if (clipped.length > 0) {
        clipped[clipped.length - 1] = clampPlannerPdfLineText(
            clipped[clipped.length - 1],
            Math.max(5, fallbackLayout.maxCharsPerLine - 1)
        )

        if (!clipped[clipped.length - 1].endsWith("…")) {
            clipped[clipped.length - 1] = `${clipped[
                clipped.length - 1
            ].replace(/[.…]+$/g, "")}…`
        }
    }

    return {
        lines: clipped,
        fontSize: minFontSize,
        paddingX,
        paddingY,
    }
}

function resolvePlannerPdfBlockColor(row: PlannerDisplayRow) {
    const seed = [
        row.sectionDisplay,
        row.subjectCodeDisplay,
        row.descriptiveTitleDisplay,
        row.roomDisplay,
    ]
        .map((value) => normalizePlannerPdfText(value))
        .join("|")

    const paletteIndex = stablePdfRowHash(seed || row.key) % PDF_PASTEL_ROW_FILLS.length
    return PDF_PASTEL_ROW_FILLS[paletteIndex]
}

function buildPlannerPdfMeetingSources(rows: PlannerDisplayRow[]) {
    return rows.flatMap((row) =>
        row.sourceRows.map((sourceRow) => {
            const lines = [
                row.sectionDisplay,
                row.subjectCodeDisplay,
                row.descriptiveTitleDisplay,
            ]
                .map((value) => normalizePlannerPdfText(value))
                .filter((value) => value && value !== "—")
                .slice(0, 4)

            return {
                id: `${row.key}::${sourceRow.meetingId}`,
                dayOfWeek: sourceRow.dayOfWeek,
                startTime: sourceRow.startTime,
                endTime: sourceRow.endTime,
                lines,
                color: resolvePlannerPdfBlockColor(row),
                textColor: "#334155",
                hasConflict: row.hasConflict,
            } as PlannerPdfMeetingBlockSource
        })
    )
}

function buildPlannerPdfMeetingBlocks(
    rows: PlannerDisplayRow[],
    timeSlots: string[],
    rowHeight: number,
    blockScale: number
) {
    const slotLayouts = buildPlannerPdfSlotLayoutDescriptors(timeSlots, rowHeight)
    const sources = buildPlannerPdfMeetingSources(rows)

    const blocks: Array<{
        id: string
        dayIndex: number
        rowIndex: number
        top: number
        left: number
        width: number
        height: number
        color: string
        textColor: string
        hasConflict: boolean
        lines: string[]
        fontSize: number
        paddingX: number
        paddingY: number
    }> = []

    for (const source of sources) {
        const normalizedDay = normalizePlannerPdfText(source.dayOfWeek).toLowerCase()
        const dayIndex = PLANNER_PDF_DAYS.findIndex((day) =>
            normalizedDay.startsWith(day.toLowerCase().slice(0, 3))
        )
        if (dayIndex < 0) continue

        const range = resolvePlannerPdfTimeRangeFromTimes(
            source.startTime,
            source.endTime,
            slotLayouts
        )
        if (!range) continue

        const matchedSlots = slotLayouts.filter(
            (slot) =>
                !slot.isNoonBreak &&
                plannerPdfRangesOverlap(
                    range.start,
                    range.end,
                    slot.start,
                    slot.end,
                    PLANNER_PDF_SLOT_EDGE_TOLERANCE_MINUTES
                )
        )

        if (matchedSlots.length === 0) continue

        const firstSlot = matchedSlots[0]
        const lastSlot = matchedSlots[matchedSlots.length - 1]

        const top = resolvePlannerPdfMinutePositionWithinSlot(firstSlot, range.start)
        const bottom = resolvePlannerPdfMinutePositionWithinSlot(lastSlot, range.end)
        const left = dayIndex * PLANNER_PDF_DAY_COL_WIDTH
        const width = PLANNER_PDF_DAY_COL_WIDTH
        const height = Math.max(bottom - top, 1)
        const blockContent = resolvePlannerPdfScaledBlockContent(
            source.lines,
            width,
            height,
            blockScale
        )

        blocks.push({
            id: source.id,
            dayIndex,
            rowIndex: firstSlot.rowIndex,
            top,
            left,
            width,
            height,
            color: source.color,
            textColor: source.textColor,
            hasConflict: source.hasConflict,
            lines: blockContent.lines,
            fontSize: blockContent.fontSize,
            paddingX: blockContent.paddingX,
            paddingY: blockContent.paddingY,
        })
    }

    return blocks.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex
        if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex
        return a.id.localeCompare(b.id)
    })
}

const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: PLANNER_PDF_PAGE_PADDING_TOP,
        paddingRight: PLANNER_PDF_PAGE_PADDING_RIGHT,
        paddingBottom: PLANNER_PDF_PAGE_PADDING_BOTTOM,
        paddingLeft: PLANNER_PDF_PAGE_PADDING_LEFT,
        fontFamily: "Helvetica",
        color: "#1F2937",
        fontSize: 8.25,
    },
    sheetWrap: {
        width: PLANNER_PDF_GRID_WIDTH,
        minHeight: "100%",
        alignSelf: "center",
        display: "flex",
        flexDirection: "column",
    },
    contentWrap: {
        width: PLANNER_PDF_GRID_WIDTH,
        alignSelf: "center",
    },
    bottomWrap: {
        width: PLANNER_PDF_GRID_WIDTH,
        marginTop: "auto",
        alignSelf: "center",
    },
    headerWrap: {
        width: PLANNER_PDF_GRID_WIDTH,
        alignSelf: "center",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
    logoWrap: {
        width: 72,
        height: 60,
        alignItems: "center",
        justifyContent: "center",
    },
    logo: {
        width: 54,
        height: 54,
        objectFit: "contain",
    },
    centerHeader: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },
    republic: {
        fontSize: 7,
        color: "#4B5563",
        textAlign: "center",
        marginBottom: 1,
    },
    school: {
        fontSize: 10.5,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 1,
    },
    campusLine: {
        fontSize: 7.2,
        color: "#4B5563",
        textAlign: "center",
        marginBottom: 4,
    },
    college: {
        fontSize: 9.25,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 1,
    },
    documentTitle: {
        fontSize: 15.5,
        fontStyle: "italic",
        textAlign: "center",
        color: "#4B5563",
        marginTop: 8,
        marginBottom: 3,
    },
    metaCenter: {
        fontSize: 8.1,
        textAlign: "center",
        color: "#475569",
        marginBottom: 1,
    },
    gridTable: {
        width: PLANNER_PDF_GRID_WIDTH,
        marginTop: 10,
        alignSelf: "center",
        borderWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
    },
    gridHeaderRow: {
        flexDirection: "row",
        width: PLANNER_PDF_GRID_WIDTH,
    },
    timeHeadCell: {
        width: PLANNER_PDF_TIME_COL_WIDTH,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PDF_TABLE_HEADER_FILL,
        paddingHorizontal: 2,
    },
    dayHeadCell: {
        width: PLANNER_PDF_DAY_COL_WIDTH,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PDF_TABLE_HEADER_FILL,
        paddingHorizontal: 2,
    },
    bodyGrid: {
        position: "relative",
        width: PLANNER_PDF_GRID_WIDTH,
    },
    bodyRow: {
        flexDirection: "row",
    },
    timeCell: {
        width: PLANNER_PDF_TIME_COL_WIDTH,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
    },
    blankDayCell: {
        width: PLANNER_PDF_DAY_COL_WIDTH,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
    },
    noonCell: {
        width:
            PLANNER_PDF_GRID_WIDTH - PLANNER_PDF_TIME_COL_WIDTH,
        borderBottomWidth: 1,
        borderColor: PDF_TABLE_BORDER_COLOR,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAFAFA",
    },
    overlayArea: {
        position: "absolute",
        top: 0,
        left: PLANNER_PDF_TIME_COL_WIDTH,
        width: PLANNER_PDF_GRID_WIDTH - PLANNER_PDF_TIME_COL_WIDTH,
    },
    meetingBlock: {
        position: "absolute",
        borderWidth: 0.8,
        borderColor: "#94A3B8",
        alignItems: "center",
        justifyContent: "center",
    },
    meetingConflictBlock: {
        borderColor: "#DC2626",
        borderWidth: 1,
    },
    meetingText: {
        lineHeight: PLANNER_PDF_BLOCK_LINE_HEIGHT_RATIO,
        textAlign: "center",
    },
    footerRuleWrap: {
        width: "100%",
        marginTop: 18,
    },
    blueRule: {
        height: 2,
        backgroundColor: "#7FA7E8",
        width: "100%",
    },
    goldRule: {
        height: 1.5,
        backgroundColor: "#E9C76B",
        width: "100%",
        marginTop: 2,
    },
    footerText: {
        marginTop: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 8,
        color: "#64748B",
    },
})


function comparePlannerText(a?: string | number | null, b?: string | number | null) {
    return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        numeric: true,
        sensitivity: "base",
    })
}

function splitSubjectLabelParts(subjectLabel?: string | null) {
    const normalized = String(subjectLabel || "").trim()
    if (!normalized) {
        return { code: "—", descriptiveTitle: "—" }
    }

    const parts = normalized
        .split(" • ")
        .map((part) => part.trim())
        .filter(Boolean)

    if (parts.length <= 1) {
        return { code: parts[0] || normalized, descriptiveTitle: parts[0] || normalized }
    }

    return {
        code: parts[0],
        descriptiveTitle: parts.slice(1).join(" • "),
    }
}

function countConflictFlags(flags?: ConflictFlags) {
    return Number(Boolean(flags?.room)) + Number(Boolean(flags?.faculty)) + Number(Boolean(flags?.section))
}

function normalizeSectionYearLevelDisplay(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    if (/^(CS|IS)\s+[1-9]\d*$/.test(normalized)) {
        return normalized
    }

    const prefixedMatch = normalized.match(/^(CS|IS)\s*([1-9]\d*)$/)
    if (prefixedMatch) {
        return `${prefixedMatch[1]} ${prefixedMatch[2]}`
    }

    const plainNumberMatch = normalized.match(/^([1-9]\d*)$/)
    if (plainNumberMatch) {
        return plainNumberMatch[1]
    }

    const ordinalYearMatch = normalized.match(/^([1-9]\d*)(?:ST|ND|RD|TH)?(?:\s+YEAR)?$/)
    if (ordinalYearMatch) {
        return ordinalYearMatch[1]
    }

    return ""
}

function buildFormattedSectionLabel(rawValue: string) {
    const normalized = String(rawValue || "").trim().replace(/\s+/g, " ")
    if (!normalized) return ""

    const withoutProgramPrefix = normalized
        .replace(
            /^(?:BSCS|BSIS|BS\s+COMPUTER\s+SCIENCE|BS\s+INFORMATION\s+SYSTEMS?|COMPUTER\s+SCIENCE|INFORMATION\s+SYSTEMS?)\s*/i,
            ""
        )
        .trim()

    const hyphenParts = withoutProgramPrefix
        .split(/\s*-\s*/)
        .map((part) => part.trim())
        .filter(Boolean)

    if (hyphenParts.length >= 2) {
        const leftPart = hyphenParts[0]
        const rightPart = hyphenParts.slice(1).join(" - ")
        const normalizedLeftYear = normalizeSectionYearLevelDisplay(leftPart)

        if (normalizedLeftYear && rightPart) {
            return `${normalizedLeftYear} - ${rightPart}`
        }
    }

    const normalizedWholeYear = normalizeSectionYearLevelDisplay(withoutProgramPrefix)
    if (normalizedWholeYear) {
        return normalizedWholeYear
    }

    return withoutProgramPrefix
}

function formatSectionDisplayLabel({
    label,
    yearLevel,
    name,
}: {
    label?: string | null
    yearLevel?: string | number | null
    name?: string | null
}) {
    const normalizedYearLevel = normalizeSectionYearLevelDisplay(yearLevel)
    const normalizedName = String(name || "").trim()
    if (normalizedYearLevel && normalizedName) {
        return `${normalizedYearLevel} - ${normalizedName}`
    }
    if (normalizedYearLevel) return normalizedYearLevel

    const formattedFromLabel = buildFormattedSectionLabel(String(label || ""))
    if (formattedFromLabel) return formattedFromLabel

    const formattedFromName = buildFormattedSectionLabel(String(name || ""))
    if (formattedFromName) return formattedFromName

    return "—"
}

function buildSectionDisplayLookup(sections: SectionDoc[]): SectionDisplayLookup {
    const lookup: SectionDisplayLookup = {}
    for (const section of sections) {
        lookup[section.$id] = formatSectionDisplayLabel({
            label: section.label,
            yearLevel: section.yearLevel,
            name: section.name,
        })
    }
    return lookup
}

function getRowSectionDisplayLabel(row: ScheduleRow, sectionDisplayLookup: SectionDisplayLookup) {
    const sectionId = String(row.sectionId || "").trim()
    if (sectionId && sectionDisplayLookup[sectionId]) {
        return sectionDisplayLookup[sectionId]
    }

    return formatSectionDisplayLabel({
        label: row.sectionLabel,
        yearLevel: row.sectionYearLevel,
        name: row.sectionName,
    })
}

function mergeConflictFlags(flagsCollection: Array<ConflictFlags | undefined>): ConflictFlags {
    return flagsCollection.reduce<ConflictFlags>(
        (acc, flags) => ({
            room: acc.room || Boolean(flags?.room),
            faculty: acc.faculty || Boolean(flags?.faculty),
            section: acc.section || Boolean(flags?.section),
        }),
        { room: false, faculty: false, section: false }
    )
}

function normalizePlannerSectionDisplayValue(value?: string | null) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
}


function getPlannerCourseYearKey(sectionDisplay?: string | null) {
    const normalizedSectionDisplay = normalizePlannerSectionDisplayValue(sectionDisplay)
    if (!normalizedSectionDisplay || normalizedSectionDisplay === "—") {
        return "Unspecified"
    }

    const firstSectionDisplay = normalizedSectionDisplay
        .split(/\s*\/\s*/)
        .map((part) => part.trim())
        .filter(Boolean)[0] || normalizedSectionDisplay

    const [courseYearPart] = firstSectionDisplay.split(/\s+-\s+/)
    return courseYearPart?.trim() || firstSectionDisplay
}

function formatPlannerCourseGroupSubtitle(sectionDisplays: string[]) {
    const normalizedSectionDisplays = Array.from(
        new Set(sectionDisplays.map((sectionDisplay) => normalizePlannerSectionDisplayValue(sectionDisplay)).filter(Boolean))
    )

    if (normalizedSectionDisplays.length === 0) return ""
    if (normalizedSectionDisplays.length === 1) return normalizedSectionDisplays[0]

    return joinDisplayValues(normalizedSectionDisplays, " • ")
}

function buildPlannerDisplayRows({
    rows,
    conflictFlagsByMeetingId,
    sectionDisplayLookup,
}: {
    rows: ScheduleRow[]
    conflictFlagsByMeetingId: Map<string, ConflictFlags>
    sectionDisplayLookup: SectionDisplayLookup
}) {
    const groupedRows = new Map<string, ScheduleRow[]>()

    for (const row of rows) {
        const { descriptiveTitle } = splitSubjectLabelParts(row.subjectLabel)
        const sectionDisplay = getRowSectionDisplayLabel(row, sectionDisplayLookup)
        const meetingType = meetingTypeLabel(row.meetingType)
        const normalizedSectionDisplay = normalizePlannerSectionDisplayValue(sectionDisplay)
        const groupingKey = [
            normalizedSectionDisplay.toLowerCase() || "section",
            descriptiveTitle.toLowerCase(),
            meetingType,
        ].join("::")

        const current = groupedRows.get(groupingKey) || []
        current.push(row)
        groupedRows.set(groupingKey, current)
    }

    return Array.from(groupedRows.entries()).map(([key, sourceRows]) => {
        const orderedRows = sourceRows.slice().sort((a, b) => {
            const dayDiff = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
            if (dayDiff !== 0) return dayDiff
            return comparePlannerText(a.startTime, b.startTime)
        })
        const primaryRow = orderedRows[0]
        const conflictFlags = mergeConflictFlags(
            orderedRows.map((row) => conflictFlagsByMeetingId.get(row.meetingId))
        )
        const subjectParts = orderedRows.map((row) => splitSubjectLabelParts(row.subjectLabel))

        return {
            key,
            primaryRow,
            sourceRows: orderedRows,
            conflictFlags,
            hasConflict: countConflictFlags(conflictFlags) > 0,
            subjectCodeDisplay: joinDisplayValues(subjectParts.map((part) => part.code || "—")),
            descriptiveTitleDisplay: joinDisplayValues(subjectParts.map((part) => part.descriptiveTitle || "—")),
            dayDisplay: formatCombinedMeetingDayDisplay(orderedRows),
            timeDisplay: formatCombinedMeetingTimeDisplay(orderedRows),
            roomDisplay: joinDisplayValues(orderedRows.map((row) => row.roomLabel || "—")),
            roomTypeDisplay: joinDisplayValues(orderedRows.map((row) => roomTypeLabel(row.roomType))),
            facultyDisplay: joinDisplayValues(orderedRows.map((row) => row.facultyName || "—")),
            meetingTypeDisplay: joinDisplayValues(orderedRows.map((row) => meetingTypeLabel(row.meetingType))),
            sectionDisplay: joinDisplayValues(orderedRows.map((row) => getRowSectionDisplayLabel(row, sectionDisplayLookup))),
            sortDayValue: String(primaryRow.dayOfWeek || ""),
            sortStartTime: String(primaryRow.startTime || ""),
        } satisfies PlannerDisplayRow
    })
}


function SchedulePdfDocument({
    rows,
    scheduleScopeLabel,
    termLabel,
    deptLabel,
    generatedAt,
    scopeLabel,
    pdfPageSize,
    leftLogoSrc,
    rightLogoSrc,
}: {
    rows: PlannerDisplayRow[]
    scheduleScopeLabel: string
    termLabel: string
    deptLabel: string
    generatedAt: string
    filteredByConflict: boolean
    scopeLabel?: string
    pdfPageSize: "A4" | { width: number; height: number }
    leftLogoSrc: string
    rightLogoSrc: string
}) {
    const timeSlots = resolvePlannerPdfTimeSlots(rows)
    const tableLayout = computePlannerPdfLayoutMetrics(timeSlots.length, pdfPageSize)
    const meetingBlocks = buildPlannerPdfMeetingBlocks(
        rows,
        timeSlots,
        tableLayout.rowHeight,
        tableLayout.blockScale
    )
    const entryCount = rows.reduce(
        (total, row) => total + Math.max(1, row.sourceRows.length),
        0
    )
    const conflictCount = rows.filter((row) => row.hasConflict).length

    const pdfPageProps =
        typeof pdfPageSize === "string"
            ? { size: pdfPageSize, orientation: "landscape" as const }
            : { size: pdfPageSize }

    return (
        <Document title={`${HEADER_DOCUMENT}${scopeLabel ? ` - ${scopeLabel}` : ""}`}>
            <Page {...pdfPageProps} style={pdfStyles.page}>
                <View style={pdfStyles.sheetWrap}>
                    <View style={pdfStyles.contentWrap}>
                        <View style={pdfStyles.headerWrap}>
                            <View style={pdfStyles.headerRow}>
                                <View style={pdfStyles.logoWrap}>
                                    <Image src={leftLogoSrc} style={pdfStyles.logo} />
                                </View>

                                <View style={pdfStyles.centerHeader}>
                                    <Text style={pdfStyles.republic}>{HEADER_REPUBLIC}</Text>
                                    <Text style={pdfStyles.school}>{HEADER_INSTITUTION}</Text>
                                    <Text style={pdfStyles.campusLine}>{HEADER_SUBTITLE}</Text>
                                    <Text style={pdfStyles.college}>{HEADER_COLLEGE}</Text>
                                </View>

                                <View style={pdfStyles.logoWrap}>
                                    <Image src={rightLogoSrc} style={pdfStyles.logo} />
                                </View>
                            </View>
                        </View>

                        <Text style={pdfStyles.documentTitle}>{HEADER_DOCUMENT}</Text>
                        <Text style={pdfStyles.metaCenter}>
                            Schedule Scope: {scheduleScopeLabel || "—"} • Term: {termLabel || "—"} • College: {deptLabel || "—"}
                        </Text>
                        {scopeLabel ? <Text style={pdfStyles.metaCenter}>{scopeLabel}</Text> : null}
                        <Text style={pdfStyles.metaCenter}>Generated at: {generatedAt}</Text>

                        <View style={pdfStyles.gridTable}>
                            <View style={pdfStyles.gridHeaderRow}>
                                <View
                                    style={[
                                        pdfStyles.timeHeadCell,
                                        { height: tableLayout.headerRowHeight },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            fontSize: tableLayout.dayHeaderFontSize,
                                            fontWeight: "bold",
                                            color: PDF_TABLE_HEADER_TEXT,
                                        }}
                                    >
                                        Time
                                    </Text>
                                </View>

                                {PLANNER_PDF_DAYS.map((day, index) => (
                                    <View
                                        key={day}
                                        style={[
                                            pdfStyles.dayHeadCell,
                                            {
                                                height: tableLayout.headerRowHeight,
                                                borderRightWidth:
                                                    index === PLANNER_PDF_DAYS.length - 1 ? 0 : 1,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                fontSize: tableLayout.dayHeaderFontSize,
                                                fontWeight: "bold",
                                                color: PDF_TABLE_HEADER_TEXT,
                                            }}
                                        >
                                            {day}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View
                                style={[
                                    pdfStyles.bodyGrid,
                                    { height: tableLayout.bodyGridHeight },
                                ]}
                            >
                                {timeSlots.map((slotLabel) => {
                                    const isNoonBreak = isPlannerPdfNoonBreakSlot(slotLabel)

                                    return (
                                        <View
                                            key={slotLabel}
                                            style={[
                                                pdfStyles.bodyRow,
                                                { height: tableLayout.rowHeight },
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    pdfStyles.timeCell,
                                                    { height: tableLayout.rowHeight },
                                                ]}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: tableLayout.timeFontSize,
                                                    }}
                                                >
                                                    {slotLabel}
                                                </Text>
                                            </View>

                                            {isNoonBreak ? (
                                                <View
                                                    style={[
                                                        pdfStyles.noonCell,
                                                        { height: tableLayout.rowHeight },
                                                    ]}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: tableLayout.noonFontSize,
                                                            color: "#4B5563",
                                                        }}
                                                    >
                                                        Noon Break
                                                    </Text>
                                                </View>
                                            ) : (
                                                <>
                                                    {PLANNER_PDF_DAYS.map((day, index) => (
                                                        <View
                                                            key={`${slotLabel}-${day}`}
                                                            style={[
                                                                pdfStyles.blankDayCell,
                                                                {
                                                                    height: tableLayout.rowHeight,
                                                                    borderRightWidth:
                                                                        index ===
                                                                        PLANNER_PDF_DAYS.length - 1
                                                                            ? 0
                                                                            : 1,
                                                                },
                                                            ]}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </View>
                                    )
                                })}

                                <View
                                    style={[
                                        pdfStyles.overlayArea,
                                        { height: tableLayout.bodyGridHeight },
                                    ]}
                                >
                                    {meetingBlocks.map((block) => (
                                        <View
                                            key={block.id}
                                            style={[
                                                pdfStyles.meetingBlock,
                                                ...(block.hasConflict
                                                    ? [pdfStyles.meetingConflictBlock]
                                                    : []),
                                                {
                                                    top: block.top,
                                                    left: block.left,
                                                    width: block.width,
                                                    height: block.height,
                                                    backgroundColor: block.color,
                                                    paddingHorizontal: block.paddingX,
                                                    paddingVertical: block.paddingY,
                                                },
                                            ]}
                                        >
                                            {block.lines.map((line, lineIndex) => (
                                                <Text
                                                    key={`${block.id}-${lineIndex}`}
                                                    style={[
                                                        pdfStyles.meetingText,
                                                        {
                                                            color: block.textColor,
                                                            fontSize: block.fontSize,
                                                            fontWeight:
                                                                lineIndex === 0
                                                                    ? "bold"
                                                                    : "normal",
                                                        },
                                                    ]}
                                                >
                                                    {line}
                                                </Text>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={pdfStyles.bottomWrap}>
                        <View style={pdfStyles.footerRuleWrap}>
                            <View style={pdfStyles.blueRule} />
                            <View style={pdfStyles.goldRule} />
                        </View>

                        <View style={pdfStyles.footerText}>
                            <Text>
                                {entryCount} scheduled entr{entryCount === 1 ? "y" : "ies"}
                                {conflictCount > 0 ? ` • ${conflictCount} conflicted group${conflictCount === 1 ? "" : "s"}` : ""}
                            </Text>
                            <Text>WorkloadHub</Text>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    )
}


type ExtraSmallPlannerCardShellProps = {
    value: string
    title: string
    children: React.ReactNode
}

function ExtraSmallPlannerCardShell({
    value,
    title,
    children,
}: ExtraSmallPlannerCardShellProps) {
    return (
        <div className="sm:hidden">
            <Accordion type="single" collapsible className="rounded-2xl border bg-background">
                <AccordionItem value={value} className="border-b-0">
                    <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                        <span className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold">{title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-col-1 flex w-full flex-col items-center justify-center gap-1 rounded-xl whitespace-normal wrap-anywhere"
                                    >
                                        Details
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[95svh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto px-4 sm:px-6">
                                    <div className="min-w-0">{children}</div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}

function renderPlannerMobileRowCard({
    row,
    onFixConflict,
    renderConflictBadges,
    renderGroupedEditButtons,
}: {
    row: PlannerDisplayRow
    onFixConflict: () => void
    renderConflictBadges: (flags: ConflictFlags) => React.ReactNode
    renderGroupedEditButtons: (row: PlannerDisplayRow, alignment?: "start" | "end") => React.ReactNode
}) {
    return (
        <div className="rounded-xl border bg-background p-3 shadow-sm">
            <div className="space-y-2">
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</div>
                    <div className="font-semibold wrap-anywhere">{row.subjectCodeDisplay || "—"}</div>
                </div>
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descriptive Title</div>
                    <div className="max-w-full text-sm leading-relaxed wrap-anywhere">{row.descriptiveTitleDisplay || "—"}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Section</div>
                        <div className="wrap-anywhere">{row.sectionDisplay || "—"}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</div>
                        <div className="wrap-anywhere">{row.meetingTypeDisplay}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day</div>
                        <div className="wrap-anywhere">{row.dayDisplay}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</div>
                        <div className="wrap-anywhere">{row.timeDisplay}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room</div>
                        <div className="wrap-anywhere">{row.roomDisplay || "—"}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instructor</div>
                        <div className="wrap-anywhere">{row.facultyDisplay || "—"}</div>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    {renderConflictBadges(row.conflictFlags)}
                    {row.sourceRows.some((sourceRow) => sourceRow.isManualFaculty) ? (
                        <Badge variant="secondary" className="rounded-lg">
                            Manual
                        </Badge>
                    ) : null}
                </div>
                <div className="space-y-2 pt-1">
                    {row.hasConflict ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={onFixConflict}
                        >
                            <ArrowRight className="mr-2 size-4" />
                            Fix Conflict
                        </Button>
                    ) : null}
                    {renderGroupedEditButtons(row)}
                </div>
            </div>
        </div>
    )
}

function renderLaboratoryMobileRowCard({
    row,
    renderConflictBadges,
    renderGroupedEditButtons,
}: {
    row: PlannerDisplayRow
    renderConflictBadges: (flags: ConflictFlags) => React.ReactNode
    renderGroupedEditButtons: (row: PlannerDisplayRow, alignment?: "start" | "end") => React.ReactNode
}) {
    const baseRow = row.primaryRow

    return (
        <div className="rounded-xl border bg-background p-3 shadow-sm">
            <div className="space-y-2">
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Laboratory Room</div>
                    <div className="font-semibold wrap-anywhere">{row.roomDisplay || "—"}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day</div>
                        <div className="wrap-anywhere">{row.dayDisplay}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</div>
                        <div className="wrap-anywhere">{row.timeDisplay}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned Faculty</div>
                        <div className="wrap-anywhere">{row.facultyDisplay || "—"}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</div>
                        <div className="wrap-anywhere">{baseRow.subjectLabel || "—"}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Section</div>
                        <div className="wrap-anywhere">{row.sectionDisplay || "—"}</div>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    {renderConflictBadges(row.conflictFlags)}
                    {row.sourceRows.some((sourceRow) => sourceRow.isManualFaculty) ? (
                        <Badge variant="secondary" className="rounded-lg">
                            Manual
                        </Badge>
                    ) : null}
                </div>
                <div className="space-y-2 pt-1">
                    {renderGroupedEditButtons(row)}
                </div>
            </div>
        </div>
    )
}

export function PlannerManagementSection({
    hasScheduleScope,
    scheduleScopeKey,
    showConflictsOnly,
    onShowConflictsOnlyChange,
    entriesLoading,
    entriesError,
    entrySaving,
    onReloadEntries,
    onOpenCreateEntry,
    plannerStats,
    visibleRows,
    laboratoryRows,
    conflictFlagsByMeetingId,
    scheduleScopeLabel,
    selectedTermLabel,
    selectedDeptLabel,
    entryDialogOpen,
    setEntryDialogOpen,
    editingEntry,
    formSectionId,
    setFormSectionId,
    formSubjectIds,
    setFormSubjectIds,
    subjectCollegeFilter,
    setSubjectCollegeFilter: _setSubjectCollegeFilter,
    subjectProgramFilters,
    setSubjectProgramFilters: _setSubjectProgramFilters,
    subjectSectionFilters,
    setSubjectSectionFilters: _setSubjectSectionFilters,
    subjectYearLevelFilters,
    setSubjectYearLevelFilters: _setSubjectYearLevelFilters,
    subjectAcademicTermFilter,
    setSubjectAcademicTermFilter: _setSubjectAcademicTermFilter,
    formFacultyChoice,
    setFormFacultyChoice,
    formManualFaculty,
    setFormManualFaculty,
    formRoomId,
    setFormRoomId,
    formDayOfWeek,
    setFormDayOfWeek,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formMeetingType,
    setFormMeetingType,
    formAllowConflictSave,
    setFormAllowConflictSave,
    candidateConflicts,
    candidateConflictCounts,
    manualFacultySuggestions,
    sections,
    facultyProfiles,
    rooms,
    filteredSubjectOptions,
    onEditEntry,
    onSaveEntry,
    onDeleteEntry,
}: Props) {
    const navigate = useNavigate()
    const [pdfPreviewState, setPdfPreviewState] = React.useState<PdfPreviewState | null>(null)
    const [plannerSearch, setPlannerSearch] = React.useState("")
    const [plannerDayFilter, setPlannerDayFilter] = React.useState("all")
    const [plannerMeetingTypeFilter, setPlannerMeetingTypeFilter] = React.useState("all")
    const [plannerRoomTypeFilter, setPlannerRoomTypeFilter] = React.useState("all")
    const [plannerFacultyFilter, setPlannerFacultyFilter] = React.useState("all")
    const [plannerSortKey, setPlannerSortKey] = React.useState<PlannerSortKey>("day")
    const [plannerSortDirection, setPlannerSortDirection] = React.useState<PlannerSortDirection>("asc")
    const [pdfPreviewBusy, setPdfPreviewBusy] = React.useState(false)
    const [pdfExportBusy, setPdfExportBusy] = React.useState(false)
    const [selectedPaperSize, setSelectedPaperSize] =
        React.useState<PlannerPdfPaperSize>("A4")
    const [pdfPreviewUrl, setPdfPreviewUrl] = React.useState<string | null>(null)
    const pdfPreviewUrlRef = React.useRef<string | null>(null)

    const sectionDisplayLookup = React.useMemo(() => buildSectionDisplayLookup(sections), [sections])

    const filteredSections = React.useMemo(() => {
        return sections.filter((section) =>
            sectionMatchesSubjectFilters({
                section,
                subjectCollegeFilter,
                subjectProgramFilters,
                subjectSectionFilters,
                subjectYearLevelFilters,
                subjectAcademicTermFilter,
            })
        )
    }, [
        sections,
        subjectAcademicTermFilter,
        subjectCollegeFilter,
        subjectProgramFilters,
        subjectSectionFilters,
        subjectYearLevelFilters,
    ])

    React.useEffect(() => {
        const fallbackSectionId = filteredSections[0]?.$id || ""
        if (!fallbackSectionId) {
            if (formSectionId) setFormSectionId("")
            return
        }

        if (filteredSections.some((section) => section.$id === formSectionId)) return
        setFormSectionId(fallbackSectionId)
    }, [filteredSections, formSectionId, setFormSectionId])

    const selectedSection = React.useMemo(
        () => filteredSections.find((section) => section.$id === formSectionId) ?? filteredSections[0] ?? null,
        [filteredSections, formSectionId]
    )

    const entryDayOptions = React.useMemo(() => {
        const baseDayOptions: string[] = [...BASE_DAY_OPTIONS]
        if (!editingEntry) return baseDayOptions

        const currentDayValue = String(editingEntry.dayOfWeek || "").trim()
        if (!currentDayValue || baseDayOptions.includes(currentDayValue)) return baseDayOptions

        return [...baseDayOptions, currentDayValue]
    }, [editingEntry])

    const selectedSectionPreviewLabel = React.useMemo(() => {
        if (!selectedSection) return "—"
        return sectionDisplayLookup[selectedSection.$id] || "—"
    }, [selectedSection, sectionDisplayLookup])

    const normalizedSubjectSectionFilters = React.useMemo(
        () => Array.from(new Set(subjectSectionFilters.map((value) => String(value || "").trim()).filter(Boolean))),
        [subjectSectionFilters]
    )

    const selectedSectionsForSave = React.useMemo(() => {
        if (editingEntry) {
            return selectedSection ? [selectedSection] : []
        }

        if (normalizedSubjectSectionFilters.length > 0) {
            const explicitSections = filteredSections.filter((section) =>
                normalizedSubjectSectionFilters.includes(String(section.$id || "").trim())
            )

            if (explicitSections.length > 0) {
                return explicitSections
            }
        }

        if (formSectionId) {
            const matchedSection = filteredSections.find((section) => String(section.$id || "").trim() === String(formSectionId || "").trim())
            if (matchedSection) {
                return [matchedSection]
            }
        }

        return filteredSections.length === 1 ? filteredSections : []
    }, [editingEntry, filteredSections, formSectionId, normalizedSubjectSectionFilters, selectedSection])

    const selectedSectionsPreviewBadges = React.useMemo(
        () =>
            selectedSectionsForSave.map((section) => ({
                id: section.$id,
                label:
                    sectionDisplayLookup[section.$id] ||
                    formatSectionDisplayLabel({
                        label: section.label,
                        yearLevel: section.yearLevel,
                        name: section.name,
                    }),
            })),
        [sectionDisplayLookup, selectedSectionsForSave]
    )

    const selectedSectionsSummaryLabel = React.useMemo(() => {
        if (selectedSectionsForSave.length === 0) return "—"
        if (selectedSectionsForSave.length === 1) return selectedSectionsPreviewBadges[0]?.label || selectedSectionPreviewLabel
        if (selectedSectionsForSave.length <= 3) {
            return selectedSectionsPreviewBadges.map((section) => section.label).join(" • ")
        }
        return `${selectedSectionsForSave.length} sections selected`
    }, [selectedSectionPreviewLabel, selectedSectionsForSave.length, selectedSectionsPreviewBadges])

    const selectedSectionProgramBadges = React.useMemo(
        () =>
            Array.from(
                new Set(
                    selectedSectionsForSave
                        .map((section) => String(section.programCode || section.programName || "").trim())
                        .filter(Boolean)
                )
            ),
        [selectedSectionsForSave]
    )

    const selectedSectionYearLevelBadges = React.useMemo(
        () =>
            Array.from(
                new Set(
                    selectedSectionsForSave
                        .map((section) => {
                            const normalizedYearLevel = normalizeSectionYearLevelDisplay(section.yearLevel)
                            return normalizedYearLevel || String(section.yearLevel || "").trim()
                        })
                        .filter(Boolean)
                )
            ),
        [selectedSectionsForSave]
    )

    const selectedSectionSemesterBadges = React.useMemo(
        () =>
            Array.from(
                new Set(
                    selectedSectionsForSave
                        .map((section) => String(section.semester || "").trim())
                        .filter(Boolean)
                )
            ),
        [selectedSectionsForSave]
    )

    const selectedSectionAcademicTermBadges = React.useMemo(
        () =>
            Array.from(
                new Set(
                    selectedSectionsForSave
                        .map((section) => String(section.academicTermLabel || "").trim())
                        .filter(Boolean)
                )
            ),
        [selectedSectionsForSave]
    )

    const selectedSubjectIds = React.useMemo(
        () => Array.from(new Set(formSubjectIds.map((subjectId) => String(subjectId || "").trim()).filter(Boolean))).slice(0, 1),
        [formSubjectIds]
    )

    const selectedSubjectId = selectedSubjectIds[0] || ""

    const selectedSubjectDoc = React.useMemo(
        () => filteredSubjectOptions.find((subject) => subject.$id === selectedSubjectId) || null,
        [filteredSubjectOptions, selectedSubjectId]
    )

    const handleSubjectChange = React.useCallback(
        (value: string) => {
            if (!value || value === EMPTY_SUBJECT_SELECT_VALUE) {
                setFormSubjectIds([])
                return
            }
            setFormSubjectIds([value])
        },
        [setFormSubjectIds]
    )

    const goToRoomsAndFacilities = React.useCallback(() => {
        navigate(ROOMS_AND_FACILITIES_ROUTE)
    }, [navigate])

    const resetPlannerViewControls = React.useCallback(() => {
        setPlannerSearch("")
        setPlannerDayFilter("all")
        setPlannerMeetingTypeFilter("all")
        setPlannerRoomTypeFilter("all")
        setPlannerFacultyFilter("all")
        setPlannerSortKey("day")
        setPlannerSortDirection("asc")
    }, [])

    React.useEffect(() => {
        resetPlannerViewControls()
    }, [resetPlannerViewControls, scheduleScopeKey])

    const renderConflictBadges = React.useCallback((flags?: ConflictFlags) => {
        if (!flags || (!flags.room && !flags.faculty && !flags.section)) {
            return <Badge variant="outline">No Conflict</Badge>
        }

        return (
            <div className="flex flex-wrap items-center gap-1">
                {flags.room ? <Badge variant="destructive" className="rounded-lg">Room</Badge> : null}
                {flags.faculty ? <Badge variant="destructive" className="rounded-lg">Faculty</Badge> : null}
                {flags.section ? <Badge variant="destructive" className="rounded-lg">Section</Badge> : null}
            </div>
        )
    }, [])

    const plannerMeetingTypeOptions = React.useMemo(() => {
        return Array.from(new Set(visibleRows.map((row) => meetingTypeLabel(row.meetingType)).filter(Boolean))).sort(comparePlannerText)
    }, [visibleRows])

    const plannerRoomTypeOptions = React.useMemo(() => {
        return Array.from(new Set(visibleRows.map((row) => roomTypeLabel(row.roomType)).filter(Boolean))).sort(comparePlannerText)
    }, [visibleRows])

    const displayedPlannerRows = React.useMemo<PlannerDisplayRow[]>(() => {
        const query = plannerSearch.trim().toLowerCase()
        const direction = plannerSortDirection === "asc" ? 1 : -1

        const filteredRows = visibleRows.filter((row) => {
            const flags = conflictFlagsByMeetingId.get(row.meetingId)
            const rowMeetingType = meetingTypeLabel(row.meetingType)
            const rowRoomType = roomTypeLabel(row.roomType)
            const sectionLabel = getRowSectionDisplayLabel(row, sectionDisplayLookup)
            const facultyMode = row.isManualFaculty ? "manual" : row.facultyUserId ? "assigned" : "unassigned"
            const searchText = [
                row.dayOfWeek,
                formatDayDisplayLabel(row.dayOfWeek),
                formatCompactDayDisplay(row.dayOfWeek),
                row.subjectLabel,
                sectionLabel,
                row.facultyName,
                row.roomLabel,
                rowMeetingType,
                rowRoomType,
                row.classRemarks,
                flags?.room ? "room conflict" : "",
                flags?.faculty ? "faculty conflict" : "",
                flags?.section ? "section conflict" : "",
            ]
                .join(" ")
                .toLowerCase()

            if (query && !searchText.includes(query)) return false
            if (plannerDayFilter !== "all" && !dayExpressionsOverlap(row.dayOfWeek, plannerDayFilter)) return false
            if (plannerMeetingTypeFilter !== "all" && rowMeetingType !== plannerMeetingTypeFilter) return false
            if (plannerRoomTypeFilter !== "all" && rowRoomType !== plannerRoomTypeFilter) return false
            if (plannerFacultyFilter !== "all" && facultyMode !== plannerFacultyFilter) return false
            return true
        })

        const groupedRows = buildPlannerDisplayRows({
            rows: filteredRows,
            conflictFlagsByMeetingId,
            sectionDisplayLookup,
        })

        return groupedRows.slice().sort((a, b) => {
            let result = 0

            switch (plannerSortKey) {
                case "time":
                    result = comparePlannerText(a.sortStartTime, b.sortStartTime)
                    break
                case "subject":
                    result = comparePlannerText(a.descriptiveTitleDisplay, b.descriptiveTitleDisplay)
                    break
                case "section":
                    result = comparePlannerText(a.sectionDisplay, b.sectionDisplay)
                    break
                case "faculty":
                    result = comparePlannerText(a.facultyDisplay, b.facultyDisplay)
                    break
                case "room":
                    result = comparePlannerText(a.roomDisplay, b.roomDisplay)
                    break
                case "type":
                    result = comparePlannerText(a.meetingTypeDisplay, b.meetingTypeDisplay)
                    break
                case "conflicts":
                    result = countConflictFlags(a.conflictFlags) - countConflictFlags(b.conflictFlags)
                    break
                case "day":
                default:
                    result = dayOrder(a.sortDayValue) - dayOrder(b.sortDayValue)
                    if (result === 0) {
                        result = comparePlannerText(a.sortStartTime, b.sortStartTime)
                    }
                    break
            }

            if (result === 0) {
                result = comparePlannerText(a.descriptiveTitleDisplay, b.descriptiveTitleDisplay)
            }

            return result * direction
        })
    }, [
        visibleRows,
        plannerSearch,
        plannerDayFilter,
        plannerMeetingTypeFilter,
        plannerRoomTypeFilter,
        plannerFacultyFilter,
        plannerSortKey,
        plannerSortDirection,
        conflictFlagsByMeetingId,
        sectionDisplayLookup,
    ])

    const displayedLaboratoryRows = React.useMemo<PlannerDisplayRow[]>(() => {
        return buildPlannerDisplayRows({
            rows: laboratoryRows,
            conflictFlagsByMeetingId,
            sectionDisplayLookup,
        }).sort((a, b) => {
            const roomCompare = comparePlannerText(a.roomDisplay, b.roomDisplay)
            if (roomCompare !== 0) return roomCompare
            const dayCompare = dayOrder(a.sortDayValue) - dayOrder(b.sortDayValue)
            if (dayCompare !== 0) return dayCompare
            return comparePlannerText(a.sortStartTime, b.sortStartTime)
        })
    }, [laboratoryRows, conflictFlagsByMeetingId, sectionDisplayLookup])

    const laboratoryAccordionGroups = React.useMemo<LaboratoryAccordionGroup[]>(() => {
        const roomMap = new Map<string, LaboratoryAccordionGroup>()

        displayedLaboratoryRows.forEach((row) => {
            const roomLabel = String(row.roomDisplay || "").trim() || "Unassigned laboratory room"
            const key = roomLabel.toLowerCase()
            const existing = roomMap.get(key)

            if (existing) {
                existing.rowCount += 1
                existing.rows.push(row)
                if (row.hasConflict) existing.conflictedCount += 1
                return
            }

            roomMap.set(key, {
                key,
                label: roomLabel,
                rowCount: 1,
                conflictedCount: row.hasConflict ? 1 : 0,
                rows: [row],
            })
        })

        return Array.from(roomMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true })
        )
    }, [displayedLaboratoryRows])

    const plannerCourseAccordionGroups = React.useMemo<PlannerCourseAccordionGroup[]>(() => {
        const courseMap = new Map<string, PlannerCourseAccordionGroupAccumulator>()

        for (const row of displayedPlannerRows) {
            const courseKey = getPlannerCourseYearKey(row.sectionDisplay)
            const existing = courseMap.get(courseKey) || {
                key: courseKey,
                label: `COURSE:${courseKey.replace(/\s+/g, "-").toUpperCase()}`,
                subtitle: "",
                rowCount: 0,
                conflictedCount: 0,
                instructorCount: 0,
                rows: [],
                instructorKeys: new Set<string>(),
                sectionDisplays: new Set<string>(),
            }

            existing.rowCount += 1
            if (row.hasConflict) existing.conflictedCount += 1
            existing.rows.push(row)
            existing.instructorKeys.add(String(row.facultyDisplay || row.primaryRow.facultyName || "Unassigned"))
            existing.sectionDisplays.add(normalizePlannerSectionDisplayValue(row.sectionDisplay) || "—")
            existing.instructorCount = existing.instructorKeys.size
            courseMap.set(courseKey, existing)
        }

        return Array.from(courseMap.values())
            .map(({ instructorKeys, sectionDisplays, ...group }) => ({
                ...group,
                instructorCount: instructorKeys.size,
                subtitle: formatPlannerCourseGroupSubtitle(Array.from(sectionDisplays)),
            }))
            .sort((a, b) => comparePlannerText(a.label, b.label))
    }, [displayedPlannerRows])

    const generatedAt = React.useMemo(() => fmtDate(new Date().toISOString()), [
        displayedPlannerRows.length,
        scheduleScopeKey,
        showConflictsOnly,
        plannerSearch,
        plannerDayFilter,
        plannerMeetingTypeFilter,
        plannerRoomTypeFilter,
        plannerFacultyFilter,
        plannerSortKey,
        plannerSortDirection,
    ])

    const activeSortLabel = React.useMemo(
        () => PLANNER_SORT_OPTIONS.find((option) => option.value === plannerSortKey)?.label || "Day",
        [plannerSortKey]
    )
    const selectedPaperSizeLabel = React.useMemo(
        () => paperSizeLabel(selectedPaperSize),
        [selectedPaperSize]
    )
    const previewTermBadges = React.useMemo(() => {
        const normalizedTermLabel = String(selectedTermLabel || "").trim()
        if (!normalizedTermLabel) {
            return {
                schoolYear: "",
                semester: "",
                combinedLabel: "",
            }
        }

        const segments = normalizedTermLabel
            .split("•")
            .map((segment) => String(segment || "").trim())
            .filter(Boolean)

        if (segments.length < 2) {
            return {
                schoolYear: "",
                semester: "",
                combinedLabel: normalizedTermLabel,
            }
        }

        const schoolYearSegment = segments.find((segment) => /\b\d{4}\s*-\s*\d{4}\b/.test(segment)) || ""
        const semesterSegment = segments.find((segment) => segment !== schoolYearSegment) || segments[0] || ""

        if (!schoolYearSegment || !semesterSegment) {
            return {
                schoolYear: "",
                semester: "",
                combinedLabel: normalizedTermLabel,
            }
        }

        return {
            schoolYear: schoolYearSegment,
            semester: semesterSegment,
            combinedLabel: "",
        }
    }, [selectedTermLabel])
    const selectedPaperSizeFileLabel = React.useMemo(
        () => paperSizeFilenameLabel(selectedPaperSize),
        [selectedPaperSize]
    )
    const pdfPageSize = React.useMemo(
        () => resolvePdfPageSize(selectedPaperSize),
        [selectedPaperSize]
    )

    const buildPlannerStatsForRows = React.useCallback((rows: PlannerDisplayRow[]): PlannerStats => {
        const total = rows.length
        const conflicts = rows.filter((row) => row.hasConflict).length
        const labs = rows.filter((row) =>
            row.sourceRows.some((sourceRow) => {
                const rowMeetingType = meetingTypeLabel(sourceRow.meetingType)
                const rowRoomType = roomTypeLabel(sourceRow.roomType)
                return rowMeetingType === "LAB" || rowRoomType === "LAB"
            })
        ).length

        return { total, conflicts, labs }
    }, [])

    const sanitizeFileNamePart = React.useCallback((value: string) => {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "schedule"
    }, [])

    const revokePdfPreviewUrl = React.useCallback(() => {
        if (pdfPreviewUrlRef.current) {
            URL.revokeObjectURL(pdfPreviewUrlRef.current)
            pdfPreviewUrlRef.current = null
        }
        setPdfPreviewUrl(null)
    }, [])

    const buildRowsPdf = React.useCallback(
        async ({
            rows,
            fileNameBase,
            scopeLabel,
        }: {
            rows: PlannerDisplayRow[]
            fileNameBase: string
            scopeLabel?: string
        }) => {
            if (!hasScheduleScope || rows.length === 0) {
                throw new Error("No schedule entries to export.")
            }

            const [leftLogoSrc, rightLogoSrc] = await Promise.all([
                getAssetAsDataUrl(LEFT_LOGO_PATH),
                getAssetAsDataUrl(RIGHT_LOGO_PATH),
            ])

            const documentNode = (
                <SchedulePdfDocument
                    rows={rows}
                    scheduleScopeLabel={scheduleScopeLabel}
                    termLabel={selectedTermLabel}
                    deptLabel={selectedDeptLabel}
                    generatedAt={generatedAt}
                    filteredByConflict={showConflictsOnly}
                    scopeLabel={scopeLabel}
                    pdfPageSize={pdfPageSize}
                    leftLogoSrc={leftLogoSrc}
                    rightLogoSrc={rightLogoSrc}
                />
            )

            const blob = await pdf(documentNode).toBlob()
            const fileName = `${fileNameBase}-${selectedPaperSizeFileLabel}-${new Date().toISOString().slice(0, 10)}.pdf`

            return { blob, fileName }
        },
        [
            generatedAt,
            hasScheduleScope,
            pdfPageSize,
            scheduleScopeLabel,
            selectedDeptLabel,
            selectedPaperSizeFileLabel,
            selectedTermLabel,
            showConflictsOnly,
        ]
    )

    const openPdfPreview = React.useCallback(
        (previewState: PdfPreviewState) => {
            if (!hasScheduleScope || previewState.rows.length === 0) {
                toast.error("No schedule entries to preview.")
                return
            }

            setPdfPreviewState(previewState)
        },
        [hasScheduleScope]
    )

    const closePdfPreview = React.useCallback(() => {
        setPdfPreviewState(null)
        setPdfPreviewBusy(false)
        revokePdfPreviewUrl()
    }, [revokePdfPreviewUrl])

    React.useEffect(() => {
        if (!pdfPreviewState) {
            setPdfPreviewBusy(false)
            revokePdfPreviewUrl()
            return
        }

        let cancelled = false

        void (async () => {
            setPdfPreviewBusy(true)
            revokePdfPreviewUrl()

            try {
                const { blob } = await buildRowsPdf({
                    rows: pdfPreviewState.rows,
                    fileNameBase: pdfPreviewState.fileNameBase,
                    scopeLabel: pdfPreviewState.scopeLabel,
                })

                if (cancelled) return

                const url = URL.createObjectURL(blob)
                pdfPreviewUrlRef.current = url
                setPdfPreviewUrl(url)
            } catch (e: any) {
                if (!cancelled) {
                    toast.error(e?.message || "Failed to generate PDF preview.")
                }
            } finally {
                if (!cancelled) {
                    setPdfPreviewBusy(false)
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [pdfPreviewState, buildRowsPdf, revokePdfPreviewUrl])

    React.useEffect(() => {
        return () => {
            revokePdfPreviewUrl()
        }
    }, [revokePdfPreviewUrl])

    const downloadRowsPdf = React.useCallback(
        async ({
            rows,
            fileNameBase,
            scopeLabel,
        }: {
            rows: PlannerDisplayRow[]
            fileNameBase: string
            scopeLabel?: string
        }) => {
            if (!hasScheduleScope || rows.length === 0) {
                toast.error("No schedule entries to export.")
                return
            }

            setPdfExportBusy(true)
            try {
                const { blob, fileName } = await buildRowsPdf({
                    rows,
                    fileNameBase,
                    scopeLabel,
                })
                downloadBlob(blob, fileName)
                toast.success("Schedule PDF exported.")
            } catch (e: any) {
                toast.error(e?.message || "Failed to export PDF.")
            } finally {
                setPdfExportBusy(false)
            }
        },
        [buildRowsPdf, hasScheduleScope]
    )

    const downloadPdf = async () => {
        if (!hasScheduleScope || displayedPlannerRows.length === 0) {
            toast.error("No schedule entries to export.")
            return
        }

        await downloadRowsPdf({
            rows: displayedPlannerRows,
            fileNameBase: `schedule-report-${sanitizeFileNamePart(scheduleScopeKey || scheduleScopeLabel || selectedTermLabel || "active-scope")}`,
        })
    }

    const renderGroupedEditButtons = React.useCallback(
        (row: PlannerDisplayRow, align: "start" | "end" = "start") => {
            const alignmentClassName = align === "end" ? "justify-end" : "justify-start"

            return (
                <div className={cn("flex flex-wrap gap-2", alignmentClassName)}>
                    {row.sourceRows.map((sourceRow) => {
                        const compactDayLabel = formatCompactDayDisplay(sourceRow.dayOfWeek)
                        const buttonLabel =
                            row.sourceRows.length === 1 ? "Edit" : `Edit ${compactDayLabel === "—" ? "Meeting" : compactDayLabel}`

                        return (
                            <Button
                                key={`edit-${row.key}-${sourceRow.meetingId}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                                onClick={() => onEditEntry(sourceRow)}
                            >
                                <PencilLine className="mr-2 size-4" />
                                {buttonLabel}
                            </Button>
                        )
                    })}
                </div>
            )
        },
        [onEditEntry]
    )

    const activePdfPreviewRows = pdfPreviewState?.rows ?? displayedPlannerRows
    const activePdfPreviewTitle = String(pdfPreviewState?.title || "").trim() || "Schedule Planner"
    const activePdfPreviewScopeLabel = String(pdfPreviewState?.scopeLabel || "").trim()
    const activePdfPreviewStats = buildPlannerStatsForRows(activePdfPreviewRows)
    const controlsDisabled = pdfPreviewBusy || pdfExportBusy

    const plannerCard = (
            <Card className="rounded-2xl">
                <CardHeader className="pb-4">
                    <CardTitle>Schedule Planner & Conflict Manager</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                        <div className="min-w-0 space-y-1 xl:col-span-3">
                            <Label>Conflict Filter</Label>
                            <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3">
                                <Checkbox
                                    id="showConflictsOnly"
                                    checked={showConflictsOnly}
                                    onCheckedChange={(v) => onShowConflictsOnlyChange(Boolean(v))}
                                />
                                <Label htmlFor="showConflictsOnly" className="cursor-pointer truncate text-sm leading-none">
                                    Show conflicts only
                                </Label>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end justify-start gap-2 xl:col-span-9 xl:justify-end">
                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={onReloadEntries}
                                disabled={!hasScheduleScope || entriesLoading || entrySaving}
                            >
                                <RefreshCcw className="mr-2 size-4" />
                                Reload Entries
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={() =>
                                    openPdfPreview({
                                        title: "Schedule Planner",
                                        rows: displayedPlannerRows,
                                        fileNameBase: `schedule-report-${sanitizeFileNamePart(scheduleScopeKey || scheduleScopeLabel || selectedTermLabel || "active-scope")}`,
                                    })
                                }
                                disabled={!hasScheduleScope || displayedPlannerRows.length === 0}
                            >
                                <Eye className="mr-2 size-4" />
                                Preview PDF
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full rounded-xl sm:w-auto"
                                onClick={() => void downloadPdf()}
                                disabled={!hasScheduleScope || displayedPlannerRows.length === 0 || controlsDisabled}
                            >
                                {pdfExportBusy ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 size-4" />
                                )}
                                {pdfExportBusy ? "Exporting..." : "Export PDF"}
                            </Button>

                            <Button
                                className="w-full rounded-xl sm:w-auto"
                                onClick={onOpenCreateEntry}
                                disabled={!hasScheduleScope || entriesLoading || entrySaving}
                            >
                                <Plus className="mr-2 size-4" />
                                New Entry
                            </Button>
                        </div>
                    </div>

                    {hasScheduleScope ? (
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.total}</CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.conflicts}</CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Laboratory Entries</CardTitle>
                                </CardHeader>
                                <CardContent className="text-2xl font-semibold">{plannerStats.labs}</CardContent>
                            </Card>
                        </div>
                    ) : null}

                    {hasScheduleScope && plannerStats.conflicts > 0 ? (
                        <Alert variant="destructive">
                            <AlertTitle className="flex items-center gap-2">
                                <AlertTriangle className="size-4" />
                                Conflicts detected
                            </AlertTitle>
                            <AlertDescription className="space-y-3">
                                <div>
                                    There are <span className="font-semibold">{plannerStats.conflicts}</span> conflicting schedule
                                    entr{plannerStats.conflicts === 1 ? "y" : "ies"} in the active schedule scope.
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full rounded-xl whitespace-normal wrap-anywhere sm:w-auto"
                                    onClick={goToRoomsAndFacilities}
                                >
                                    <ArrowRight className="mr-2 size-4" />
                                    Go to Rooms & Facilities
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <Separator />

                    {hasScheduleScope ? (
                        <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                                <div className="min-w-0 w-full space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <SlidersHorizontal className="size-4" />
                                        Table filters & sorting
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className="rounded-lg">
                                        {displayedPlannerRows.length} shown
                                    </Badge>
                                    <span>of {visibleRows.length} visible entries</span>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                                <div className="space-y-1 xl:col-span-2">
                                    <Label>Search</Label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={plannerSearch}
                                            onChange={(e) => setPlannerSearch(e.target.value)}
                                            placeholder="Subject, section, faculty, room..."
                                            className="rounded-xl pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Day</Label>
                                    <Select value={plannerDayFilter} onValueChange={setPlannerDayFilter}>
                                        <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="All days" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all"><span className="block max-w-full truncate">All days</span></SelectItem>
                                            {DAY_OPTIONS.map((day) => (
                                                <SelectItem key={day} value={day}>
                                                    <span className="block max-w-full truncate">{formatDayDisplayLabel(day)}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Meeting Type</Label>
                                    <Select value={plannerMeetingTypeFilter} onValueChange={setPlannerMeetingTypeFilter}>
                                        <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="All meeting types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all"><span className="block max-w-full truncate">All meeting types</span></SelectItem>
                                            {plannerMeetingTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Room Type</Label>
                                    <Select value={plannerRoomTypeFilter} onValueChange={setPlannerRoomTypeFilter}>
                                        <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="All room types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all"><span className="block max-w-full truncate">All room types</span></SelectItem>
                                            {plannerRoomTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Faculty Mode</Label>
                                    <Select value={plannerFacultyFilter} onValueChange={setPlannerFacultyFilter}>
                                        <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="All faculty modes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all"><span className="block max-w-full truncate">All faculty modes</span></SelectItem>
                                            <SelectItem value="assigned"><span className="block max-w-full truncate">Assigned profile</span></SelectItem>
                                            <SelectItem value="manual"><span className="block max-w-full truncate">Manual faculty</span></SelectItem>
                                            <SelectItem value="unassigned"><span className="block max-w-full truncate">Unassigned</span></SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Sort By</Label>
                                    <Select value={plannerSortKey} onValueChange={(value) => setPlannerSortKey(value as PlannerSortKey)}>
                                        <SelectTrigger className="overflow-hidden rounded-xl text-left [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="Sort planner rows" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PLANNER_SORT_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <span className="block max-w-full truncate">{option.label}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <ArrowUpDown className="size-4" />
                                    <span>
                                        {activeSortLabel} • {plannerSortDirection === "asc" ? "Ascending" : "Descending"}
                                    </span>
                                    <Select
                                        value={plannerSortDirection}
                                        onValueChange={(value) => setPlannerSortDirection(value as PlannerSortDirection)}
                                    >
                                        <SelectTrigger className="h-8 min-w-0 w-full overflow-hidden rounded-xl text-left sm:w-35 [&>span]:block [&>span]:w-full [&>span]:overflow-hidden [&>span]:truncate">
                                            <SelectValue placeholder="Order" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc"><span className="block max-w-full truncate">Ascending</span></SelectItem>
                                            <SelectItem value="desc"><span className="block max-w-full truncate">Descending</span></SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button type="button" variant="ghost" className="w-full rounded-xl whitespace-normal wrap-anywhere sm:w-auto" onClick={resetPlannerViewControls}>
                                    <X className="mr-2 size-4" />
                                    Reset filters & sort
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {!hasScheduleScope ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <CalendarDays className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No active semester</div>
                            <div className="text-sm text-muted-foreground">
                                Activate at least one semester to manage schedule entries and conflict detection.
                            </div>
                        </div>
                    ) : entriesLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6" />
                        </div>
                    ) : entriesError ? (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{entriesError}</AlertDescription>
                        </Alert>
                    ) : visibleRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <CalendarDays className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No schedule entries found</div>
                            <div className="text-sm text-muted-foreground">
                                {showConflictsOnly ? "No conflicts detected for the active schedule scope." : "Create your first schedule entry to begin."}
                            </div>
                        </div>
                    ) : displayedPlannerRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center">
                            <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                <Search className="size-5" />
                            </div>
                            <div className="mt-3 font-medium">No planner entries matched</div>
                            <div className="text-sm text-muted-foreground">
                                Adjust the current planner filters or reset the sort controls to see more entries.
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border">
                            <div className="flex justify-end border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:px-4">
                                <span>
                                    Showing {displayedPlannerRows.length} grouped entries from {visibleRows.length} visible meetings
                                </span>
                            </div>

                            <Accordion type="multiple" className="w-full">
                                {plannerCourseAccordionGroups.map((courseGroup, courseIndex) => {
                                    const courseGroupFileNameBase = `course-group-${sanitizeFileNamePart(courseGroup.label)}`
                                    const courseGroupPreviewState: PdfPreviewState = {
                                        title: courseGroup.label,
                                        rows: courseGroup.rows,
                                        fileNameBase: courseGroupFileNameBase,
                                        scopeLabel: courseGroup.label,
                                    }

                                    return (
                                        <AccordionItem
                                            key={`${courseGroup.key}-${courseIndex}`}
                                            value={`${courseGroup.key}-${courseIndex}`}
                                            className="px-3 sm:px-4"
                                        >
                                            <AccordionTrigger className="min-w-0 gap-3 py-4 text-left hover:no-underline">
                                                <div className="min-w-0 flex-1 text-left">
                                                    <div className="wrap-anywhere text-sm font-semibold leading-5">
                                                        {courseGroup.label}
                                                    </div>
                                                    {courseGroup.subtitle ? (
                                                        <div className="mt-1 hidden text-xs text-muted-foreground sm:block">
                                                            {courseGroup.subtitle}
                                                        </div>
                                                    ) : null}
                                                    <div className="mt-2 hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground sm:flex">
                                                        <span>{courseGroup.rowCount} grouped entries</span>
                                                        <span>•</span>
                                                        <span>{courseGroup.instructorCount} instructors</span>
                                                        <span>•</span>
                                                        <span>{courseGroup.conflictedCount} conflicts</span>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>

                                            <AccordionContent className="space-y-4 pb-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full rounded-xl whitespace-normal wrap-anywhere sm:w-auto"
                                                        onClick={() => openPdfPreview(courseGroupPreviewState)}
                                                    >
                                                        <Eye className="mr-2 size-4" />
                                                        Preview PDF
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full rounded-xl whitespace-normal wrap-anywhere sm:w-auto"
                                                        onClick={() =>
                                                            void downloadRowsPdf({
                                                                rows: courseGroup.rows,
                                                                fileNameBase: courseGroupFileNameBase,
                                                                scopeLabel: courseGroup.label,
                                                            })
                                                        }
                                                    >
                                                        <Printer className="mr-2 size-4" />
                                                        Export PDF
                                                    </Button>
                                                </div>

                                                <div className="sm:hidden">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="w-full rounded-xl whitespace-normal wrap-anywhere"
                                                            >
                                                                Details
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-h-[95svh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto px-4 sm:px-6">
                                                            <DialogHeader>
                                                                <DialogTitle className="wrap-anywhere">{courseGroup.label}</DialogTitle>
                                                            </DialogHeader>

                                                            <div className="flex flex-wrap gap-2">
                                                                <Badge variant="secondary" className="max-w-full rounded-full whitespace-normal wrap-anywhere">
                                                                    {courseGroup.rowCount} grouped entr{courseGroup.rowCount === 1 ? "y" : "ies"}
                                                                </Badge>
                                                                <Badge variant="outline" className="max-w-full rounded-full whitespace-normal wrap-anywhere">
                                                                    {courseGroup.instructorCount} instructor{courseGroup.instructorCount === 1 ? "" : "s"}
                                                                </Badge>
                                                                <Badge variant="outline" className="max-w-full rounded-full whitespace-normal wrap-anywhere">
                                                                    {courseGroup.conflictedCount} conflict{courseGroup.conflictedCount === 1 ? "" : "s"}
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {courseGroup.rows.map((row) => (
                                                                    <React.Fragment key={`mobile-dialog-${courseGroup.key}-${row.key}`}>
                                                                        {renderPlannerMobileRowCard({
                                                                            row,
                                                                            onFixConflict: goToRoomsAndFacilities,
                                                                            renderConflictBadges,
                                                                            renderGroupedEditButtons,
                                                                        })}
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                <div className="hidden overflow-x-auto rounded-xl border sm:block">
                                                    <Table className="w-full min-w-275 table-fixed">
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-28 whitespace-normal wrap-anywhere align-top">Code</TableHead>
                                                                <TableHead className="w-72 whitespace-normal wrap-anywhere align-top">Descriptive Title</TableHead>
                                                                <TableHead className="w-32 whitespace-normal wrap-anywhere align-top">Section</TableHead>
                                                                <TableHead className="w-20 whitespace-normal wrap-anywhere align-top">Type</TableHead>
                                                                <TableHead className="w-24 whitespace-normal wrap-anywhere align-top">Day</TableHead>
                                                                <TableHead className="w-32 whitespace-normal wrap-anywhere align-top">Time</TableHead>
                                                                <TableHead className="w-44 whitespace-normal wrap-anywhere align-top">Room</TableHead>
                                                                <TableHead className="w-52 whitespace-normal wrap-anywhere align-top">Instructor</TableHead>
                                                                <TableHead className="w-32 whitespace-normal wrap-anywhere align-top text-right">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {courseGroup.rows.map((row) => (
                                                                <TableRow key={`desktop-${courseGroup.key}-${row.key}`}>
                                                                    <TableCell className="font-medium whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                                        {row.subjectCodeDisplay || "—"}
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                                        <div className="min-w-0 space-y-1 leading-relaxed">
                                                                            <div className="wrap-anywhere font-medium">{row.descriptiveTitleDisplay || "—"}</div>
                                                                            <div className="text-xs text-muted-foreground wrap-anywhere">
                                                                                Units: {row.primaryRow.subjectUnits ?? "—"}
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                                        {row.sectionDisplay || "—"}
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                                        <Badge variant="outline" className="rounded-lg whitespace-normal wrap-anywhere text-center">
                                                                            {row.meetingTypeDisplay}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                                        {row.dayDisplay}
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                                        {row.timeDisplay}
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                                        <div className="min-w-0 space-y-2 leading-relaxed">
                                                                            <div className="wrap-anywhere">{row.roomDisplay || "—"}</div>
                                                                            <div className="wrap-anywhere text-xs text-muted-foreground">
                                                                                {row.roomTypeDisplay}
                                                                            </div>
                                                                            <div>{renderConflictBadges(row.conflictFlags)}</div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                                        <div className="min-w-0 space-y-1 leading-relaxed">
                                                                            <div className="wrap-anywhere">{row.facultyDisplay || "—"}</div>
                                                                            {row.sourceRows.some((sourceRow) => sourceRow.isManualFaculty) ? (
                                                                                <Badge variant="secondary" className="rounded-lg">
                                                                                    Manual
                                                                                </Badge>
                                                                            ) : null}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="whitespace-normal wrap-anywhere align-top text-right">
                                                                        <div className="flex flex-col items-end gap-2">
                                                                            {row.hasConflict ? (
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="rounded-lg whitespace-normal wrap-anywhere text-left"
                                                                                    onClick={goToRoomsAndFacilities}
                                                                                >
                                                                                    <ArrowRight className="mr-2 size-4" />
                                                                                    Fix
                                                                                </Button>
                                                                            ) : null}
                                                                            {renderGroupedEditButtons(row, "end")}
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                        </div>
                    )}
                </CardContent>
            </Card>
    )

    const laboratoryAssignmentsCard = (
            <Card className="rounded-2xl">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="size-5" />
                        Laboratory Assignments
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {!hasScheduleScope ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No active semester to view laboratory assignments.
                        </div>
                    ) : entriesLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-5/6" />
                        </div>
                    ) : displayedLaboratoryRows.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No laboratory assignments found for the active schedule scope.
                        </div>
                    ) : (
                        <>
                            <div className="sm:hidden">
                                <Accordion type="multiple" className="overflow-hidden rounded-xl border">
                                    {laboratoryAccordionGroups.map((group, groupIndex) => (
                                        <AccordionItem key={`${group.key}-${groupIndex}`} value={`${group.key}-${groupIndex}`} className="px-3">
                                            <AccordionTrigger className="min-w-0 py-4 text-left hover:no-underline">
                                                <div className="min-w-0 flex-1 wrap-anywhere text-sm font-semibold">{group.label}</div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-4">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button type="button" variant="outline" className="w-full rounded-xl whitespace-normal wrap-anywhere">
                                                            Details
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-h-[95svh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto px-4 sm:px-6">
                                                        <DialogHeader>
                                                            <DialogTitle className="wrap-anywhere">{group.label}</DialogTitle>
                                                        </DialogHeader>

                                                        <div className="flex flex-wrap gap-2">
                                                            <Badge variant="secondary" className="max-w-full rounded-full whitespace-normal wrap-anywhere">
                                                                {group.rowCount} assignment{group.rowCount === 1 ? "" : "s"}
                                                            </Badge>
                                                            <Badge variant="outline" className="max-w-full rounded-full whitespace-normal wrap-anywhere">
                                                                {group.conflictedCount} conflict{group.conflictedCount === 1 ? "" : "s"}
                                                            </Badge>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {group.rows.map((row) => (
                                                                <React.Fragment key={`lab-mobile-dialog-${group.key}-${row.key}`}>
                                                                    {renderLaboratoryMobileRowCard({
                                                                        row,
                                                                        renderConflictBadges,
                                                                        renderGroupedEditButtons,
                                                                    })}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>

                            <div className="hidden overflow-hidden rounded-xl border sm:block">

                                <Table className="min-w-245 w-full table-fixed">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40 whitespace-normal wrap-anywhere align-top">Laboratory Room</TableHead>
                                            <TableHead className="w-24 whitespace-normal wrap-anywhere align-top">Day</TableHead>
                                            <TableHead className="w-32 whitespace-normal wrap-anywhere align-top">Time</TableHead>
                                            <TableHead className="w-56 whitespace-normal wrap-anywhere align-top">Assigned Faculty</TableHead>
                                            <TableHead className="w-52 whitespace-normal wrap-anywhere align-top">Subject</TableHead>
                                            <TableHead className="w-32 whitespace-normal wrap-anywhere align-top">Section</TableHead>
                                            <TableHead className="w-40 whitespace-normal wrap-anywhere align-top">Conflicts</TableHead>
                                            <TableHead className="w-36 whitespace-normal wrap-anywhere align-top">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedLaboratoryRows.map((row) => {
                                            const baseRow = row.primaryRow
                                            return (
                                                <TableRow key={`lab-${row.key}`}>
                                                    <TableCell className="font-medium whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                        {row.roomDisplay}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                        {row.dayDisplay}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top text-sm">
                                                        <div className="space-y-1 leading-snug">
                                                            <div className="font-medium wrap-anywhere">{row.timeDisplay}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                        <div className="flex items-start gap-2">
                                                            <UserCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                            <div className="min-w-0 space-y-1 leading-relaxed">
                                                                <span className="block wrap-anywhere">{row.facultyDisplay}</span>
                                                                {row.sourceRows.some((sourceRow) => sourceRow.isManualFaculty) ? (
                                                                    <Badge variant="secondary" className="rounded-lg">
                                                                        Manual
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                        {baseRow.subjectLabel}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top leading-relaxed">
                                                        {row.sectionDisplay}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                        {renderConflictBadges(row.conflictFlags)}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal wrap-anywhere align-top">
                                                        {renderGroupedEditButtons(row)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
    )

    return (
        <>
            <div className="space-y-3 sm:hidden">
                <ExtraSmallPlannerCardShell
                    value="schedule-planner-conflict-manager"
                    title="Schedule Planner & Conflict Manager"
                >
                    {plannerCard}
                </ExtraSmallPlannerCardShell>

                <ExtraSmallPlannerCardShell
                    value="laboratory-assignments"
                    title="Laboratory Assignments"
                >
                    {laboratoryAssignmentsCard}
                </ExtraSmallPlannerCardShell>
            </div>

            <div className="hidden space-y-6 sm:block">
                {plannerCard}
                {laboratoryAssignmentsCard}
            </div>

            <Dialog
                open={Boolean(pdfPreviewState)}
                onOpenChange={(open) => {
                    if (!open) closePdfPreview()
                }}
            >
                <DialogContent className="max-h-[95svh] overflow-auto sm:max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>
                            PDF Preview — {activePdfPreviewTitle}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-wrap items-center gap-2">
                        {previewTermBadges.semester ? (
                            <Badge variant="secondary">{previewTermBadges.semester}</Badge>
                        ) : previewTermBadges.combinedLabel ? (
                            <Badge variant="secondary">{previewTermBadges.combinedLabel}</Badge>
                        ) : null}
                        {previewTermBadges.schoolYear ? (
                            <Badge variant="secondary">SY {previewTermBadges.schoolYear}</Badge>
                        ) : null}
                        {selectedDeptLabel && selectedDeptLabel !== "—" ? (
                            <Badge variant="outline">{selectedDeptLabel}</Badge>
                        ) : null}
                        {activePdfPreviewScopeLabel ? (
                            <Badge variant="outline">{activePdfPreviewScopeLabel}</Badge>
                        ) : null}
                        <Badge variant="outline">{selectedPaperSizeLabel}</Badge>
                        <Badge variant="outline">
                            {activePdfPreviewRows.length} grouped entr{activePdfPreviewRows.length === 1 ? "y" : "ies"}
                        </Badge>
                        <Badge variant="outline">
                            {activePdfPreviewStats.conflicts} conflict{activePdfPreviewStats.conflicts === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline">
                            {activePdfPreviewStats.labs} lab{activePdfPreviewStats.labs === 1 ? "" : "s"}
                        </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Paper Size:</span>
                        {PAPER_SIZE_OPTIONS.map((option) => (
                            <Button
                                key={`planner-preview-${option.value}`}
                                type="button"
                                size="sm"
                                variant={selectedPaperSize === option.value ? "default" : "outline"}
                                onClick={() => setSelectedPaperSize(option.value)}
                                disabled={controlsDisabled}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>

                    <div className="mt-3 overflow-hidden rounded-md border bg-background">
                        {pdfPreviewBusy ? (
                            <div className="space-y-3 p-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating schedule PDF preview...
                                </div>
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-[70vh] w-full" />
                            </div>
                        ) : pdfPreviewUrl ? (
                            <iframe
                                key={pdfPreviewUrl}
                                title={`Schedule PDF preview - ${activePdfPreviewTitle} - ${selectedPaperSizeLabel}`}
                                src={pdfPreviewUrl}
                                className="block h-[75vh] w-full bg-background"
                            />
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground">
                                PDF preview is not ready yet.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={closePdfPreview}>
                                Close
                            </Button>
                            <Button
                                onClick={() =>
                                    pdfPreviewState
                                        ? void downloadRowsPdf({
                                              rows: pdfPreviewState.rows,
                                              fileNameBase: pdfPreviewState.fileNameBase,
                                              scopeLabel: pdfPreviewState.scopeLabel,
                                          })
                                        : undefined
                                }
                                disabled={!hasScheduleScope || activePdfPreviewRows.length === 0 || controlsDisabled}
                            >
                                {pdfExportBusy ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                {pdfExportBusy ? "Exporting..." : "Download PDF"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={entryDialogOpen}
                onOpenChange={(v) => {
                    setEntryDialogOpen(v)
                    if (!v) setFormAllowConflictSave(false)
                }}
            >
                <DialogContent className={ENTRY_DIALOG_CONTENT_CLASS}>
                    <DialogHeader className="shrink-0 space-y-1 pr-6 text-left">
                        <DialogTitle className="wrap-anywhere pr-6 text-left">
                            {editingEntry ? "Edit Schedule Entry" : "Create Schedule Entry"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className={ENTRY_DIALOG_BODY_CLASS}>
                        {editingEntry ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground [&>span]:wrap-anywhere">
                                <Badge variant="secondary" className="rounded-lg">
                                    Editing entry
                                </Badge>
                                <span>{editingEntry.subjectLabel}</span>
                                <span>•</span>
                                <span>{formatDayDisplayLabel(editingEntry.dayOfWeek)}</span>
                                <span>•</span>
                                <span>{formatTimeRange(editingEntry.startTime, editingEntry.endTime)}</span>
                            </div>
                        ) : null}

                        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start lg:gap-4">
                            <div className="min-w-0 space-y-3">
                                <div className="min-w-0 rounded-2xl border border-dashed p-3 text-left sm:p-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        {editingEntry ? "Resolved Section Reference" : "Selected Section Scope"}
                                    </div>
                                    <div className="mt-2 font-medium wrap-anywhere">{selectedSectionsSummaryLabel}</div>
                                    {selectedSectionsPreviewBadges.length > 0 ? (
                                        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                            {selectedSectionsPreviewBadges.slice(0, 8).map((section) => (
                                                <Badge key={section.id} variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                    {section.label}
                                                </Badge>
                                            ))}
                                            {selectedSectionsPreviewBadges.length > 8 ? (
                                                <Badge variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                    +{selectedSectionsPreviewBadges.length - 8} more
                                                </Badge>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                                        <Badge variant="secondary" className={ENTRY_DIALOG_BADGE_CLASS}>
                                            {selectedDeptLabel || "Department not set"}
                                        </Badge>
                                        {selectedSectionProgramBadges.map((program) => (
                                            <Badge key={`program-${program}`} variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                {program}
                                            </Badge>
                                        ))}
                                        {selectedSectionYearLevelBadges.map((yearLevel) => (
                                            <Badge key={`year-level-${yearLevel}`} variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                {yearLevel}
                                            </Badge>
                                        ))}
                                        {selectedSectionSemesterBadges.map((semester) => (
                                            <Badge key={`semester-${semester}`} variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                {semester}
                                            </Badge>
                                        ))}
                                        {selectedSectionAcademicTermBadges.length > 0
                                            ? selectedSectionAcademicTermBadges.map((academicTermLabel) => (
                                                <Badge key={`academic-term-${academicTermLabel}`} variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                    {academicTermLabel}
                                                </Badge>
                                            ))
                                            : selectedTermLabel ? (
                                                <Badge variant="outline" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                    {selectedTermLabel}
                                                </Badge>
                                            ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 space-y-3">

                                <div className="min-w-0 w-full space-y-1">
                                    <Label>Subject</Label>
                                    <Select
                                        value={selectedSubjectId || EMPTY_SUBJECT_SELECT_VALUE}
                                        onValueChange={handleSubjectChange}
                                    >
                                        <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Select subject" />
                                        </SelectTrigger>
                                        <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                            {filteredSections.length === 0 ? (
                                                <SelectItem value={EMPTY_SUBJECT_SELECT_VALUE} disabled><span className="block max-w-full truncate">No matching sections available</span></SelectItem>
                                            ) : filteredSubjectOptions.length === 0 ? (
                                                <SelectItem value={EMPTY_SUBJECT_SELECT_VALUE}><span className="block max-w-full truncate">No subjects available</span></SelectItem>
                                            ) : (
                                                filteredSubjectOptions.map((subject) => (
                                                    <SelectItem key={subject.$id} value={subject.$id}>
                                                        <span className="block max-w-full truncate">{formatSubjectOptionLabel(subject)}</span>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className={ENTRY_DIALOG_CARD_CLASS}>
                                    <div className="text-xs text-muted-foreground wrap-anywhere">
                                        Sections and subjects shown here are automatically scoped by the linked college, program, year level, semester, and linked semester records.
                                    </div>

                                    {selectedSubjectDoc ? (
                                        <div className="mt-3 min-w-0 space-y-2">
                                            <Badge variant="secondary" className={ENTRY_DIALOG_BADGE_CLASS}>
                                                {String(selectedSubjectDoc.code || selectedSubjectDoc.title || selectedSubjectDoc.$id)}
                                            </Badge>
                                            <div className="max-w-full text-sm leading-relaxed wrap-anywhere">
                                                {formatSubjectOptionLabel(selectedSubjectDoc)}
                                            </div>
                                        </div>
                                    ) : filteredSubjectOptions.length === 0 ? (
                                        <div className="mt-3 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground wrap-anywhere">
                                            No linked subjects are available for the selected section scope and active academic term scope.
                                        </div>
                                    ) : (
                                        <div className="mt-3 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground wrap-anywhere">
                                            Select one subject to continue.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid min-w-0 gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <Label>Faculty / Instructor</Label>
                                <Select value={formFacultyChoice} onValueChange={setFormFacultyChoice}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select faculty" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        <SelectItem value={FACULTY_OPTION_NONE}><span className="block max-w-full truncate">Unassigned</span></SelectItem>
                                        <SelectItem value={FACULTY_OPTION_MANUAL}><span className="block max-w-full truncate">Manual encode faculty</span></SelectItem>
                                        {facultyProfiles.map((faculty) => {
                                            const key = String(faculty.userId || faculty.$id || "").trim()
                                            const name = String(faculty.name || "").trim()
                                            const email = String(faculty.email || "").trim()
                                            const label = name || email || key
                                            if (!key) return null

                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <span className="block max-w-full truncate">{label}</span>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Room</Label>
                                <Select value={formRoomId} onValueChange={setFormRoomId}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {rooms.map((room) => {
                                            const code = String(room.code || "").trim()
                                            const name = String(room.name || "").trim()
                                            const type = roomTypeLabel(String(room.type || ""))
                                            const label = [code, name].filter(Boolean).join(" • ") || room.$id

                                            return (
                                                <SelectItem key={room.$id} value={room.$id}>
                                                    <span className="block max-w-full truncate">{label} ({type})</span>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formFacultyChoice === FACULTY_OPTION_MANUAL ? (
                            <div className="min-w-0 space-y-2 rounded-xl border p-3">
                                <div className="space-y-1">
                                    <Label>Manual Faculty Name</Label>
                                    <Input
                                        value={formManualFaculty}
                                        onChange={(e) => setFormManualFaculty(e.target.value)}
                                        placeholder="Enter faculty/instructor name manually"
                                    />
                                </div>

                                {manualFacultySuggestions.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="text-xs text-muted-foreground">
                                            Quick pick from previously used manual names:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {manualFacultySuggestions.slice(0, 12).map((name) => (
                                                <Button
                                                    key={name}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg whitespace-normal wrap-anywhere text-left"
                                                    onClick={() => setFormManualFaculty(name)}
                                                >
                                                    {name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="grid min-w-0 gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                                <Label>Day</Label>
                                <Select value={formDayOfWeek} onValueChange={setFormDayOfWeek}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {entryDayOptions.map((day) => (
                                            <SelectItem key={day} value={day}>
                                                <span className="block max-w-full truncate">{formatDayDisplayLabel(day)}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Start Time</Label>
                                <Select value={formStartTime} onValueChange={setFormStartTime}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select start time" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {TIME_OPTIONS.map((time) => (
                                            <SelectItem key={`st-${time.value}`} value={time.value}>
                                                <span className="block max-w-full truncate">{time.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>End Time</Label>
                                <Select value={formEndTime} onValueChange={setFormEndTime}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select end time" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        {TIME_OPTIONS.map((time) => (
                                            <SelectItem key={`et-${time.value}`} value={time.value}>
                                                <span className="block max-w-full truncate">{time.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label>Meeting Type</Label>
                                <Select value={formMeetingType} onValueChange={(value) => setFormMeetingType(value as MeetingType)}>
                                    <SelectTrigger className={ENTRY_DIALOG_SELECT_TRIGGER_CLASS}>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent className={ENTRY_DIALOG_SELECT_CONTENT_CLASS}>
                                        <SelectItem value="LECTURE"><span className="block max-w-full truncate">LECTURE</span></SelectItem>
                                        <SelectItem value="LAB"><span className="block max-w-full truncate">LAB</span></SelectItem>
                                        <SelectItem value="OTHER"><span className="block max-w-full truncate">OTHER</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {candidateConflicts.length > 0 ? (
                            <Alert variant="destructive">
                                <AlertTitle className="flex items-center gap-2">
                                    <AlertTriangle className="size-4" />
                                    Conflict detected
                                </AlertTitle>
                                <AlertDescription className="space-y-2 **:wrap-anywhere">
                                    <div className="text-sm wrap-anywhere">
                                        Room: <span className="font-medium">{candidateConflictCounts.room}</span> • Faculty:{" "}
                                        <span className="font-medium">{candidateConflictCounts.faculty}</span> • Section:{" "}
                                        <span className="font-medium">{candidateConflictCounts.section}</span>
                                    </div>
                                    <ul className="list-disc space-y-1 pl-4 text-xs">
                                        {candidateConflicts.slice(0, 6).map((conflict, idx) => (
                                            <li key={`${conflict.type}-${conflict.row.meetingId}-${idx}`} className="wrap-anywhere">
                                                [{conflict.type.toUpperCase()}] {formatDayDisplayLabel(conflict.row.dayOfWeek)}{" "}
                                                {formatTimeRange(conflict.row.startTime, conflict.row.endTime)} • {conflict.row.subjectLabel} •{" "}
                                                {getRowSectionDisplayLabel(conflict.row, sectionDisplayLookup)} • {conflict.row.roomLabel}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex flex-wrap items-start gap-2 pt-1">
                                        <Checkbox
                                            id="allowConflictSave"
                                            checked={formAllowConflictSave}
                                            onCheckedChange={(value) => setFormAllowConflictSave(Boolean(value))}
                                        />
                                        <Label htmlFor="allowConflictSave" className="cursor-pointer text-sm">
                                            Override and save anyway
                                        </Label>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg whitespace-normal wrap-anywhere text-left"
                                            onClick={goToRoomsAndFacilities}
                                        >
                                            <ArrowRight className="mr-2 size-4" />
                                            Fix in Rooms & Facilities
                                        </Button>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert>
                                <AlertTitle>No conflict detected</AlertTitle>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter className="shrink-0 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {editingEntry ? (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="destructive" disabled={entrySaving} className={ENTRY_DIALOG_ACTION_BUTTON_CLASS}>
                                            <Trash2 className="mr-2 size-4" />
                                            Delete Entry
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="z-210">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this schedule entry?</AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={entrySaving}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    void onDeleteEntry()
                                                }}
                                                disabled={entrySaving}
                                                className={cn(ENTRY_DIALOG_ACTION_BUTTON_CLASS, entrySaving && "pointer-events-none opacity-90")}
                                            >
                                                {entrySaving ? (
                                                    <>
                                                        <RefreshCcw className="mr-2 size-4 animate-spin" />
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 className="mr-2 size-4" />
                                                        Confirm Delete
                                                    </>
                                                )}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : null}

                            <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)} disabled={entrySaving} className={ENTRY_DIALOG_ACTION_BUTTON_CLASS}>
                                Cancel
                            </Button>
                        </div>

                        <Button
                            type="button"
                            onClick={() => void onSaveEntry()}
                            disabled={entrySaving}
                            className={cn(ENTRY_DIALOG_ACTION_BUTTON_CLASS, entrySaving && "opacity-90")}
                        >
                            {entrySaving ? (
                                <>
                                    <RefreshCcw className="mr-2 size-4 animate-spin" />
                                    {editingEntry ? "Saving..." : "Creating..."}
                                </>
                            ) : editingEntry ? (
                                <>
                                    <PencilLine className="mr-2 size-4" />
                                    Update Entry
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    {selectedSectionsForSave.length > 1 ? `Create ${selectedSectionsForSave.length} Entries` : "Create Entry"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default PlannerManagementSection