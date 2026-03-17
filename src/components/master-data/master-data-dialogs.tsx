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
                        <DialogDescription>Subjects include units and lecture/lab hour breakdown.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>College (optional)</Label>
                            <Select
                                value={vm.subjectCollegeId || "__none__"}
                                onValueChange={(v) => vm.setSubjectCollegeId(v === "__none__" ? "" : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No College" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No College</SelectItem>
                                    {vm.colleges.map((d) => (
                                        <SelectItem key={d.$id} value={d.$id}>
                                            {d.code} — {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                        <div className="rounded-md border border-dashed p-3">
                            <div className="text-xs text-muted-foreground">Faculty Load Source</div>
                            <div className="mt-1 text-sm font-medium">
                                Units and hours are auto-populated from the faculty member&apos;s assigned subjects.
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                                You do not need to manually encode max units or max hours in the Faculty form anymore.
                            </div>
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
            <Dialog open={vm.sectionOpen} onOpenChange={vm.setSectionOpen}>
                <DialogContent className={DIALOG_CONTENT_CLASS}>
                    <DialogHeader>
                        <DialogTitle>{vm.sectionEditing ? "Edit Section" : "Add Section"}</DialogTitle>
                        <DialogDescription>
                            Sections are linked to a Term and College, with year level + name (A-Z / Others).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label>Academic Term</Label>
                            {vm.sectionEditing ? (
                                <div className="grid gap-2">
                                    <Input value={vm.termLabel(vm.terms, vm.sectionTermId)} disabled />
                                    <div className="text-xs text-muted-foreground">
                                        Term cannot be changed once created (recommended).
                                    </div>
                                </div>
                            ) : (
                                <Select value={vm.sectionTermId} onValueChange={vm.setSectionTermId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Academic Term" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vm.terms.map((t) => (
                                            <SelectItem key={t.$id} value={t.$id}>
                                                {vm.termLabel(vm.terms, t.$id)}{t.isActive ? " • Active" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>College</Label>
                            <Select value={vm.sectionCollegeId} onValueChange={vm.setSectionCollegeId}>
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
                            <Label>Program (optional)</Label>
                            <Select
                                value={vm.sectionProgramId || "__none__"}
                                onValueChange={(v) => {
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
                                    onValueChange={(value) =>
                                        vm.setSectionYear(
                                            buildSectionYearLevelValue({
                                                yearLevel: currentSectionTrackPrefix
                                                    ? `${currentSectionTrackPrefix} ${value}`
                                                    : value,
                                                programCode: selectedSectionProgram?.code,
                                                programName: selectedSectionProgram?.name,
                                            })
                                        )
                                    }
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
                                <Select value={vm.sectionName} onValueChange={vm.setSectionName}>
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
                                onChange={(e) => vm.setSectionStudentCount(e.target.value)}
                                inputMode="numeric"
                                placeholder="e.g. 35"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={vm.sectionActive}
                                onCheckedChange={(v) => vm.setSectionActive(Boolean(v))}
                                id="section-active"
                            />
                            <Label htmlFor="section-active">Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => vm.setSectionOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => void vm.saveSection()}>Save</Button>
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
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}