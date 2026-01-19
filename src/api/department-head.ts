/* eslint-disable @typescript-eslint/no-explicit-any */
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from "@/lib/db"

type AnyDoc = {
    $id: string
    $createdAt?: string
    $updatedAt?: string
    [key: string]: any
}

async function listAllDocuments(collectionId: string, baseQueries: any[] = [], max = 800) {
    const limit = 100
    let offset = 0
    const all: AnyDoc[] = []

    while (true) {
        const queries = [
            ...baseQueries.filter((q) => typeof q === "string"),
            Query.limit(limit),
            Query.offset(offset),
        ]

        const res: any = await databases.listDocuments(DATABASE_ID, collectionId, queries)
        const docs: AnyDoc[] = Array.isArray(res?.documents) ? res.documents : []

        all.push(...docs)

        if (docs.length < limit) break
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
            const docs = await listAllDocuments(COLLECTIONS.ACADEMIC_TERMS, [
                Query.equal("isActive", true),
                Query.orderDesc("$updatedAt"),
            ])
            return docs[0] ?? null
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
            const docs = await listAllDocuments(
                COLLECTIONS.USER_PROFILES,
                [
                    Query.equal("userId", userId),
                    Query.orderDesc("$updatedAt"),
                ],
                5
            )
            return docs[0] ?? null
        },
    },

    scheduleVersions: {
        async listByTermDepartment(termId: string, departmentId: string) {
            if (!termId || !departmentId) return []
            const docs = await listAllDocuments(COLLECTIONS.SCHEDULE_VERSIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.orderDesc("version"),
            ])
            return docs
        },
    },

    subjects: {
        async listByDepartment(departmentId: string) {
            if (!departmentId) return []
            const docs = await listAllDocuments(COLLECTIONS.SUBJECTS, [
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),
                Query.orderAsc("code"),
            ])
            return docs
        },
    },

    sections: {
        async listByTermDepartment(termId: string, departmentId: string) {
            if (!termId || !departmentId) return []
            const docs = await listAllDocuments(COLLECTIONS.SECTIONS, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("isActive", true),

                // ✅ Better ordering: Year Level then Name (prevents confusing duplicates)
                Query.orderAsc("yearLevel"),
                Query.orderAsc("name"),
            ])
            return docs
        },
    },

    faculty: {
        async listByDepartment(departmentId: string) {
            if (!departmentId) return { users: [], profiles: [] }

            const userProfiles = await listAllDocuments(COLLECTIONS.USER_PROFILES, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("name"),
            ])

            const facultyUsers = userProfiles.filter((u) => isFacultyRole(u?.role))

            const facultyProfiles = await listAllDocuments(COLLECTIONS.FACULTY_PROFILES, [
                Query.equal("departmentId", departmentId),
                Query.orderAsc("userId"),
            ])

            return {
                users: facultyUsers,
                profiles: facultyProfiles,
            }
        },
    },

    /**
     * ✅ NEW: Faculty Availability (Preferences)
     * - Uses faculty_availability collection
     * - termId is required
     */
    facultyAvailability: {
        async listByTerm(termId: string) {
            if (!termId) return []
            const docs = await listAllDocuments(COLLECTIONS.FACULTY_AVAILABILITY, [
                Query.equal("termId", termId),
                Query.orderDesc("$updatedAt"),
            ])
            return docs
        },

        async listByTermUser(termId: string, userId: string) {
            if (!termId || !userId) return []
            const docs = await listAllDocuments(COLLECTIONS.FACULTY_AVAILABILITY, [
                Query.equal("termId", termId),
                Query.equal("userId", userId),
                Query.orderDesc("$updatedAt"),
            ])
            return docs
        },
    },

    // ✅ NEW: Rooms loader (for scheduling room selection)
    rooms: {
        async listActive() {
            const docs = await listAllDocuments(COLLECTIONS.ROOMS, [
                Query.equal("isActive", true),
                Query.orderAsc("code"),
            ])
            return docs
        },
    },

    classes: {
        async listByVersion(termId: string, departmentId: string, versionId: string) {
            if (!termId || !departmentId || !versionId) return []
            const docs = await listAllDocuments(COLLECTIONS.CLASSES, [
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("versionId", versionId),
                Query.orderDesc("$updatedAt"),
            ])
            return docs
        },

        async unassign(classId: string) {
            if (!classId) throw new Error("Missing classId.")
            return databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASSES, classId, {
                facultyUserId: null,
            })
        },

        /**
         * ✅ NEW: Find an existing class offering by (version+term+dept+section+subject)
         * Used by Class Scheduling to avoid duplicating assignment logic.
         */
        async findOffering(args: {
            versionId: string
            termId: string
            departmentId: string
            sectionId: string
            subjectId: string
        }) {
            const { versionId, termId, departmentId, sectionId, subjectId } = args

            if (!versionId || !termId || !departmentId || !sectionId || !subjectId) return null

            const existing = await listAllDocuments(
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

        /**
         * ✅ Assign logic:
         * If offering for (versionId+sectionId+subjectId) exists -> update facultyUserId
         * else -> create new class offering with facultyUserId
         */
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

            // Try find existing class offering
            const existing = await listAllDocuments(
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
                return databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASSES, existing[0].$id, {
                    facultyUserId,
                    classCode: classCode ?? existing[0]?.classCode ?? null,
                    deliveryMode: deliveryMode ?? existing[0]?.deliveryMode ?? null,
                    remarks: remarks ?? existing[0]?.remarks ?? null,
                })
            }

            return databases.createDocument(DATABASE_ID, COLLECTIONS.CLASSES, ID.unique(), {
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
            })
        },
    },

    // ✅ NEW: Meeting schedules CRUD (CLASS_MEETINGS)
    classMeetings: {
        async listByVersion(versionId: string) {
            if (!versionId) return []
            const docs = await listAllDocuments(COLLECTIONS.CLASS_MEETINGS, [
                Query.equal("versionId", versionId),
                Query.orderDesc("$updatedAt"),
            ])
            return docs
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
            const { versionId, classId, dayOfWeek, startTime, endTime, roomId, meetingType, notes } = args

            if (!versionId || !classId || !dayOfWeek || !startTime || !endTime) {
                throw new Error("Missing required meeting fields.")
            }

            return databases.createDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, ID.unique(), {
                versionId,
                classId,
                dayOfWeek,
                startTime,
                endTime,
                roomId: roomId ?? null,
                meetingType: meetingType ?? "LECTURE",
                notes: notes ?? null,
            })
        },

        async update(meetingId: string, data: any) {
            if (!meetingId) throw new Error("Missing meetingId.")
            return databases.updateDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meetingId, data)
        },

        async delete(meetingId: string) {
            if (!meetingId) throw new Error("Missing meetingId.")
            return databases.deleteDocument(DATABASE_ID, COLLECTIONS.CLASS_MEETINGS, meetingId)
        },
    },
}
