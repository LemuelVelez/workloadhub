/* eslint-disable @typescript-eslint/no-explicit-any */
import { tablesDB, DATABASE_ID, COLLECTIONS, Query, ID } from "@/lib/db"

type AnyRow = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

async function listAllRows(tableId: string, baseQueries: any[] = [], max = 5000) {
    const limit = 100
    let offset = 0
    const all: AnyRow[] = []

    while (true) {
        const queries = [
            ...baseQueries.filter((q) => typeof q === "string"),
            Query.limit(limit),
            Query.offset(offset),
        ]

        const res: any = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId,
            queries,
        })

        const rows: AnyRow[] = Array.isArray(res?.rows) ? res.rows : []
        all.push(...rows)

        if (rows.length < limit) break
        offset += limit
        if (all.length >= max) break
    }

    return all
}

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function toNum(v: any, fallback = 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

function normalizeRole(role: any) {
    return safeStr(role).toLowerCase()
}

function isFacultyRole(role: any) {
    const r = normalizeRole(role)
    return r.includes("faculty")
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const

function normalizeDay(day: any) {
    const d = safeStr(day)
    if (!d) return ""
    const lower = d.toLowerCase()

    if (lower.startsWith("mon")) return "Monday"
    if (lower.startsWith("tue")) return "Tuesday"
    if (lower.startsWith("wed")) return "Wednesday"
    if (lower.startsWith("thu")) return "Thursday"
    if (lower.startsWith("fri")) return "Friday"
    if (lower.startsWith("sat")) return "Saturday"
    if (lower.startsWith("sun")) return "Sunday"

    const match = DAY_ORDER.find((x) => x.toLowerCase() === lower)
    return match ?? d
}

function timeToMinutes(t: any) {
    const s = safeStr(t)
    if (!s) return 0
    const parts = s.split(":").map((x) => Number(x))
    const hh = Number.isFinite(parts[0]) ? parts[0] : 0
    const mm = Number.isFinite(parts[1]) ? parts[1] : 0
    return hh * 60 + mm
}

function durationMinutes(start: any, end: any) {
    const a = timeToMinutes(start)
    const b = timeToMinutes(end)
    const diff = b - a
    return diff > 0 ? diff : 0
}

function normalizePreference(pref: any) {
    const p = safeStr(pref)
    if (!p) return "Neutral"
    const lower = p.toLowerCase()
    if (lower.includes("unavail")) return "Unavailable"
    if (lower.includes("prefer")) return "Preferred"
    if (lower.includes("neutral")) return "Neutral"
    return p
}

function chunk<T>(arr: T[], size = 50) {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export type FacultyScheduleItem = {
    meetingId: string
    classId: string

    dayOfWeek: string
    startTime: string
    endTime: string

    meetingType?: string | null

    subjectCode?: string | null
    subjectTitle?: string | null

    sectionLabel?: string | null
    classCode?: string | null

    roomCode?: string | null
    roomName?: string | null
}

export type FacultyWorkloadSummaryItem = {
    classId: string

    subjectId?: string | null
    subjectCode?: string | null
    subjectTitle?: string | null

    sectionId?: string | null
    sectionLabel?: string | null

    classCode?: string | null
    deliveryMode?: string | null
    status?: string | null

    units: number
    lectureHours: number
    labHours: number
    totalHours: number

    meetingCount: number
    weeklyMinutes: number
}

export type FacultyAvailabilityItem = {
    $id: string
    $createdAt?: string
    $updatedAt?: string

    termId: string
    userId: string
    dayOfWeek: string
    startTime: string
    endTime: string
    preference: string
    notes?: string | null
}

export type FacultyChangeRequestItem = {
    $id: string
    $createdAt?: string
    $updatedAt?: string

    termId: string
    departmentId: string
    requestedBy: string

    classId?: string | null
    meetingId?: string | null

    type: string
    details: string
    status: string

    reviewedBy?: string | null
    reviewedAt?: string | null
    resolutionNotes?: string | null
}

export type FacultyNotificationItem = {
    notificationId: string
    recipientRowId: string

    isRead: boolean
    readAt?: string | null

    type: string
    title: string
    message: string
    link?: string | null

    departmentId?: string | null
    termId?: string | null
    createdBy?: string | null

    createdAt?: string | null
    updatedAt?: string | null
}

export const facultyMemberApi = {
    terms: {
        async getActive() {
            const rows = await listAllRows(COLLECTIONS.ACADEMIC_TERMS, [
                Query.equal("isActive", true),
                Query.orderDesc("$updatedAt"),
            ])
            return rows[0] ?? null
        },
    },

    profiles: {
        async getByUserId(userId: string) {
            const id = safeStr(userId)
            if (!id) return null

            const rows = await listAllRows(
                COLLECTIONS.USER_PROFILES,
                [Query.equal("userId", id), Query.orderDesc("$updatedAt")],
                5
            )
            return rows[0] ?? null
        },

        async getFacultyProfileByUserId(userId: string) {
            const id = safeStr(userId)
            if (!id) return null

            const rows = await listAllRows(
                COLLECTIONS.FACULTY_PROFILES,
                [Query.equal("userId", id), Query.orderDesc("$updatedAt")],
                5
            )

            return rows[0] ?? null
        },

        async listFacultyUsersByDepartment(departmentId: string) {
            const deptId = safeStr(departmentId)
            if (!deptId) return []

            const users = await listAllRows(COLLECTIONS.USER_PROFILES, [
                Query.equal("departmentId", deptId),
                Query.orderAsc("name"),
            ])

            return users.filter((u) => isFacultyRole(u?.role))
        },
    },

    schedules: {
        /**
         * ✅ Returns current faculty user's schedule for ACTIVE term + ACTIVE version
         * Includes profile for PDF header display.
         */
        async getMySchedule(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) {
                return {
                    term: null,
                    version: null,
                    profile: null,
                    items: [] as FacultyScheduleItem[],
                }
            }

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)

            const profile = await facultyMemberApi.profiles.getByUserId(userId).catch(() => null)
            const departmentId = safeStr(profile?.departmentId)

            if (!termId || !departmentId) {
                return {
                    term,
                    version: null,
                    profile,
                    items: [] as FacultyScheduleItem[],
                }
            }

            const versions = await listAllRows(
                COLLECTIONS.SCHEDULE_VERSIONS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.orderDesc("version"),
                ],
                300
            )

            const active = versions.find((v) => safeStr(v?.status) === "Active")
            const locked = versions.find((v) => safeStr(v?.status) === "Locked")
            const version = active ?? locked ?? versions[0] ?? null
            const versionId = safeStr(version?.$id)

            if (!versionId) {
                return {
                    term,
                    version: null,
                    profile,
                    items: [] as FacultyScheduleItem[],
                }
            }

            const classes = await listAllRows(
                COLLECTIONS.CLASSES,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("versionId", versionId),
                    Query.equal("facultyUserId", userId),
                    Query.orderDesc("$updatedAt"),
                ],
                6000
            )

            const classIdSet = new Set(classes.map((c) => safeStr(c?.$id)).filter(Boolean))

            if (classIdSet.size === 0) {
                return {
                    term,
                    version,
                    profile,
                    items: [] as FacultyScheduleItem[],
                }
            }

            const meetingsAll = await listAllRows(
                COLLECTIONS.CLASS_MEETINGS,
                [Query.equal("versionId", versionId), Query.orderDesc("$updatedAt")],
                12000
            )

            const meetings = meetingsAll.filter((m) => classIdSet.has(safeStr(m?.classId)))

            const subjects = await listAllRows(COLLECTIONS.SUBJECTS, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("code"),
            ])

            const sections = await listAllRows(COLLECTIONS.SECTIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),
                Query.orderAsc("yearLevel"),
                Query.orderAsc("name"),
            ])

            const rooms = await listAllRows(COLLECTIONS.ROOMS, [
                Query.equal("isActive", true),
                Query.orderAsc("code"),
            ])

            const subjectMap = new Map<string, AnyRow>()
            for (const s of subjects) subjectMap.set(safeStr(s?.$id), s)

            const sectionMap = new Map<string, AnyRow>()
            for (const s of sections) sectionMap.set(safeStr(s?.$id), s)

            const roomMap = new Map<string, AnyRow>()
            for (const r of rooms) roomMap.set(safeStr(r?.$id), r)

            const classMap = new Map<string, AnyRow>()
            for (const c of classes) classMap.set(safeStr(c?.$id), c)

            const items: FacultyScheduleItem[] = meetings
                .map((m) => {
                    const meetingId = safeStr(m?.$id)
                    const classId = safeStr(m?.classId)

                    const c = classMap.get(classId)
                    const subjectId = safeStr(c?.subjectId)
                    const sectionId = safeStr(c?.sectionId)

                    const subj = subjectMap.get(subjectId)
                    const sec = sectionMap.get(sectionId)
                    const room = roomMap.get(safeStr(m?.roomId))

                    const dayOfWeek = normalizeDay(m?.dayOfWeek)

                    const sectionLabel =
                        sec
                            ? `${Number(sec?.yearLevel || 0) || ""}${safeStr(sec?.name) ? ` - ${safeStr(sec?.name)}` : ""
                            }`
                            : null

                    return {
                        meetingId,
                        classId,

                        dayOfWeek,
                        startTime: safeStr(m?.startTime),
                        endTime: safeStr(m?.endTime),

                        meetingType: safeStr(m?.meetingType) || null,

                        subjectCode: safeStr(subj?.code) || null,
                        subjectTitle: safeStr(subj?.title) || null,

                        sectionLabel,
                        classCode: safeStr(c?.classCode) || null,

                        roomCode: safeStr(room?.code) || null,
                        roomName: safeStr(room?.name) || null,
                    } as FacultyScheduleItem
                })
                .filter((x) => x.meetingId && x.classId)
                .sort((a, b) => {
                    const da = DAY_ORDER.indexOf(a.dayOfWeek as any)
                    const db = DAY_ORDER.indexOf(b.dayOfWeek as any)
                    if (da !== db) return da - db
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                })

            return {
                term,
                version,
                profile,
                items,
            }
        },
    },

    workloads: {
        /**
         * ✅ Workload Summary:
         * - Lists faculty assigned classes (unique class rows)
         * - Adds units/hours from SUBJECTS
         * - Adds meetingCount + weeklyMinutes from CLASS_MEETINGS
         * - Includes facultyProfile (maxUnits/maxHours)
         */
        async getMyWorkloadSummary(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) {
                return {
                    term: null,
                    version: null,
                    profile: null,
                    facultyProfile: null,
                    items: [] as FacultyWorkloadSummaryItem[],
                }
            }

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)

            const profile = await facultyMemberApi.profiles.getByUserId(userId).catch(() => null)
            const facultyProfile = await facultyMemberApi.profiles.getFacultyProfileByUserId(userId).catch(() => null)

            const departmentId = safeStr(profile?.departmentId)

            if (!termId || !departmentId) {
                return {
                    term,
                    version: null,
                    profile,
                    facultyProfile,
                    items: [] as FacultyWorkloadSummaryItem[],
                }
            }

            const versions = await listAllRows(
                COLLECTIONS.SCHEDULE_VERSIONS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.orderDesc("version"),
                ],
                300
            )

            const active = versions.find((v) => safeStr(v?.status) === "Active")
            const locked = versions.find((v) => safeStr(v?.status) === "Locked")
            const version = active ?? locked ?? versions[0] ?? null
            const versionId = safeStr(version?.$id)

            if (!versionId) {
                return {
                    term,
                    version: null,
                    profile,
                    facultyProfile,
                    items: [] as FacultyWorkloadSummaryItem[],
                }
            }

            const classes = await listAllRows(
                COLLECTIONS.CLASSES,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("versionId", versionId),
                    Query.equal("facultyUserId", userId),
                    Query.orderDesc("$updatedAt"),
                ],
                6000
            )

            if (!Array.isArray(classes) || classes.length === 0) {
                return {
                    term,
                    version,
                    profile,
                    facultyProfile,
                    items: [] as FacultyWorkloadSummaryItem[],
                }
            }

            const classIdSet = new Set(classes.map((c) => safeStr(c?.$id)).filter(Boolean))

            const subjects = await listAllRows(COLLECTIONS.SUBJECTS, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("code"),
            ])

            const sections = await listAllRows(COLLECTIONS.SECTIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),
                Query.orderAsc("yearLevel"),
                Query.orderAsc("name"),
            ])

            const subjectMap = new Map<string, AnyRow>()
            for (const s of subjects) subjectMap.set(safeStr(s?.$id), s)

            const sectionMap = new Map<string, AnyRow>()
            for (const s of sections) sectionMap.set(safeStr(s?.$id), s)

            // Meetings stats for scheduled hours
            const meetingsAll = await listAllRows(
                COLLECTIONS.CLASS_MEETINGS,
                [Query.equal("versionId", versionId), Query.orderDesc("$updatedAt")],
                12000
            )

            const statsMap = new Map<string, { meetingCount: number; weeklyMinutes: number }>()

            for (const m of meetingsAll) {
                const classId = safeStr(m?.classId)
                if (!classId || !classIdSet.has(classId)) continue

                const dur = durationMinutes(m?.startTime, m?.endTime)

                const prev = statsMap.get(classId) ?? { meetingCount: 0, weeklyMinutes: 0 }
                prev.meetingCount += 1
                prev.weeklyMinutes += dur
                statsMap.set(classId, prev)
            }

            const items: FacultyWorkloadSummaryItem[] = classes
                .map((c) => {
                    const classId = safeStr(c?.$id)
                    if (!classId) return null

                    const subjectId = safeStr(c?.subjectId)
                    const sectionId = safeStr(c?.sectionId)

                    const subj = subjectMap.get(subjectId)
                    const sec = sectionMap.get(sectionId)

                    const sectionLabel =
                        sec
                            ? `${Number(sec?.yearLevel || 0) || ""}${safeStr(sec?.name) ? ` - ${safeStr(sec?.name)}` : ""
                            }`
                            : null

                    const sUnits = toNum(subj?.units, 0)
                    const sLec = toNum(subj?.lectureHours, 0)
                    const sLab = toNum(subj?.labHours, 0)
                    const sTotal = toNum(subj?.totalHours, sLec + sLab)

                    const stats = statsMap.get(classId) ?? { meetingCount: 0, weeklyMinutes: 0 }

                    return {
                        classId,

                        subjectId: subjectId || null,
                        subjectCode: safeStr(subj?.code) || null,
                        subjectTitle: safeStr(subj?.title) || null,

                        sectionId: sectionId || null,
                        sectionLabel,

                        classCode: safeStr(c?.classCode) || null,
                        deliveryMode: safeStr(c?.deliveryMode) || null,
                        status: safeStr(c?.status) || null,

                        units: sUnits,
                        lectureHours: sLec,
                        labHours: sLab,
                        totalHours: sTotal,

                        meetingCount: toNum(stats?.meetingCount, 0),
                        weeklyMinutes: toNum(stats?.weeklyMinutes, 0),
                    } as FacultyWorkloadSummaryItem
                })
                .filter(Boolean) as FacultyWorkloadSummaryItem[]

            items.sort((a, b) => {
                const ac = safeStr(a?.subjectCode).localeCompare(safeStr(b?.subjectCode))
                if (ac !== 0) return ac
                const as = safeStr(a?.sectionLabel).localeCompare(safeStr(b?.sectionLabel))
                if (as !== 0) return as
                return safeStr(a?.classCode).localeCompare(safeStr(b?.classCode))
            })

            return {
                term,
                version,
                profile,
                facultyProfile,
                items,
            }
        },
    },

    /**
     * ✅ NEW: Faculty Availability / Preference Submission
     * Saves entries into FACULTY_AVAILABILITY table for ACTIVE term.
     */
    availability: {
        async listMy(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) {
                return {
                    term: null,
                    items: [] as FacultyAvailabilityItem[],
                }
            }

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)

            if (!termId) {
                return {
                    term: null,
                    items: [] as FacultyAvailabilityItem[],
                }
            }

            const rows = await listAllRows(
                COLLECTIONS.FACULTY_AVAILABILITY,
                [
                    Query.equal("termId", termId),
                    Query.equal("userId", userId),
                    Query.orderDesc("$updatedAt"),
                ],
                6000
            )

            const items: FacultyAvailabilityItem[] = rows
                .map((r) => {
                    return {
                        $id: safeStr(r?.$id),
                        $createdAt: safeStr(r?.$createdAt),
                        $updatedAt: safeStr(r?.$updatedAt),

                        termId: safeStr(r?.termId),
                        userId: safeStr(r?.userId),

                        dayOfWeek: normalizeDay(r?.dayOfWeek),
                        startTime: safeStr(r?.startTime),
                        endTime: safeStr(r?.endTime),
                        preference: normalizePreference(r?.preference),
                        notes: safeStr(r?.notes) || null,
                    } as FacultyAvailabilityItem
                })
                .filter((x) => x.$id && x.termId && x.userId)
                .sort((a, b) => {
                    const da = DAY_ORDER.indexOf(a.dayOfWeek as any)
                    const db = DAY_ORDER.indexOf(b.dayOfWeek as any)
                    if (da !== db) return da - db
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                })

            return { term, items }
        },

        async createMy(args: {
            userId: string
            dayOfWeek: string
            startTime: string
            endTime: string
            preference: string
            notes?: string
        }) {
            const userId = safeStr(args.userId)
            if (!userId) throw new Error("Missing userId")

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)
            if (!termId) throw new Error("No active term")

            const payload = {
                termId,
                userId,
                dayOfWeek: normalizeDay(args.dayOfWeek),
                startTime: safeStr(args.startTime),
                endTime: safeStr(args.endTime),
                preference: normalizePreference(args.preference),
                notes: safeStr(args.notes) || null,
            }

            return await tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.FACULTY_AVAILABILITY,
                rowId: ID.unique(),
                data: payload,
            })
        },

        async updateMy(args: {
            userId: string
            rowId: string
            dayOfWeek: string
            startTime: string
            endTime: string
            preference: string
            notes?: string
        }) {
            const userId = safeStr(args.userId)
            const rowId = safeStr(args.rowId)
            if (!userId) throw new Error("Missing userId")
            if (!rowId) throw new Error("Missing rowId")

            const payload = {
                dayOfWeek: normalizeDay(args.dayOfWeek),
                startTime: safeStr(args.startTime),
                endTime: safeStr(args.endTime),
                preference: normalizePreference(args.preference),
                notes: safeStr(args.notes) || null,
            }

            return await tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.FACULTY_AVAILABILITY,
                rowId,
                data: payload,
            })
        },

        async deleteMy(args: { userId: string; rowId: string }) {
            const userId = safeStr(args.userId)
            const rowId = safeStr(args.rowId)
            if (!userId) throw new Error("Missing userId")
            if (!rowId) throw new Error("Missing rowId")

            return await tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.FACULTY_AVAILABILITY,
                rowId,
            })
        },
    },

    /**
     * ✅ NEW: Change Requests (Faculty)
     * - Faculty submits requests for schedule/load changes
     * - Department head approves/rejects
     */
    changeRequests: {
        async listMy(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) {
                return { term: null, profile: null, items: [] as FacultyChangeRequestItem[] }
            }

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)

            const profile = await facultyMemberApi.profiles.getByUserId(userId).catch(() => null)
            const departmentId = safeStr(profile?.departmentId)

            if (!termId || !departmentId) {
                return { term, profile, items: [] as FacultyChangeRequestItem[] }
            }

            const rows = await listAllRows(
                COLLECTIONS.CHANGE_REQUESTS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("requestedBy", userId),
                    Query.orderDesc("$createdAt"),
                ],
                6000
            )

            const items: FacultyChangeRequestItem[] = rows
                .map((r) => {
                    return {
                        $id: safeStr(r?.$id),
                        $createdAt: safeStr(r?.$createdAt),
                        $updatedAt: safeStr(r?.$updatedAt),

                        termId: safeStr(r?.termId),
                        departmentId: safeStr(r?.departmentId),
                        requestedBy: safeStr(r?.requestedBy),

                        classId: safeStr(r?.classId) || null,
                        meetingId: safeStr(r?.meetingId) || null,

                        type: safeStr(r?.type) || "Request",
                        details: safeStr(r?.details) || "",
                        status: safeStr(r?.status) || "Pending",

                        reviewedBy: safeStr(r?.reviewedBy) || null,
                        reviewedAt: safeStr(r?.reviewedAt) || null,
                        resolutionNotes: safeStr(r?.resolutionNotes) || null,
                    } as FacultyChangeRequestItem
                })
                .filter((x) => x.$id && x.termId && x.departmentId && x.requestedBy)
                .sort((a, b) => {
                    const ad = safeStr(a.$updatedAt || a.$createdAt || "")
                    const bd = safeStr(b.$updatedAt || b.$createdAt || "")
                    return bd.localeCompare(ad)
                })

            return { term, profile, items }
        },

        async createMy(args: {
            userId: string
            type: string
            details: string
            classId?: string
            meetingId?: string
        }) {
            const userId = safeStr(args.userId)
            if (!userId) throw new Error("Missing userId")

            const type = safeStr(args.type)
            const details = safeStr(args.details)

            if (!type) throw new Error("Missing request type")
            if (!details) throw new Error("Missing details")

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)
            if (!termId) throw new Error("No active term")

            const profile = await facultyMemberApi.profiles.getByUserId(userId).catch(() => null)
            const departmentId = safeStr(profile?.departmentId)
            if (!departmentId) throw new Error("Missing department")

            const payload = {
                termId,
                departmentId,
                requestedBy: userId,

                classId: safeStr(args.classId) || null,
                meetingId: safeStr(args.meetingId) || null,

                type,
                details,
                status: "Pending",

                reviewedBy: null,
                reviewedAt: null,
                resolutionNotes: null,
            }

            return await tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CHANGE_REQUESTS,
                rowId: ID.unique(),
                data: payload,
            })
        },

        async cancelMy(args: { userId: string; rowId: string }) {
            const userId = safeStr(args.userId)
            const rowId = safeStr(args.rowId)
            if (!userId) throw new Error("Missing userId")
            if (!rowId) throw new Error("Missing rowId")

            // ✅ Ensure it's actually theirs (basic guard)
            const existing = await tablesDB
                .getRow({
                    databaseId: DATABASE_ID,
                    tableId: COLLECTIONS.CHANGE_REQUESTS,
                    rowId,
                })
                .catch(() => null)

            if (!existing) throw new Error("Request not found")
            if (safeStr(existing?.requestedBy) !== userId) throw new Error("Not allowed")

            const status = safeStr(existing?.status || "Pending").toLowerCase()
            if (status !== "pending") throw new Error("Only pending requests can be cancelled")

            return await tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CHANGE_REQUESTS,
                rowId,
                data: { status: "Cancelled" },
            })
        },
    },

    /**
     * ✅ NEW: Notifications (Faculty View)
     * Joins:
     * - NOTIFICATIONS
     * - NOTIFICATION_RECIPIENTS (per-user read state)
     */
    notifications: {
        async listMy(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) {
                return {
                    term: null,
                    profile: null,
                    items: [] as FacultyNotificationItem[],
                }
            }

            const term = await facultyMemberApi.terms.getActive().catch(() => null)
            const termId = safeStr(term?.$id)

            const profile = await facultyMemberApi.profiles.getByUserId(userId).catch(() => null)
            const departmentId = safeStr(profile?.departmentId)

            // 1) Load recipient rows for this user
            const recipients = await listAllRows(
                COLLECTIONS.NOTIFICATION_RECIPIENTS,
                [
                    Query.equal("userId", userId),
                    Query.orderDesc("$updatedAt"),
                ],
                6000
            )

            const recipientMap = new Map<string, AnyRow>()
            for (const r of recipients) {
                const nid = safeStr(r?.notificationId)
                if (!nid) continue
                recipientMap.set(nid, r)
            }

            const notificationIds = Array.from(recipientMap.keys())
            if (notificationIds.length === 0) {
                return { term, profile, items: [] as FacultyNotificationItem[] }
            }

            // 2) Fetch notifications (try by IDs first, fallback to broad filter)
            const notifSet = new Set(notificationIds)
            const notificationsAll: AnyRow[] = []

            // ✅ Attempt by ID chunks (fast)
            let idQueryWorked = true
            try {
                for (const group of chunk(notificationIds, 50)) {
                    const rows = await listAllRows(
                        COLLECTIONS.NOTIFICATIONS,
                        [
                            Query.equal("$id", group),
                            Query.orderDesc("$updatedAt"),
                        ],
                        2000
                    )
                    notificationsAll.push(...rows)
                }
            } catch {
                idQueryWorked = false
            }

            // ✅ Fallback: broad filter by term + dept then filter by set
            if (!idQueryWorked) {
                const base: any[] = [Query.orderDesc("$updatedAt")]

                if (termId) base.push(Query.equal("termId", termId))
                if (departmentId) base.push(Query.equal("departmentId", departmentId))

                const rows = await listAllRows(COLLECTIONS.NOTIFICATIONS, base, 8000)
                notificationsAll.push(...rows.filter((n) => notifSet.has(safeStr(n?.$id))))
            }

            const notifMap = new Map<string, AnyRow>()
            for (const n of notificationsAll) {
                const id = safeStr(n?.$id)
                if (!id) continue
                notifMap.set(id, n)
            }

            // 3) Join recipient + notification
            const joined: FacultyNotificationItem[] = []

            for (const nid of notificationIds) {
                const notif = notifMap.get(nid)
                const rec = recipientMap.get(nid)
                if (!notif || !rec) continue

                joined.push({
                    notificationId: safeStr(notif?.$id),
                    recipientRowId: safeStr(rec?.$id),

                    isRead: Boolean(rec?.isRead),
                    readAt: safeStr(rec?.readAt) || null,

                    type: safeStr(notif?.type),
                    title: safeStr(notif?.title),
                    message: safeStr(notif?.message),
                    link: safeStr(notif?.link) || null,

                    departmentId: safeStr(notif?.departmentId) || null,
                    termId: safeStr(notif?.termId) || null,
                    createdBy: safeStr(notif?.createdBy) || null,

                    createdAt: safeStr(notif?.$createdAt) || null,
                    updatedAt: safeStr(notif?.$updatedAt) || null,
                })
            }

            // ✅ Sort: unread first, then newest
            joined.sort((a, b) => {
                const ar = a.isRead ? 1 : 0
                const br = b.isRead ? 1 : 0
                if (ar !== br) return ar - br

                const ad = safeStr(a.updatedAt || a.createdAt || "")
                const bd = safeStr(b.updatedAt || b.createdAt || "")
                return bd.localeCompare(ad)
            })

            return { term, profile, items: joined }
        },

        async markRead(args: { userId: string; recipientRowId: string }) {
            const userId = safeStr(args.userId)
            const recipientRowId = safeStr(args.recipientRowId)
            if (!userId) throw new Error("Missing userId")
            if (!recipientRowId) throw new Error("Missing recipientRowId")

            const payload = {
                isRead: true,
                readAt: new Date().toISOString(),
            }

            return await tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.NOTIFICATION_RECIPIENTS,
                rowId: recipientRowId,
                data: payload,
            })
        },

        async markAllRead(args: { userId: string }) {
            const userId = safeStr(args.userId)
            if (!userId) throw new Error("Missing userId")

            const rows = await listAllRows(
                COLLECTIONS.NOTIFICATION_RECIPIENTS,
                [
                    Query.equal("userId", userId),
                    Query.equal("isRead", false),
                    Query.orderDesc("$updatedAt"),
                ],
                6000
            )

            let updated = 0
            const now = new Date().toISOString()

            for (const r of rows) {
                const rowId = safeStr(r?.$id)
                if (!rowId) continue

                try {
                    await tablesDB.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.NOTIFICATION_RECIPIENTS,
                        rowId,
                        data: { isRead: true, readAt: now },
                    })
                    updated += 1
                } catch {
                    // ignore individual failures
                }
            }

            return { updatedCount: updated }
        },
    },
}
