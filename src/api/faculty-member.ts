/* eslint-disable @typescript-eslint/no-explicit-any */
import { tablesDB, DATABASE_ID, COLLECTIONS, Query } from "@/lib/db"

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
                            ? `${Number(sec?.yearLevel || 0) || ""}${safeStr(sec?.name) ? ` - ${safeStr(sec?.name)}` : ""}`
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
}
