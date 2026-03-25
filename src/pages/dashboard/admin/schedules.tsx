/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, RefreshCcw } from "lucide-react"

import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "@/hooks/use-session"

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

import { Button } from "@/components/ui/button"

import { VersionManagementSection } from "@/components/schedules/version-management-section"
import { PlannerManagementSection } from "@/components/schedules/planner-management-section"
import type {
    AcademicTermDoc,
    CandidateConflict,
    ClassDoc,
    ClassMeetingDoc,
    ConflictFlags,
    DepartmentDoc,
    MeetingType,
    RoomDoc,
    ScheduleRow,
    ScheduleStatus,
    ScheduleVersionDoc,
    SectionDoc,
    SubjectDoc,
    TabKey,
    UserProfileDoc,
} from "@/components/schedules/schedule-types"
import {
    FACULTY_OPTION_MANUAL,
    FACULTY_OPTION_NONE,
} from "@/components/schedules/schedule-types"
import {
    composeRemarks,
    dayExpressionsOverlap,
    dayOrder,
    deptLabel,
    extractManualFaculty,
    getCanonicalDayValue,
    hhmmToMinutes,
    meetingTypeLabel,
    normalizeText,
    rangesOverlap,
    roleLooksLikeFaculty,
    roomTypeLabel,
    stripManualFacultyTag,
    termLabel,
} from "@/components/schedules/schedule-utils"

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
    const [editingEntry, setEditingEntry] = React.useState<ScheduleRow | null>(null)

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

            await databases.createDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, ID.unique(), payload)

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
                        await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, o.$id, {
                            status: "Draft",
                        })
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

            await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHEDULE_VERSIONS, it.$id, payload)

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
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SUBJECTS, [Query.limit(5000)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ROOMS, [Query.limit(2000)]),
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
            const selectedVersionTermId = String(selectedVersion.termId || "").trim()
            const selectedVersionDeptId = String(selectedVersion.departmentId || "").trim()

            const scopedSubjects = allSubjects
                .filter((s) => s.isActive !== false)
                .filter((s) => {
                    const subjectDeptId = String(s.departmentId || "").trim()
                    if (subjectDeptId && subjectDeptId !== selectedVersionDeptId) return false

                    const subjectTermId = String(s.termId || "").trim()
                    if (!selectedVersionTermId) return !subjectTermId

                    return subjectTermId === selectedVersionTermId
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

    React.useEffect(() => {
        setFormSubjectId((prev) => {
            if (prev && subjects.some((subject) => subject.$id === prev)) return prev
            return subjects[0]?.$id || ""
        })
    }, [subjects])

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

            const sectionAny = (section || {}) as any
            const secName = String(section?.name || "").trim()
            const secYearRaw = section?.yearLevel ?? sectionAny.yearLevel ?? null
            const secYearText = String(secYearRaw ?? "").trim()
            const secProgramCode = String(sectionAny.programCode || sectionAny.sectionProgramCode || "").trim()
            const secProgramName = String(sectionAny.programName || sectionAny.sectionProgramName || "").trim()
            const sectionLabel =
                String(section?.label || sectionAny.sectionLabel || "").trim() ||
                (secName ? `${secYearText ? `Y${secYearText}` : "Y?"} - ${secName}` : c.sectionId)

            const roomCode = String(room?.code || "").trim()
            const roomName = String(room?.name || "").trim()
            const roomLabel = [roomCode, roomName].filter(Boolean).join(" • ") || "Unassigned"

            rows.push({
                meetingId: m.$id,
                classId: c.$id,

                versionId: String(c.versionId || m.versionId || ""),
                termId: String(c.termId || ""),
                departmentId: String(c.departmentId || ""),

                dayOfWeek: getCanonicalDayValue(String(m.dayOfWeek || "")),
                startTime: String(m.startTime || ""),
                endTime: String(m.endTime || ""),
                meetingType: (m.meetingType || "LECTURE") as MeetingType,

                roomId: String(m.roomId || ""),
                roomType: String(room?.type || ""),
                roomLabel,

                sectionId: String(c.sectionId || ""),
                sectionLabel,
                sectionYearLevel: secYearRaw,
                sectionName: secName || null,
                sectionProgramCode: secProgramCode || null,
                sectionProgramName: secProgramName || null,

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

        const mark = (id: string, type: "room" | "faculty" | "section") => {
            const current = map.get(id)
            if (!current) return
            current[type] = true
        }

        for (let i = 0; i < scheduleRows.length; i += 1) {
            for (let j = i + 1; j < scheduleRows.length; j += 1) {
                const a = scheduleRows[i]
                const b = scheduleRows[j]

                if (!dayExpressionsOverlap(a.dayOfWeek, b.dayOfWeek)) continue
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
        setFormDayOfWeek(getCanonicalDayValue("Monday"))
        setFormStartTime("07:00")
        setFormEndTime("08:00")
        setFormMeetingType("LECTURE")
        setFormClassCode("")
        setFormDeliveryMode("")
        setFormRemarks("")
        setFormAllowConflictSave(false)
    }, [sections, subjects, rooms])

    const handleEntryDialogOpenChange = React.useCallback((nextOpen: boolean) => {
        setEntryDialogOpen(nextOpen)
        if (!nextOpen) {
            setFormAllowConflictSave(false)
            setEditingEntry(null)
        }
    }, [])

    const openCreateEntry = React.useCallback(() => {
        setEditingEntry(null)
        resetEntryForm()
        setEntryDialogOpen(true)
    }, [resetEntryForm])

    const openEditEntry = React.useCallback((row: ScheduleRow) => {
        setEditingEntry(row)
        setFormSectionId(String(row.sectionId || ""))
        setFormSubjectId(String(row.subjectId || ""))
        setFormFacultyChoice(
            row.isManualFaculty
                ? FACULTY_OPTION_MANUAL
                : row.facultyUserId
                  ? String(row.facultyUserId)
                  : FACULTY_OPTION_NONE
        )
        setFormManualFaculty(String(row.manualFaculty || ""))
        setFormRoomId(String(row.roomId || ""))
        setFormDayOfWeek(getCanonicalDayValue(String(row.dayOfWeek || "Monday")))
        setFormStartTime(String(row.startTime || "07:00"))
        setFormEndTime(String(row.endTime || "08:00"))
        setFormMeetingType((row.meetingType || "LECTURE") as MeetingType)
        setFormClassCode(String(row.classCode || ""))
        setFormDeliveryMode(String(row.deliveryMode || ""))
        setFormRemarks(String(row.classRemarks || ""))
        setFormAllowConflictSave(false)
        setEntryDialogOpen(true)
    }, [
        setFormSectionId,
        setFormSubjectId,
        setFormFacultyChoice,
        setFormManualFaculty,
        setFormRoomId,
        setFormDayOfWeek,
        setFormStartTime,
        setFormEndTime,
        setFormMeetingType,
        setFormClassCode,
        setFormDeliveryMode,
        setFormRemarks,
    ])

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
            if (editingEntry && (r.meetingId === editingEntry.meetingId || r.classId === editingEntry.classId)) {
                continue
            }
            if (!dayExpressionsOverlap(r.dayOfWeek, formDayOfWeek)) continue
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
        editingEntry,
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
            const manualFaculty = formFacultyChoice === FACULTY_OPTION_MANUAL ? formManualFaculty.trim() : ""
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
                remarks: composeRemarks(formRemarks, manualFaculty),
            }

            if (editingEntry) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingEntry.classId,
                    classPayload
                )

                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASS_MEETINGS,
                    editingEntry.meetingId,
                    {
                        dayOfWeek: getCanonicalDayValue(formDayOfWeek),
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
                    {
                        ...classPayload,
                        status: "Planned",
                    }
                )

                await databases.createDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, ID.unique(), {
                    versionId: selectedVersion.$id,
                    classId: createdClass.$id,
                    dayOfWeek: getCanonicalDayValue(formDayOfWeek),
                    startTime: formStartTime,
                    endTime: formEndTime,
                    roomId: formRoomId || null,
                    meetingType: formMeetingType,
                })

                toast.success("Schedule entry created.")
            }

            handleEntryDialogOpenChange(false)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to save schedule entry.")
        } finally {
            setEntrySaving(false)
        }
    }

    const deleteEntry = async () => {
        if (!editingEntry) {
            toast.error("No schedule entry selected.")
            return
        }

        setEntrySaving(true)
        try {
            const siblingMeetings = meetings.filter(
                (meeting) =>
                    String(meeting.classId || "") === String(editingEntry.classId || "") &&
                    String(meeting.$id || "") !== String(editingEntry.meetingId || "")
            )

            await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.CLASS_MEETINGS,
                editingEntry.meetingId
            )

            if (siblingMeetings.length === 0) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    COLLECTIONS.CLASSES,
                    editingEntry.classId
                )
            }

            toast.success("Schedule entry deleted.")
            handleEntryDialogOpenChange(false)
            await fetchScheduleContext()
        } catch (e: any) {
            toast.error(e?.message || "Failed to delete schedule entry.")
        } finally {
            setEntrySaving(false)
        }
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

    const selectedVersionLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return `v${Number(selectedVersion.version || 0)} • ${selectedVersion.label || "Untitled"} (${String(
            selectedVersion.status
        )})`
    }, [selectedVersion])

    const selectedTermLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return termLabel(termMap.get(String(selectedVersion.termId)) ?? null)
    }, [selectedVersion, termMap])

    const selectedDeptLabel = React.useMemo(() => {
        if (!selectedVersion) return "—"
        return deptLabel(deptMap.get(String(selectedVersion.departmentId)) ?? null)
    }, [selectedVersion, deptMap])

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading || saving}>
                <RefreshCcw className="mr-2 size-4" />
                Refresh
            </Button>

            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={loading || saving}>
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
                <VersionManagementSection
                    loading={loading}
                    saving={saving}
                    error={error}
                    terms={terms}
                    departments={departments}
                    termMap={termMap}
                    deptMap={deptMap}
                    stats={stats}
                    filtered={filtered}
                    tab={tab}
                    setTab={setTab}
                    search={search}
                    setSearch={setSearch}
                    filterTermId={filterTermId}
                    setFilterTermId={setFilterTermId}
                    filterDeptId={filterDeptId}
                    setFilterDeptId={setFilterDeptId}
                    selectedVersionId={selectedVersionId}
                    setSelectedVersionId={setSelectedVersionId}
                    onRefresh={() => void fetchAll()}
                    onOpenCreate={() => setCreateOpen(true)}
                    onSetStatus={setStatus}
                    viewOpen={viewOpen}
                    setViewOpen={setViewOpen}
                    active={active}
                    setActive={setActive}
                    onOpenView={openView}
                    createOpen={createOpen}
                    setCreateOpen={setCreateOpen}
                    createTermId={createTermId}
                    setCreateTermId={setCreateTermId}
                    createDeptId={createDeptId}
                    setCreateDeptId={setCreateDeptId}
                    createLabel={createLabel}
                    setCreateLabel={setCreateLabel}
                    createNotes={createNotes}
                    setCreateNotes={setCreateNotes}
                    createSetActive={createSetActive}
                    setCreateSetActive={setCreateSetActive}
                    nextVersionNumber={nextVersionNumber}
                    onCreateVersion={createVersion}
                    resetCreateForm={resetCreateForm}
                />

                <PlannerManagementSection
                    selectedVersion={selectedVersion}
                    selectedVersionId={selectedVersionId}
                    onSelectedVersionChange={setSelectedVersionId}
                    versionSelectOptions={versionSelectOptions}
                    showConflictsOnly={showConflictsOnly}
                    onShowConflictsOnlyChange={setShowConflictsOnly}
                    entriesLoading={entriesLoading}
                    entriesError={entriesError}
                    entrySaving={entrySaving}
                    onReloadEntries={() => void fetchScheduleContext()}
                    onOpenCreateEntry={openCreateEntry}
                    plannerStats={plannerStats}
                    visibleRows={visibleRows}
                    laboratoryRows={laboratoryRows}
                    conflictFlagsByMeetingId={conflictFlagsByMeetingId}
                    selectedVersionLabel={selectedVersionLabel}
                    selectedTermLabel={selectedTermLabel}
                    selectedDeptLabel={selectedDeptLabel}
                    entryDialogOpen={entryDialogOpen}
                    setEntryDialogOpen={handleEntryDialogOpenChange}
                    editingEntry={editingEntry}
                    formSectionId={formSectionId}
                    setFormSectionId={setFormSectionId}
                    formSubjectId={formSubjectId}
                    setFormSubjectId={setFormSubjectId}
                    formFacultyChoice={formFacultyChoice}
                    setFormFacultyChoice={setFormFacultyChoice}
                    formManualFaculty={formManualFaculty}
                    setFormManualFaculty={setFormManualFaculty}
                    formRoomId={formRoomId}
                    setFormRoomId={setFormRoomId}
                    formDayOfWeek={formDayOfWeek}
                    setFormDayOfWeek={setFormDayOfWeek}
                    formStartTime={formStartTime}
                    setFormStartTime={setFormStartTime}
                    formEndTime={formEndTime}
                    setFormEndTime={setFormEndTime}
                    formMeetingType={formMeetingType}
                    setFormMeetingType={setFormMeetingType}
                    formClassCode={formClassCode}
                    setFormClassCode={setFormClassCode}
                    formDeliveryMode={formDeliveryMode}
                    setFormDeliveryMode={setFormDeliveryMode}
                    formRemarks={formRemarks}
                    setFormRemarks={setFormRemarks}
                    formAllowConflictSave={formAllowConflictSave}
                    setFormAllowConflictSave={setFormAllowConflictSave}
                    candidateConflicts={candidateConflicts}
                    candidateConflictCounts={candidateConflictCounts}
                    manualFacultySuggestions={manualFacultySuggestions}
                    sections={sections}
                    subjects={subjects}
                    facultyProfiles={facultyProfiles}
                    rooms={rooms}
                    onEditEntry={openEditEntry}
                    onSaveEntry={saveEntry}
                    onDeleteEntry={deleteEntry}
                />
            </div>
        </DashboardLayout>
    )
}