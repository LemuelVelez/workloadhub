/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    Plus,
    RefreshCcw,
    Pencil,
    Trash2,
    DoorOpen,
    Printer,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import RoomSchedulePrintSheet, {
    type RoomSchedulePrintItem,
    type RoomScheduleScope,
} from "@/components/room/room-schedule-print-sheet"
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type RoomDoc = {
    $id: string
    code: string
    name?: string | null
    building?: string | null
    floor?: string | null
    capacity: number
    type: string
    isActive: boolean
}

type AcademicTermDocLite = {
    $id: string
    schoolYear: string
    semester: string
    startDate: string
    endDate: string
    isActive: boolean
    isLocked: boolean
}

type ScheduleVersionLite = {
    $id: string
    termId: string
    departmentId: string
    version: number
    label?: string | null
    status: string
}

type ClassMeetingLite = {
    $id: string
    versionId: string
    classId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    roomId?: string | null
    meetingType?: string | null
    notes?: string | null
}

type ClassLite = {
    $id: string
    sectionId: string
    subjectId: string
    facultyUserId?: string | null
    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null
    remarks?: string | null
}

type SubjectLite = {
    $id: string
    code: string
    title: string
}

type SectionLite = {
    $id: string
    yearLevel: number
    name: string
}

type UserProfileLite = {
    $id: string
    userId: string
    name?: string | null
    email?: string | null
}

type RoomTypeFilter = "ALL" | "LECTURE" | "LAB" | "OTHER"

const DIALOG_CONTENT_CLASS = "sm:max-w-2xl max-h-[75vh] overflow-y-auto"
const PRINT_FILTER_TRIGGER_CLASS = "w-full max-w-none"

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const
const DEFAULT_PRINT_TIME_SLOTS = [
    "8:00-9:00",
    "9:01-10:00",
    "10:01-11:00",
    "11:01-12:00",
    "12:01-1:00",
    "1:01-2:00",
    "2:01-3:00",
    "3:01-4:00",
    "4:01-5:00",
    "5:01-6:00",
    "6:01-7:00",
    "7:01-8:00",
    "8:01-9:00",
] as const

const MORNING_LABEL = "Morning"
const AFTERNOON_LABEL = "Afternoon"
const BOTH_LABEL = "Morning & Afternoon"
const MORNING_END_MINUTES = 12 * 60
const AFTERNOON_START_MINUTES = 13 * 60

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

function typeBadgeVariant(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "default"
    if (v === "LECTURE") return "secondary"
    return "outline"
}

function displayType(t: string) {
    const v = String(t || "").toUpperCase()
    if (v === "LAB") return "Lab"
    if (v === "LECTURE") return "Lecture"
    if (v === "OTHER") return "Other"
    return v || "Other"
}

function displayRoomLabel(room?: RoomDoc | null) {
    if (!room) return "Room"
    return str(room.name) || str(room.code) || "Room"
}

function displayRoomSubLabel(room?: RoomDoc | null) {
    if (!room) return ""
    const primary = str(room.code)
    const secondary = str(room.name)
    if (primary && secondary && primary !== secondary) {
        return `${secondary} (${primary})`
    }
    return secondary || primary
}

function normalizeDayLabel(value: any) {
    const raw = str(value).toLowerCase()
    if (raw.startsWith("mon")) return "Monday"
    if (raw.startsWith("tue")) return "Tuesday"
    if (raw.startsWith("wed")) return "Wednesday"
    if (raw.startsWith("thu")) return "Thursday"
    if (raw.startsWith("fri")) return "Friday"
    return str(value)
}

function parseClockMinutes(value: any) {
    const raw = str(value)
    if (!raw) return Number.POSITIVE_INFINITY

    const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (ampm) {
        let hh = Number(ampm[1])
        const mm = Number(ampm[2])
        const suffix = ampm[3].toUpperCase()
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.POSITIVE_INFINITY
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return Number.POSITIVE_INFINITY
        if (suffix === "AM" && hh === 12) hh = 0
        if (suffix === "PM" && hh !== 12) hh += 12
        return hh * 60 + mm
    }

    const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/)
    if (!timeMatch) return Number.POSITIVE_INFINITY

    const hh = Number(timeMatch[1])
    const mm = Number(timeMatch[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.POSITIVE_INFINITY
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return Number.POSITIVE_INFINITY
    return hh * 60 + mm
}

function formatClockTo12Hour(value: any) {
    const minutes = parseClockMinutes(value)
    if (!Number.isFinite(minutes)) return str(value)

    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const hh24 = Math.floor(normalized / 60)
    const mm = normalized % 60
    const suffix = hh24 >= 12 ? "PM" : "AM"
    const hh12 = hh24 % 12 || 12

    return `${hh12}:${String(mm).padStart(2, "0")} ${suffix}`
}

function scheduleScopeLabel(scope: RoomScheduleScope | "") {
    if (scope === "MORNING") return MORNING_LABEL
    if (scope === "AFTERNOON") return AFTERNOON_LABEL
    if (scope === "BOTH") return BOTH_LABEL
    return ""
}

function inferRoomScheduleScope(startTime: any, endTime: any): RoomScheduleScope | "" {
    const start = parseClockMinutes(startTime)
    const end = parseClockMinutes(endTime)

    if (!Number.isFinite(start) || !Number.isFinite(end)) return ""

    if (end <= MORNING_END_MINUTES) return "MORNING"
    if (start >= AFTERNOON_START_MINUTES) return "AFTERNOON"

    return "BOTH"
}

function resolveRoomScheduleScope(item: RoomSchedulePrintItem): RoomScheduleScope | "" {
    const raw = str(item.groupLabel).toLowerCase()

    if (raw.includes("morning")) return "MORNING"
    if (raw.includes("afternoon")) return "AFTERNOON"
    if (raw.includes("combined") || raw.includes("both")) return "BOTH"

    return inferRoomScheduleScope(item.startTime, item.endTime)
}

function matchesRoomScheduleScope(item: RoomSchedulePrintItem, scheduleScope: RoomScheduleScope) {
    const itemScope = resolveRoomScheduleScope(item)

    if (!itemScope) return scheduleScope === "BOTH"
    if (scheduleScope === "BOTH") return true
    if (scheduleScope === "MORNING") {
        return itemScope === "MORNING" || itemScope === "BOTH"
    }

    return itemScope === "AFTERNOON" || itemScope === "BOTH"
}

function roomSchedulePeriodBadgeVariant(item: RoomSchedulePrintItem) {
    const scope = resolveRoomScheduleScope(item)

    if (scope === "MORNING") return "secondary" as const
    if (scope === "AFTERNOON") return "default" as const

    return "outline" as const
}

function academicTermLabel(term?: AcademicTermDocLite | null) {
    if (!term) return "Select academic term"
    return `${term.semester} • SY ${term.schoolYear}`
}

function sortTermsDesc(a: AcademicTermDocLite, b: AcademicTermDocLite) {
    const aKey = `${a.startDate}|${a.schoolYear}|${a.semester}`
    const bKey = `${b.startDate}|${b.schoolYear}|${b.semester}`
    return bKey.localeCompare(aKey)
}

function buildSectionLabel(section?: SectionLite | null) {
    if (!section) return ""
    const yr = num(section.yearLevel, 0)
    const name = str(section.name)
    if (yr > 0 && name) return `${yr}${name}`
    if (yr > 0) return `${yr}`
    return name
}

function buildPrintablePeriodText(item: RoomSchedulePrintItem) {
    return scheduleScopeLabel(resolveRoomScheduleScope(item))
}

function buildPrintableSubjectLabel(item: RoomSchedulePrintItem) {
    const code = str(item.subjectCode)
    const title = str(item.subjectTitle)

    if (code && title) return `${code} — ${title}`
    return code || title || "—"
}

function buildPrintableSectionText(item: RoomSchedulePrintItem) {
    return str(item.sectionLabel) || "—"
}

function buildPrintableInstructorText(item: RoomSchedulePrintItem) {
    return str(item.facultyName) || "Unassigned Instructor"
}

function buildPrintableTimeText(item: RoomSchedulePrintItem) {
    const start = str(item.displayStartTime) || formatClockTo12Hour(item.startTime)
    const end = str(item.displayEndTime) || formatClockTo12Hour(item.endTime)

    if (start && end) return `${start} - ${end}`
    return `${str(item.startTime)} - ${str(item.endTime)}`
}

function choosePreferredVersions(versions: ScheduleVersionLite[]) {
    const byDepartment = new Map<string, ScheduleVersionLite[]>()

    for (const version of versions) {
        const departmentId = str(version.departmentId) || "__unknown__"
        if (!byDepartment.has(departmentId)) {
            byDepartment.set(departmentId, [])
        }
        byDepartment.get(departmentId)?.push(version)
    }

    const statusRank = (status: string) => {
        const value = str(status).toLowerCase()
        if (value === "active") return 0
        if (value === "locked") return 1
        if (value === "draft") return 2
        if (value === "archived") return 3
        return 9
    }

    const selected: ScheduleVersionLite[] = []

    for (const entry of byDepartment.values()) {
        entry.sort((a, b) => {
            const statusDiff = statusRank(a.status) - statusRank(b.status)
            if (statusDiff !== 0) return statusDiff
            return num(b.version, 0) - num(a.version, 0)
        })

        if (entry[0]) {
            selected.push(entry[0])
        }
    }

    return selected
}

function chunkValues<T>(values: T[], size = 100) {
    const chunks: T[][] = []
    for (let i = 0; i < values.length; i += size) {
        chunks.push(values.slice(i, i + size))
    }
    return chunks
}

async function listDocs(collectionId: string, queries: any[] = []) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries)
    return (res?.documents ?? []) as any[]
}

async function listDocsByField(
    collectionId: string,
    field: string,
    values: string[],
    extraQueries: any[] = []
) {
    const ids = Array.from(new Set(values.map((value) => str(value)).filter(Boolean)))
    if (ids.length === 0) return [] as any[]

    const parts = chunkValues(ids, 100)
    const results: any[] = []

    for (const part of parts) {
        const docs = await listDocs(collectionId, [
            Query.equal(field, part),
            Query.limit(100),
            ...extraQueries,
        ])
        results.push(...docs)
    }

    return results
}

async function fetchRoomPrintableSchedule(params: {
    roomId: string
    termId: string
}) {
    const roomId = str(params.roomId)
    const termId = str(params.termId)

    if (!roomId || !termId) return [] as RoomSchedulePrintItem[]

    const versionDocs = (await listDocs(COLLECTIONS.SCHEDULE_VERSIONS, [
        Query.equal("termId", termId),
        Query.limit(5000),
    ])) as any[]

    const preferredVersions = choosePreferredVersions(
        versionDocs.map(
            (version: any) =>
                ({
                    $id: version.$id,
                    termId: str(version.termId),
                    departmentId: str(version.departmentId),
                    version: num(version.version, 0),
                    label: version.label ?? null,
                    status: str(version.status),
                }) as ScheduleVersionLite
        )
    )

    const versionIds = preferredVersions.map((version) => version.$id).filter(Boolean)
    if (versionIds.length === 0) {
        return [] as RoomSchedulePrintItem[]
    }

    const meetingDocs = (await listDocsByField(
        COLLECTIONS.CLASS_MEETINGS,
        "versionId",
        versionIds,
        [Query.equal("roomId", roomId)]
    )) as any[]

    const meetings = meetingDocs.map(
        (meeting: any) =>
            ({
                $id: meeting.$id,
                versionId: str(meeting.versionId),
                classId: str(meeting.classId),
                dayOfWeek: normalizeDayLabel(meeting.dayOfWeek),
                startTime: str(meeting.startTime),
                endTime: str(meeting.endTime),
                roomId: meeting.roomId ? str(meeting.roomId) : null,
                meetingType: meeting.meetingType ? str(meeting.meetingType) : null,
                notes: meeting.notes ? str(meeting.notes) : null,
            }) as ClassMeetingLite
    )

    const classIds = meetings.map((meeting) => meeting.classId).filter(Boolean)
    const classDocs = (await listDocsByField(COLLECTIONS.CLASSES, "$id", classIds)) as any[]
    const classes = classDocs.map(
        (klass: any) =>
            ({
                $id: klass.$id,
                sectionId: str(klass.sectionId),
                subjectId: str(klass.subjectId),
                facultyUserId: klass.facultyUserId ? str(klass.facultyUserId) : null,
                classCode: klass.classCode ? str(klass.classCode) : null,
                deliveryMode: klass.deliveryMode ? str(klass.deliveryMode) : null,
                status: klass.status ? str(klass.status) : null,
                remarks: klass.remarks ? str(klass.remarks) : null,
            }) as ClassLite
    )

    const classById = new Map(classes.map((klass) => [klass.$id, klass]))

    const subjectIds = classes.map((klass) => klass.subjectId).filter(Boolean)
    const sectionIds = classes.map((klass) => klass.sectionId).filter(Boolean)
    const facultyLookupValues = classes.map((klass) => str(klass.facultyUserId)).filter(Boolean)

    const [subjectDocs, sectionDocs, userDocsByUserId, userDocsByProfileId] = await Promise.all([
        listDocsByField(COLLECTIONS.SUBJECTS, "$id", subjectIds),
        listDocsByField(COLLECTIONS.SECTIONS, "$id", sectionIds),
        listDocsByField(COLLECTIONS.USER_PROFILES, "userId", facultyLookupValues),
        listDocsByField(COLLECTIONS.USER_PROFILES, "$id", facultyLookupValues),
    ])

    const subjectById = new Map<string, SubjectLite>(
        subjectDocs.map((subject: any) => [
            subject.$id,
            {
                $id: subject.$id,
                code: str(subject.code),
                title: str(subject.title),
            } as SubjectLite,
        ])
    )

    const sectionById = new Map<string, SectionLite>(
        sectionDocs.map((section: any) => [
            section.$id,
            {
                $id: section.$id,
                yearLevel: num(section.yearLevel, 0),
                name: str(section.name),
            } as SectionLite,
        ])
    )

    const facultyByLookupId = new Map<string, UserProfileLite>()
    for (const user of [...userDocsByUserId, ...userDocsByProfileId]) {
        const profile = {
            $id: str(user.$id),
            userId: str(user.userId),
            name: user.name ? str(user.name) : null,
            email: user.email ? str(user.email) : null,
        } as UserProfileLite

        if (profile.$id) {
            facultyByLookupId.set(profile.$id, profile)
        }

        if (profile.userId) {
            facultyByLookupId.set(profile.userId, profile)
        }
    }

    const printableItems = meetings.map((meeting) => {
        const klass = classById.get(meeting.classId)
        const subject = klass ? subjectById.get(klass.subjectId) : null
        const section = klass ? sectionById.get(klass.sectionId) : null
        const faculty =
            klass && klass.facultyUserId ? facultyByLookupId.get(str(klass.facultyUserId)) : null

        const facultyName = str(faculty?.name) || str(faculty?.email) || "Unassigned Instructor"
        const subjectCode = str(subject?.code)
        const subjectTitle = str(subject?.title)
        const sectionLabel = buildSectionLabel(section)
        const scheduleScope = inferRoomScheduleScope(meeting.startTime, meeting.endTime)
        const periodLabel = scheduleScopeLabel(scheduleScope)
        const displayStartTime = formatClockTo12Hour(meeting.startTime)
        const displayEndTime = formatClockTo12Hour(meeting.endTime)

        const lineTwoParts = [subjectCode, sectionLabel].filter(Boolean)
        const lineThree = subjectTitle || str(klass?.classCode)

        const contentLines = [
            periodLabel,
            facultyName,
            lineTwoParts.join(" - "),
            lineThree,
        ].filter(Boolean)

        return {
            id: meeting.$id,
            dayOfWeek: meeting.dayOfWeek,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            displayStartTime,
            displayEndTime,
            facultyName,
            subjectCode: subjectCode || null,
            subjectTitle: subjectTitle || null,
            sectionLabel: sectionLabel || null,
            notes: meeting.notes || null,
            groupLabel: periodLabel || null,
            contentLines,
        } as RoomSchedulePrintItem
    })

    printableItems.sort((a, b) => {
        const dayDiff =
            DAY_ORDER.indexOf(normalizeDayLabel(a.dayOfWeek) as (typeof DAY_ORDER)[number]) -
            DAY_ORDER.indexOf(normalizeDayLabel(b.dayOfWeek) as (typeof DAY_ORDER)[number])

        if (dayDiff !== 0) return dayDiff
        return parseClockMinutes(a.startTime) - parseClockMinutes(b.startTime)
    })

    return printableItems
}

export default function AdminRoomsAndFacilitiesPage() {
    const [loading, setLoading] = React.useState(true)

    const [rooms, setRooms] = React.useState<RoomDoc[]>([])
    const [terms, setTerms] = React.useState<AcademicTermDocLite[]>([])

    const [search, setSearch] = React.useState("")
    const [typeFilter, setTypeFilter] = React.useState<RoomTypeFilter>("ALL")
    const [onlyAvailable, setOnlyAvailable] = React.useState(false)

    const [dialogOpen, setDialogOpen] = React.useState(false)
    const [editing, setEditing] = React.useState<RoomDoc | null>(null)

    const [roomCode, setRoomCode] = React.useState("")
    const [roomName, setRoomName] = React.useState("")
    const [roomBuilding, setRoomBuilding] = React.useState("")
    const [roomFloor, setRoomFloor] = React.useState("")
    const [roomCapacity, setRoomCapacity] = React.useState("30")
    const [roomType, setRoomType] = React.useState("LECTURE")
    const [roomAvailable, setRoomAvailable] = React.useState(true)

    const [deleteRoom, setDeleteRoom] = React.useState<RoomDoc | null>(null)

    const [printRoomId, setPrintRoomId] = React.useState("")
    const [printTermId, setPrintTermId] = React.useState("")
    const [printScope, setPrintScope] = React.useState<RoomScheduleScope>("BOTH")
    const [scheduleBusy, setScheduleBusy] = React.useState(false)
    const [printItems, setPrintItems] = React.useState<RoomSchedulePrintItem[]>([])

    const refreshRooms = React.useCallback(async () => {
        setLoading(true)
        try {
            const [roomDocs, termDocs] = await Promise.all([
                listDocs(COLLECTIONS.ROOMS, [Query.orderAsc("code"), Query.limit(2000)]),
                listDocs(COLLECTIONS.ACADEMIC_TERMS, [
                    Query.orderDesc("startDate"),
                    Query.limit(200),
                ]),
            ])

            const nextRooms = roomDocs.map(
                (r: any) =>
                    ({
                        $id: r.$id,
                        code: str(r.code),
                        name: r.name ?? null,
                        building: r.building ?? null,
                        floor: r.floor ?? null,
                        capacity: num(r.capacity, 0),
                        type: str(r.type) || "OTHER",
                        isActive: toBool(r.isActive),
                    }) as RoomDoc
            )

            const nextTerms = termDocs
                .map(
                    (t: any) =>
                        ({
                            $id: t.$id,
                            schoolYear: str(t.schoolYear),
                            semester: str(t.semester),
                            startDate: str(t.startDate),
                            endDate: str(t.endDate),
                            isActive: toBool(t.isActive),
                            isLocked: toBool(t.isLocked),
                        }) as AcademicTermDocLite
                )
                .sort(sortTermsDesc)

            setRooms(nextRooms)
            setTerms(nextTerms)

            setPrintRoomId((current) => {
                if (current && nextRooms.some((room) => room.$id === current)) return current
                return nextRooms[0]?.$id ?? ""
            })

            setPrintTermId((current) => {
                if (current && nextTerms.some((term) => term.$id === current)) return current
                return nextTerms.find((term) => term.isActive)?.$id ?? nextTerms[0]?.$id ?? ""
            })
        } catch (e: any) {
            toast.error(e?.message || "Failed to load rooms.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void refreshRooms()
    }, [refreshRooms])

    React.useEffect(() => {
        if (!dialogOpen) return

        if (!editing) {
            setRoomCode("")
            setRoomName("")
            setRoomBuilding("")
            setRoomFloor("")
            setRoomCapacity("30")
            setRoomType("LECTURE")
            setRoomAvailable(true)
            return
        }

        setRoomCode(editing.code)
        setRoomName(String(editing.name ?? ""))
        setRoomBuilding(String(editing.building ?? ""))
        setRoomFloor(String(editing.floor ?? ""))
        setRoomCapacity(String(editing.capacity ?? 0))
        setRoomType(String(editing.type ?? "OTHER"))
        setRoomAvailable(Boolean(editing.isActive))
    }, [dialogOpen, editing])

    const loadPrintableSchedule = React.useCallback(async () => {
        const roomId = str(printRoomId)
        const termId = str(printTermId)

        if (!roomId || !termId) {
            setPrintItems([])
            return
        }

        setScheduleBusy(true)
        try {
            const nextItems = await fetchRoomPrintableSchedule({ roomId, termId })
            setPrintItems(nextItems)
        } catch (e: any) {
            setPrintItems([])
            toast.error(e?.message || "Failed to load room schedule print data.")
        } finally {
            setScheduleBusy(false)
        }
    }, [printRoomId, printTermId])

    React.useEffect(() => {
        void loadPrintableSchedule()
    }, [loadPrintableSchedule])

    async function saveRoom() {
        const payload: any = {
            code: str(roomCode),
            name: str(roomName) || null,
            building: str(roomBuilding) || null,
            floor: str(roomFloor) || null,
            capacity: num(roomCapacity, 0),
            type: str(roomType) || "OTHER",
            isActive: Boolean(roomAvailable),
        }

        if (!payload.code) {
            toast.error("Room code is required.")
            return
        }

        if (!Number.isFinite(payload.capacity) || payload.capacity <= 0) {
            toast.error("Capacity must be a valid number greater than 0.")
            return
        }

        try {
            if (editing) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROOMS, editing.$id, payload)
                toast.success("Room updated.")
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.ROOMS, ID.unique(), payload)
                toast.success("Room created.")
            }

            setDialogOpen(false)
            setEditing(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save room.")
        }
    }

    async function confirmDelete() {
        if (!deleteRoom) return
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ROOMS, deleteRoom.$id)
            toast.success("Room deleted.")
            setDeleteRoom(null)
            await refreshRooms()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete room.")
        }
    }

    const selectedPrintRoom = React.useMemo(
        () => rooms.find((room) => room.$id === printRoomId) ?? null,
        [rooms, printRoomId]
    )

    const selectedPrintTerm = React.useMemo(
        () => terms.find((term) => term.$id === printTermId) ?? null,
        [terms, printTermId]
    )

    const filteredPrintItems = React.useMemo(
        () => printItems.filter((item) => matchesRoomScheduleScope(item, printScope)),
        [printItems, printScope]
    )

    const uniquePrintInstructors = React.useMemo(
        () =>
            Array.from(
                new Set(
                    filteredPrintItems
                        .map((item) => buildPrintableInstructorText(item))
                        .filter(Boolean)
                )
            ),
        [filteredPrintItems]
    )

    const uniquePrintPeriods = React.useMemo(
        () =>
            Array.from(
                new Set(filteredPrintItems.map((item) => buildPrintablePeriodText(item)).filter(Boolean))
            ),
        [filteredPrintItems]
    )

    const q = search.trim().toLowerCase()

    const filteredRooms = React.useMemo(() => {
        let list = rooms

        if (typeFilter !== "ALL") {
            list = list.filter((r) => String(r.type || "").toUpperCase() === typeFilter)
        }

        if (onlyAvailable) {
            list = list.filter((r) => Boolean(r.isActive))
        }

        if (!q) return list

        return list.filter((r) => {
            const info = `${r.code} ${r.name ?? ""} ${r.building ?? ""} ${r.floor ?? ""} ${r.type}`
            return info.toLowerCase().includes(q)
        })
    }, [rooms, q, typeFilter, onlyAvailable])

    const total = rooms.length
    const availableCount = rooms.filter((r) => r.isActive).length
    const labs = rooms.filter((r) => String(r.type || "").toUpperCase() === "LAB").length
    const lectures = rooms.filter((r) => String(r.type || "").toUpperCase() === "LECTURE").length

    return (
        <DashboardLayout
            title="Rooms & Facilities"
            subtitle="Add or update rooms, manage availability, and export the official room monitoring sheet."
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refreshRooms()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setEditing(null)
                            setDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Room
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 p-6">
                <Alert>
                    <AlertTitle className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" />
                        Rooms & Facilities
                    </AlertTitle>
                    <AlertDescription>
                        Rooms are used in schedules and validations. Mark rooms as{" "}
                        <span className="font-medium">Available</span> to include them in assignments.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{total}</div>
                            <Badge variant="secondary">Total</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Available</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{availableCount}</div>
                            <Badge>Active</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Labs</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{labs}</div>
                            <Badge variant="outline">LAB</Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Lecture Rooms</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-baseline justify-between">
                            <div className="text-2xl font-semibold">{lectures}</div>
                            <Badge variant="secondary">LECTURE</Badge>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                            <div className="min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <Printer className="h-4 w-4" />
                                    Room Schedule Print Sheet
                                </CardTitle>
                                <CardDescription>
                                    Preview and export a room monitoring sheet for Morning, Afternoon,
                                    or combined Morning & Afternoon schedules.
                                </CardDescription>
                            </div>

                            <div className="flex w-full min-w-0 flex-col gap-3 lg:max-w-4xl">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-room">Room</Label>
                                        <Select value={printRoomId} onValueChange={setPrintRoomId}>
                                            <SelectTrigger
                                                id="print-room"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select room" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {rooms.map((room) => (
                                                    <SelectItem key={room.$id} value={room.$id}>
                                                        {displayRoomSubLabel(room)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-term">Academic Term</Label>
                                        <Select value={printTermId} onValueChange={setPrintTermId}>
                                            <SelectTrigger
                                                id="print-term"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select academic term" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {terms.map((term) => (
                                                    <SelectItem key={term.$id} value={term.$id}>
                                                        {academicTermLabel(term)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="print-scope">Schedule</Label>
                                        <Select
                                            value={printScope}
                                            onValueChange={(value) =>
                                                setPrintScope(value as RoomScheduleScope)
                                            }
                                        >
                                            <SelectTrigger
                                                id="print-scope"
                                                className={PRINT_FILTER_TRIGGER_CLASS}
                                            >
                                                <SelectValue placeholder="Select schedule" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MORNING">{MORNING_LABEL}</SelectItem>
                                                <SelectItem value="AFTERNOON">{AFTERNOON_LABEL}</SelectItem>
                                                <SelectItem value="BOTH">{BOTH_LABEL}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {selectedPrintRoom
                                            ? displayRoomSubLabel(selectedPrintRoom)
                                            : "No room selected"}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {selectedPrintTerm
                                            ? academicTermLabel(selectedPrintTerm)
                                            : "No term selected"}
                                    </Badge>
                                    <Badge variant="outline">{scheduleScopeLabel(printScope)}</Badge>
                                    <Badge variant="outline">
                                        {filteredPrintItems.length} schedule block
                                        {filteredPrintItems.length === 1 ? "" : "s"}
                                    </Badge>
                                    <Badge variant="outline">
                                        {uniquePrintInstructors.length} instructor
                                        {uniquePrintInstructors.length === 1 ? "" : "s"}
                                    </Badge>
                                    {uniquePrintPeriods.length > 0 ? (
                                        <Badge variant="outline">
                                            {uniquePrintPeriods.join(" • ")}
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <p className="text-sm text-muted-foreground">
                                The generated PDF follows the official room monitoring layout with aligned
                                top logos, a corrected table header, sign columns, a noon break row,
                                color-coded schedule blocks, visible instructor assignments, selectable
                                morning, afternoon, or combined Morning & Afternoon schedule output,
                                wrapped text blocks, adaptive block sizing, and 12-hour time display.
                            </p>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void loadPrintableSchedule()}
                                    disabled={scheduleBusy || !printRoomId || !printTermId}
                                >
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Refresh Schedule Data
                                </Button>

                                <RoomSchedulePrintSheet
                                    roomLabel={displayRoomLabel(selectedPrintRoom)}
                                    items={printItems}
                                    schoolYear={selectedPrintTerm?.schoolYear ?? ""}
                                    semester={selectedPrintTerm?.semester ?? ""}
                                    timeSlots={[...DEFAULT_PRINT_TIME_SLOTS]}
                                    scheduleScope={printScope}
                                    disabled={scheduleBusy || !printRoomId || !printTermId}
                                />
                            </div>
                        </div>

                        {scheduleBusy ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <div className="rounded-md border bg-muted/20 p-4">
                                {filteredPrintItems.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-sm font-medium">
                                                Loaded printable schedule data
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto rounded-md border bg-background">
                                            <Table className="min-w-245 table-fixed">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-40">Period</TableHead>
                                                        <TableHead className="w-36">Day</TableHead>
                                                        <TableHead className="w-48">Time</TableHead>
                                                        <TableHead>Instructor</TableHead>
                                                        <TableHead>Subject</TableHead>
                                                        <TableHead className="w-28">Section</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredPrintItems.map((item) => (
                                                        <TableRow
                                                            key={
                                                                item.id ||
                                                                `${item.dayOfWeek}-${item.startTime}-${item.endTime}`
                                                            }
                                                        >
                                                            <TableCell className="align-top">
                                                                <Badge
                                                                    variant={roomSchedulePeriodBadgeVariant(item)}
                                                                >
                                                                    {buildPrintablePeriodText(item)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="align-top font-medium">
                                                                {normalizeDayLabel(item.dayOfWeek)}
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="whitespace-normal leading-tight">
                                                                    {buildPrintableTimeText(item)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <div className="space-y-1">
                                                                    <div className="whitespace-normal wrap-break-word font-medium leading-tight">
                                                                        {buildPrintableInstructorText(item)}
                                                                    </div>
                                                                    {str(item.notes) ? (
                                                                        <div className="whitespace-normal wrap-break-word text-xs leading-tight text-muted-foreground">
                                                                            {str(item.notes)}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className="whitespace-normal wrap-break-word leading-tight">
                                                                    {buildPrintableSubjectLabel(item)}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="align-top text-muted-foreground">
                                                                <div className="whitespace-normal wrap-break-word leading-tight">
                                                                    {buildPrintableSectionText(item)}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">
                                        No scheduled classes were found for the selected room, academic term,
                                        and schedule. You can refresh again after schedules are finalized or
                                        switch to another schedule selection.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Manage Rooms</CardTitle>
                                <CardDescription>
                                    Add or update room details used by scheduling and workload rules.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search code / name / building..."
                                    className="sm:w-80"
                                />

                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={onlyAvailable}
                                        onCheckedChange={(v) => setOnlyAvailable(Boolean(v))}
                                        id="only-available"
                                    />
                                    <Label htmlFor="only-available" className="text-sm">
                                        Available only
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <Tabs value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="ALL">All</TabsTrigger>
                                <TabsTrigger value="LECTURE">Lecture</TabsTrigger>
                                <TabsTrigger value="LAB">Lab</TabsTrigger>
                                <TabsTrigger value="OTHER">Other</TabsTrigger>
                            </TabsList>

                            <TabsContent value={typeFilter}>
                                {loading ? (
                                    <div className="space-y-3 pt-4">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredRooms.length === 0 ? (
                                    <div className="pt-4 text-sm text-muted-foreground">
                                        No rooms found.
                                    </div>
                                ) : (
                                    <div className="mt-4 overflow-hidden rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-36">Code</TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead className="w-44">Building/Floor</TableHead>
                                                    <TableHead className="w-28">Capacity</TableHead>
                                                    <TableHead className="w-32">Type</TableHead>
                                                    <TableHead className="w-28">Available</TableHead>
                                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredRooms.map((r) => (
                                                    <TableRow key={r.$id}>
                                                        <TableCell className="font-medium">{r.code}</TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {r.name || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            <div className="text-sm">{r.building || "—"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.floor ? `Floor ${r.floor}` : ""}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{r.capacity}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={typeBadgeVariant(r.type)}>
                                                                {displayType(r.type)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={r.isActive ? "default" : "secondary"}>
                                                                {r.isActive ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEditing(r)
                                                                        setDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>

                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => setDeleteRoom(r)}
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
                        </Tabs>
                    </CardHeader>
                </Card>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className={DIALOG_CONTENT_CLASS}>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Room" : "Add Room"}</DialogTitle>
                            <DialogDescription>
                                Define room details for scheduling and workload capacity checks.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                                <Label>Room Code</Label>
                                <Input
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="e.g. R-101 / LAB-2"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label>Room Name (optional)</Label>
                                <Input
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="e.g. Computer Laboratory 2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Building (optional)</Label>
                                    <Input
                                        value={roomBuilding}
                                        onChange={(e) => setRoomBuilding(e.target.value)}
                                        placeholder="e.g. CCS Building"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Floor (optional)</Label>
                                    <Input
                                        value={roomFloor}
                                        onChange={(e) => setRoomFloor(e.target.value)}
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Capacity</Label>
                                    <Input
                                        value={roomCapacity}
                                        onChange={(e) => setRoomCapacity(e.target.value)}
                                        inputMode="numeric"
                                        placeholder="e.g. 30"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Room Type</Label>
                                    <Select value={roomType} onValueChange={setRoomType}>
                                        <SelectTrigger className={PRINT_FILTER_TRIGGER_CLASS}>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LECTURE">Lecture</SelectItem>
                                            <SelectItem value="LAB">Lab</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={roomAvailable}
                                    onCheckedChange={(v) => setRoomAvailable(Boolean(v))}
                                    id="room-available"
                                />
                                <Label htmlFor="room-available">Available (Active)</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => void saveRoom()}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AlertDialog
                    open={Boolean(deleteRoom)}
                    onOpenChange={(open) => {
                        if (!open) setDeleteRoom(null)
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Room</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete room{" "}
                                <span className="font-medium">{deleteRoom?.code}</span>. This action
                                cannot be undone.
                            </AlertDialogDescription>
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