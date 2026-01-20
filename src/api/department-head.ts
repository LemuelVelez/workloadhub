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

function safeStr(v: any) {
    return String(v ?? "").trim()
}

function uniqStrings(values: any[]) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const v of values ?? []) {
        const s = safeStr(v)
        if (!s) continue
        if (seen.has(s)) continue
        seen.add(s)
        out.push(s)
    }
    return out
}

export const departmentHeadApi = {
    /**
     * ✅ NEW: Departments helper (for displaying department NAME not ID)
     */
    departments: {
        async getById(departmentId: string) {
            const id = safeStr(departmentId)
            if (!id) return null

            const rows = await listAllRows(
                COLLECTIONS.DEPARTMENTS,
                [Query.equal("$id", id), Query.orderDesc("$updatedAt")],
                5
            )

            return rows[0] ?? null
        },

        async listAll() {
            return listAllRows(
                COLLECTIONS.DEPARTMENTS,
                [Query.orderAsc("name"), Query.orderAsc("$updatedAt")],
                2000
            )
        },
    },

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

        async create(args: {
            termId: string
            departmentId: string
            createdBy: string
            label?: string | null
            notes?: string | null
            copyFromVersionId?: string | null
        }) {
            const { termId, departmentId, createdBy, label, notes, copyFromVersionId } = args

            if (!termId || !departmentId || !createdBy) {
                throw new Error("Missing required fields (termId, departmentId, createdBy).")
            }

            // Determine next version number
            const existing = await listAllRows(
                COLLECTIONS.SCHEDULE_VERSIONS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.orderDesc("version"),
                ],
                50
            )

            const maxVersion = existing.reduce((acc, row) => {
                const v = Number(row?.version)
                return Number.isFinite(v) ? Math.max(acc, v) : acc
            }, 0)

            const nextVersion = maxVersion + 1

            const versionRow: any = await tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.SCHEDULE_VERSIONS,
                rowId: ID.unique(),
                data: {
                    termId,
                    departmentId,
                    version: nextVersion,
                    label: label ?? null,
                    status: "Draft",
                    createdBy,
                    lockedBy: null,
                    lockedAt: null,
                    notes: notes ?? null,
                },
            })

            const newVersionId = safeStr(versionRow?.$id)

            // Optional: Copy classes + meetings from existing version
            const sourceId = safeStr(copyFromVersionId)
            if (sourceId && newVersionId) {
                const sourceClasses = await listAllRows(
                    COLLECTIONS.CLASSES,
                    [
                        Query.equal("termId", termId),
                        Query.equal("departmentId", departmentId),
                        Query.equal("versionId", sourceId),
                    ],
                    5000
                )

                const classIdMap = new Map<string, string>()

                for (const c of sourceClasses) {
                    const oldId = safeStr(c?.$id)
                    const newId = ID.unique()
                    classIdMap.set(oldId, newId)

                    await tablesDB.createRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.CLASSES,
                        rowId: newId,
                        data: {
                            versionId: newVersionId,
                            termId,
                            departmentId,
                            programId: c?.programId ?? null,
                            sectionId: c?.sectionId,
                            subjectId: c?.subjectId,
                            facultyUserId: c?.facultyUserId ?? null,
                            classCode: c?.classCode ?? null,
                            deliveryMode: c?.deliveryMode ?? null,
                            status: c?.status ?? "Planned",
                            remarks: c?.remarks ?? null,
                        },
                    })
                }

                const sourceMeetings = await listAllRows(
                    COLLECTIONS.CLASS_MEETINGS,
                    [Query.equal("versionId", sourceId)],
                    8000
                )

                for (const m of sourceMeetings) {
                    const oldClassId = safeStr(m?.classId)
                    const newClassId = classIdMap.get(oldClassId)

                    // If class wasn't copied for some reason, skip meeting
                    if (!newClassId) continue

                    await tablesDB.createRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.CLASS_MEETINGS,
                        rowId: ID.unique(),
                        data: {
                            versionId: newVersionId,
                            classId: newClassId,
                            dayOfWeek: m?.dayOfWeek,
                            startTime: m?.startTime,
                            endTime: m?.endTime,
                            roomId: m?.roomId ?? null,
                            meetingType: m?.meetingType ?? "LECTURE",
                            notes: m?.notes ?? null,
                        },
                    })
                }
            }

            return versionRow
        },

        async setActive(args: { termId: string; departmentId: string; versionId: string }) {
            const { termId, departmentId, versionId } = args
            if (!termId || !departmentId || !versionId) throw new Error("Missing required fields.")

            // Ensure only ONE active version (Draft others that are Active)
            const rows = await listAllRows(
                COLLECTIONS.SCHEDULE_VERSIONS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.orderDesc("version"),
                ],
                200
            )

            for (const r of rows) {
                const id = safeStr(r?.$id)
                const status = safeStr(r?.status)

                if (!id) continue
                if (id === versionId) continue

                if (status === "Active") {
                    await tablesDB.updateRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.SCHEDULE_VERSIONS,
                        rowId: id,
                        data: { status: "Draft" },
                    })
                }
            }

            // Set selected version Active (if not Locked/Archived)
            const target = rows.find((x) => safeStr(x?.$id) === versionId)
            const targetStatus = safeStr(target?.status)

            if (targetStatus === "Locked") {
                throw new Error("Locked versions cannot be activated.")
            }
            if (targetStatus === "Archived") {
                throw new Error("Archived versions cannot be activated.")
            }

            return tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.SCHEDULE_VERSIONS,
                rowId: versionId,
                data: { status: "Active" },
            })
        },

        async lock(args: { versionId: string; lockedBy: string; notes?: string | null }) {
            const { versionId, lockedBy, notes } = args
            if (!versionId || !lockedBy) throw new Error("Missing versionId or lockedBy.")

            return tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.SCHEDULE_VERSIONS,
                rowId: versionId,
                data: {
                    status: "Locked",
                    lockedBy,
                    lockedAt: new Date().toISOString(),
                    notes: notes ?? null,
                },
            })
        },

        async archive(args: { versionId: string }) {
            const { versionId } = args
            if (!versionId) throw new Error("Missing versionId.")

            return tablesDB.updateRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.SCHEDULE_VERSIONS,
                rowId: versionId,
                data: { status: "Archived" },
            })
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
            return listAllRows(
                COLLECTIONS.CLASSES,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.equal("versionId", versionId),
                    Query.orderDesc("$updatedAt"),
                ],
                5000
            )
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
            return listAllRows(
                COLLECTIONS.CLASS_MEETINGS,
                [Query.equal("versionId", versionId), Query.orderDesc("$updatedAt")],
                12000
            )
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

    /**
     * ✅ NEW: Announcements / Notifications
     * Department Head sends updates to Faculty users via:
     * - notifications table (message payload)
     * - notification_recipients table (fan-out per user)
     */
    notifications: {
        async listByDepartmentTerm(args: { departmentId: string; termId?: string | null }) {
            const { departmentId, termId } = args
            if (!departmentId) return []

            const queries: any[] = [Query.equal("departmentId", departmentId), Query.orderDesc("$createdAt")]

            if (safeStr(termId)) {
                queries.splice(1, 0, Query.equal("termId", safeStr(termId)))
            }

            return listAllRows(COLLECTIONS.NOTIFICATIONS, queries, 1500)
        },

        async createAndSend(args: {
            departmentId: string
            termId?: string | null
            createdBy: string
            type: string
            title: string
            message: string
            link?: string | null
            recipientUserIds: string[]
        }) {
            const departmentId = safeStr(args.departmentId)
            const termId = safeStr(args.termId)
            const createdBy = safeStr(args.createdBy)
            const type = safeStr(args.type) || "Announcement"
            const title = safeStr(args.title)
            const message = safeStr(args.message)
            const link = safeStr(args.link)

            if (!departmentId || !createdBy || !title || !message) {
                throw new Error("Missing required fields (departmentId, createdBy, title, message).")
            }

            const recipientIds = uniqStrings(args.recipientUserIds ?? [])
            if (recipientIds.length === 0) {
                throw new Error("No recipients found.")
            }

            const notification: any = await tablesDB.createRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.NOTIFICATIONS,
                rowId: ID.unique(),
                data: {
                    departmentId,
                    termId: termId || null,
                    createdBy,
                    type,
                    title,
                    message,
                    link: link || null,
                },
            })

            const notificationId = safeStr(notification?.$id)
            if (!notificationId) {
                throw new Error("Failed to create notification.")
            }

            // Fan-out recipients
            let createdCount = 0
            for (const userId of recipientIds) {
                await tablesDB.createRow({
                    databaseId: DATABASE_ID,
                    tableId: COLLECTIONS.NOTIFICATION_RECIPIENTS,
                    rowId: ID.unique(),
                    data: {
                        notificationId,
                        userId,
                        isRead: false,
                        readAt: null,
                    },
                })
                createdCount++
            }

            return { notification, recipientsCreated: createdCount }
        },

        async listRecipients(notificationId: string) {
            const id = safeStr(notificationId)
            if (!id) return []

            return listAllRows(
                COLLECTIONS.NOTIFICATION_RECIPIENTS,
                [Query.equal("notificationId", id), Query.orderDesc("$createdAt")],
                5000
            )
        },
    },

    /**
     * ✅ NEW: Changes / Requests list for Reports Module
     */
    changeRequests: {
        async listByTermDepartment(termId: string, departmentId: string) {
            if (!termId || !departmentId) return []
            return listAllRows(
                COLLECTIONS.CHANGE_REQUESTS,
                [
                    Query.equal("termId", termId),
                    Query.equal("departmentId", departmentId),
                    Query.orderDesc("$updatedAt"),
                ],
                2500
            )
        },
    },
}
