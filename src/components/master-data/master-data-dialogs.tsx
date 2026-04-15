"use client"

import type { MasterDataManagementVM } from "./use-master-data"
import { DIALOG_CONTENT_CLASS, YEAR_LEVEL_OPTIONS } from "./types"
import { SECTION_NAME_OPTIONS } from "@/model/schemaModel"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
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

type Props = {
    vm: MasterDataManagementVM
}

function normalizeSectionTrackPrefix(value?: string | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    if (
        normalized === "IS" ||
        normalized === "BSIS" ||
        normalized === "INFORMATION SYSTEMS" ||
        normalized === "BS INFORMATION SYSTEMS" ||
        normalized === "INFO SYSTEMS" ||
        normalized === "INFO SYS"
    ) {
        return "IS"
    }

    if (
        normalized === "CS" ||
        normalized === "BSCS" ||
        normalized === "COMPUTER SCIENCE" ||
        normalized === "BS COMPUTER SCIENCE" ||
        normalized === "COMP SCI" ||
        normalized === "COMSCI"
    ) {
        return "CS"
    }

    return ""
}

function inferSectionTrackPrefix(values: Array<string | null | undefined>) {
    const normalizedValues = values
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)

    if (normalizedValues.length === 0) return ""

    const directPrefix = normalizedValues
        .map((value) => normalizeSectionTrackPrefix(value))
        .find(Boolean)

    if (directPrefix) return directPrefix

    const joined = normalizedValues.join(" ")
    const tokens = joined
        .split(/[\s/-]+/)
        .map((token) => token.trim())
        .filter(Boolean)

    if (
        tokens.includes("BSIS") ||
        tokens.includes("IS") ||
        /INFORMATION\s+SYSTEMS?/.test(joined)
    ) {
        return "IS"
    }

    if (
        tokens.includes("BSCS") ||
        tokens.includes("CS") ||
        /COMPUTER\s+SCIENCE/.test(joined)
    ) {
        return "CS"
    }

    return ""
}

function extractSectionTrackPrefixFromYearLevel(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    const match = normalized.match(/^(CS|IS)\s+[1-9]\d*$/)
    return match?.[1] ?? ""
}

function extractSectionYearNumber(value?: string | number | null) {
    const normalized = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")

    if (!normalized) return ""

    const direct = normalized.match(/^([1-9]\d*)$/)
    if (direct) return direct[1]

    const prefixed = normalized.match(/^(?:CS|IS)\s+([1-9]\d*)$/)
    if (prefixed) return prefixed[1]

    const trailing = normalized.match(/(?:^|[\s-])([1-9]\d*)$/)
    return trailing?.[1] ?? ""
}

function buildSectionYearLevelValue({
    yearLevel,
    programCode,
    programName,
}: {
    yearLevel?: string | number | null
    programCode?: string | null
    programName?: string | null
}) {
    const yearNumber = extractSectionYearNumber(yearLevel)
    if (!yearNumber) return ""

    const inferredPrefixFromProgram = inferSectionTrackPrefix([programCode, programName])
    const existingPrefix =
        extractSectionTrackPrefixFromYearLevel(yearLevel) || inferSectionTrackPrefix([String(yearLevel ?? "")])

    const prefix = inferredPrefixFromProgram || existingPrefix
    return prefix ? `${prefix} ${yearNumber}` : yearNumber
}

function buildSectionPreviewLabel({
    yearLevel,
    sectionName,
    programCode,
    programName,
}: {
    yearLevel?: string | number | null
    sectionName?: string | null
    programCode?: string | null
    programName?: string | null
}) {
    const yearNumber = extractSectionYearNumber(yearLevel)
    const safeSectionName = String(sectionName ?? "").trim()

    const inferredPrefixFromProgram = inferSectionTrackPrefix([programCode, programName])
    const existingPrefix =
        extractSectionTrackPrefixFromYearLevel(yearLevel) || inferSectionTrackPrefix([String(yearLevel ?? "")])

    const prefix = inferredPrefixFromProgram || existingPrefix

    if (!yearNumber && !safeSectionName) return "—"

    const core = yearNumber && safeSectionName
        ? `${yearNumber} - ${safeSectionName}`
        : yearNumber
            ? yearNumber
            : safeSectionName

    return prefix ? `${prefix} ${core}` : core
}

export function MasterDataDialogs({ vm }: Props) {
    const selectedSectionProgram = vm.programsForSelectedCollege.find(
        (program) => program.$id === vm.sectionProgramId
    )


    const subjectProgramsForSelectedCollege = vm.programs
        .filter((program) => String(program.departmentId ?? "") === String(vm.subjectCollegeId ?? ""))
        .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`))

    const sectionYearSelectValue = extractSectionYearNumber(vm.sectionYear)
    const currentSectionTrackPrefix = extractSectionTrackPrefixFromYearLevel(vm.sectionYear)

    const sectionStoredYearLevelValue = buildSectionYearLevelValue({
        yearLevel: vm.sectionYear,
        programCode: selectedSectionProgram?.code,
        programName: selectedSectionProgram?.name,
    })

    const sectionPreviewLabel = buildSectionPreviewLabel({
        yearLevel: vm.sectionYear,
        sectionName: vm.sectionName,
        programCode: selectedSectionProgram?.code,
        programName: selectedSectionProgram?.name,
    })

    const selectedSectionSubjectLabels = vm.sectionSubjectIds
        .map((subjectId) => vm.sectionSubjectsForSelectedScope.find((subject) => subject.$id === subjectId))
        .filter(Boolean)
        .map((subject) => `${subject?.code} — ${subject?.title}`)

    return (
        <>
            {/* College Dialog */}
            <Dialog open={vm.collegeOpen} onOpenChange={vm.setCollegeOpen}>
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>{vm.collegeEditing ? "Edit College" : "Add College"}</DialogTitle>
                        <DialogDescription>
                            Colleges organize Programs, Subjects, and Faculty assignments.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>College Code</Label>
                            <Input
                                value={vm.collegeCode}
                                onChange={(e) => vm.setCollegeCode(e.target.value)}
                                placeholder="e.g. CCS"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>College Name</Label>
                            <Input
                                value={vm.collegeName}
                                onChange={(e) => vm.setCollegeName(e.target.value)}
                                placeholder="e.g. College of Computing Studies"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={vm.collegeActive}
                                onCheckedChange={(v) => vm.setCollegeActive(Boolean(v))}
                                id="college-active"
                            />
                            <Label htmlFor="college-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.setCollegeOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveCollege()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Program Dialog */}
            <Dialog open={vm.programOpen} onOpenChange={vm.setProgramOpen}>
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>{vm.programEditing ? "Edit Program" : "Add Program"}</DialogTitle>
                        <DialogDescription>Programs/Courses belong to a college.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>College</Label>
                            <Select value={vm.programCollegeId} onValueChange={vm.setProgramCollegeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Program Code</Label>
                            <Input value={vm.programCode} onChange={(e) => vm.setProgramCode(e.target.value)} placeholder="e.g. BSIS" />
                        </div>

                        <div className="grid gap-2">
                            <Label>Program Name</Label>
                            <Input
                                value={vm.programName}
                                onChange={(e) => vm.setProgramName(e.target.value)}
                                placeholder="e.g. BS Information Systems"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Description (optional)</Label>
                            <Textarea
                                value={vm.programDesc}
                                onChange={(e) => vm.setProgramDesc(e.target.value)}
                                placeholder="Short description..."
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={vm.programActive}
                                onCheckedChange={(v) => vm.setProgramActive(Boolean(v))}
                                id="program-active"
                            />
                            <Label htmlFor="program-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.setProgramOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveProgram()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Subject Dialog */}
            <Dialog open={vm.subjectOpen} onOpenChange={vm.setSubjectOpen}>
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>{vm.subjectEditing ? "Edit Subject" : "Add Subject"}</DialogTitle>
                        <DialogDescription>
                            Subjects are now scoped to a college, program, year level, and semester so records only show the correct subjects for matching sections.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>College</Label>
                            <Select
                                value={vm.subjectCollegeId || "__none__"}
                                onValueChange={(v) => vm.setSubjectCollegeId(v === "__none__" ? "" : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>Programs</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {vm.subjectProgramIds.length} selected
                                    </span>
                                </div>
                                <ScrollArea className="h-44 rounded-md border">
                                    <div className="space-y-2 p-3">
                                        {subjectProgramsForSelectedCollege.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                No programs found for the selected college.
                                            </div>
                                        ) : (
                                            subjectProgramsForSelectedCollege.map((program) => {
                                                const checked = vm.subjectProgramIds.includes(program.$id)
                                                return (
                                                    <label
                                                        key={program.$id}
                                                        htmlFor={`subject-program-${program.$id}`}
                                                        className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                    >
                                                        <Checkbox
                                                            id={`subject-program-${program.$id}`}
                                                            checked={checked}
                                                            onCheckedChange={(value) => {
                                                                const nextChecked = Boolean(value)
                                                                vm.setSubjectProgramIds((current) => {
                                                                    if (nextChecked) {
                                                                        return current.includes(program.$id)
                                                                            ? current
                                                                            : [...current, program.$id]
                                                                    }
                                                                    return current.filter((id) => id !== program.$id)
                                                                })
                                                            }}
                                                        />
                                                        <div className="min-w-0 flex-1 text-sm">
                                                            <div className="font-medium">{program.code}</div>
                                                            <div className="text-muted-foreground">{program.name}</div>
                                                        </div>
                                                    </label>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label>Year Levels</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {vm.subjectYearLevels.length} selected
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 rounded-md border p-3">
                                        {YEAR_LEVEL_OPTIONS.map((year) => {
                                            const value = String(year)
                                            const checked = vm.subjectYearLevels.includes(value)
                                            return (
                                                <label
                                                    key={value}
                                                    htmlFor={`subject-year-${value}`}
                                                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={`subject-year-${value}`}
                                                        checked={checked}
                                                        onCheckedChange={(nextValue) => {
                                                            const isChecked = Boolean(nextValue)
                                                            vm.setSubjectYearLevels((current) => {
                                                                if (isChecked) {
                                                                    return current.includes(value)
                                                                        ? current
                                                                        : [...current, value]
                                                                }
                                                                return current.filter((item) => item !== value)
                                                            })
                                                        }}
                                                    />
                                                    <span>{value}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Reference Semester</Label>
                                    <Input value={vm.subjectSemester || "—"} disabled />
                                    <div className="text-xs text-muted-foreground">
                                        Filled automatically from the selected semester.
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Semester (optional)</Label>
                                    <Select
                                        value={vm.subjectTermId || "__none__"}
                                        onValueChange={(v) => {
                                            const nextValue = v === "__none__" ? "" : v
                                            vm.setSubjectTermId(nextValue)

                                            const matchedTerm = vm.terms.find((term) => term.$id === nextValue)
                                            if (matchedTerm?.semester) {
                                                vm.setSubjectSemester(String(matchedTerm.semester))
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="No Semester" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">No Semester</SelectItem>
                                            {vm.terms.map((t) => (
                                                <SelectItem key={t.$id} value={t.$id}>
                                                    {vm.termLabel(vm.terms, t.$id)}
                                                    {t.isActive ? " • Active" : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="text-xs text-muted-foreground">
                                        Select a semester record to fill the subject semester automatically.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                            Subject scope preview:{" "}
                            <span className="font-medium text-foreground">
                                {vm.subjectProgramIds.length === 0
                                    ? "Select at least one program"
                                    : vm.subjectProgramIds
                                        .map((programId) => vm.programLabel(vm.programs, programId))
                                        .join(", ")}
                            </span>
                            {" • "}
                            <span className="font-medium text-foreground">
                                {vm.subjectYearLevels.length === 0 ? "Select year levels" : vm.subjectYearLevels.join(", ")}
                            </span>
                            {" • "}
                            <span className="font-medium text-foreground">
                                {vm.subjectSemester || "Select semester record"}
                            </span>
                        </div>

                        <div className="grid gap-2">
                            <Label>Subject Code</Label>
                            <Input value={vm.subjectCode} onChange={(e) => vm.setSubjectCode(e.target.value)} placeholder="e.g. IT 101" />
                        </div>

                        <div className="grid gap-2">
                            <Label>Subject Title</Label>
                            <Input
                                value={vm.subjectTitle}
                                onChange={(e) => vm.setSubjectTitle(e.target.value)}
                                placeholder="e.g. Introduction to Computing"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label>Units</Label>
                                <Input value={vm.subjectUnits} onChange={(e) => vm.setSubjectUnits(e.target.value)} inputMode="numeric" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Lecture Hours</Label>
                                <Input value={vm.subjectLec} onChange={(e) => vm.setSubjectLec(e.target.value)} inputMode="numeric" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Lab Hours</Label>
                                <Input value={vm.subjectLab} onChange={(e) => vm.setSubjectLab(e.target.value)} inputMode="numeric" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={vm.subjectActive}
                                onCheckedChange={(v) => vm.setSubjectActive(Boolean(v))}
                                id="subject-active"
                            />
                            <Label htmlFor="subject-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.setSubjectOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveSubject()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Faculty Dialog */}
            <Dialog open={vm.facultyOpen} onOpenChange={vm.setFacultyOpen}>
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>{vm.facultyEditing ? "Edit Faculty" : "Add Faculty"}</DialogTitle>
                        <DialogDescription>
                            Select a Faculty user from USER_PROFILES (role: FACULTY / CHAIR / DEAN). Faculty load units and hours are automatically derived from the assigned subjects, so they are no longer manually encoded here.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Faculty User</Label>

                            {vm.facultyEditing ? (
                                <div className="grid gap-2">
                                    <Input value={vm.facultyUserId} disabled />
                                    <div className="text-xs text-muted-foreground">
                                        Faculty User ID cannot be changed once created.
                                    </div>
                                </div>
                            ) : (
                                <Select value={vm.facultyUserId} onValueChange={vm.setFacultyUserId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Faculty User" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vm.availableFacultyUsers.length === 0 ? (
                                            <SelectItem value="__none__" disabled>
                                                No available faculty users
                                            </SelectItem>
                                        ) : (
                                            vm.availableFacultyUsers.map((u) => (
                                                <SelectItem key={u.$id} value={u.userId}>
                                                    {vm.facultyDisplay(u)}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            )}

                            {vm.selectedFacultyUser ? (
                                <div className="rounded-md border p-3 text-xs">
                                    <div className="text-muted-foreground">Selected Faculty</div>
                                    <div className="mt-1 font-medium">{vm.facultyDisplay(vm.selectedFacultyUser)}</div>
                                    <div className="mt-1 text-muted-foreground">
                                        userId:{" "}
                                        <span className="font-medium text-foreground">{vm.selectedFacultyUser.userId}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">
                                    Pick from faculty users only (auto-fetched from USER_PROFILES).
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Employee No (optional)</Label>
                            <Input
                                value={vm.facultyEmpNo}
                                onChange={(e) => vm.setFacultyEmpNo(e.target.value)}
                                placeholder="e.g. 2026-0012"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>College</Label>
                            <Select value={vm.facultyCollegeId} onValueChange={vm.setFacultyCollegeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Rank (optional)</Label>
                            <Input
                                value={vm.facultyRank}
                                onChange={(e) => vm.setFacultyRank(e.target.value)}
                                placeholder="e.g. Instructor I / Assistant Prof."
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Notes (optional)</Label>
                            <Textarea
                                value={vm.facultyNotes}
                                onChange={(e) => vm.setFacultyNotes(e.target.value)}
                                placeholder="Extra remarks, faculty-specific notes, or scheduling considerations..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.setFacultyOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveFacultyProfile()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Section Dialog */}
            <Dialog
                open={vm.sectionOpen}
                onOpenChange={(open) => {
                    if (open) {
                        vm.setSectionOpen(true)
                        return
                    }

                    vm.closeSectionDialog()
                }}
            >
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>
                            {vm.isBulkEditingSections
                                ? `Edit Selected Sections (${vm.sectionEditingTargets.length})`
                                : vm.sectionEditing
                                    ? "Edit Section"
                                    : "Add Section"}
                        </DialogTitle>
                        <DialogDescription>
                            {vm.isBulkEditingSections
                                ? "Only the fields you change below will be applied to every selected section record. Leave untouched fields as they are to preserve each section's current values."
                                : "Sections are reusable across all academic terms. Use the optional subject filter term below only to narrow linked subject choices while the saved section remains globally reusable."}
                        </DialogDescription>
                    </DialogHeader>

                    {vm.isBulkEditingSections ? (
                        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                            Editing <span className="font-medium text-foreground">{vm.sectionEditingTargets.length}</span> selected section records.
                            Only changed fields will be saved across all selected records.
                        </div>
                    ) : null}

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Subject Filter Term (optional)</Label>
                            <Select
                                value={vm.sectionTermId || "__all__"}
                                onValueChange={(value) => {
                                    if (value === "__all__") {
                                        vm.setSectionTermId("")
                                        vm.setSectionSemester("")
                                        vm.setSectionAcademicTermLabel("All Academic Terms")
                                        return
                                    }

                                    vm.setSectionTermId(value)
                                    const selectedTerm = vm.terms.find((term) => term.$id === value)
                                    vm.setSectionSemester(String(selectedTerm?.semester ?? ""))
                                    vm.setSectionAcademicTermLabel(vm.termLabel(vm.terms, value))
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Academic Terms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All Academic Terms</SelectItem>
                                    {vm.terms.map((t) => (
                                        <SelectItem key={t.$id} value={t.$id}>
                                            {vm.termLabel(vm.terms, t.$id)}{t.isActive ? " • Active" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                This only narrows the subject picker. The saved section remains reusable across every academic term.
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>College</Label>
                            <Select
                                value={vm.sectionCollegeId}
                                onValueChange={(value) => {
                                    vm.markSectionFieldDirty("departmentId")
                                    vm.setSectionCollegeId(value)
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select College" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Academic Term Coverage</Label>
                                <Input
                                    value={
                                        vm.sectionTermId
                                            ? vm.sectionAcademicTermLabel || vm.termLabel(vm.terms, vm.sectionTermId)
                                            : "All Academic Terms"
                                    }
                                    disabled
                                />
                                <div className="text-xs text-muted-foreground">
                                    Sections are shared across all academic terms. The optional filter only helps narrow the linked subject list.
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Subject Filter Semester</Label>
                                <Input value={vm.sectionSemester || "All Semesters"} disabled />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Program (optional)</Label>
                            <Select
                                value={vm.sectionProgramId || "__none__"}
                                onValueChange={(v) => {
                                    vm.markSectionFieldDirty("programId")
                                    const nextProgramId = v === "__none__" ? "" : v
                                    vm.setSectionProgramId(nextProgramId)

                                    const nextProgram = vm.programsForSelectedCollege.find(
                                        (program) => program.$id === nextProgramId
                                    )

                                    const normalizedYearLevel = buildSectionYearLevelValue({
                                        yearLevel: vm.sectionYear,
                                        programCode: nextProgram?.code,
                                        programName: nextProgram?.name,
                                    })

                                    if (normalizedYearLevel) {
                                        vm.setSectionYear(normalizedYearLevel)
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No Program" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No Program</SelectItem>
                                    {vm.programsForSelectedCollege.map((p) => (
                                        <SelectItem key={p.$id} value={p.$id}>
                                            {p.code} — {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="text-xs text-muted-foreground">
                                Optional, but recommended if your schedule rules are program-based.
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Linked Subjects</Label>
                                <span className="text-xs text-muted-foreground">
                                    {vm.sectionSubjectIds.length} selected
                                </span>
                            </div>
                            <ScrollArea className="h-44 rounded-md border">
                                <div className="space-y-2 p-3">
                                    {vm.sectionSubjectsForSelectedScope.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            No matching subjects found for the selected reusable section scope.
                                        </div>
                                    ) : (
                                        vm.sectionSubjectsForSelectedScope.map((subject) => {
                                            const checked = vm.sectionSubjectIds.includes(subject.$id)

                                            return (
                                                <label
                                                    key={subject.$id}
                                                    htmlFor={`section-subject-${subject.$id}`}
                                                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={`section-subject-${subject.$id}`}
                                                        checked={checked}
                                                        onCheckedChange={(value) => {
                                                            const isChecked = Boolean(value)
                                                            vm.markSectionFieldDirty("subjectIds")
                                                            vm.setSectionSubjectIds((current) => {
                                                                if (isChecked) {
                                                                    return current.includes(subject.$id)
                                                                        ? current
                                                                        : [...current, subject.$id]
                                                                }
                                                                return current.filter((id) => id !== subject.$id)
                                                            })
                                                        }}
                                                    />

                                                    <div className="min-w-0 flex-1 text-sm">
                                                        <div className="font-medium">{subject.code}</div>
                                                        <div className="text-muted-foreground">{subject.title}</div>
                                                    </div>
                                                </label>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                                Linked subject preview:{" "}
                                <span className="font-medium text-foreground">
                                    {selectedSectionSubjectLabels.length === 0
                                        ? "Select at least one subject"
                                        : selectedSectionSubjectLabels.join(", ")}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Subject options are filtered by the selected college, program, year level, and the optional term filter.
                            </div>
                        </div>

                        <div className="rounded-md border border-dashed p-3">
                            <div className="text-xs text-muted-foreground">Section CS/IS Reference Preview</div>
                            <div className="mt-1 font-medium">{sectionPreviewLabel}</div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Stored yearLevel:{" "}
                                <span className="font-medium text-foreground">
                                    {sectionStoredYearLevelValue || "—"}
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>Year Level</Label>
                                <Select
                                    value={sectionYearSelectValue}
                                    onValueChange={(value) => {
                                        vm.markSectionFieldDirty("yearLevel")
                                        vm.setSectionYear(
                                            buildSectionYearLevelValue({
                                                yearLevel: currentSectionTrackPrefix
                                                    ? `${currentSectionTrackPrefix} ${value}`
                                                    : value,
                                                programCode: selectedSectionProgram?.code,
                                                programName: selectedSectionProgram?.name,
                                            })
                                        )
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Year Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEAR_LEVEL_OPTIONS.map((y) => (
                                            <SelectItem key={y} value={String(y)}>
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Saved automatically as CS 1 / IS 1 based on the selected program.
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Section Name</Label>
                                <Select
                                    value={vm.sectionName}
                                    onValueChange={(value) => {
                                        vm.markSectionFieldDirty("name")
                                        vm.setSectionName(value)
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Section Name" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SECTION_NAME_OPTIONS.map((n) => (
                                            <SelectItem key={n} value={n}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Student Count (optional)</Label>
                            <Input
                                value={vm.sectionStudentCount}
                                onChange={(e) => {
                                    vm.markSectionFieldDirty("studentCount")
                                    vm.setSectionStudentCount(e.target.value)
                                }}
                                inputMode="numeric"
                                placeholder="e.g. 35"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={vm.sectionActive}
                                onCheckedChange={(v) => {
                                    vm.markSectionFieldDirty("isActive")
                                    vm.setSectionActive(Boolean(v))
                                }}
                                id="section-active"
                            />
                            <Label htmlFor="section-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.closeSectionDialog()}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveSection()}>
                            {vm.isBulkEditingSections
                                ? `Apply to Selected (${vm.sectionEditingTargets.length})`
                                : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog
                open={Boolean(vm.deleteIntent)}
                onOpenChange={(open) => (!open ? vm.setDeleteIntent(null) : null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{vm.deleteTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{vm.deleteText} This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => void vm.confirmDelete()}
                        >
                            {vm.deleteActionLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}