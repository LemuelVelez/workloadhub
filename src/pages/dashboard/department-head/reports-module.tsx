/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import {
    AlertTriangle,
    CalendarDays,
    Download,
    RefreshCcw,
    DoorOpen,
    Users,
    FileText,
} from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"
import { departmentHeadApi } from "@/api/department-head"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

type AnyRow = Record<string, any>

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function safeNum(v: any) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

function parseTimeToMinutes(t: any) {
    const s = safeStr(t)
    const parts = s.split(":")
    const hh = safeNum(parts[0])
    const mm = safeNum(parts[1])
    return hh * 60 + mm
}

function durationMinutes(start: any, end: any) {
    const a = parseTimeToMinutes(start)
    const b = parseTimeToMinutes(end)
    return Math.max(0, b - a)
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
}

function shortDayLabel(day: any) {
    const d = safeStr(day).toLowerCase()
    if (d.startsWith("mon")) return "Mon"
    if (d.startsWith("tue")) return "Tue"
    if (d.startsWith("wed")) return "Wed"
    if (d.startsWith("thu")) return "Thu"
    if (d.startsWith("fri")) return "Fri"
    if (d.startsWith("sat")) return "Sat"
    if (d.startsWith("sun")) return "Sun"
    return safeStr(day) || "-"
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
    try {
        const blob = new Blob([content], { type: mime })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
    } catch {
        // ignore
    }
}

function csvEscape(v: any) {
    const s = String(v ?? "")
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`
    }
    return s
}

function buildCsv(headers: string[], rows: any[][]) {
    const out: string[] = []
    out.push(headers.map(csvEscape).join(","))
    for (const r of rows) {
        out.push(r.map(csvEscape).join(","))
    }
    return out.join("\n")
}

type ConflictItem = {
    type: "ROOM" | "FACULTY" | "SECTION"
    dayOfWeek: string
    startTime: string
    endTime: string
    roomCode?: string
    facultyName?: string
    sectionName?: string
    aClassLabel: string
    bClassLabel: string
}

function buildClassLabel(args: {
    subjectCode: string
    sectionName: string
    facultyName: string
}) {
    const subject = args.subjectCode || "SUBJ"
    const sec = args.sectionName || "SEC"
    const fac = args.facultyName || "TBA"
    return `${subject} • ${sec} • ${fac}`
}

export default function DepartmentHeadReportsModulePage() {
    const { user } = useSession()

    const [bootLoading, setBootLoading] = React.useState(true)
    const [dataLoading, setDataLoading] = React.useState(false)

    const [activeTerm, setActiveTerm] = React.useState<AnyRow | null>(null)
    const [profile, setProfile] = React.useState<AnyRow | null>(null)

    const [versions, setVersions] = React.useState<AnyRow[]>([])
    const [selectedVersionId, setSelectedVersionId] = React.useState("")

    const [classes, setClasses] = React.useState<AnyRow[]>([])
    const [meetings, setMeetings] = React.useState<AnyRow[]>([])
    const [subjects, setSubjects] = React.useState<AnyRow[]>([])
    const [sections, setSections] = React.useState<AnyRow[]>([])
    const [rooms, setRooms] = React.useState<AnyRow[]>([])
    const [timeBlocks, setTimeBlocks] = React.useState<AnyRow[]>([])

    const [facultyUsers, setFacultyUsers] = React.useState<AnyRow[]>([])
    const [facultyProfiles, setFacultyProfiles] = React.useState<AnyRow[]>([])

    const departmentId = React.useMemo(() => safeStr(profile?.departmentId), [profile])
    const termId = React.useMemo(() => safeStr(activeTerm?.$id), [activeTerm])

    // ----------------------------
    // Bootstrapping (term + profile + versions)
    // ----------------------------
    React.useEffect(() => {
        let alive = true

        async function run() {
            setBootLoading(true)

            try {
                const term = await departmentHeadApi.terms.getActive()
                if (!alive) return
                setActiveTerm(term)

                const userId = safeStr(user?.$id || user?.id || user?.userId)
                const prof = await departmentHeadApi.profiles.getByUserId(userId)
                if (!alive) return
                setProfile(prof)

                const deptId = safeStr(prof?.departmentId)
                const tId = safeStr(term?.$id)

                if (!deptId || !tId) {
                    setVersions([])
                    setSelectedVersionId("")
                    return
                }

                const v = await departmentHeadApi.scheduleVersions.listByTermDepartment(tId, deptId)
                if (!alive) return
                setVersions(Array.isArray(v) ? v : [])

                // prefer Active status version
                const active = (Array.isArray(v) ? v : []).find((x) => safeStr(x?.status) === "Active")
                const latest = (Array.isArray(v) ? v : [])[0]
                const pick = safeStr(active?.$id) || safeStr(latest?.$id) || ""
                setSelectedVersionId(pick)
            } catch (e: any) {
                toast.error(e?.message || "Failed to load report module.")
            } finally {
                if (alive) setBootLoading(false)
            }
        }

        void run()
        return () => {
            alive = false
        }
    }, [user])

    // ----------------------------
    // Load dataset for chosen version
    // ----------------------------
    const reloadData = React.useCallback(async () => {
        if (!termId || !departmentId || !selectedVersionId) return

        setDataLoading(true)
        try {
            const [cls, mts, subs, secs, rms, tbs, fac] = await Promise.all([
                departmentHeadApi.classes.listByVersion(termId, departmentId, selectedVersionId),
                departmentHeadApi.classMeetings.listByVersion(selectedVersionId),
                departmentHeadApi.subjects.listByDepartment(departmentId),
                departmentHeadApi.sections.listByTermDepartment(termId, departmentId),
                departmentHeadApi.rooms.listActive(),
                departmentHeadApi.timeBlocks.listByTerm(termId),
                departmentHeadApi.faculty.listByDepartment(departmentId),
            ])

            setClasses(Array.isArray(cls) ? cls : [])
            setMeetings(Array.isArray(mts) ? mts : [])
            setSubjects(Array.isArray(subs) ? subs : [])
            setSections(Array.isArray(secs) ? secs : [])
            setRooms(Array.isArray(rms) ? rms : [])
            setTimeBlocks(Array.isArray(tbs) ? tbs : [])

            const facUsers = Array.isArray(fac?.users) ? fac.users : []
            const facProfiles = Array.isArray(fac?.profiles) ? fac.profiles : []
            setFacultyUsers(facUsers)
            setFacultyProfiles(facProfiles)
        } catch (e: any) {
            toast.error(e?.message || "Failed to load report data.")
        } finally {
            setDataLoading(false)
        }
    }, [termId, departmentId, selectedVersionId])

    React.useEffect(() => {
        if (!termId || !departmentId || !selectedVersionId) return
        void reloadData()
    }, [termId, departmentId, selectedVersionId, reloadData])

    // ----------------------------
    // Lookups
    // ----------------------------
    const subjectById = React.useMemo(() => {
        const map = new Map<string, AnyRow>()
        for (const s of subjects) {
            const id = safeStr(s?.$id)
            if (id) map.set(id, s)
        }
        return map
    }, [subjects])

    const sectionById = React.useMemo(() => {
        const map = new Map<string, AnyRow>()
        for (const s of sections) {
            const id = safeStr(s?.$id)
            if (id) map.set(id, s)
        }
        return map
    }, [sections])

    const roomById = React.useMemo(() => {
        const map = new Map<string, AnyRow>()
        for (const r of rooms) {
            const id = safeStr(r?.$id)
            if (id) map.set(id, r)
        }
        return map
    }, [rooms])

    const facultyUserById = React.useMemo(() => {
        const map = new Map<string, AnyRow>()
        for (const u of facultyUsers) {
            const id = safeStr(u?.userId || u?.$id || u?.id)
            if (id) map.set(id, u)
        }
        return map
    }, [facultyUsers])

    const facultyProfileByUserId = React.useMemo(() => {
        const map = new Map<string, AnyRow>()
        for (const p of facultyProfiles) {
            const uid = safeStr(p?.userId)
            if (uid) map.set(uid, p)
        }
        return map
    }, [facultyProfiles])

    const meetingsByClassId = React.useMemo(() => {
        const map = new Map<string, AnyRow[]>()
        for (const m of meetings) {
            const cid = safeStr(m?.classId)
            if (!cid) continue
            const list = map.get(cid) ?? []
            list.push(m)
            map.set(cid, list)
        }
        return map
    }, [meetings])

    // ----------------------------
    // Report: Faculty Load Summary
    // ----------------------------
    const facultyLoadRows = React.useMemo(() => {
        const rows: {
            facultyUserId: string
            name: string
            employeeNo: string
            maxUnits: number
            maxHours: number
            classesCount: number
            totalUnits: number
            totalMinutes: number
        }[] = []

        const acc = new Map<
            string,
            {
                classesCount: number
                totalUnits: number
                totalMinutes: number
            }
        >()

        for (const c of classes) {
            const fid = safeStr(c?.facultyUserId)
            if (!fid) continue

            const subj = subjectById.get(safeStr(c?.subjectId))
            const units = safeNum(subj?.units)

            const mm = meetingsByClassId.get(safeStr(c?.$id)) ?? []
            const minutes = mm.reduce((sum, m) => sum + durationMinutes(m?.startTime, m?.endTime), 0)

            const cur = acc.get(fid) ?? { classesCount: 0, totalUnits: 0, totalMinutes: 0 }
            cur.classesCount += 1
            cur.totalUnits += units
            cur.totalMinutes += minutes
            acc.set(fid, cur)
        }

        for (const u of facultyUsers) {
            const fid = safeStr(u?.userId || u?.$id || u?.id)
            if (!fid) continue

            const prof = facultyProfileByUserId.get(fid)
            const stats = acc.get(fid) ?? { classesCount: 0, totalUnits: 0, totalMinutes: 0 }

            rows.push({
                facultyUserId: fid,
                name: safeStr(u?.name) || safeStr(u?.email) || "Faculty",
                employeeNo: safeStr(prof?.employeeNo) || "-",
                maxUnits: safeNum(prof?.maxUnits),
                maxHours: safeNum(prof?.maxHours),
                classesCount: stats.classesCount,
                totalUnits: stats.totalUnits,
                totalMinutes: stats.totalMinutes,
            })
        }

        for (const [fid, stats] of acc.entries()) {
            if (facultyUserById.has(fid)) continue
            rows.push({
                facultyUserId: fid,
                name: "Unknown Faculty",
                employeeNo: "-",
                maxUnits: 0,
                maxHours: 0,
                classesCount: stats.classesCount,
                totalUnits: stats.totalUnits,
                totalMinutes: stats.totalMinutes,
            })
        }

        rows.sort((a, b) => a.name.localeCompare(b.name))
        return rows
    }, [classes, facultyUsers, facultyUserById, facultyProfileByUserId, meetingsByClassId, subjectById])

    // ----------------------------
    // Report: Department Schedule
    // ----------------------------
    const scheduleRows = React.useMemo(() => {
        const out: {
            sectionId: string
            sectionName: string
            subjectCode: string
            subjectTitle: string
            facultyName: string
            dayOfWeek: string
            startTime: string
            endTime: string
            roomCode: string
            meetingType: string
            classId: string
        }[] = []

        const classById = new Map<string, AnyRow>()
        for (const c of classes) {
            const id = safeStr(c?.$id)
            if (id) classById.set(id, c)
        }

        for (const m of meetings) {
            const cid = safeStr(m?.classId)
            const c = classById.get(cid)
            if (!c) continue

            const sec = sectionById.get(safeStr(c?.sectionId))
            const subj = subjectById.get(safeStr(c?.subjectId))

            const fid = safeStr(c?.facultyUserId)
            const fu = facultyUserById.get(fid)

            const rm = roomById.get(safeStr(m?.roomId))

            out.push({
                sectionId: safeStr(c?.sectionId),
                sectionName: sec
                    ? `${safeStr(sec?.yearLevel)}-${safeStr(sec?.name)}`
                    : "Unknown Section",
                subjectCode: safeStr(subj?.code) || "SUBJ",
                subjectTitle: safeStr(subj?.title) || "-",
                facultyName: safeStr(fu?.name) || "TBA",
                dayOfWeek: safeStr(m?.dayOfWeek) || "-",
                startTime: safeStr(m?.startTime) || "-",
                endTime: safeStr(m?.endTime) || "-",
                roomCode: safeStr(rm?.code) || "-",
                meetingType: safeStr(m?.meetingType) || "LECTURE",
                classId: cid,
            })
        }

        out.sort((a, b) => {
            const sec = a.sectionName.localeCompare(b.sectionName)
            if (sec !== 0) return sec
            const day = a.dayOfWeek.localeCompare(b.dayOfWeek)
            if (day !== 0) return day
            return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
        })

        return out
    }, [classes, meetings, sectionById, subjectById, facultyUserById, roomById])

    // ----------------------------
    // Report: Room Utilization
    // ----------------------------
    const roomUtilizationRows = React.useMemo(() => {
        const availByDay = new Map<string, number>()
        for (const tb of timeBlocks) {
            const day = safeStr(tb?.dayOfWeek) || "-"
            const mins = durationMinutes(tb?.startTime, tb?.endTime)
            availByDay.set(day, (availByDay.get(day) ?? 0) + mins)
        }

        const availableWeekMinutes = Array.from(availByDay.values()).reduce((a, b) => a + b, 0)

        const usedByRoomId = new Map<string, number>()
        for (const m of meetings) {
            const rid = safeStr(m?.roomId)
            if (!rid) continue
            const mins = durationMinutes(m?.startTime, m?.endTime)
            usedByRoomId.set(rid, (usedByRoomId.get(rid) ?? 0) + mins)
        }

        const out: {
            roomId: string
            roomCode: string
            type: string
            capacity: number
            usedMinutes: number
            availableMinutes: number
            utilizationPct: number
        }[] = []

        for (const r of rooms) {
            const id = safeStr(r?.$id)
            if (!id) continue
            const used = usedByRoomId.get(id) ?? 0
            const avail = availableWeekMinutes

            const pct = avail > 0 ? Math.min(100, (used / avail) * 100) : 0

            out.push({
                roomId: id,
                roomCode: safeStr(r?.code) || "ROOM",
                type: safeStr(r?.type) || "-",
                capacity: safeNum(r?.capacity),
                usedMinutes: used,
                availableMinutes: avail,
                utilizationPct: pct,
            })
        }

        for (const [rid, used] of usedByRoomId.entries()) {
            const exists = rooms.some((x) => safeStr(x?.$id) === rid)
            if (exists) continue
            const avail = availableWeekMinutes
            const pct = avail > 0 ? Math.min(100, (used / avail) * 100) : 0
            out.push({
                roomId: rid,
                roomCode: "Unknown Room",
                type: "-",
                capacity: 0,
                usedMinutes: used,
                availableMinutes: avail,
                utilizationPct: pct,
            })
        }

        out.sort((a, b) => b.utilizationPct - a.utilizationPct)
        return out
    }, [rooms, meetings, timeBlocks])

    // ----------------------------
    // Report: Conflicts
    // ----------------------------
    const conflicts = React.useMemo<ConflictItem[]>(() => {
        const out: ConflictItem[] = []

        const classById = new Map<string, AnyRow>()
        for (const c of classes) {
            const id = safeStr(c?.$id)
            if (id) classById.set(id, c)
        }

        const getLabels = (classId: string) => {
            const c = classById.get(classId)
            if (!c) {
                return {
                    subjectCode: "SUBJ",
                    sectionName: "SEC",
                    facultyName: "TBA",
                }
            }

            const subj = subjectById.get(safeStr(c?.subjectId))
            const sec = sectionById.get(safeStr(c?.sectionId))

            const fid = safeStr(c?.facultyUserId)
            const fu = facultyUserById.get(fid)

            return {
                subjectCode: safeStr(subj?.code) || "SUBJ",
                sectionName: sec
                    ? `${safeStr(sec?.yearLevel)}-${safeStr(sec?.name)}`
                    : "SEC",
                facultyName: safeStr(fu?.name) || "TBA",
            }
        }

        const roomCode = (roomId: string) => {
            const r = roomById.get(roomId)
            return safeStr(r?.code) || "-"
        }

        // group for room conflicts: key = day + roomId
        const roomGroups = new Map<string, AnyRow[]>()
        for (const m of meetings) {
            const rid = safeStr(m?.roomId)
            const day = safeStr(m?.dayOfWeek)
            if (!rid || !day) continue
            const groupKey = `${day}::${rid}`
            const list = roomGroups.get(groupKey) ?? []
            list.push(m)
            roomGroups.set(groupKey, list)
        }

        // ✅ FIXED: removed unused "key"
        for (const list of roomGroups.values()) {
            const sorted = [...list].sort(
                (a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime)
            )

            for (let i = 0; i < sorted.length - 1; i++) {
                const A = sorted[i]
                const B = sorted[i + 1]

                const aStart = parseTimeToMinutes(A?.startTime)
                const aEnd = parseTimeToMinutes(A?.endTime)
                const bStart = parseTimeToMinutes(B?.startTime)
                const bEnd = parseTimeToMinutes(B?.endTime)

                if (!overlaps(aStart, aEnd, bStart, bEnd)) continue

                const day = safeStr(A?.dayOfWeek) || "-"
                const roomId = safeStr(A?.roomId)

                const aCid = safeStr(A?.classId)
                const bCid = safeStr(B?.classId)

                const aMeta = getLabels(aCid)
                const bMeta = getLabels(bCid)

                out.push({
                    type: "ROOM",
                    dayOfWeek: day,
                    startTime: safeStr(A?.startTime),
                    endTime: safeStr(A?.endTime),
                    roomCode: roomCode(roomId),
                    aClassLabel: buildClassLabel(aMeta),
                    bClassLabel: buildClassLabel(bMeta),
                })
            }
        }

        // faculty conflicts: key = day + facultyUserId
        const facultyGroups = new Map<string, AnyRow[]>()
        for (const m of meetings) {
            const c = classById.get(safeStr(m?.classId))
            if (!c) continue

            const fid = safeStr(c?.facultyUserId)
            const day = safeStr(m?.dayOfWeek)
            if (!fid || !day) continue

            const groupKey = `${day}::${fid}`
            const list = facultyGroups.get(groupKey) ?? []
            list.push(m)
            facultyGroups.set(groupKey, list)
        }

        // ✅ FIXED: removed unused "key"
        for (const list of facultyGroups.values()) {
            const sorted = [...list].sort(
                (a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime)
            )

            for (let i = 0; i < sorted.length - 1; i++) {
                const A = sorted[i]
                const B = sorted[i + 1]

                const aStart = parseTimeToMinutes(A?.startTime)
                const aEnd = parseTimeToMinutes(A?.endTime)
                const bStart = parseTimeToMinutes(B?.startTime)
                const bEnd = parseTimeToMinutes(B?.endTime)

                if (!overlaps(aStart, aEnd, bStart, bEnd)) continue

                const aCid = safeStr(A?.classId)
                const bCid = safeStr(B?.classId)

                if (aCid && bCid && aCid === bCid) continue

                const aMeta = getLabels(aCid)
                const bMeta = getLabels(bCid)

                out.push({
                    type: "FACULTY",
                    dayOfWeek: safeStr(A?.dayOfWeek) || "-",
                    startTime: safeStr(A?.startTime),
                    endTime: safeStr(A?.endTime),
                    facultyName: aMeta.facultyName || "Faculty",
                    aClassLabel: buildClassLabel(aMeta),
                    bClassLabel: buildClassLabel(bMeta),
                })
            }
        }

        // section conflicts (same section, same day)
        const sectionGroups = new Map<string, AnyRow[]>()
        for (const m of meetings) {
            const c = classById.get(safeStr(m?.classId))
            if (!c) continue

            const secId = safeStr(c?.sectionId)
            const day = safeStr(m?.dayOfWeek)
            if (!secId || !day) continue

            const groupKey = `${day}::${secId}`
            const list = sectionGroups.get(groupKey) ?? []
            list.push(m)
            sectionGroups.set(groupKey, list)
        }

        // ✅ FIXED: removed unused "key"
        for (const list of sectionGroups.values()) {
            const sorted = [...list].sort(
                (a, b) => parseTimeToMinutes(a?.startTime) - parseTimeToMinutes(b?.startTime)
            )

            for (let i = 0; i < sorted.length - 1; i++) {
                const A = sorted[i]
                const B = sorted[i + 1]

                const aStart = parseTimeToMinutes(A?.startTime)
                const aEnd = parseTimeToMinutes(A?.endTime)
                const bStart = parseTimeToMinutes(B?.startTime)
                const bEnd = parseTimeToMinutes(B?.endTime)

                if (!overlaps(aStart, aEnd, bStart, bEnd)) continue

                const aCid = safeStr(A?.classId)
                const bCid = safeStr(B?.classId)
                if (aCid && bCid && aCid === bCid) continue

                const aMeta = getLabels(aCid)
                const bMeta = getLabels(bCid)

                out.push({
                    type: "SECTION",
                    dayOfWeek: safeStr(A?.dayOfWeek) || "-",
                    startTime: safeStr(A?.startTime),
                    endTime: safeStr(A?.endTime),
                    sectionName: aMeta.sectionName || "Section",
                    aClassLabel: buildClassLabel(aMeta),
                    bClassLabel: buildClassLabel(bMeta),
                })
            }
        }

        const typeOrder = (t: ConflictItem["type"]) => {
            if (t === "ROOM") return 0
            if (t === "FACULTY") return 1
            return 2
        }

        out.sort((a, b) => {
            const t = typeOrder(a.type) - typeOrder(b.type)
            if (t !== 0) return t
            const d = a.dayOfWeek.localeCompare(b.dayOfWeek)
            if (d !== 0) return d
            return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
        })

        return out
    }, [classes, meetings, subjectById, sectionById, facultyUserById, roomById])

    // ----------------------------
    // UI filters + export
    // ----------------------------
    const [facultySearch, setFacultySearch] = React.useState("")
    const [scheduleSectionFilter, setScheduleSectionFilter] = React.useState<string>("all")
    const [roomSearch, setRoomSearch] = React.useState("")
    const [conflictSearch, setConflictSearch] = React.useState("")

    const filteredFacultyLoad = React.useMemo(() => {
        const q = safeStr(facultySearch).toLowerCase()
        if (!q) return facultyLoadRows
        return facultyLoadRows.filter((x) => x.name.toLowerCase().includes(q))
    }, [facultyLoadRows, facultySearch])

    const filteredScheduleRows = React.useMemo(() => {
        if (scheduleSectionFilter === "all") return scheduleRows
        return scheduleRows.filter((x) => safeStr(x.sectionId) === scheduleSectionFilter)
    }, [scheduleRows, scheduleSectionFilter])

    const filteredRooms = React.useMemo(() => {
        const q = safeStr(roomSearch).toLowerCase()
        if (!q) return roomUtilizationRows
        return roomUtilizationRows.filter((r) => r.roomCode.toLowerCase().includes(q))
    }, [roomUtilizationRows, roomSearch])

    const filteredConflicts = React.useMemo(() => {
        const q = safeStr(conflictSearch).toLowerCase()
        if (!q) return conflicts
        return conflicts.filter((c) => {
            const bag = [
                c.type,
                c.dayOfWeek,
                c.startTime,
                c.endTime,
                c.roomCode,
                c.facultyName,
                c.sectionName,
                c.aClassLabel,
                c.bClassLabel,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return bag.includes(q)
        })
    }, [conflicts, conflictSearch])

    const selectedVersion = React.useMemo(() => {
        return versions.find((v) => safeStr(v?.$id) === selectedVersionId) ?? null
    }, [versions, selectedVersionId])

    function exportFacultySummaryCsv() {
        const headers = [
            "Faculty",
            "Employee No",
            "Classes",
            "Total Units",
            "Weekly Hours",
            "Max Units",
            "Max Hours",
        ]

        const rows = filteredFacultyLoad.map((r) => [
            r.name,
            r.employeeNo,
            r.classesCount,
            r.totalUnits,
            (r.totalMinutes / 60).toFixed(2),
            r.maxUnits || "",
            r.maxHours || "",
        ])

        const csv = buildCsv(headers, rows)
        downloadTextFile("faculty-load-summary.csv", csv, "text/csv;charset=utf-8")
        toast.success("Exported Faculty Load Summary CSV")
    }

    function exportRoomUtilizationCsv() {
        const headers = [
            "Room",
            "Type",
            "Capacity",
            "Used Hours",
            "Available Hours",
            "Utilization %",
        ]

        const rows = filteredRooms.map((r) => [
            r.roomCode,
            r.type,
            r.capacity,
            (r.usedMinutes / 60).toFixed(2),
            (r.availableMinutes / 60).toFixed(2),
            r.utilizationPct.toFixed(1),
        ])

        const csv = buildCsv(headers, rows)
        downloadTextFile("room-utilization.csv", csv, "text/csv;charset=utf-8")
        toast.success("Exported Room Utilization CSV")
    }

    function exportConflictsCsv() {
        const headers = [
            "Type",
            "Day",
            "Start",
            "End",
            "Room",
            "Faculty",
            "Section",
            "Class A",
            "Class B",
        ]

        const rows = filteredConflicts.map((c) => [
            c.type,
            c.dayOfWeek,
            c.startTime,
            c.endTime,
            c.roomCode ?? "",
            c.facultyName ?? "",
            c.sectionName ?? "",
            c.aClassLabel,
            c.bClassLabel,
        ])

        const csv = buildCsv(headers, rows)
        downloadTextFile("conflicts-report.csv", csv, "text/csv;charset=utf-8")
        toast.success("Exported Conflicts CSV")
    }

    // ----------------------------
    // Header meta
    // ----------------------------
    const termLabel = React.useMemo(() => {
        const sy = safeStr(activeTerm?.schoolYear)
        const sem = safeStr(activeTerm?.semester)
        if (!sy && !sem) return "No active term"
        return [sy, sem].filter(Boolean).join(" • ")
    }, [activeTerm])

    if (bootLoading) {
        return (
            <DashboardLayout title="Reports Module" subtitle="Loading reports…">
                <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-56 w-full" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout
            title="Reports Module"
            subtitle="Faculty loads, schedules, rooms, and conflicts."
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void reloadData()}
                        disabled={dataLoading || !selectedVersionId}
                        className="gap-2"
                    >
                        <RefreshCcw className={cn("h-4 w-4", dataLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="p-6 space-y-4">
                <Card>
                    <CardHeader className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Reports Overview
                                </CardTitle>
                                <CardDescription>
                                    Use the filters below then export reports as CSV.
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Badge variant="secondary" className="w-fit gap-2">
                                    <CalendarDays className="h-4 w-4" />
                                    {termLabel}
                                </Badge>

                                {selectedVersion ? (
                                    <Badge
                                        variant={
                                            safeStr(selectedVersion?.status) === "Active"
                                                ? "default"
                                                : "outline"
                                        }
                                        className="w-fit"
                                    >
                                        {safeStr(selectedVersion?.status) || "Draft"} • v
                                        {safeNum(selectedVersion?.version) || 0}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">No Version</Badge>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2">
                                <div className="text-sm font-medium">Schedule Version</div>
                                <Select
                                    value={selectedVersionId}
                                    onValueChange={(v) => setSelectedVersionId(v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select schedule version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(versions ?? []).map((v) => {
                                            const id = safeStr(v?.$id)
                                            const ver = safeNum(v?.version) || 0
                                            const status = safeStr(v?.status) || "Draft"
                                            const label = safeStr(v?.label)
                                            const title = label
                                                ? `${label} (v${ver}) • ${status}`
                                                : `Version ${ver} • ${status}`

                                            return (
                                                <SelectItem key={id} value={id}>
                                                    {title}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                                <div className="text-xs text-muted-foreground">
                                    Switching version reloads the report dataset.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Department</div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="w-fit">
                                        {departmentId ? departmentId : "No department assigned"}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Based on your user profile.
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Dataset</div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="gap-2">
                                        <Users className="h-4 w-4" />
                                        Faculty: {facultyUsers.length}
                                    </Badge>
                                    <Badge variant="secondary" className="gap-2">
                                        <DoorOpen className="h-4 w-4" />
                                        Rooms: {rooms.length}
                                    </Badge>
                                    <Badge variant="secondary" className="gap-2">
                                        <CalendarDays className="h-4 w-4" />
                                        Meetings: {meetings.length}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Loaded from Appwrite TablesDB.
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Tabs defaultValue="faculty-load" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                        <TabsTrigger value="faculty-load">Faculty Load</TabsTrigger>
                        <TabsTrigger value="dept-schedule">Department Schedule</TabsTrigger>
                        <TabsTrigger value="room-utilization">Room Utilization</TabsTrigger>
                        <TabsTrigger value="conflicts">Conflicts/Changes</TabsTrigger>
                    </TabsList>

                    {/* ---------------- Faculty Load ---------------- */}
                    <TabsContent value="faculty-load" className="mt-4 space-y-3">
                        <Card>
                            <CardHeader className="space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            Faculty Load Summary
                                        </CardTitle>
                                        <CardDescription>
                                            Total units and weekly hours per faculty member.
                                        </CardDescription>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="gap-2"
                                            onClick={exportFacultySummaryCsv}
                                            disabled={filteredFacultyLoad.length === 0}
                                        >
                                            <Download className="h-4 w-4" />
                                            Export CSV
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Input
                                        placeholder="Search faculty name…"
                                        value={facultySearch}
                                        onChange={(e) => setFacultySearch(e.target.value)}
                                        className="sm:max-w-md"
                                    />
                                    <Badge variant="secondary" className="w-fit">
                                        Rows: {filteredFacultyLoad.length}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {dataLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredFacultyLoad.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No faculty load data found for this version.
                                    </div>
                                ) : (
                                    <div className="w-full overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Faculty</TableHead>
                                                    <TableHead>Employee No</TableHead>
                                                    <TableHead className="text-right">
                                                        Classes
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Units
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Weekly Hours
                                                    </TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredFacultyLoad.map((r) => {
                                                    const hours = r.totalMinutes / 60
                                                    const overUnits =
                                                        r.maxUnits > 0 && r.totalUnits > r.maxUnits
                                                    const overHours =
                                                        r.maxHours > 0 && hours > r.maxHours

                                                    const status =
                                                        overUnits || overHours
                                                            ? "Overload"
                                                            : r.classesCount === 0
                                                                ? "No Load"
                                                                : "OK"

                                                    const pct =
                                                        r.maxHours > 0
                                                            ? Math.min(100, (hours / r.maxHours) * 100)
                                                            : 0

                                                    return (
                                                        <TableRow key={r.facultyUserId}>
                                                            <TableCell className="min-w-56">
                                                                <div className="font-medium">
                                                                    {r.name}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    ID: {r.facultyUserId}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>{r.employeeNo}</TableCell>

                                                            <TableCell className="text-right">
                                                                {r.classesCount}
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                {r.totalUnits}
                                                                {r.maxUnits > 0 ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {" "}
                                                                        / {r.maxUnits}
                                                                    </span>
                                                                ) : null}
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                <div className="space-y-1">
                                                                    <div>
                                                                        {hours.toFixed(2)}
                                                                        {r.maxHours > 0 ? (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {" "}
                                                                                / {r.maxHours}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    {r.maxHours > 0 ? (
                                                                        <Progress value={pct} />
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell>
                                                                <Badge
                                                                    variant={
                                                                        status === "Overload"
                                                                            ? "destructive"
                                                                            : status === "No Load"
                                                                                ? "secondary"
                                                                                : "default"
                                                                    }
                                                                >
                                                                    {status}
                                                                </Badge>
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
                    </TabsContent>

                    {/* ---------------- Department Schedule ---------------- */}
                    <TabsContent value="dept-schedule" className="mt-4 space-y-3">
                        <Card>
                            <CardHeader className="space-y-2">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5" />
                                        Department Schedule Report
                                    </CardTitle>
                                    <CardDescription>
                                        View the final schedule by section for the selected version.
                                    </CardDescription>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-2">
                                        <div className="text-sm font-medium">Section Filter</div>
                                        <Select
                                            value={scheduleSectionFilter}
                                            onValueChange={(v) => setScheduleSectionFilter(v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All sections" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sections</SelectItem>
                                                {sections.map((s) => {
                                                    const id = safeStr(s?.$id)
                                                    const name = `${safeNum(s?.yearLevel)}-${safeStr(
                                                        s?.name
                                                    )}`
                                                    return (
                                                        <SelectItem key={id} value={id}>
                                                            {name}
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-end">
                                        <Badge variant="secondary" className="w-fit">
                                            Rows: {filteredScheduleRows.length}
                                        </Badge>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {dataLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredScheduleRows.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No schedule meetings found for this version.
                                    </div>
                                ) : (
                                    <div className="w-full overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Section</TableHead>
                                                    <TableHead>Day</TableHead>
                                                    <TableHead>Time</TableHead>
                                                    <TableHead>Subject</TableHead>
                                                    <TableHead>Faculty</TableHead>
                                                    <TableHead>Room</TableHead>
                                                    <TableHead>Type</TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredScheduleRows.map((r, idx) => (
                                                    <TableRow key={`${r.classId}-${idx}`}>
                                                        <TableCell className="min-w-40">
                                                            <Badge variant="outline">
                                                                {r.sectionName}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{shortDayLabel(r.dayOfWeek)}</TableCell>
                                                        <TableCell className="min-w-36">
                                                            {r.startTime} - {r.endTime}
                                                        </TableCell>
                                                        <TableCell className="min-w-56">
                                                            <div className="font-medium">
                                                                {r.subjectCode}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {r.subjectTitle}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="min-w-40">
                                                            {r.facultyName}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary">{r.roomCode}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{r.meetingType}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ---------------- Room Utilization ---------------- */}
                    <TabsContent value="room-utilization" className="mt-4 space-y-3">
                        <Card>
                            <CardHeader className="space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <DoorOpen className="h-5 w-5" />
                                            Room Utilization Report
                                        </CardTitle>
                                        <CardDescription>
                                            Weekly usage vs available time blocks.
                                        </CardDescription>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        onClick={exportRoomUtilizationCsv}
                                        disabled={filteredRooms.length === 0}
                                    >
                                        <Download className="h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Input
                                        placeholder="Search room code…"
                                        value={roomSearch}
                                        onChange={(e) => setRoomSearch(e.target.value)}
                                        className="sm:max-w-md"
                                    />
                                    <Badge variant="secondary" className="w-fit">
                                        Rows: {filteredRooms.length}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {dataLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredRooms.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No room utilization data found.
                                    </div>
                                ) : (
                                    <div className="w-full overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Room</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead className="text-right">
                                                        Capacity
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Used Hours
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Available Hours
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Utilization
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredRooms.map((r) => (
                                                    <TableRow key={r.roomId}>
                                                        <TableCell className="min-w-40">
                                                            <Badge variant="secondary">{r.roomCode}</Badge>
                                                        </TableCell>
                                                        <TableCell>{r.type}</TableCell>
                                                        <TableCell className="text-right">
                                                            {r.capacity}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {(r.usedMinutes / 60).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {(r.availableMinutes / 60).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right min-w-40">
                                                            <div className="space-y-1">
                                                                <div className="font-medium">
                                                                    {r.utilizationPct.toFixed(1)}%
                                                                </div>
                                                                <Progress value={r.utilizationPct} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ---------------- Conflicts ---------------- */}
                    <TabsContent value="conflicts" className="mt-4 space-y-3">
                        <Card>
                            <CardHeader className="space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5" />
                                            Conflict / Changes Report
                                        </CardTitle>
                                        <CardDescription>
                                            Detects overlapping schedules for rooms, faculty, and sections.
                                        </CardDescription>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        onClick={exportConflictsCsv}
                                        disabled={filteredConflicts.length === 0}
                                    >
                                        <Download className="h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Input
                                        placeholder="Search conflicts…"
                                        value={conflictSearch}
                                        onChange={(e) => setConflictSearch(e.target.value)}
                                        className="sm:max-w-md"
                                    />
                                    <Badge
                                        variant={filteredConflicts.length > 0 ? "destructive" : "secondary"}
                                        className="w-fit"
                                    >
                                        Conflicts: {filteredConflicts.length}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {dataLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : filteredConflicts.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                        No conflicts detected 🎉
                                    </div>
                                ) : (
                                    <div className="w-full overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Day</TableHead>
                                                    <TableHead>Time</TableHead>
                                                    <TableHead>Room</TableHead>
                                                    <TableHead>Faculty</TableHead>
                                                    <TableHead>Section</TableHead>
                                                    <TableHead className="min-w-72">
                                                        Conflict Details
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {filteredConflicts.map((c, idx) => (
                                                    <TableRow key={`${c.type}-${idx}`}>
                                                        <TableCell>
                                                            <Badge
                                                                variant={
                                                                    c.type === "ROOM"
                                                                        ? "destructive"
                                                                        : c.type === "FACULTY"
                                                                            ? "default"
                                                                            : "secondary"
                                                                }
                                                            >
                                                                {c.type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>{shortDayLabel(c.dayOfWeek)}</TableCell>
                                                        <TableCell className="min-w-36">
                                                            {c.startTime} - {c.endTime}
                                                        </TableCell>
                                                        <TableCell>
                                                            {c.roomCode ? (
                                                                <Badge variant="outline">{c.roomCode}</Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="min-w-40">
                                                            {c.facultyName ?? (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="min-w-40">
                                                            {c.sectionName ?? (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="min-w-72">
                                                            <div className="space-y-1">
                                                                <div className="text-xs text-muted-foreground">
                                                                    A
                                                                </div>
                                                                <div className="text-sm font-medium">
                                                                    {c.aClassLabel}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    B
                                                                </div>
                                                                <div className="text-sm font-medium">
                                                                    {c.bClassLabel}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
