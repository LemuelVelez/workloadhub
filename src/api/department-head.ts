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
     * ✅ NEW: Current user's profile lookup
     * We use USER_PROFILES as source of truth for:
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
         * ✅ Assign logic:
         * If an offering for (versionId+sectionId+subjectId) exists -> update facultyUserId
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
            const existing = await listAllDocuments(COLLECTIONS.CLASSES, [
                Query.equal("versionId", versionId),
                Query.equal("termId", termId),
                Query.equal("departmentId", departmentId),
                Query.equal("sectionId", sectionId),
                Query.equal("subjectId", subjectId),
            ], 5)

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
}
