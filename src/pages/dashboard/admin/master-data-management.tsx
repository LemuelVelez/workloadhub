/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, RefreshCcw, Pencil, Trash2 } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"
import { SECTION_NAME_OPTIONS } from "@/model/schemaModel"

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
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

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

type DepartmentDoc = {
    $id: string
    code: string
    name: string
    isActive: boolean
}

type ProgramDoc = {
    $id: string
    departmentId: string
    code: string
    name: string
    description?: string | null
    isActive: boolean
}

type SubjectDoc = {
    $id: string
    departmentId?: string | null
    code: string
    title: string
    units: number
    lectureHours: number
    labHours: number
    totalHours?: number | null
    isActive: boolean
}

type AcademicTermDoc = {
    $id: string
    schoolYear: string
    semester: string
    startDate?: string | null
    endDate?: string | null
    isActive: boolean
    isLocked: boolean
}

type SectionDoc = {
    $id: string
    termId: string
    departmentId: string
    programId?: string | null
    yearLevel: number
    name: string
    studentCount?: number | null
    isActive: boolean
}

type UserProfileDoc = {
    $id: string
    userId: string
    email: string
    name?: string | null
    role: string
    departmentId?: string | null
    isActive: boolean
}

type FacultyProfileDoc = {
    $id: string
    userId: string
    employeeNo?: string | null
    departmentId: string
    rank?: string | null
    maxUnits?: number | null
    maxHours?: number | null
    notes?: string | null
}

type MasterTab = "departments" | "programs" | "subjects" | "faculty" | "sections"

type DeleteIntent =
    | { type: "department"; doc: DepartmentDoc }
    | { type: "program"; doc: ProgramDoc }
    | { type: "subject"; doc: SubjectDoc }
    | { type: "faculty"; doc: FacultyProfileDoc }
    | { type: "section"; doc: SectionDoc }

const FACULTY_ROLES = ["FACULTY", "CHAIR", "DEAN"] as const

// ✅ Shorter dialog + vertical scroll
const DIALOG_CONTENT_CLASS = "sm:max-w-2xl max-h-[75vh] overflow-y-auto"

function str(v: any) {
    return String(v ?? "").trim()
}

function num(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function toBool(v: any) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function deptLabel(depts: DepartmentDoc[], deptId: string | null | undefined) {
    const id = String(deptId ?? "").trim()
    if (!id) return "—"
    const d = depts.find((x) => x.$id === id)
    if (!d) return "Unknown"
    return `${d.code} — ${d.name}`
}

function programLabel(programs: ProgramDoc[], programId: string | null | undefined) {
    const id = String(programId ?? "").trim()
    if (!id) return "—"
    const p = programs.find((x) => x.$id === id)
    if (!p) return "Unknown"
    return `${p.code} — ${p.name}`
}

function termLabel(terms: AcademicTermDoc[], termId: string | null | undefined) {
    const id = String(termId ?? "").trim()
    if (!id) return "—"
    const t = terms.find((x) => x.$id === id)
    if (!t) return "Unknown"
    const sy = str(t.schoolYear)
    const sem = str(t.semester)
    return sy && sem ? `${sy} • ${sem}` : sy || sem || "Term"
}

function facultyDisplay(u?: UserProfileDoc | null) {
    if (!u) return "Unknown faculty"
    const name = str(u.name) || "Unnamed"
    const email = str(u.email)
    return email ? `${name} (${email})` : name
}

async function listDocs(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

const YEAR_LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6] as const

export default function AdminMasterDataManagementPage() {
    const [tab, setTab] = React.useState<MasterTab>("departments")
    const [loading, setLoading] = React.useState(true)

    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])
    const [programs, setPrograms] = React.useState<ProgramDoc[]>([])
    const [subjects, setSubjects] = React.useState<SubjectDoc[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<FacultyProfileDoc[]>([])

    // ✅ NEW: Terms + Sections (SECTIONS table now used)
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [sections, setSections] = React.useState<SectionDoc[]>([])
    const [selectedTermId, setSelectedTermId] = React.useState("")

    // ✅ NEW: faculty users from USER_PROFILES (role FACULTY/CHAIR/DEAN)
    const [facultyUsers, setFacultyUsers] = React.useState<UserProfileDoc[]>([])

    const [search, setSearch] = React.useState("")

    const [deleteIntent, setDeleteIntent] = React.useState<DeleteIntent | null>(null)

    const refreshAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const [deptDocs, progDocs, subDocs, facDocs, userProfileDocs, termDocs, sectionDocs] =
                await Promise.all([
                    listDocs(COLLECTIONS.DEPARTMENTS, [Query.orderAsc("name"), Query.limit(200)]),
                    listDocs(COLLECTIONS.PROGRAMS, [Query.orderAsc("name"), Query.limit(500)]),
                    listDocs(COLLECTIONS.SUBJECTS, [Query.orderAsc("code"), Query.limit(2000)]),
                    listDocs(COLLECTIONS.FACULTY_PROFILES, [Query.orderAsc("$createdAt"), Query.limit(1000)]),

                    // ✅ fetch user profiles (then filter to faculty roles)
                    listDocs(COLLECTIONS.USER_PROFILES, [Query.orderAsc("name"), Query.limit(2000)]),

                    // ✅ Academic Terms
                    listDocs(COLLECTIONS.ACADEMIC_TERMS, [Query.orderDesc("$createdAt"), Query.limit(500)]),

                    // ✅ Sections (now used)
                    listDocs(COLLECTIONS.SECTIONS, [Query.orderDesc("$createdAt"), Query.limit(5000)]),
                ])

            setDepartments(
                deptDocs.map((d: any) => ({
                    $id: d.$id,
                    code: str(d.code),
                    name: str(d.name),
                    isActive: toBool(d.isActive),
                }))
            )

            setPrograms(
                progDocs.map((p: any) => ({
                    $id: p.$id,
                    departmentId: str(p.departmentId),
                    code: str(p.code),
                    name: str(p.name),
                    description: p.description ?? null,
                    isActive: toBool(p.isActive),
                }))
            )

            setSubjects(
                subDocs.map((s: any) => ({
                    $id: s.$id,
                    departmentId: s.departmentId ? str(s.departmentId) : null,
                    code: str(s.code),
                    title: str(s.title),
                    units: num(s.units, 0),
                    lectureHours: num(s.lectureHours, 0),
                    labHours: num(s.labHours, 0),
                    totalHours: s.totalHours != null ? num(s.totalHours, 0) : null,
                    isActive: toBool(s.isActive),
                }))
            )

            setFacultyProfiles(
                facDocs.map((f: any) => ({
                    $id: f.$id,
                    userId: str(f.userId),
                    employeeNo: f.employeeNo ?? null,
                    departmentId: str(f.departmentId),
                    rank: f.rank ?? null,
                    maxUnits: f.maxUnits != null ? num(f.maxUnits, 0) : null,
                    maxHours: f.maxHours != null ? num(f.maxHours, 0) : null,
                    notes: f.notes ?? null,
                }))
            )

            const mappedUsers: UserProfileDoc[] = (userProfileDocs ?? []).map((u: any) => ({
                $id: u.$id,
                userId: str(u.userId),
                email: str(u.email),
                name: u.name ?? null,
                role: str(u.role),
                departmentId: u.departmentId ? str(u.departmentId) : null,
                isActive: toBool(u.isActive),
            }))

            const filteredFacultyUsers = mappedUsers
                .filter((u) => FACULTY_ROLES.includes(str(u.role).toUpperCase() as any))
                .filter((u) => Boolean(u.userId))
                .sort((a, b) => facultyDisplay(a).localeCompare(facultyDisplay(b)))

            setFacultyUsers(filteredFacultyUsers)

            const mappedTerms: AcademicTermDoc[] = (termDocs ?? []).map((t: any) => ({
                $id: t.$id,
                schoolYear: str(t.schoolYear),
                semester: str(t.semester),
                startDate: t.startDate ?? null,
                endDate: t.endDate ?? null,
                isActive: toBool(t.isActive),
                isLocked: toBool(t.isLocked),
            }))
            setTerms(mappedTerms)

            // ✅ Auto-select an active term (or fallback to first)
            setSelectedTermId((prev) => {
                if (str(prev)) return prev
                const active = mappedTerms.find((x) => x.isActive)
                return active?.$id || mappedTerms[0]?.$id || ""
            })

            const mappedSections: SectionDoc[] = (sectionDocs ?? []).map((s: any) => ({
                $id: s.$id,
                termId: str(s.termId),
                departmentId: str(s.departmentId),
                programId: s.programId ? str(s.programId) : null,
                yearLevel: num(s.yearLevel, 1),
                name: str(s.name),
                studentCount: s.studentCount != null ? num(s.studentCount, 0) : null,
                isActive: toBool(s.isActive),
            }))
            setSections(mappedSections)
        } catch (e: any) {
            toast.error(e?.message || "Failed to load Master Data.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void refreshAll()
    }, [refreshAll])

    const facultyUserMap = React.useMemo(() => {
        const m = new Map<string, UserProfileDoc>()
        for (const u of facultyUsers) {
            if (u.userId) m.set(u.userId, u)
        }
        return m
    }, [facultyUsers])

    // -----------------------------
    // Departments dialog state
    // -----------------------------
    const [deptOpen, setDeptOpen] = React.useState(false)
    const [deptEditing, setDeptEditing] = React.useState<DepartmentDoc | null>(null)

    const [deptCode, setDeptCode] = React.useState("")
    const [deptName, setDeptName] = React.useState("")
    const [deptActive, setDeptActive] = React.useState(true)

    React.useEffect(() => {
        if (!deptOpen) return
        if (!deptEditing) {
            setDeptCode("")
            setDeptName("")
            setDeptActive(true)
            return
        }
        setDeptCode(deptEditing.code)
        setDeptName(deptEditing.name)
        setDeptActive(Boolean(deptEditing.isActive))
    }, [deptOpen, deptEditing])

    async function saveDepartment() {
        const payload = {
            code: str(deptCode),
            name: str(deptName),
            isActive: Boolean(deptActive),
        }

        if (!payload.code || !payload.name) {
            toast.error("Department code and name are required.")
            return
        }

        try {
            if (deptEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, deptEditing.$id, payload)
                toast.success("Department updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, ID.unique(), payload)
                toast.success("Department created.")
            }
            setDeptOpen(false)
            setDeptEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save department.")
        }
    }

    // -----------------------------
    // Programs dialog state
    // -----------------------------
    const [progOpen, setProgOpen] = React.useState(false)
    const [progEditing, setProgEditing] = React.useState<ProgramDoc | null>(null)

    const [progDeptId, setProgDeptId] = React.useState("")
    const [progCode, setProgCode] = React.useState("")
    const [progName, setProgName] = React.useState("")
    const [progDesc, setProgDesc] = React.useState("")
    const [progActive, setProgActive] = React.useState(true)

    React.useEffect(() => {
        if (!progOpen) return
        if (!progEditing) {
            setProgDeptId("")
            setProgCode("")
            setProgName("")
            setProgDesc("")
            setProgActive(true)
            return
        }

        setProgDeptId(progEditing.departmentId)
        setProgCode(progEditing.code)
        setProgName(progEditing.name)
        setProgDesc(String(progEditing.description ?? ""))
        setProgActive(Boolean(progEditing.isActive))
    }, [progOpen, progEditing])

    async function saveProgram() {
        const payload = {
            departmentId: str(progDeptId),
            code: str(progCode),
            name: str(progName),
            description: str(progDesc) || null,
            isActive: Boolean(progActive),
        }

        if (!payload.departmentId || !payload.code || !payload.name) {
            toast.error("Department, program code, and program name are required.")
            return
        }

        try {
            if (progEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, progEditing.$id, payload)
                toast.success("Program updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, ID.unique(), payload)
                toast.success("Program created.")
            }
            setProgOpen(false)
            setProgEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save program.")
        }
    }

    // -----------------------------
    // Subjects dialog state
    // -----------------------------
    const [subOpen, setSubOpen] = React.useState(false)
    const [subEditing, setSubEditing] = React.useState<SubjectDoc | null>(null)

    const [subDeptId, setSubDeptId] = React.useState("")
    const [subCode, setSubCode] = React.useState("")
    const [subTitle, setSubTitle] = React.useState("")
    const [subUnits, setSubUnits] = React.useState("3")
    const [subLec, setSubLec] = React.useState("3")
    const [subLab, setSubLab] = React.useState("0")
    const [subActive, setSubActive] = React.useState(true)

    React.useEffect(() => {
        if (!subOpen) return
        if (!subEditing) {
            setSubDeptId("")
            setSubCode("")
            setSubTitle("")
            setSubUnits("3")
            setSubLec("3")
            setSubLab("0")
            setSubActive(true)
            return
        }

        setSubDeptId(String(subEditing.departmentId ?? ""))
        setSubCode(subEditing.code)
        setSubTitle(subEditing.title)
        setSubUnits(String(subEditing.units ?? 0))
        setSubLec(String(subEditing.lectureHours ?? 0))
        setSubLab(String(subEditing.labHours ?? 0))
        setSubActive(Boolean(subEditing.isActive))
    }, [subOpen, subEditing])

    async function saveSubject() {
        const units = num(subUnits, 0)
        const lec = num(subLec, 0)
        const lab = num(subLab, 0)
        const total = lec + lab

        const payload: any = {
            code: str(subCode),
            title: str(subTitle),
            units,
            lectureHours: lec,
            labHours: lab,
            totalHours: total,
            isActive: Boolean(subActive),
        }

        const dept = str(subDeptId)
        payload.departmentId = dept ? dept : null

        if (!payload.code || !payload.title) {
            toast.error("Subject code and title are required.")
            return
        }

        try {
            if (subEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, subEditing.$id, payload)
                toast.success("Subject updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, ID.unique(), payload)
                toast.success("Subject created.")
            }
            setSubOpen(false)
            setSubEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save subject.")
        }
    }

    // -----------------------------
    // Faculty dialog state
    // -----------------------------
    const [facOpen, setFacOpen] = React.useState(false)
    const [facEditing, setFacEditing] = React.useState<FacultyProfileDoc | null>(null)

    const [facUserId, setFacUserId] = React.useState("")
    const [facEmpNo, setFacEmpNo] = React.useState("")
    const [facDeptId, setFacDeptId] = React.useState("")
    const [facRank, setFacRank] = React.useState("")
    const [facMaxUnits, setFacMaxUnits] = React.useState("")
    const [facMaxHours, setFacMaxHours] = React.useState("")
    const [facNotes, setFacNotes] = React.useState("")

    React.useEffect(() => {
        if (!facOpen) return
        if (!facEditing) {
            setFacUserId("")
            setFacEmpNo("")
            setFacDeptId("")
            setFacRank("")
            setFacMaxUnits("")
            setFacMaxHours("")
            setFacNotes("")
            return
        }

        setFacUserId(facEditing.userId)
        setFacEmpNo(String(facEditing.employeeNo ?? ""))
        setFacDeptId(facEditing.departmentId)
        setFacRank(String(facEditing.rank ?? ""))
        setFacMaxUnits(facEditing.maxUnits != null ? String(facEditing.maxUnits) : "")
        setFacMaxHours(facEditing.maxHours != null ? String(facEditing.maxHours) : "")
        setFacNotes(String(facEditing.notes ?? ""))
    }, [facOpen, facEditing])

    const selectedFacultyUser = React.useMemo(() => {
        const id = str(facUserId)
        if (!id) return null
        return facultyUserMap.get(id) ?? null
    }, [facUserId, facultyUserMap])

    // ✅ NEW: show only faculty users that don't already have a profile
    const availableFacultyUsers = React.useMemo(() => {
        const existing = new Set(facultyProfiles.map((f) => str(f.userId)))
        return facultyUsers.filter((u) => {
            if (!u.userId) return false
            if (facEditing?.userId && u.userId === facEditing.userId) return true
            return !existing.has(u.userId)
        })
    }, [facultyUsers, facultyProfiles, facEditing?.userId])

    async function saveFacultyProfile() {
        const payload: any = {
            userId: str(facUserId),
            employeeNo: str(facEmpNo) || null,
            departmentId: str(facDeptId),
            rank: str(facRank) || null,
            maxUnits: str(facMaxUnits) ? num(facMaxUnits, 0) : null,
            maxHours: str(facMaxHours) ? num(facMaxHours, 0) : null,
            notes: str(facNotes) || null,
        }

        if (!payload.userId || !payload.departmentId) {
            toast.error("Faculty user and department are required for Faculty Profile.")
            return
        }

        try {
            if (facEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, facEditing.$id, payload)
                toast.success("Faculty profile updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, ID.unique(), payload)
                toast.success("Faculty profile created.")
            }
            setFacOpen(false)
            setFacEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save faculty profile.")
        }
    }

    // -----------------------------
    // Sections dialog state (NEW)
    // -----------------------------
    const [secOpen, setSecOpen] = React.useState(false)
    const [secEditing, setSecEditing] = React.useState<SectionDoc | null>(null)

    const [secTermId, setSecTermId] = React.useState("")
    const [secDeptId, setSecDeptId] = React.useState("")
    const [secProgId, setSecProgId] = React.useState<string>("__none__")
    const [secYear, setSecYear] = React.useState<string>("1")
    const [secName, setSecName] = React.useState<string>(SECTION_NAME_OPTIONS[0] || "A")
    const [secStudentCount, setSecStudentCount] = React.useState<string>("")
    const [secActive, setSecActive] = React.useState<boolean>(true)

    React.useEffect(() => {
        if (!secOpen) return

        if (!secEditing) {
            setSecTermId(str(selectedTermId))
            setSecDeptId("")
            setSecProgId("__none__")
            setSecYear("1")
            setSecName(SECTION_NAME_OPTIONS[0] || "A")
            setSecStudentCount("")
            setSecActive(true)
            return
        }

        setSecTermId(str(secEditing.termId))
        setSecDeptId(str(secEditing.departmentId))
        setSecProgId(secEditing.programId ? str(secEditing.programId) : "__none__")
        setSecYear(String(secEditing.yearLevel ?? 1))
        setSecName(str(secEditing.name) || (SECTION_NAME_OPTIONS[0] || "A"))
        setSecStudentCount(secEditing.studentCount != null ? String(secEditing.studentCount) : "")
        setSecActive(Boolean(secEditing.isActive))
    }, [secOpen, secEditing, selectedTermId])

    const programsForSelectedDept = React.useMemo(() => {
        const deptId = str(secDeptId)
        if (!deptId) return []
        return programs
            .filter((p) => str(p.departmentId) === deptId)
            .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`))
    }, [programs, secDeptId])

    async function saveSection() {
        const termId = str(secTermId)
        const departmentId = str(secDeptId)
        const yearLevel = num(secYear, 1)
        const name = str(secName)

        if (!termId) {
            toast.error("Academic term is required for Sections.")
            return
        }
        if (!departmentId) {
            toast.error("Department is required for Sections.")
            return
        }
        if (!Number.isFinite(yearLevel) || yearLevel <= 0) {
            toast.error("Year level must be a valid number.")
            return
        }
        if (!name) {
            toast.error("Section name is required.")
            return
        }
        if (!SECTION_NAME_OPTIONS.includes(name as any)) {
            toast.error(`Invalid section name. Use A-Z or "Others".`)
            return
        }

        const programId = str(secProgId) === "__none__" ? null : str(secProgId)
        const studentCount = str(secStudentCount) ? num(secStudentCount, 0) : null

        const payload: any = {
            termId,
            departmentId,
            programId,
            yearLevel,
            name,
            studentCount,
            isActive: Boolean(secActive),
        }

        // ✅ optional local uniqueness check to avoid duplicate index errors
        const conflict = sections.find((s) => {
            if (secEditing?.$id && s.$id === secEditing.$id) return false
            return (
                str(s.termId) === termId &&
                str(s.departmentId) === departmentId &&
                num(s.yearLevel, 0) === yearLevel &&
                str(s.name).toUpperCase() === name.toUpperCase()
            )
        })

        if (conflict) {
            toast.error(`Section already exists for this term/department/year/name.`)
            return
        }

        try {
            if (secEditing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.SECTIONS, secEditing.$id, payload)
                toast.success("Section updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.SECTIONS, ID.unique(), payload)
                toast.success("Section created.")
            }

            setSecOpen(false)
            setSecEditing(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save section.")
        }
    }

    // -----------------------------
    // DELETE (ShadCN AlertDialog)
    // -----------------------------
    async function confirmDelete() {
        if (!deleteIntent) return

        try {
            if (deleteIntent.type === "department") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, deleteIntent.doc.$id)
                toast.success("Department deleted.")
            }

            if (deleteIntent.type === "program") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROGRAMS, deleteIntent.doc.$id)
                toast.success("Program deleted.")
            }

            if (deleteIntent.type === "subject") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SUBJECTS, deleteIntent.doc.$id)
                toast.success("Subject deleted.")
            }

            if (deleteIntent.type === "faculty") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.FACULTY_PROFILES, deleteIntent.doc.$id)
                toast.success("Faculty profile deleted.")
            }

            // ✅ NEW: delete section
            if (deleteIntent.type === "section") {
                await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SECTIONS, deleteIntent.doc.$id)
                toast.success("Section deleted.")
            }

            setDeleteIntent(null)
            await refreshAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete record.")
        }
    }

    // -----------------------------
    // Filtered lists (search)
    // -----------------------------
    const q = search.trim().toLowerCase()

    const filteredDepartments = React.useMemo(() => {
        if (!q) return departments
        return departments.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(q))
    }, [departments, q])

    const filteredPrograms = React.useMemo(() => {
        if (!q) return programs
        return programs.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q))
    }, [programs, q])

    const filteredSubjects = React.useMemo(() => {
        if (!q) return subjects
        return subjects.filter((s) => `${s.code} ${s.title}`.toLowerCase().includes(q))
    }, [subjects, q])

    const filteredFaculty = React.useMemo(() => {
        if (!q) return facultyProfiles
        return facultyProfiles.filter((f) => {
            const u = facultyUserMap.get(str(f.userId))
            const nameEmail = u ? `${facultyDisplay(u)} ${u.userId}` : ""
            return `${f.userId} ${f.employeeNo ?? ""} ${f.rank ?? ""} ${nameEmail}`.toLowerCase().includes(q)
        })
    }, [facultyProfiles, q, facultyUserMap])

    const visibleSectionsByTerm = React.useMemo(() => {
        const termId = str(selectedTermId)
        if (!termId) return sections
        return sections.filter((s) => str(s.termId) === termId)
    }, [sections, selectedTermId])

    const filteredSections = React.useMemo(() => {
        const base = visibleSectionsByTerm
        if (!q) return base
        return base.filter((s) => {
            const dept = deptLabel(departments, s.departmentId)
            const prog = programLabel(programs, s.programId ?? null)
            const term = termLabel(terms, s.termId)
            const main = `Y${s.yearLevel} ${s.name}`
            return `${main} ${dept} ${prog} ${term} ${s.studentCount ?? ""}`
                .toLowerCase()
                .includes(q)
        })
    }, [visibleSectionsByTerm, q, departments, programs, terms])

    const stats = [
        { label: "Departments", value: departments.length },
        { label: "Programs/Courses", value: programs.length },
        { label: "Subjects", value: subjects.length },
        { label: "Faculty Profiles", value: facultyProfiles.length },
        { label: "Sections", value: sections.length },
    ]

    const deleteTitle =
        deleteIntent?.type === "department"
            ? `Delete Department`
            : deleteIntent?.type === "program"
                ? `Delete Program`
                : deleteIntent?.type === "subject"
                    ? `Delete Subject`
                    : deleteIntent?.type === "faculty"
                        ? `Delete Faculty Profile`
                        : deleteIntent?.type === "section"
                            ? `Delete Section`
                            : "Delete"

    const deleteText =
        deleteIntent?.type === "department"
            ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.name}".`
            : deleteIntent?.type === "program"
                ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.name}".`
                : deleteIntent?.type === "subject"
                    ? `This will permanently delete "${deleteIntent.doc.code} — ${deleteIntent.doc.title}".`
                    : deleteIntent?.type === "faculty"
                        ? `This will permanently delete faculty profile for userId "${deleteIntent.doc.userId}".`
                        : deleteIntent?.type === "section"
                            ? `This will permanently delete section "Y${deleteIntent.doc.yearLevel} ${deleteIntent.doc.name}".`
                            : "This action cannot be undone."

    return (
        <DashboardLayout
            title="Master Data Management"
            subtitle="Maintain core academic records used in scheduling and workload rules."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-6">
                <Alert>
                    <AlertTitle>Master Data</AlertTitle>
                    <AlertDescription>
                        These are system-wide datasets used by schedules, workloads, and validations.
                        Update carefully to avoid breaking references.
                    </AlertDescription>
                </Alert>

                {/* Stats */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {stats.map((s) => (
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
                                    Add, edit, and maintain Departments, Programs, Subjects, Faculty Profiles, and Sections.
                                </CardDescription>
                            </div>

                            <div className="flex items-center gap-2">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search code / name..."
                                    className="sm:w-80"
                                />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
                                <TabsTrigger value="departments">Departments</TabsTrigger>
                                <TabsTrigger value="programs">Programs/Courses</TabsTrigger>
                                <TabsTrigger value="subjects">Subjects</TabsTrigger>
                                <TabsTrigger value="faculty">Faculty Profiles</TabsTrigger>
                                <TabsTrigger value="sections">Sections</TabsTrigger>
                            </TabsList>

                            <Separator className="my-4" />

                            {/* ---------------- DEPARTMENTS ---------------- */}
                            <TabsContent value="departments" className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium">Departments</div>
                                        <div className="text-sm text-muted-foreground">Add/edit department records.</div>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setDeptEditing(null)
                                            setDeptOpen(true)
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Department
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredDepartments.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No departments found.</div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
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
                                                {filteredDepartments.map((d) => (
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
                                                                        setDeptEditing(d)
                                                                        setDeptOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 mr-2" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteIntent({ type: "department", doc: d })}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
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

                                {/* Department Dialog */}
                                <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
                                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                                        <DialogHeader>
                                            <DialogTitle>{deptEditing ? "Edit Department" : "Add Department"}</DialogTitle>
                                            <DialogDescription>
                                                Departments organize Programs, Subjects, and Faculty assignments.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            <div className="grid gap-2">
                                                <Label>Department Code</Label>
                                                <Input
                                                    value={deptCode}
                                                    onChange={(e) => setDeptCode(e.target.value)}
                                                    placeholder="e.g. CCS"
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Department Name</Label>
                                                <Input
                                                    value={deptName}
                                                    onChange={(e) => setDeptName(e.target.value)}
                                                    placeholder="e.g. College of Computing Studies"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={deptActive}
                                                    onCheckedChange={(v) => setDeptActive(Boolean(v))}
                                                    id="dept-active"
                                                />
                                                <Label htmlFor="dept-active">Active</Label>
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setDeptOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void saveDepartment()}>Save</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TabsContent>

                            {/* ---------------- PROGRAMS ---------------- */}
                            <TabsContent value="programs" className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium">Programs / Courses</div>
                                        <div className="text-sm text-muted-foreground">Manage programs handled by departments.</div>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setProgEditing(null)
                                            setProgOpen(true)
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Program
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredPrograms.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No programs found.</div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-32">Code</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="w-72">Department</TableHead>
                                                    <TableHead className="w-24">Active</TableHead>
                                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredPrograms.map((p) => (
                                                    <TableRow key={p.$id}>
                                                        <TableCell className="font-medium">{p.code}</TableCell>
                                                        <TableCell>{p.name}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {deptLabel(departments, p.departmentId)}
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
                                                                        setProgEditing(p)
                                                                        setProgOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 mr-2" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteIntent({ type: "program", doc: p })}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
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

                                {/* Program Dialog */}
                                <Dialog open={progOpen} onOpenChange={setProgOpen}>
                                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                                        <DialogHeader>
                                            <DialogTitle>{progEditing ? "Edit Program" : "Add Program"}</DialogTitle>
                                            <DialogDescription>Programs/Courses belong to a department.</DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            <div className="grid gap-2">
                                                <Label>Department</Label>
                                                <Select value={progDeptId} onValueChange={setProgDeptId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {departments.map((d) => (
                                                            <SelectItem key={d.$id} value={d.$id}>
                                                                {d.code} — {d.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Program Code</Label>
                                                <Input value={progCode} onChange={(e) => setProgCode(e.target.value)} placeholder="e.g. BSIS" />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Program Name</Label>
                                                <Input
                                                    value={progName}
                                                    onChange={(e) => setProgName(e.target.value)}
                                                    placeholder="e.g. BS Information Systems"
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Description (optional)</Label>
                                                <Textarea
                                                    value={progDesc}
                                                    onChange={(e) => setProgDesc(e.target.value)}
                                                    placeholder="Short description..."
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={progActive}
                                                    onCheckedChange={(v) => setProgActive(Boolean(v))}
                                                    id="prog-active"
                                                />
                                                <Label htmlFor="prog-active">Active</Label>
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setProgOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void saveProgram()}>Save</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
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
                                            setSubEditing(null)
                                            setSubOpen(true)
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Subject
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredSubjects.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No subjects found.</div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-40">Code</TableHead>
                                                    <TableHead>Title</TableHead>
                                                    <TableHead className="w-72">Department</TableHead>
                                                    <TableHead className="w-44">Units / Hours</TableHead>
                                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredSubjects.map((s) => (
                                                    <TableRow key={s.$id}>
                                                        <TableCell className="font-medium">{s.code}</TableCell>
                                                        <TableCell>{s.title}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {deptLabel(departments, s.departmentId ?? null)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-xs text-muted-foreground">
                                                                Units: <span className="font-medium text-foreground">{s.units}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Lec {s.lectureHours} / Lab {s.labHours} ={" "}
                                                                <span className="font-medium text-foreground">
                                                                    {num(s.totalHours, s.lectureHours + s.labHours)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSubEditing(s)
                                                                        setSubOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 mr-2" />
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteIntent({ type: "subject", doc: s })}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
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

                                {/* Subject Dialog */}
                                <Dialog open={subOpen} onOpenChange={setSubOpen}>
                                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                                        <DialogHeader>
                                            <DialogTitle>{subEditing ? "Edit Subject" : "Add Subject"}</DialogTitle>
                                            <DialogDescription>Subjects include units and lecture/lab hour breakdown.</DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            <div className="grid gap-2">
                                                <Label>Department (optional)</Label>
                                                <Select
                                                    value={subDeptId || "__none__"}
                                                    onValueChange={(v) => setSubDeptId(v === "__none__" ? "" : v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="No Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">No Department</SelectItem>
                                                        {departments.map((d) => (
                                                            <SelectItem key={d.$id} value={d.$id}>
                                                                {d.code} — {d.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Subject Code</Label>
                                                <Input value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="e.g. IT 101" />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Subject Title</Label>
                                                <Input
                                                    value={subTitle}
                                                    onChange={(e) => setSubTitle(e.target.value)}
                                                    placeholder="e.g. Introduction to Computing"
                                                />
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-3">
                                                <div className="grid gap-2">
                                                    <Label>Units</Label>
                                                    <Input value={subUnits} onChange={(e) => setSubUnits(e.target.value)} inputMode="numeric" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Lecture Hours</Label>
                                                    <Input value={subLec} onChange={(e) => setSubLec(e.target.value)} inputMode="numeric" />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Lab Hours</Label>
                                                    <Input value={subLab} onChange={(e) => setSubLab(e.target.value)} inputMode="numeric" />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={subActive}
                                                    onCheckedChange={(v) => setSubActive(Boolean(v))}
                                                    id="sub-active"
                                                />
                                                <Label htmlFor="sub-active">Active</Label>
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setSubOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void saveSubject()}>Save</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TabsContent>

                            {/* ---------------- FACULTY PROFILES ---------------- */}
                            <TabsContent value="faculty" className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium">Faculty Profiles</div>
                                        <div className="text-sm text-muted-foreground">
                                            Faculty info, rank, and max load rules (if applicable).
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setFacEditing(null)
                                            setFacOpen(true)
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Faculty Profile
                                    </Button>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredFaculty.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No faculty profiles found.</div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Faculty</TableHead>
                                                    <TableHead className="w-64">User ID</TableHead>
                                                    <TableHead className="w-40">Employee No</TableHead>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead className="w-44">Max Load</TableHead>
                                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredFaculty.map((f) => {
                                                    const u = facultyUserMap.get(str(f.userId)) ?? null
                                                    return (
                                                        <TableRow key={f.$id}>
                                                            <TableCell className="font-medium">
                                                                {u ? facultyDisplay(u) : "Unknown faculty"}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">{f.userId}</TableCell>
                                                            <TableCell className="text-muted-foreground">{f.employeeNo || "—"}</TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {deptLabel(departments, f.departmentId)}
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
                                                                            setFacEditing(f)
                                                                            setFacOpen(true)
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-4 w-4 mr-2" />
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => setDeleteIntent({ type: "faculty", doc: f })}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2" />
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

                                {/* Faculty Dialog */}
                                <Dialog open={facOpen} onOpenChange={setFacOpen}>
                                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                                        <DialogHeader>
                                            <DialogTitle>{facEditing ? "Edit Faculty Profile" : "Add Faculty Profile"}</DialogTitle>
                                            <DialogDescription>
                                                Select a Faculty user from USER_PROFILES (role: FACULTY / CHAIR / DEAN) and store rank + optional max load.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            {/* ✅ NEW: Select faculty user (no manual userId input) */}
                                            <div className="grid gap-2">
                                                <Label>Faculty User</Label>

                                                {facEditing ? (
                                                    <div className="grid gap-2">
                                                        <Input value={facUserId} disabled />
                                                        <div className="text-xs text-muted-foreground">
                                                            Faculty User ID cannot be changed once created.
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Select value={facUserId} onValueChange={setFacUserId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Faculty User" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {availableFacultyUsers.length === 0 ? (
                                                                <SelectItem value="__none__" disabled>
                                                                    No available faculty users
                                                                </SelectItem>
                                                            ) : (
                                                                availableFacultyUsers.map((u) => (
                                                                    <SelectItem key={u.$id} value={u.userId}>
                                                                        {facultyDisplay(u)}
                                                                    </SelectItem>
                                                                ))
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                {selectedFacultyUser ? (
                                                    <div className="rounded-md border p-3 text-xs">
                                                        <div className="text-muted-foreground">Selected Faculty</div>
                                                        <div className="mt-1 font-medium">{facultyDisplay(selectedFacultyUser)}</div>
                                                        <div className="mt-1 text-muted-foreground">
                                                            userId:{" "}
                                                            <span className="font-medium text-foreground">{selectedFacultyUser.userId}</span>
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
                                                    value={facEmpNo}
                                                    onChange={(e) => setFacEmpNo(e.target.value)}
                                                    placeholder="e.g. 2025-0012"
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Department</Label>
                                                <Select value={facDeptId} onValueChange={setFacDeptId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {departments.map((d) => (
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
                                                    value={facRank}
                                                    onChange={(e) => setFacRank(e.target.value)}
                                                    placeholder="e.g. Instructor I / Assistant Prof."
                                                />
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label>Max Units (optional)</Label>
                                                    <Input
                                                        value={facMaxUnits}
                                                        onChange={(e) => setFacMaxUnits(e.target.value)}
                                                        inputMode="numeric"
                                                        placeholder="e.g. 18"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Max Hours (optional)</Label>
                                                    <Input
                                                        value={facMaxHours}
                                                        onChange={(e) => setFacMaxHours(e.target.value)}
                                                        inputMode="numeric"
                                                        placeholder="e.g. 24"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Notes (optional)</Label>
                                                <Textarea
                                                    value={facNotes}
                                                    onChange={(e) => setFacNotes(e.target.value)}
                                                    placeholder="Extra rules, remarks, special notes..."
                                                />
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setFacOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void saveFacultyProfile()}>Save</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TabsContent>

                            {/* ---------------- SECTIONS (NEW) ---------------- */}
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
                                            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Academic Term" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {terms.length === 0 ? (
                                                        <SelectItem value="__none__" disabled>
                                                            No academic terms found
                                                        </SelectItem>
                                                    ) : (
                                                        terms.map((t) => (
                                                            <SelectItem key={t.$id} value={t.$id}>
                                                                {termLabel(terms, t.$id)}{t.isActive ? " • Active" : ""}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSecEditing(null)
                                                setSecOpen(true)
                                            }}
                                            disabled={terms.length === 0}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Section
                                        </Button>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="space-y-3">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : terms.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No academic terms found. Create an Academic Term first to manage Sections.
                                    </div>
                                ) : filteredSections.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No sections found for this term.
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-40">Section</TableHead>
                                                    <TableHead className="w-72">Department</TableHead>
                                                    <TableHead>Program (optional)</TableHead>
                                                    <TableHead className="w-32">Students</TableHead>
                                                    <TableHead className="w-24">Active</TableHead>
                                                    <TableHead className="w-40 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredSections
                                                    .slice()
                                                    .sort((a, b) => {
                                                        const left = `${a.departmentId}-${a.yearLevel}-${a.name}`
                                                        const right = `${b.departmentId}-${b.yearLevel}-${b.name}`
                                                        return left.localeCompare(right)
                                                    })
                                                    .map((s) => (
                                                        <TableRow key={s.$id}>
                                                            <TableCell className="font-medium">
                                                                {`Y${s.yearLevel} ${s.name}`}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {deptLabel(departments, s.departmentId)}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {programLabel(programs, s.programId ?? null)}
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
                                                                            setSecEditing(s)
                                                                            setSecOpen(true)
                                                                        }}
                                                                    >
                                                                        <Pencil className="h-4 w-4 mr-2" />
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => setDeleteIntent({ type: "section", doc: s })}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2" />
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

                                {/* Section Dialog */}
                                <Dialog open={secOpen} onOpenChange={setSecOpen}>
                                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                                        <DialogHeader>
                                            <DialogTitle>{secEditing ? "Edit Section" : "Add Section"}</DialogTitle>
                                            <DialogDescription>
                                                Sections are linked to a Term and Department, with year level + name (A-Z / Others).
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-4 py-2">
                                            <div className="grid gap-2">
                                                <Label>Academic Term</Label>
                                                {secEditing ? (
                                                    <div className="grid gap-2">
                                                        <Input value={termLabel(terms, secTermId)} disabled />
                                                        <div className="text-xs text-muted-foreground">
                                                            Term cannot be changed once created (recommended).
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Select value={secTermId} onValueChange={setSecTermId}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Academic Term" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {terms.map((t) => (
                                                                <SelectItem key={t.$id} value={t.$id}>
                                                                    {termLabel(terms, t.$id)}{t.isActive ? " • Active" : ""}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>Department</Label>
                                                <Select value={secDeptId} onValueChange={setSecDeptId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Department" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {departments.map((d) => (
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
                                                    value={secProgId}
                                                    onValueChange={setSecProgId}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="No Program" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">No Program</SelectItem>
                                                        {programsForSelectedDept.map((p) => (
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

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="grid gap-2">
                                                    <Label>Year Level</Label>
                                                    <Select value={secYear} onValueChange={setSecYear}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Year Level" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {YEAR_LEVEL_OPTIONS.map((y) => (
                                                                <SelectItem key={y} value={String(y)}>
                                                                    Year {y}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label>Section Name</Label>
                                                    <Select value={secName} onValueChange={setSecName}>
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
                                                    value={secStudentCount}
                                                    onChange={(e) => setSecStudentCount(e.target.value)}
                                                    inputMode="numeric"
                                                    placeholder="e.g. 35"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={secActive}
                                                    onCheckedChange={(v) => setSecActive(Boolean(v))}
                                                    id="sec-active"
                                                />
                                                <Label htmlFor="sec-active">Active</Label>
                                            </div>
                                        </div>

                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setSecOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={() => void saveSection()}>Save</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* ✅ Delete confirmation */}
                <AlertDialog open={Boolean(deleteIntent)} onOpenChange={(open) => (!open ? setDeleteIntent(null) : null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
                            <AlertDialogDescription>{deleteText} This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void confirmDelete()}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}
