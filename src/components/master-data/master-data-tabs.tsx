/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Plus, Pencil, Trash2 } from "lucide-react"

import type { MasterDataManagementVM } from "./use-master-data"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type Props = {
    vm: MasterDataManagementVM
}

export function MasterDataTabs({ vm }: Props) {
    return (
        <>
            <Alert>
                <AlertTitle>Master Data</AlertTitle>
                <AlertDescription>
                    These are system-wide datasets used by schedules, workloads, and validations.
                    Update carefully to avoid breaking references.
                </AlertDescription>
            </Alert>

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
                            <CardDescription>
                                Add, edit, and maintain Colleges, Programs, Subjects, Faculty, Sections, and List of Records.
                            </CardDescription>
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
                    <Tabs value={vm.tab} onValueChange={(v: any) => vm.setTab(v)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
                            <TabsTrigger value="colleges">Colleges</TabsTrigger>
                            <TabsTrigger value="programs">Programs/Courses</TabsTrigger>
                            <TabsTrigger value="subjects">Subjects</TabsTrigger>
                            <TabsTrigger value="faculty">Faculty</TabsTrigger>
                            <TabsTrigger value="sections">Sections</TabsTrigger>
                            <TabsTrigger value="records">List of Records</TabsTrigger>
                        </TabsList>

                        <Separator className="my-4" />

                        {/* ---------------- COLLEGES ---------------- */}
                        <TabsContent value="colleges" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Colleges</div>
                                    <div className="text-sm text-muted-foreground">Add/edit college records.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setCollegeEditing(null)
                                        vm.setCollegeOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add College
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredColleges.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No colleges found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-40 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredColleges.map((d) => (
                                                <TableRow key={d.$id}>
                                                    <TableCell className="font-medium">{d.code}</TableCell>
                                                    <TableCell>{d.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={d.isActive ? "default" : "secondary"}>
                                                            {d.isActive ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setCollegeEditing(d)
                                                                    vm.setCollegeOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "college", doc: d })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- PROGRAMS ---------------- */}
                        <TabsContent value="programs" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Programs / Courses</div>
                                    <div className="text-sm text-muted-foreground">Manage programs handled by colleges.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setProgramEditing(null)
                                        vm.setProgramOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Program
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredPrograms.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No programs found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-32">Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredPrograms.map((p) => (
                                                <TableRow key={p.$id}>
                                                    <TableCell className="font-medium">{p.code}</TableCell>
                                                    <TableCell>{p.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {vm.collegeLabel(vm.colleges, p.departmentId)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={p.isActive ? "default" : "secondary"}>
                                                            {p.isActive ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setProgramEditing(p)
                                                                    vm.setProgramOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "program", doc: p })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- SUBJECTS ---------------- */}
                        <TabsContent value="subjects" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Subjects</div>
                                    <div className="text-sm text-muted-foreground">Manage subject list, units, and hours.</div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setSubjectEditing(null)
                                        vm.setSubjectOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Subject
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredSubjects.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No subjects found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Code</TableHead>
                                                <TableHead>Title</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead className="w-44">Units / Hours</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredSubjects.map((s) => (
                                                <TableRow key={s.$id}>
                                                    <TableCell className="font-medium">{s.code}</TableCell>
                                                    <TableCell>{s.title}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {vm.collegeLabel(vm.colleges, s.departmentId ?? null)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs text-muted-foreground">
                                                            Units: <span className="font-medium text-foreground">{s.units}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Lec {s.lectureHours} / Lab {s.labHours} ={" "}
                                                            <span className="font-medium text-foreground">
                                                                {Number.isFinite(Number(s.totalHours))
                                                                    ? s.totalHours
                                                                    : s.lectureHours + s.labHours}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    vm.setSubjectEditing(s)
                                                                    vm.setSubjectOpen(true)
                                                                }}
                                                            >
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => vm.setDeleteIntent({ type: "subject", doc: s })}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- FACULTY ---------------- */}
                        <TabsContent value="faculty" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">Faculty</div>
                                    <div className="text-sm text-muted-foreground">
                                        Faculty info, rank, and max load rules (if applicable).
                                    </div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        vm.setFacultyEditing(null)
                                        vm.setFacultyOpen(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Faculty
                                </Button>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredFaculty.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No faculty found.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Faculty</TableHead>
                                                <TableHead className="w-64">User ID</TableHead>
                                                <TableHead className="w-40">Employee No</TableHead>
                                                <TableHead>College</TableHead>
                                                <TableHead className="w-44">Max Load</TableHead>
                                                <TableHead className="w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredFaculty.map((f) => {
                                                const u = vm.facultyUserMap.get(String(f.userId).trim()) ?? null
                                                return (
                                                    <TableRow key={f.$id}>
                                                        <TableCell className="font-medium">
                                                            {u ? vm.facultyDisplay(u) : "Unknown faculty"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{f.userId}</TableCell>
                                                        <TableCell className="text-muted-foreground">{f.employeeNo || "—"}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.collegeLabel(vm.colleges, f.departmentId)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-xs text-muted-foreground">
                                                                Units:{" "}
                                                                <span className="font-medium text-foreground">{f.maxUnits ?? "—"}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Hours:{" "}
                                                                <span className="font-medium text-foreground">{f.maxHours ?? "—"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
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
                                                                    onClick={() => vm.setDeleteIntent({ type: "faculty", doc: f })}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle>Optional: Encode List of Faculties</CardTitle>
                                    <CardDescription>
                                        Useful when the same faculty roster repeats every semester.
                                        Format per line: userId,employeeNo,rank,maxUnits,maxHours,notes
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-medium">Default College</label>
                                            <Select value={vm.facBulkCollegeId} onValueChange={vm.setFacBulkCollegeId}>
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
                                    </div>

                                    <Textarea
                                        value={vm.facBulkText}
                                        onChange={(e) => vm.setFacBulkText(e.target.value)}
                                        placeholder={`faculty-user-id-1,2026-001,Instructor I,18,24,Regular load
faculty-user-id-2,2026-002,Assistant Professor,18,24,Thesis adviser`}
                                        className="min-h-40"
                                    />

                                    <div className="flex items-center justify-end">
                                        <Button onClick={() => void vm.saveFacultyBulkList()}>
                                            Encode Faculty List
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ---------------- SECTIONS ---------------- */}
                        <TabsContent value="sections" className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="font-medium">Sections</div>
                                    <div className="text-sm text-muted-foreground">
                                        Manage class sections per term (A–Z + Others), including year level and student count.
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                    <div className="w-full sm:w-80">
                                        <Select value={vm.selectedTermId} onValueChange={vm.setSelectedTermId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Academic Term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vm.terms.length === 0 ? (
                                                    <SelectItem value="__none__" disabled>
                                                        No academic terms found
                                                    </SelectItem>
                                                ) : (
                                                    vm.terms.map((t) => (
                                                        <SelectItem key={t.$id} value={t.$id}>
                                                            {vm.termLabel(vm.terms, t.$id)}{t.isActive ? " • Active" : ""}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            vm.setSectionEditing(null)
                                            vm.setSectionOpen(true)
                                        }}
                                        disabled={vm.terms.length === 0}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Section
                                    </Button>
                                </div>
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.terms.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    No academic terms found. Create an Academic Term first to manage Sections.
                                </div>
                            ) : vm.filteredSections.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No sections found for this term.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-40">Section</TableHead>
                                                <TableHead className="w-72">College</TableHead>
                                                <TableHead>Program (optional)</TableHead>
                                                <TableHead className="w-32">Students</TableHead>
                                                <TableHead className="w-24">Active</TableHead>
                                                <TableHead className="w-40 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredSections
                                                .slice()
                                                .sort((a, b) => {
                                                    const left = `${a.departmentId}-${a.yearLevel}-${a.name}`
                                                    const right = `${b.departmentId}-${b.yearLevel}-${b.name}`
                                                    return left.localeCompare(right)
                                                })
                                                .map((s) => (
                                                    <TableRow key={s.$id}>
                                                        <TableCell className="font-medium">{`Y${s.yearLevel} ${s.name}`}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.collegeLabel(vm.colleges, s.departmentId)}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {vm.programLabel(vm.programs, s.programId ?? null)}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {s.studentCount != null ? s.studentCount : "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={s.isActive ? "default" : "secondary"}>
                                                                {s.isActive ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        vm.setSectionEditing(s)
                                                                        vm.setSectionOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => vm.setDeleteIntent({ type: "section", doc: s })}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------------- LIST OF RECORDS ---------------- */}
                        <TabsContent value="records" className="space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <div className="font-medium">List of Records</div>
                                    <div className="text-sm text-muted-foreground">
                                        Conflict detection focuses on room + day/time overlap.
                                        Same subject across different faculty is allowed.
                                    </div>
                                </div>

                                <Alert>
                                    <AlertTitle>Conflict Rule in Use</AlertTitle>
                                    <AlertDescription>
                                        Detected conflict = same term + same room + same day + overlapping time.
                                        Faculty and subject repetition are allowed.
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
                            </div>

                            {vm.loading ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : vm.filteredRecordRows.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No records found using current filters.</div>
                            ) : (
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-48">Term</TableHead>
                                                <TableHead className="w-28">Day</TableHead>
                                                <TableHead className="w-36">Time</TableHead>
                                                <TableHead className="w-48">Room</TableHead>
                                                <TableHead className="w-72">Faculty</TableHead>
                                                <TableHead className="w-80">Subject</TableHead>
                                                <TableHead className="w-20">Units</TableHead>
                                                <TableHead className="w-28">Conflict</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {vm.filteredRecordRows.map((r) => {
                                                const hasConflict = vm.conflictRecordIds.has(r.id)
                                                return (
                                                    <TableRow key={r.id}>
                                                        <TableCell className="text-muted-foreground">{r.termLabel}</TableCell>
                                                        <TableCell>{r.dayOfWeek || "—"}</TableCell>
                                                        <TableCell>{r.startTime} - {r.endTime}</TableCell>
                                                        <TableCell>{r.roomLabel}</TableCell>
                                                        <TableCell className="text-muted-foreground">{r.facultyLabel}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{r.subjectCode}</div>
                                                            <div className="text-xs text-muted-foreground">{r.subjectTitle}</div>
                                                        </TableCell>
                                                        <TableCell>{r.units ?? "—"}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={hasConflict ? "destructive" : "secondary"}>
                                                                {hasConflict ? "Conflict" : "Clear"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </>
    )
}
