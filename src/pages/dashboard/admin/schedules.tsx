/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    Clock,
    Eye,
    FileLock2,
    FlaskConical,
    MoreHorizontal,
    Pencil,
    Plus,
    RefreshCcw,
    ShieldCheck,
    ShieldX,
    Trash2,
    UserCircle2,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

type ScheduleStatus = "Draft" | "Active" | "Locked" | "Archived" | (string & {})
type MeetingType = "LECTURE" | "LAB" | "OTHER" | (string & {})

type ScheduleVersionDoc = {
    $id: string
    $createdAt: string
    $updatedAt: string
    termId: string
    departmentId: string
    version: number
    label?: string | null
    status: ScheduleStatus
    createdBy: string
    lockedBy?: string | null
    lockedAt?: string | null
    notes?: string | null
}

type DepartmentDoc = {
    $id: string
    name?: string | null
    code?: string | null
    isActive?: boolean
}

type AcademicTermDoc = {
    $id: string
    schoolYear?: string | null
    semester?: string | null
    startDate?: string | null
    endDate?: string | null
    isActive?: boolean
    isLocked?: boolean
}

type SubjectDoc = {
    $id: string
    departmentId?: string | null
    code?: string | null
    title?: string | null
    units?: number | null
    isActive?: boolean
}

type RoomDoc = {
    $id: string
    code?: string | null
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity?: number | null
    type?: string | null
    isActive?: boolean
}

type SectionDoc = {
    $id: string
    termId: string
    departmentId: string
    yearLevel?: number | null
    name?: string | null
    isActive?: boolean
}

type UserProfileDoc = {
    $id: string
    userId?: string | null
    email?: string | null
    name?: string | null
    role?: string | null
    isActive?: boolean
}

type ClassDoc = {
    $id: string
    versionId: string
    termId: string
    departmentId: string
    programId?: string | null
    sectionId: string
    subjectId: string
    facultyUserId?: string | null
    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null
    remarks?: string | null
}

type ClassMeetingDoc = {
    $id: string
    versionId: string
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType: MeetingType
    notes?: string | null
}

type TabKey = "all" | "Draft" | "Active" | "Locked" | "Archived"
type ConflictType = "room" | "faculty" | "section"

type ConflictFlags = {
    room: boolean
    faculty: boolean
    section: boolean
}

type ScheduleRow = {
    meetingId: string
    classId: string

    versionId: string
    termId: string
    departmentId: string

    dayOfWeek: string
    startTime: string
    endTime: string
    meetingType: MeetingType

    roomId: string
    roomType: string
    roomLabel: string

    sectionId: string
    sectionLabel: string

    subjectId: string
    subjectLabel: string
    subjectUnits: number | null

    facultyUserId: string
    facultyName: string
    manualFaculty: string
    facultyKey: string
    isManualFaculty: boolean

    classCode: string
    deliveryMode: string
    classStatus: string
    classRemarks: string
}

type CandidateConflict = {
    type: ConflictType
    row: ScheduleRow
}

const DAY_OPTIONS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const

const FACULTY_OPTION_NONE = "__none__"
const FACULTY_OPTION_MANUAL = "__manual__"

const MANUAL_FACULTY_TAG_REGEX = /\[\[manualFaculty:(.*?)\]\]/i
const MANUAL_FACULTY_TAG_REMOVE_REGEX = /\s*\[\[manualFaculty:.*?\]\]\s*/gi

function shortId(id: string) {
    if (!id) return ""
    return id.length <= 10 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`
}

function fmtDate(iso?: string | null) {
    if (!iso) return "—"
    try {
        const d = new Date(iso)
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d)
    } catch {
        return "—"
    }
}

function statusBadgeVariant(status: string) {
    const s = String(status || "").toLowerCase()
    if (s === "active") return "default"
    if (s === "locked") return "secondary"
    if (s === "archived") return "outline"
    return "outline" // Draft, unknown
}

function statusIcon(status: string) {
    const s = String(status || "").toLowerCase()
    if (s === "active") return ShieldCheck
    if (s === "locked") return FileLock2
    if (s === "archived") return ShieldX
    return Clock
}

function termLabel(t?: AcademicTermDoc | null) {
    if (!t) return "—"
    const sy = (t.schoolYear || "").trim()
    const sem = (t.semester || "").trim()
    const base = [sy, sem].filter(Boolean).join(" • ")
    const suffix = t.isActive ? " (Active)" : ""
    return (base || t.$id) + suffix
}

function deptLabel(d?: DepartmentDoc | null) {
    if (!d) return "—"
    const code = (d.code || "").trim()
    const name = (d.name || "").trim()
    if (code && name) return `${code} • ${name}`
    return name || code || d.$id
}

function normalizeText(v?: string | null) {
    return String(v || "").trim().toLowerCase()
}

function hhmmToMinutes(v: string) {
    const parts = String(v || "").split(":")
    const hh = Number.parseInt(parts[0] || "0", 10)
    const mm = Number.parseInt(parts[1] || "0", 10)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
    return hh * 60 + mm
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    const aS = hhmmToMinutes(aStart)
    const aE = hhmmToMinutes(aEnd)
    const bS = hhmmToMinutes(bStart)
    const bE = hhmmToMinutes(bEnd)
    return Math.max(aS, bS) < Math.min(aE, bE)
}

function formatTimeRange(start: string, end: string) {
    return `${start || "—"} - ${end || "—"}`
}

function extractManualFaculty(remarks?: string | null) {
    const raw = String(remarks || "")
    const match = raw.match(MANUAL_FACULTY_TAG_REGEX)
    return String(match?.[1] || "").trim()
}

function stripManualFacultyTag(remarks?: string | null) {
    return String(remarks || "").replace(MANUAL_FACULTY_TAG_REMOVE_REGEX, " ").replace(/\s{2,}/g, " ").trim()
}

function composeRemarks(baseRemarks: string, manualFaculty: string) {
    const base = stripManualFacultyTag(baseRemarks)
    const manual = String(manualFaculty || "").trim()
    if (!manual) return base || null
    const tag = `[[manualFaculty:${manual}]]`
    return [base, tag].filter(Boolean).join(" ").trim()
}

function dayOrder(day: string) {
    const idx = DAY_OPTIONS.findIndex((d) => d.toLowerCase() === String(day || "").toLowerCase())
    return idx >= 0 ? idx : 999
}

function roleLooksLikeFaculty(role?: string | null) {
    const r = String(role || "").toLowerCase()
    return r === "faculty" || r === "instructor"
}

function roomTypeLabel(roomType: string) {
    const t = String(roomType || "").toUpperCase()
    if (t === "LAB") return "LAB"
    if (t === "LECTURE") return "LECTURE"
    return t || "OTHER"
}

function meetingTypeLabel(v: string) {
    const t = String(v || "").toUpperCase()
    if (t === "LAB") return "LAB"
    if (t === "LECTURE") return "LECTURE"
    return "OTHER"
}

export default function AdminSchedulesPage() {
    const { user } = useSession()
    const userId = String(user?.$id || user?.id || "").trim()

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [versions, setVersions] = React.useState<ScheduleVersionDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDoc[]>([])
    const [departments, setDepartments] = React.useState<DepartmentDoc[]>([])

    const [tab, setTab] = React.useState<TabKey>("all")
    const [search, setSearch] = React.useState("")

    const [filterTermId, setFilterTermId] = React.useState<string>("all")
    const [filterDeptId, setFilterDeptId] = React.useState<string>("all")

    const [viewOpen, setViewOpen] = React.useState(false)
    const [active, setActive] = React.useState<ScheduleVersionDoc | null>(null)

    const [createOpen, setCreateOpen] = React.useState(false)
    const [createTermId, setCreateTermId] = React.useState<string>("")
    const [createDeptId, setCreateDeptId] = React.useState<string>("")
    const [createLabel, setCreateLabel] = React.useState<string>("")
    const [createNotes, setCreateNotes] = React.useState<string>("")
    const [createSetActive, setCreateSetActive] = React.useState<boolean>(false)
    const [saving, setSaving] = React.useState(false)

    // Schedule planner states
    const [selectedVersionId, setSelectedVersionId] = React.useState<string>("")

    const [subjects, setSubjects] = React.useState<SubjectDoc[]>([])
    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [sections, setSections] = React.useState<SectionDoc[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<UserProfileDoc[]>([])
    const [classes, setClasses] = React.useState<ClassDoc[]>([])
    const [meetings, setMeetings] = React.useState<ClassMeetingDoc[]>([])

    const [entriesLoading, setEntriesLoading] = React.useState(false)
    const [entriesError, setEntriesError] = React.useState<string | null>(null)
    const [showConflictsOnly, setShowConflictsOnly] = React.useState(false)

    const [entryDialogOpen, setEntryDialogOpen] = React.useState(false)
    const [editingRow, setEditingRow] = React.useState<ScheduleRow | null>(null)
    const [entrySaving, setEntrySaving] = React.useState(false)

    const [formSectionId, setFormSectionId] = React.useState("")
    const [formSubjectId, setFormSubjectId] = React.useState("")
    const [formFacultyChoice, setFormFacultyChoice] = React.useState<string>(FACULTY_OPTION_NONE)
    const [formManualFaculty, setFormManualFaculty] = React.useState("")
    const [formRoomId, setFormRoomId] = React.useState("")
    const [formDayOfWeek, setFormDayOfWeek] = React.useState<string>("Monday")
    const [formStartTime, setFormStartTime] = React.useState("07:00")
    const [formEndTime, setFormEndTime] = React.useState("08:00")
    const [formMeetingType, setFormMeetingType] = React.useState<MeetingType>("LECTURE")
    const [formClassCode, setFormClassCode] = React.useState("")
    const [formDeliveryMode, setFormDeliveryMode] = React.useState("")
    const [formRemarks, setFormRemarks] = React.useState("")
    const [formAllowConflictSave, setFormAllowConflictSave] = React.useState(false)

    const [deleteTarget, setDeleteTarget] = React.useState<ScheduleRow | null>(null)
    const [deleting, setDeleting] = React.useState(false)

    const termMap = React.useMemo(() => {
        const m = new Map<string, AcademicTermDoc>()
        terms.forEach((t) => m.set(t.$id, t))
        return m
    }, [terms])

    const deptMap = React.useMemo(() => {
        const m = new Map<string, DepartmentDoc>()
        departments.forEach((d) => m.set(d.$id, d))
        return m
    }, [departments])

    const subjectMap = React.useMemo(() => {
        const m = new Map<string, SubjectDoc>()
        subjects.forEach((s) => m.set(s.$id, s))
        return m
    }, [subjects])

    const roomMap = React.useMemo(() => {
        const m = new Map<string, RoomDoc>()
        rooms.forEach((r) => m.set(r.$id, r))
        return m
    }, [rooms])

    const sectionMap = React.useMemo(() => {
        const m = new Map<string, SectionDoc>()
        sections.forEach((s) => m.set(s.$id, s))
        return m
    }, [sections])

    const facultyNameMap = React.useMemo(() => {
        const m = new Map<string, string>()
        facultyProfiles.forEach((f) => {
            const key = String(f.userId || f.$id || "").trim()
            if (!key) return
            const name = String(f.name || "").trim()
            const email = String(f.email || "").trim()
            m.set(key, name || email || key)
        })
        return m
    }, [facultyProfiles])

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const [vRes, tRes, dRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ACADEMIC_TERMS, [
                    Query.orderDesc("$createdAt"),
                    Query.limit(200),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
                    Query.orderAsc("name"),
                    Query.limit(200),
                ]),
            ])

            const vDocs = (vRes?.documents ?? []) as ScheduleVersionDoc[]
            const tDocs = (tRes?.documents ?? []) as AcademicTermDoc[]
            const dDocs = (dRes?.documents ?? []) as DepartmentDoc[]

            setVersions(vDocs)
            setTerms(tDocs)
            setDepartments(dDocs)

            setSelectedVersionId((prev) => {
                if (prev && vDocs.some((x) => x.$id === prev)) return prev
                const activeFirst = vDocs.find((x) => String(x.status) === "Active")
                return activeFirst?.$id || vDocs[0]?.$id || ""
            })
        } catch (e: any) {
            setError(e?.message || "Failed to load schedules.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void fetchAll()
    }, [fetchAll])

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()

        return versions.filter((v) => {
            const tabOk = tab === "all" ? true : String(v.status) === tab
            if (!tabOk) return false

            const termOk = filterTermId === "all" ? true : String(v.termId) === filterTermId
            if (!termOk) return false

            const deptOk = filterDeptId === "all" ? true : String(v.departmentId) === filterDeptId
            if (!deptOk) return false

            if (!q) return true

            const hay = [
                v.$id,
                v.termId,
                v.departmentId,
                v.label ?? "",
                v.status,
                String(v.version ?? ""),
                v.createdBy ?? "",
                v.notes ?? "",
            ]
                .join(" ")
                .toLowerCase()

            return hay.includes(q)
        })
    }, [versions, tab, search, filterTermId, filterDeptId])

    const stats = React.useMemo(() => {
        const total = versions.length
        const draft = versions.filter((x) => String(x.status) === "Draft").length
        const activeCount = versions.filter((x) => String(x.status) === "Active").length
        const locked = versions.filter((x) => String(x.status) === "Locked").length
        const archived = versions.filter((x) => String(x.status) === "Archived").length
        return { total, draft, active: activeCount, locked, archived }
    }, [versions])

    const openView = (it: ScheduleVersionDoc) => {
        setActive(it)
        setViewOpen(true)
    }

    const nextVersionNumber = React.useMemo(() => {
        if (!createTermId || !createDeptId) return 1
        const list = versions.filter(
            (v) => String(v.termId) === createTermId && String(v.departmentId) === createDeptId
        )
        const max = list.reduce((acc, v) => Math.max(acc, Number(v.version || 0)), 0)
        return max + 1
    }, [versions, createTermId, createDeptId])

    const resetCreateForm = () => {
        setCreateTermId("")
        setCreateDeptId("")
        setCreateLabel("")
        setCreateNotes("")
        setCreateSetActive(false)
    }

    const createVersion = async () => {
        if (!createTermId) {
            toast.error("Please select an Academic Term.")
            return
        }
        if (!createDeptId) {
            toast.error("Please select a College.")
            return
        }
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            const payload: any = {
                termId: createTermId,
                departmentId: createDeptId,
                version: nextVersionNumber,
                label: createLabel.trim() || `Version ${nextVersionNumber}`,
                status: createSetActive ? "Active" : "Draft",
                createdBy: userId,
                notes: createNotes.trim() || null,
            }

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SCHEDULE_VERSIONS,
                ID.unique(),
                payload
            )

            toast.success("Schedule version created")
            setCreateOpen(false)
            resetCreateForm()
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to create schedule version.")
        } finally {
            setSaving(false)
        }
    }

    const setStatus = async (it: ScheduleVersionDoc, next: ScheduleStatus) => {
        if (!it?.$id) return
        if (!userId) {
            toast.error("Missing user session. Please re-login.")
            return
        }

        setSaving(true)
        try {
            // If setting Active: deactivate other Active versions in same term + college
            if (next === "Active") {
                const others = versions.filter(
                    (x) =>
                        x.$id !== it.$id &&
                        String(x.termId) === String(it.termId) &&
                        String(x.departmentId) === String(it.departmentId) &&
                        String(x.status) === "Active"
                )

                for (const o of others) {
                    try {
                        await databases.updateDocument(
                            DATABASE_ID,
                            COLLECTIONS.SCHEDULE_VERSIONS,
                            o.$id,
                            { status: "Draft" }
                        )
                    } catch {
                        // best effort
                    }
                }
            }

            const payload: any = { status: next }

            if (next === "Locked") {
                payload.lockedBy = userId
                payload.lockedAt = new Date().toISOString()
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHEDULE_VERSIONS,
                it.$id,
                payload
            )

            toast.success(`Schedule set to ${next}`)
            setViewOpen(false)
            setActive(null)
            await fetchAll()
        } catch (e: any) {
            toast.error(e?.message || "Failed to update schedule status.")
        } finally {
            setSaving(false)
        }
    }

    const selectedVersion = React.useMemo(
        () => versions.find((v) => v.$id === selectedVersionId) || null,
        [versions, selectedVersionId]
    )

    const fetchScheduleContext = React.useCallback(async () => {
        if (!selectedVersion) {
            setSubjects([])
            setRooms([])
            setSections([])
            setFacultyProfiles([])
            setClasses([])
            setMeetings([])
            setEntriesError(null)
            return
        }

        setEntriesLoading(true)
        setEntriesError(null)

        try {
            const [cRes, mRes, subjRes, roomRes, secRes] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASSES, [
                    Query.equal("versionId", selectedVersion.$id),
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, [
                    Query.equal("versionId", selectedVersion.$id),
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SUBJECTS, [
                    Query.limit(5000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROOMS, [
                    Query.limit(2000),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SECTIONS, [
                    Query.equal("termId", selectedVersion.termId),
                    Query.equal("departmentId", selectedVersion.departmentId),
                    Query.limit(2000),
                ]),
            ])

            let facultyDocs: UserProfileDoc[] = []

            try {
                const fRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.equal("role", "FACULTY"),
                    Query.limit(2000),
                ])
                facultyDocs = (fRes?.documents ?? []) as UserProfileDoc[]
            } catch {
                const fResFallback = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_PROFILES, [
                    Query.limit(2000),
                ])
                facultyDocs = ((fResFallback?.documents ?? []) as UserProfileDoc[]).filter((x) =>
                    roleLooksLikeFaculty(x.role)
                )
            }

            const allSubjects = (subjRes?.documents ?? []) as SubjectDoc[]
            const scopedSubjects = allSubjects
                .filter((s) => {
                    const sid = String(s.departmentId || "").trim()
                    if (!sid) return true
                    return sid === String(selectedVersion.departmentId)
                })
                .sort((a, b) => {
                    const ac = String(a.code || "").toLowerCase()
                    const bc = String(b.code || "").toLowerCase()
                    if (ac !== bc) return ac.localeCompare(bc)
                    return String(a.title || "").localeCompare(String(b.title || ""))
                })

            const scopedRooms = ((roomRes?.documents ?? []) as RoomDoc[])
                .filter((r) => r.isActive !== false)
                .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")))

            const scopedSections = ((secRes?.documents ?? []) as SectionDoc[])
                .filter((s) => s.isActive !== false)
                .sort((a, b) => {
                    const ay = Number(a.yearLevel || 0)
                    const by = Number(b.yearLevel || 0)
                    if (ay !== by) return ay - by
                    return String(a.name || "").localeCompare(String(b.name || ""))
                })

            const scopedFaculty = facultyDocs
                .filter((f) => f.isActive !== false)
                .sort((a, b) =>
                    String(a.name || a.email || a.userId || "").localeCompare(
                        String(b.name || b.email || b.userId || "")
                    )
                )

            setClasses((cRes?.documents ?? []) as ClassDoc[])
            setMeetings((mRes?.documents ?? []) as ClassMeetingDoc[])
            setSubjects(scopedSubjects)
            setRooms(scopedRooms)
            setSections(scopedSections)
            setFacultyProfiles(scopedFaculty)
        } catch (e: any) {
            setEntriesError(e?.message || "Failed to load schedule entries.")
        } finally {
            setEntriesLoading(false)
        }
    }, [selectedVersion])

    React.useEffect(() => {
        void fetchScheduleContext()
    }, [fetchScheduleContext])

    const scheduleRows = React.useMemo<ScheduleRow[]>(() => {
        const classMap = new Map<string, ClassDoc>()
        classes.forEach((c) => classMap.set(c.$id, c))

        const rows: ScheduleRow[] = []

        for (const m of meetings) {
            const c = classMap.get(String(m.classId))
            if (!c) continue

            const subject = subjectMap.get(String(c.subjectId))
            const section = sectionMap.get(String(c.sectionId))
            const room = roomMap.get(String(m.roomId || ""))

            const manualFaculty = extractManualFaculty(c.remarks)
            const facultyUserId = String(c.facultyUserId || "").trim()
            const facultyName = facultyUserId
                ? facultyNameMap.get(facultyUserId) || facultyUserId
                : manualFaculty || "Unassigned"

            const facultyKey = facultyUserId
                ? `uid:${facultyUserId}`
                : manualFaculty
                    ? `manual:${normalizeText(manualFaculty)}`
                    : ""

            const subjectCode = String(subject?.code || "").trim()
            const subjectTitle = String(subject?.title || "").trim()
            const subjectLabel = [subjectCode, subjectTitle].filter(Boolean).join(" • ") || c.subjectId

            const secName = String(section?.name || "").trim()
            const secYear = Number(section?.yearLevel || 0)
            const sectionLabel = secName ? `Y${secYear || "?"} - ${secName}` : c.sectionId

            const roomCode = String(room?.code || "").trim()
            const roomName = String(room?.name || "").trim()
            const roomLabel = [roomCode, roomName].filter(Boolean).join(" • ") || "Unassigned"

            rows.push({
                meetingId: m.$id,
                classId: c.$id,

                versionId: String(c.versionId || m.versionId || ""),
                termId: String(c.termId || ""),
                departmentId: String(c.departmentId || ""),

                dayOfWeek: String(m.dayOfWeek || ""),
                startTime: String(m.startTime || ""),
                endTime: String(m.endTime || ""),
                meetingType: (m.meetingType || "LECTURE") as MeetingType,

                roomId: String(m.roomId || ""),
                roomType: String(room?.type || ""),
                roomLabel,

                sectionId: String(c.sectionId || ""),
                sectionLabel,

                subjectId: String(c.subjectId || ""),
                subjectLabel,
                subjectUnits: subject?.units != null ? Number(subject.units) : null,

                facultyUserId,
                facultyName,
                manualFaculty,
                facultyKey,
                isManualFaculty: !facultyUserId && Boolean(manualFaculty),

                classCode: String(c.classCode || ""),
                deliveryMode: String(c.deliveryMode || ""),
                classStatus: String(c.status || "Planned"),
                classRemarks: stripManualFacultyTag(c.remarks),
            })
        }

        rows.sort((a, b) => {
            const d = dayOrder(a.dayOfWeek) - dayOrder(b.dayOfWeek)
            if (d !== 0) return d

            const ts = hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime)
            if (ts !== 0) return ts

            return a.subjectLabel.localeCompare(b.subjectLabel)
        })

        return rows
    }, [classes, meetings, subjectMap, sectionMap, roomMap, facultyNameMap])

    const conflictFlagsByMeetingId = React.useMemo(() => {
        const map = new Map<string, ConflictFlags>()

        for (const row of scheduleRows) {
            map.set(row.meetingId, {
                room: false,
                faculty: false,
                section: false,
            })
        }

        const mark = (id: string, type: ConflictType) => {
            const current = map.get(id)
            if (!current) return
            current[type] = true
        }

        for (let i = 0; i < scheduleRows.length; i += 1) {
            for (let j = i + 1; j < scheduleRows.length; j += 1) {
                const a = scheduleRows[i]
                const b = scheduleRows[j]

                if (normalizeText(a.dayOfWeek) !== normalizeText(b.dayOfWeek)) continue
                if (!rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue

                if (a.roomId && b.roomId && a.roomId === b.roomId) {
                    mark(a.meetingId, "room")
                    mark(b.meetingId, "room")
                }

                if (a.facultyKey && b.facultyKey && a.facultyKey === b.facultyKey) {
                    mark(a.meetingId, "faculty")
                    mark(b.meetingId, "faculty")
                }

                if (a.sectionId && b.sectionId && a.sectionId === b.sectionId) {
                    mark(a.meetingId, "section")
                    mark(b.meetingId, "section")
                }
            }
        }

        return map
    }, [scheduleRows])

    const conflictedRows = React.useMemo(() => {
        return scheduleRows.filter((r) => {
            const f = conflictFlagsByMeetingId.get(r.meetingId)
            return Boolean(f?.room || f?.faculty || f?.section)
        })
    }, [scheduleRows, conflictFlagsByMeetingId])

    const visibleRows = React.useMemo(() => {
        if (!showConflictsOnly) return scheduleRows
        return conflictedRows
    }, [scheduleRows, conflictedRows, showConflictsOnly])

    const laboratoryRows = React.useMemo(() => {
        return scheduleRows.filter((r) => {
            const mType = meetingTypeLabel(r.meetingType)
            const rType = roomTypeLabel(r.roomType)
            return mType === "LAB" || rType === "LAB"
        })
    }, [scheduleRows])

    const manualFacultySuggestions = React.useMemo(() => {
        const set = new Set<string>()
        for (const r of scheduleRows) {
            const val = String(r.manualFaculty || "").trim()
            if (val) set.add(val)
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [scheduleRows])

    const resetEntryForm = React.useCallback(() => {
        setFormSectionId(sections[0]?.$id || "")
        setFormSubjectId(subjects[0]?.$id || "")
        setFormFacultyChoice(FACULTY_OPTION_NONE)
        setFormManualFaculty("")
        setFormRoomId(rooms[0]?.$id || "")
        setFormDayOfWeek("Monday")
        setFormStartTime("07:00")
        setFormEndTime("08:00")
        setFormMeetingType("LECTURE")
        setFormClassCode("")
        setFormDeliveryMode("")
        setFormRemarks("")
        setFormAllowConflictSave(false)
    }, [sections, subjects, rooms])

    const openCreateEntry = () => {
        setEditingRow(null)
        resetEntryForm()
        setEntryDialogOpen(true)
    }

    const openEditEntry = (row: ScheduleRow) => {
        setEditingRow(row)
        setFormSectionId(row.sectionId || "")
        setFormSubjectId(row.subjectId || "")

        if (row.facultyUserId) {
            setFormFacultyChoice(row.facultyUserId)
            setFormManualFaculty("")
        } else if (row.manualFaculty) {
            setFormFacultyChoice(FACULTY_OPTION_MANUAL)
            setFormManualFaculty(row.manualFaculty)
        } else {
            setFormFacultyChoice(FACULTY_OPTION_NONE)
            setFormManualFaculty("")
        }

        setFormRoomId(row.roomId || "")
        setFormDayOfWeek(row.dayOfWeek || "Monday")
        setFormStartTime(row.startTime || "07:00")
        setFormEndTime(row.endTime || "08:00")
        setFormMeetingType((row.meetingType || "LECTURE") as MeetingType)
        setFormClassCode(row.classCode || "")
        setFormDeliveryMode(row.deliveryMode || "")
        setFormRemarks(row.classRemarks || "")
        setFormAllowConflictSave(false)
        setEntryDialogOpen(true)
    }

    const candidateConflicts = React.useMemo<CandidateConflict[]>(() => {
        if (!entryDialogOpen) return []
        if (!selectedVersion) return []
        if (!formDayOfWeek || !formStartTime || !formEndTime) return []

        const candidateFacultyKey =
            formFacultyChoice === FACULTY_OPTION_MANUAL
                ? formManualFaculty.trim()
                    ? `manual:${normalizeText(formManualFaculty)}`
                    : ""
                : formFacultyChoice === FACULTY_OPTION_NONE
                    ? ""
                    : `uid:${formFacultyChoice}`

        const out: CandidateConflict[] = []

        for (const r of scheduleRows) {
            if (editingRow && r.meetingId === editingRow.meetingId) continue
            if (normalizeText(r.dayOfWeek) !== normalizeText(formDayOfWeek)) continue
            if (!rangesOverlap(r.startTime, r.endTime, formStartTime, formEndTime)) continue

            if (formRoomId && r.roomId && formRoomId === r.roomId) {
                out.push({ type: "room", row: r })
            }

            if (candidateFacultyKey && r.facultyKey && candidateFacultyKey === r.facultyKey) {
                out.push({ type: "faculty", row: r })
            }

            if (formSectionId && r.sectionId && formSectionId === r.sectionId) {
                out.push({ type: "section", row: r })
            }
        }

        return out
    }, [
        entryDialogOpen,
        selectedVersion,
        formDayOfWeek,
        formStartTime,
        formEndTime,
        formRoomId,
        formFacultyChoice,
        formManualFaculty,
        formSectionId,
        scheduleRows,
        editingRow,
    ])

    const candidateConflictCounts = React.useMemo(() => {
        const counts = { room: 0, faculty: 0, section: 0 }
        for (const c of candidateConflicts) {
            counts[c.type] += 1
        }
        return counts
    }, [candidateConflicts])

    const saveEntry = async () => {
        if (!selectedVersion) {
            toast.error("Please select a schedule version first.")
            return
        }

        if (!formSectionId) {
            toast.error("Please select a section.")
            return
        }

        if (!formSubjectId) {
            toast.error("Please select a subject.")
            return
        }

        if (!formRoomId) {
            toast.error("Please select a room.")
            return
        }

        if (!formDayOfWeek) {
            toast.error("Please select a day.")
            return
        }

        if (!formStartTime || !formEndTime) {
            toast.error("Please select both start and end time.")
            return
        }

        const startMin = hhmmToMinutes(formStartTime)
        const endMin = hhmmToMinutes(formEndTime)

        if (startMin >= endMin) {
            toast.error("End time must be later than start time.")
            return
        }

        if (formFacultyChoice === FACULTY_OPTION_MANUAL && !formManualFaculty.trim()) {
            toast.error("Please enter manual faculty name.")
            return
        }

        if (candidateConflicts.length > 0 && !formAllowConflictSave) {
            toast.error("Conflict detected. Resolve conflicts or enable override.")
            return
        }

        setEntrySaving(true)
        try {
            const manualFaculty =
                formFacultyChoice === FACULTY_OPTION_MANUAL ? formManualFaculty.trim() : ""
            const facultyUserId =
                formFacultyChoice === FACULTY_OPTION_NONE || formFacultyChoice === FACULTY_OPTION_MANUAL
                    ? null
                    : formFacultyChoice

            const classPayload: any = {
                versionId: selectedVersion.$id,
                termId: selectedVersion.termId,
                departmentId: selectedVersion.departmentId,
                sectionId: formSectionId,
                subjectId: formSubjectId,
                facultyUserId,
                classCode: formClassCode.trim() || null,
                deliveryMode: formDeliveryMode.trim() || null,
                status: editingRow?.classStatus || "Planned",
                remarks: composeRemarks(formRemarks, manualFaculty),
            }

            if (editingRow) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingRow.classId,
                    classPayload
                )

                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    editingRow.meetingId,
                    {
                        versionId: selectedVersion.$id,
                        classId: editingRow.classId,
                        dayOfWeek: formDayOfWeek,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        roomId: formRoomId || null,
                        meetingType: formMeetingType,
                    }
                )

                toast.success("Schedule entry updated.")
            } else {
                const createdClass = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    ID.unique(),
                    classPayload
                )

                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    ID.unique(),
                    {
                        versionId: selectedVersion.$id,
                        classId: createdClass.$id,
                        dayOfWeek: formDayOfWeek,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        roomId: formRoomId || null,
                        meetingType: formMeetingType,
                    }
                )

                toast.success("Schedule entry created.")
            }

            setEntryDialogOpen(false)
            setEditingRow(null)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save schedule entry.")
        } finally {
            setEntrySaving(false)
        }
    }

    const confirmDeleteEntry = async () => {
        if (!deleteTarget) return

        setDeleting(true)
        try {
            await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.CLASS_MEETINGS,
                deleteTarget.meetingId
            )

            const remainRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, [
                Query.equal("classId", deleteTarget.classId),
                Query.limit(1),
            ])

            const remain = (remainRes?.documents ?? []) as ClassMeetingDoc[]
            if (remain.length === 0) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    deleteTarget.classId
                )
            }

            toast.success("Schedule entry deleted.")
            setDeleteTarget(null)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete schedule entry.")
        } finally {
            setDeleting(false)
        }
    }

    const renderConflictBadges = (flags?: ConflictFlags) => {
        if (!flags || (!flags.room && !flags.faculty && !flags.section)) {
            return <Badge variant="outline">No Conflict</Badge>
        }

        return (
            <div className="flex flex-wrap items-center gap-1">
                {flags.room ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Room
                    </Badge>
                ) : null}
                {flags.faculty ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Faculty
                    </Badge>
                ) : null}
                {flags.section ? (
                    <Badge variant="destructive" className="rounded-lg">
                        Section
                    </Badge>
                ) : null}
            </div>
        )
    }

    const plannerStats = React.useMemo(() => {
        const total = scheduleRows.length
        const conflicts = conflictedRows.length
        const labs = laboratoryRows.length
        return { total, conflicts, labs }
    }, [scheduleRows, conflictedRows, laboratoryRows])

    const versionSelectOptions = React.useMemo(() => {
        return versions
            .slice()
            .sort((a, b) => {
                const ad = new Date(a.$createdAt).getTime()
                const bd = new Date(b.$createdAt).getTime()
                return bd - ad
            })
            .map((v) => {
                const term = termMap.get(String(v.termId))
                const dept = deptMap.get(String(v.departmentId))
                const label = `v${Number(v.version || 0)} • ${v.label || "Untitled"}`
                const meta = `${termLabel(term)} • ${deptLabel(dept)}`
                return {
                    value: v.$id,
                    label: `${label} (${String(v.status)})`,
                    meta,
                }
            })
    }, [versions, termMap, deptMap])

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchAll()}
                disabled={loading || saving}
            >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>

            <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                disabled={loading || saving}
            >
                <Plus className="mr-2 size-4" />
                New Version
            </Button>
        </div>
    )

    return (
        <DashboardLayout
            title="Schedules"
            subtitle="Manage schedule versions, assign faculty/rooms via dropdowns, detect conflicts, and monitor laboratory assignments."
            actions={HeaderActions}
        >
            <div className="space-y-6 p-6">
                {/* Version Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                            <CardDescription>All versions</CardDescription>
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
                            <CardTitle className="text-sm font-medium">Locked</CardTitle>
                            <CardDescription>No edits</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.locked}</CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Archived</CardTitle>
                            <CardDescription>Historical</CardDescription>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">{stats.archived}</CardContent>
                    </Card>
                </div>

                {/* Version List */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle>Schedule Versions</CardTitle>
                        <CardDescription>
                            Filter by term/college, search, and manage version status.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <Tabs
                                value={tab}
                                onValueChange={(v) => setTab(v as TabKey)}
                                className="w-full lg:w-auto"
                            >
                                <TabsList className="grid w-full grid-cols-5 lg:w-auto">
                                    <TabsTrigger value="all">All</TabsTrigger>
                                    <TabsTrigger value="Draft">Draft</TabsTrigger>
                                    <TabsTrigger value="Active">Active</TabsTrigger>
                                    <TabsTrigger value="Locked">Locked</TabsTrigger>
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
                                <div className="mt-3 font-medium">No schedule versions found</div>
                                <div className="text-sm text-muted-foreground">
                                    Try adjusting filters or creating a new version.
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Version</TableHead>
                                            <TableHead>Label</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Term</TableHead>
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
                                                                v{Number(it.version || 0)}
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
                                                        <div className="max-w-md truncate font-medium">
                                                            {it.label || "—"}
                                                        </div>
                                                        {it.notes ? (
                                                            <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                                                                {it.notes}
                                                            </div>
                                                        ) : null}
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant={statusBadgeVariant(String(it.status))}>
                                                            {String(it.status)}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {term ? termLabel(term) : it.termId}
                                                    </TableCell>

                                                    <TableCell className="text-sm">
                                                        {dept ? deptLabel(dept) : it.departmentId}
                                                    </TableCell>

                                                    <TableCell className="text-right text-sm">
                                                        {fmtDate(it.$createdAt)}
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="rounded-xl"
                                                                >
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>

                                                            <DropdownMenuContent align="end" className="w-60">
                                                                <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => setSelectedVersionId(it.$id)}
                                                                >
                                                                    <CalendarDays className="mr-2 size-4" />
                                                                    Use in planner
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem onClick={() => openView(it)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    View details
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Active")}
                                                                    disabled={saving || String(it.status) === "Active"}
                                                                >
                                                                    <ShieldCheck className="mr-2 size-4" />
                                                                    Set Active
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Locked")}
                                                                    disabled={saving || String(it.status) === "Locked"}
                                                                >
                                                                    <FileLock2 className="mr-2 size-4" />
                                                                    Lock
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem
                                                                    onClick={() => void setStatus(it, "Archived")}
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

                {/* Schedule Planner / Conflict Manager */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle>Schedule Planner & Conflict Manager</CardTitle>
                        <CardDescription>
                            Assign subject, faculty (dropdown or manual), and room (dropdown). Detect room/faculty/section conflicts in real time.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* FIXED: responsive layout + min-w-0 wrappers to prevent horizontal overflow */}
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
                            <div className="space-y-1 min-w-0 md:col-span-2 xl:col-span-6">
                                <Label>Schedule Version</Label>
                                <Select
                                    value={selectedVersionId || "__none__"}
                                    onValueChange={(v) => setSelectedVersionId(v === "__none__" ? "" : v)}
                                >
                                    <SelectTrigger className="w-full rounded-xl">
                                        <SelectValue placeholder="Select version for schedule planning" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {versionSelectOptions.length === 0 ? (
                                            <SelectItem value="__none__">No versions available</SelectItem>
                                        ) : (
                                            versionSelectOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label} • {opt.meta}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 min-w-0 xl:col-span-3">
                                <Label>Conflict Filter</Label>
                                <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3">
                                    <Checkbox
                                        id="showConflictsOnly"
                                        checked={showConflictsOnly}
                                        onCheckedChange={(v) => setShowConflictsOnly(Boolean(v))}
                                    />
                                    <Label
                                        htmlFor="showConflictsOnly"
                                        className="cursor-pointer truncate text-sm leading-none"
                                    >
                                        Show conflicts only
                                    </Label>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-end justify-start gap-2 md:justify-end xl:col-span-3">
                                <Button
                                    variant="outline"
                                    className="w-full rounded-xl sm:w-auto"
                                    onClick={() => void fetchScheduleContext()}
                                    disabled={!selectedVersion || entriesLoading || entrySaving}
                                >
                                    <RefreshCcw className="mr-2 size-4" />
                                    Reload Entries
                                </Button>
                                <Button
                                    className="w-full rounded-xl sm:w-auto"
                                    onClick={openCreateEntry}
                                    disabled={!selectedVersion || entriesLoading || entrySaving}
                                >
                                    <Plus className="mr-2 size-4" />
                                    New Entry
                                </Button>
                            </div>
                        </div>

                        {selectedVersion ? (
                            <div className="grid gap-4 md:grid-cols-3">
                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                                        <CardDescription>All class meetings</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-2xl font-semibold">
                                        {plannerStats.total}
                                    </CardContent>
                                </Card>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
                                        <CardDescription>Room / Faculty / Section</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-2xl font-semibold">
                                        {plannerStats.conflicts}
                                    </CardContent>
                                </Card>

                                <Card className="rounded-2xl">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium">Laboratory Entries</CardTitle>
                                        <CardDescription>LAB meeting or LAB room</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-2xl font-semibold">
                                        {plannerStats.labs}
                                    </CardContent>
                                </Card>
                            </div>
                        ) : null}

                        <Separator />

                        {!selectedVersion ? (
                            <div className="rounded-xl border border-dashed p-8 text-center">
                                <div className="mx-auto flex size-10 items-center justify-center rounded-full border">
                                    <CalendarDays className="size-5" />
                                </div>
                                <div className="mt-3 font-medium">Select a schedule version</div>
                                <div className="text-sm text-muted-foreground">
                                    Choose a version above to manage schedule entries and conflict detection.
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
                                    {showConflictsOnly
                                        ? "No conflicts detected for this version."
                                        : "Create your first schedule entry to begin."}
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Day</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead>Faculty</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Conflicts</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleRows.map((row) => {
                                            const flags = conflictFlagsByMeetingId.get(row.meetingId)

                                            return (
                                                <TableRow key={row.meetingId}>
                                                    <TableCell className="font-medium">
                                                        {row.dayOfWeek || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {formatTimeRange(row.startTime, row.endTime)}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="font-medium">{row.subjectLabel}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Units: {row.subjectUnits ?? "—"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{row.sectionLabel}</TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <UserCircle2 className="size-4 text-muted-foreground" />
                                                            <span>{row.facultyName}</span>
                                                            {row.isManualFaculty ? (
                                                                <Badge variant="secondary" className="rounded-lg">
                                                                    Manual
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="font-medium">{row.roomLabel}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {roomTypeLabel(row.roomType)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="rounded-lg">
                                                            {meetingTypeLabel(row.meetingType)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{renderConflictBadges(flags)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="rounded-xl"
                                                                >
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuLabel>Entry Actions</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => openEditEntry(row)}>
                                                                    <Pencil className="mr-2 size-4" />
                                                                    Edit entry
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => setDeleteTarget(row)}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 size-4" />
                                                                    Delete entry
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

                {/* Laboratory assignment visibility */}
                <Card className="rounded-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                            <FlaskConical className="size-5" />
                            Laboratory Assignments
                        </CardTitle>
                        <CardDescription>
                            View who is assigned in laboratories and their scheduled time.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {!selectedVersion ? (
                            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                Select a schedule version to view laboratory assignments.
                            </div>
                        ) : entriesLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-5/6" />
                            </div>
                        ) : laboratoryRows.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No laboratory assignments found for this version.
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Laboratory Room</TableHead>
                                            <TableHead>Day</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Assigned Faculty</TableHead>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>Section</TableHead>
                                            <TableHead>Conflicts</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {laboratoryRows.map((row) => {
                                            const flags = conflictFlagsByMeetingId.get(row.meetingId)
                                            return (
                                                <TableRow key={`lab-${row.meetingId}`}>
                                                    <TableCell className="font-medium">
                                                        {row.roomLabel}
                                                    </TableCell>
                                                    <TableCell>{row.dayOfWeek}</TableCell>
                                                    <TableCell>
                                                        {formatTimeRange(row.startTime, row.endTime)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <UserCircle2 className="size-4 text-muted-foreground" />
                                                            <span>{row.facultyName}</span>
                                                            {row.isManualFaculty ? (
                                                                <Badge variant="secondary" className="rounded-lg">
                                                                    Manual
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{row.subjectLabel}</TableCell>
                                                    <TableCell>{row.sectionLabel}</TableCell>
                                                    <TableCell>{renderConflictBadges(flags)}</TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* View Version Dialog */}
                <Dialog
                    open={viewOpen}
                    onOpenChange={(v) => {
                        if (!v) setActive(null)
                        setViewOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Schedule Version</DialogTitle>
                            <DialogDescription>
                                Review schedule version information and manage status.
                            </DialogDescription>
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
                                            <CardTitle className="text-sm">Version</CardTitle>
                                            <CardDescription>Schedule version number</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-2xl font-semibold">
                                            v{Number(active.version || 0)}
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
                                                {String(active.status)}
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

                                        <Separator />

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Locked By</span>
                                            <span className="font-medium">{active.lockedBy || "—"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Locked At</span>
                                            <span className="font-medium">{fmtDate(active.lockedAt)}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {active.notes ? (
                                    <Card className="rounded-2xl">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm">Notes</CardTitle>
                                            <CardDescription>Admin notes</CardDescription>
                                        </CardHeader>
                                        <CardContent className="text-sm leading-relaxed">
                                            {active.notes}
                                        </CardContent>
                                    </Card>
                                ) : null}

                                {String(active.status) === "Locked" ? (
                                    <Alert>
                                        <AlertTitle>Locked schedule</AlertTitle>
                                        <AlertDescription>
                                            This version is locked. You can still archive it, or set a different
                                            version as active.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                            </div>
                        )}

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setViewOpen(false)}
                                disabled={saving}
                            >
                                Close
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!active || saving || String(active?.status) === "Active"}
                                    onClick={() => active && void setStatus(active, "Active")}
                                >
                                    <CheckCircle2 className="mr-2 size-4" />
                                    Set Active
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={!active || saving || String(active?.status) === "Locked"}
                                    onClick={() => active && void setStatus(active, "Locked")}
                                >
                                    <FileLock2 className="mr-2 size-4" />
                                    Lock
                                </Button>

                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={!active || saving || String(active?.status) === "Archived"}
                                    onClick={() => active && void setStatus(active, "Archived")}
                                >
                                    <ShieldX className="mr-2 size-4" />
                                    Archive
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Version Dialog */}
                <Dialog
                    open={createOpen}
                    onOpenChange={(v) => {
                        if (!v) resetCreateForm()
                        setCreateOpen(v)
                    }}
                >
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create Schedule Version</DialogTitle>
                            <DialogDescription>
                                Create a new schedule version for a specific term and college.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
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

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Label</Label>
                                    <Input
                                        value={createLabel}
                                        onChange={(e) => setCreateLabel(e.target.value)}
                                        placeholder={`Version ${nextVersionNumber}`}
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        If empty, it will default to{" "}
                                        <span className="font-medium">Version {nextVersionNumber}</span>.
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Version Number</Label>
                                    <Input value={`v${nextVersionNumber}`} disabled />
                                    <div className="text-xs text-muted-foreground">
                                        Auto-calculated from existing versions.
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    placeholder="Add notes about what changed in this version..."
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
                                    Set this version as <span className="font-medium">Active</span> after creating
                                </Label>
                            </div>
                        </div>

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                onClick={() => void createVersion()}
                                disabled={saving || !createTermId || !createDeptId}
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
                                        Create Version
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Entry create/edit dialog */}
                <Dialog
                    open={entryDialogOpen}
                    onOpenChange={(v) => {
                        setEntryDialogOpen(v)
                        if (!v) {
                            setEditingRow(null)
                            setFormAllowConflictSave(false)
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingRow ? "Edit Schedule Entry" : "Create Schedule Entry"}
                            </DialogTitle>
                            <DialogDescription>
                                Use dropdowns for section, subject, faculty, and room. Optional manual faculty entry is supported.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Section</Label>
                                    <Select value={formSectionId} onValueChange={setFormSectionId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sections.map((s) => {
                                                const name = String(s.name || "").trim() || s.$id
                                                const y = Number(s.yearLevel || 0)
                                                return (
                                                    <SelectItem key={s.$id} value={s.$id}>
                                                        Y{y || "?"} - {name}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Subject</Label>
                                    <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjects.map((s) => {
                                                const code = String(s.code || "").trim()
                                                const title = String(s.title || "").trim()
                                                const units = s.units != null ? ` (${s.units}u)` : ""
                                                const label = [code, title].filter(Boolean).join(" • ") || s.$id
                                                return (
                                                    <SelectItem key={s.$id} value={s.$id}>
                                                        {label}
                                                        {units}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Faculty / Instructor</Label>
                                    <Select value={formFacultyChoice} onValueChange={setFormFacultyChoice}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select faculty" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={FACULTY_OPTION_NONE}>Unassigned</SelectItem>
                                            <SelectItem value={FACULTY_OPTION_MANUAL}>Manual encode faculty</SelectItem>
                                            {facultyProfiles.map((f) => {
                                                const key = String(f.userId || f.$id || "").trim()
                                                const name = String(f.name || "").trim()
                                                const email = String(f.email || "").trim()
                                                const label = name || email || key
                                                if (!key) return null
                                                return (
                                                    <SelectItem key={key} value={key}>
                                                        {label}
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Room</Label>
                                    <Select value={formRoomId} onValueChange={setFormRoomId}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select room" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rooms.map((r) => {
                                                const code = String(r.code || "").trim()
                                                const name = String(r.name || "").trim()
                                                const rType = roomTypeLabel(String(r.type || ""))
                                                const label = [code, name].filter(Boolean).join(" • ") || r.$id
                                                return (
                                                    <SelectItem key={r.$id} value={r.$id}>
                                                        {label} ({rType})
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {formFacultyChoice === FACULTY_OPTION_MANUAL ? (
                                <div className="space-y-2 rounded-xl border p-3">
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
                                                        className="rounded-lg"
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

                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="space-y-1">
                                    <Label>Day</Label>
                                    <Select value={formDayOfWeek} onValueChange={setFormDayOfWeek}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select day" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DAY_OPTIONS.map((d) => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Start Time</Label>
                                    <Input
                                        type="time"
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>End Time</Label>
                                    <Input
                                        type="time"
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>Meeting Type</Label>
                                    <Select
                                        value={formMeetingType}
                                        onValueChange={(v) => setFormMeetingType(v as MeetingType)}
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LECTURE">LECTURE</SelectItem>
                                            <SelectItem value="LAB">LAB</SelectItem>
                                            <SelectItem value="OTHER">OTHER</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Class Code (optional)</Label>
                                    <Input
                                        value={formClassCode}
                                        onChange={(e) => setFormClassCode(e.target.value)}
                                        placeholder="e.g. CCS-3A-IT-DB1"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label>Delivery Mode (optional)</Label>
                                    <Input
                                        value={formDeliveryMode}
                                        onChange={(e) => setFormDeliveryMode(e.target.value)}
                                        placeholder="e.g. Face-to-face, Hybrid, Online"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label>Remarks (optional)</Label>
                                <Textarea
                                    value={formRemarks}
                                    onChange={(e) => setFormRemarks(e.target.value)}
                                    placeholder="Additional notes..."
                                    className="min-h-20"
                                />
                            </div>

                            {candidateConflicts.length > 0 ? (
                                <Alert variant="destructive">
                                    <AlertTitle className="flex items-center gap-2">
                                        <AlertTriangle className="size-4" />
                                        Conflict detected
                                    </AlertTitle>
                                    <AlertDescription className="space-y-2">
                                        <div className="text-sm">
                                            Room: <span className="font-medium">{candidateConflictCounts.room}</span>{" "}
                                            • Faculty:{" "}
                                            <span className="font-medium">{candidateConflictCounts.faculty}</span> •
                                            Section:{" "}
                                            <span className="font-medium">{candidateConflictCounts.section}</span>
                                        </div>
                                        <ul className="list-disc space-y-1 pl-4 text-xs">
                                            {candidateConflicts.slice(0, 6).map((c, idx) => (
                                                <li key={`${c.type}-${c.row.meetingId}-${idx}`}>
                                                    [{c.type.toUpperCase()}] {c.row.dayOfWeek}{" "}
                                                    {formatTimeRange(c.row.startTime, c.row.endTime)} •{" "}
                                                    {c.row.subjectLabel} • {c.row.sectionLabel} • {c.row.roomLabel}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Checkbox
                                                id="allowConflictSave"
                                                checked={formAllowConflictSave}
                                                onCheckedChange={(v) => setFormAllowConflictSave(Boolean(v))}
                                            />
                                            <Label htmlFor="allowConflictSave" className="cursor-pointer text-sm">
                                                Override and save anyway
                                            </Label>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert>
                                    <AlertTitle>No conflict detected</AlertTitle>
                                    <AlertDescription>
                                        Current entry does not overlap with existing room, faculty, or section schedule.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEntryDialogOpen(false)}
                                disabled={entrySaving}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                onClick={() => void saveEntry()}
                                disabled={entrySaving}
                                className={cn(entrySaving && "opacity-90")}
                            >
                                {entrySaving ? (
                                    <>
                                        <RefreshCcw className="mr-2 size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : editingRow ? (
                                    <>
                                        <Pencil className="mr-2 size-4" />
                                        Update Entry
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 size-4" />
                                        Create Entry
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete entry confirm dialog */}
                <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete schedule entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will remove the selected class meeting. If no meetings remain for the class, the class record will also be removed.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault()
                                    void confirmDeleteEntry()
                                }}
                                disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}
