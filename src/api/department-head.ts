/* eslint-disable @typescript-eslint/no-explicit-any */
import { tablesDB, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

type AnyRow = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

async function listAllRows(tableId: string, baseQueries: any[] = [], max = 800) {
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

function normalizeRole(role: any) {
    return String(role ?? "").trim().toLowerCase()
}

function isFacultyRole(role: any) {
    const r = normalizeRole(role)
    return r.includes("faculty")
}

export const departmentHeadApi = {
    terms: {
        async getActive() {
            const rows = await listAllRows(COLLECTIONS.ACADEMIC_TERMS, [
                Query.equal("isActive", true),
                Query.orderDesc("$updatedAt"),
            ])
            return rows[0] ?? null
        },
    },

    /**
     * ✅ Current user's profile lookup
     * Source of truth:
     * - role
     * - departmentId
     */
    profiles: {
        async getByUserId(userId: string) {
            if (!userId) return null
            const rows = await listAllRows(
                COLLECTIONS.USER_PROFILES,
                [Query.equal("userId", userId), Query.orderDesc("$updatedAt")],
                5
            )
            return rows[0] ?? null
        },
    },

    scheduleVersions: {
        async listByTermDepartment(termId: string, departmentId: string) {
            if (!termId || !departmentId) return []
            return listAllRows(COLLECTIONS.SCHEDULE_VERSIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.orderDesc("version"),
            ])
        },
    },

    subjects: {
        async listByDepartment(departmentId: string) {
            if (!departmentId) return []
            return listAllRows(COLLECTIONS.SUBJECTS, [
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),
                Query.orderAsc("code"),
            ])
        },
    },

    sections: {
        async listByTermDepartment(termId: string, departmentId: string) {
            if (!termId || !departmentId) return []
            return listAllRows(COLLECTIONS.SECTIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),
                Query.orderAsc("yearLevel"),
                Query.orderAsc("name"),
            ])
        },
    },

    faculty: {
        async listByDepartment(departmentId: string) {
            if (!departmentId) return { users: [], profiles: [] }

            const userProfiles = await listAllRows(COLLECTIONS.USER_PROFILES, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("name"),
            ])

            const facultyUsers = userProfiles.filter((u) => isFacultyRole(u?.role))

            const facultyProfiles = await listAllRows(COLLECTIONS.FACULTY_PROFILES, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("userId"),
            ])

            return {
                users: facultyUsers,
                profiles: facultyProfiles,
            }
        },
    },

    facultyAvailability: {
        async listByTerm(termId: string) {
            if (!termId) return []
            return listAllRows(COLLECTIONS.FACULTY_AVAILABILITY, [
                Query.equal("termId", termId),
                Query.orderDesc("$updatedAt"),
            ])
        },

        async listByTermUser(termId: string, userId: string) {
            if (!termId || !userId) return []
            return listAllRows(COLLECTIONS.FACULTY_AVAILABILITY, [
                Query.equal("termId", termId),
                Query.equal("userId", userId),
                Query.orderDesc("$updatedAt"),
            ])
        },
    },

    timeBlocks: {
        async listByTerm(termId: string) {
            if (!termId) return []
            return listAllRows(COLLECTIONS.TIME_BLOCKS, [
                Query.equal("termId", termId),
                Query.equal("isActive", true),
                Query.orderAsc("dayOfWeek"),
                Query.orderAsc("startTime"),
            ])
        },
    },

    rooms: {
        async listActive() {
            return listAllRows(COLLECTIONS.ROOMS, [
                Query.equal("isActive", true),
                Query.orderAsc("code"),
            ])
        },
    },

    classes: {
        async listByVersion(termId: string, departmentId: string, versionId: string) {
            if (!termId || !departmentId || !versionId) return []
            return listAllRows(COLLECTIONS.CLASSES, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("versionId", versionId),
                Query.orderDesc("$updatedAt"),
            ])
        },

        async unassign(classId: string) {
            if (!classId) throw new Error("Missing classId.")
            return tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CLASSES,
                rowId: classId,
                data: { facultyUserId: null },
            })
        },

        async findOffering(args: {
            versionId: string
            termId: string
            departmentId: string
            sectionId: string
            subjectId: string
        }) {
            const { versionId, termId, departmentId, sectionId, subjectId } = args
            if (!versionId || !termId || !departmentId || !sectionId || !subjectId) return null

            const existing = await listAllRows(
                COLLECTIONS.CLASSES,
                [
                    Query.equal("versionId", versionId),
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("sectionId", sectionId),
                    Query.equal("subjectId", subjectId),
                ],
                5
            )

            return existing?.[0] ?? null
        },

        async assignOrCreate(args: {
            versionId: string
            termId: string
            departmentId: string
            sectionId: string
            subjectId: string
            facultyUserId: string
            classCode?: string | null
            deliveryMode?: string | null
            remarks?: string | null
        }) {
            const {
                versionId,
                termId,
                departmentId,
                sectionId,
                subjectId,
                facultyUserId,
                classCode,
                deliveryMode,
                remarks,
            } = args

            if (!versionId || !termId || !departmentId || !sectionId || !subjectId || !facultyUserId) {
                throw new Error("Missing required assignment fields.")
            }

            const existing = await listAllRows(
                COLLECTIONS.CLASSES,
                [
                    Query.equal("versionId", versionId),
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("sectionId", sectionId),
                    Query.equal("subjectId", subjectId),
                ],
                5
            )

            if (existing?.[0]?.$id) {
                return tablesDB.updateRow({
                    databaseId: DATABASE_ID,
                    tableId: COLLECTIONS.CLASSES,
                    rowId: existing[0].$id,
                    data: {
                        facultyUserId,
                        classCode: classCode ?? existing[0]?.classCode ?? null,
                        deliveryMode: deliveryMode ?? existing[0]?.deliveryMode ?? null,
                        remarks: remarks ?? existing[0]?.remarks ?? null,
                    },
                })
            }

            return tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CLASSES,
                rowId: ID.unique(),
                data: {
                    versionId,
                    termId,
                    departmentId,
                    programId: null,
                    sectionId,
                    subjectId,
                    facultyUserId,
                    classCode: classCode ?? null,
                    deliveryMode: deliveryMode ?? null,
                    status: "Planned",
                    remarks: remarks ?? null,
                },
            })
        },
    },

    classMeetings: {
        async listByVersion(versionId: string) {
            if (!versionId) return []
            return listAllRows(COLLECTIONS.CLASS_MEETINGS, [
                Query.equal("versionId", versionId),
                Query.orderDesc("$updatedAt"),
            ])
        },

        async create(args: {
            versionId: string
            classId: string
            dayOfWeek: string
            startTime: string
            endTime: string
            roomId?: string | null
            meetingType?: string | null
            notes?: string | null
        }) {
            const { versionId, classId, dayOfWeek, startTime, endTime, roomId, meetingType, notes } =
                args

            if (!versionId || !classId || !dayOfWeek || !startTime || !endTime) {
                throw new Error("Missing required meeting fields.")
            }

            return tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CLASS_MEETINGS,
                rowId: ID.unique(),
                data: {
                    versionId,
                    classId,
                    dayOfWeek,
                    startTime,
                    endTime,
                    roomId: roomId ?? null,
                    meetingType: meetingType ?? "LECTURE",
                    notes: notes ?? null,
                },
            })
        },

        async update(meetingId: string, data: any) {
            if (!meetingId) throw new Error("Missing meetingId.")
            return tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CLASS_MEETINGS,
                rowId: meetingId,
                data,
            })
        },

        async delete(meetingId: string) {
            if (!meetingId) throw new Error("Missing meetingId.")
            return tablesDB.deleteRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.CLASS_MEETINGS,
                rowId: meetingId,
            })
        },
    },
}
