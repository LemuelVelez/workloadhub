/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Databases, TablesDB, ID, Query, Account } from "appwrite"
import { publicEnv } from "./env"

/**
 * Browser-safe Appwrite client (uses VITE_PUBLIC_* env only)
 * Use this for client-side Database access.
 */
export const appwriteClient = new Client()
    .setEndpoint(publicEnv.APPWRITE_ENDPOINT)
    .setProject(publicEnv.APPWRITE_PROJECT_ID)

export const DATABASE_ID = publicEnv.APPWRITE_DATABASE

export const COLLECTIONS = {
    DEPARTMENTS: "departments",
    PROGRAMS: "programs",
    SUBJECTS: "subjects",
    ROOMS: "rooms",
    ACADEMIC_TERMS: "academic_terms",
    TIME_BLOCKS: "time_blocks",
    SYSTEM_POLICIES: "system_policies",
    SETTINGS: "settings",

    USER_PROFILES: "user_profiles",
    FACULTY_PROFILES: "faculty_profiles",

    // ✅ NEW: match schemaModel.ts
    FIRST_LOGIN_USERS: "first_login_users",

    SECTIONS: "sections",
    SCHEDULE_VERSIONS: "schedule_versions",
    CLASSES: "classes",
    CLASS_MEETINGS: "class_meetings",

    FACULTY_AVAILABILITY: "faculty_availability",
    CHANGE_REQUESTS: "change_requests",

    NOTIFICATIONS: "notifications",
    NOTIFICATION_RECIPIENTS: "notification_recipients",

    AUDIT_LOGS: "audit_logs",
} as const

export { ID, Query }

/**
 * ✅ Account helper (used to auto-detect the current logged-in user as audit actor)
 */
export const account = new Account(appwriteClient)

/**
 * ✅ RAW instances (used internally to avoid recursion when writing audit logs)
 */
const databasesRaw = new Databases(appwriteClient)
const tablesDBRaw = new TablesDB(appwriteClient)

/**
 * ✅ Audit Log Helpers (AUTO INSERT to audit_logs on create/update/delete)
 */
const AUDIT_MAX_JSON_LEN = 20000
const ACTOR_CACHE_TTL_MS = 30_000

let cachedActorUserId: string | null = null
let cachedActorAt = 0

function isDevMode() {
    try {
        // Works in Vite

        return typeof import.meta !== "undefined" && (import.meta as any)?.env?.DEV
    } catch {
        return false
    }
}

function stripSystemFields(obj: any) {
    if (!obj || typeof obj !== "object") return obj
    const out: any = {}
    for (const [k, v] of Object.entries(obj)) {
        if (String(k).startsWith("$")) continue
        out[k] = v
    }
    return out
}

function safeJsonStringify(obj: any, maxLen = AUDIT_MAX_JSON_LEN) {
    if (obj === undefined) return null
    try {
        const s = JSON.stringify(obj)
        if (s.length <= maxLen) return s
        return s.slice(0, maxLen) + "…(truncated)"
    } catch {
        return null
    }
}

async function tryGetActorUserIdCached() {
    const now = Date.now()
    if (cachedActorUserId && now - cachedActorAt < ACTOR_CACHE_TTL_MS) return cachedActorUserId

    try {
        const u = await account.get()
        cachedActorUserId = String(u?.$id || "")
        cachedActorAt = now
        return cachedActorUserId || null
    } catch {
        return null
    }
}

async function writeAuditLogInternal(args: {
    action: string
    entityType: string
    entityId: string
    before?: any
    after?: any
    meta?: any
    actorUserId?: string | null
}) {
    try {
        const actor =
            (args.actorUserId && String(args.actorUserId).trim()) ||
            (await tryGetActorUserIdCached()) ||
            "SYSTEM"

        const createdAt = new Date().toISOString()

        const beforeStr = safeJsonStringify(stripSystemFields(args.before))
        const afterStr = safeJsonStringify(stripSystemFields(args.after))
        const metaStr = safeJsonStringify(args.meta)

        if (!args.entityType || !args.entityId || !args.action) return

        await tablesDBRaw.createRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.AUDIT_LOGS,
            rowId: ID.unique(),
            data: {
                actorUserId: actor,
                action: args.action,
                entityType: args.entityType,
                entityId: args.entityId,
                before: beforeStr,
                after: afterStr,
                meta: metaStr,
                createdAt,
            },
        })
    } catch (err) {
        if (isDevMode()) {

            console.warn("[AUDIT_LOGS] Failed to write audit log:", err)
        }
    }
}

/**
 * ✅ Backwards compatibility: OLD Databases API
 * Now automatically logs CREATE/UPDATE/DELETE operations into AUDIT_LOGS.
 */
export const databases = new Proxy(databasesRaw as any, {
    get(target, prop) {
        if (prop === "createDocument") {
            return async (args: any) => {
                const res = await target.createDocument(args)

                const collectionId = String(args?.collectionId || "")
                if (collectionId && collectionId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "CREATE",
                        entityType: collectionId,
                        entityId: String(res?.$id || args?.documentId || ""),
                        before: null,
                        after: res,
                        meta: {
                            source: "Databases.createDocument",
                            databaseId: args?.databaseId,
                            collectionId,
                        },
                    })
                }

                return res
            }
        }

        if (prop === "updateDocument") {
            return async (args: any) => {
                const collectionId = String(args?.collectionId || "")
                const documentId = String(args?.documentId || "")

                let before: any = null
                try {
                    if (collectionId && documentId && collectionId !== COLLECTIONS.AUDIT_LOGS) {
                        before = await target.getDocument(args.databaseId, collectionId, documentId)
                    }
                } catch {
                    // ignore
                }

                const res = await target.updateDocument(args)

                if (collectionId && documentId && collectionId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "UPDATE",
                        entityType: collectionId,
                        entityId: documentId,
                        before,
                        after: res,
                        meta: {
                            source: "Databases.updateDocument",
                            databaseId: args?.databaseId,
                            collectionId,
                        },
                    })
                }

                return res
            }
        }

        if (prop === "deleteDocument") {
            return async (args: any) => {
                const collectionId = String(args?.collectionId || "")
                const documentId = String(args?.documentId || "")

                let before: any = null
                try {
                    if (collectionId && documentId && collectionId !== COLLECTIONS.AUDIT_LOGS) {
                        before = await target.getDocument(args.databaseId, collectionId, documentId)
                    }
                } catch {
                    // ignore
                }

                const res = await target.deleteDocument(args)

                if (collectionId && documentId && collectionId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "DELETE",
                        entityType: collectionId,
                        entityId: documentId,
                        before,
                        after: null,
                        meta: {
                            source: "Databases.deleteDocument",
                            databaseId: args?.databaseId,
                            collectionId,
                        },
                    })
                }

                return res
            }
        }

        const v = target[prop]
        return typeof v === "function" ? v.bind(target) : v
    },
}) as any

/**
 * ✅ NEW: TablesDB (Appwrite 1.8+ replacement)
 * Now automatically logs CREATE/UPDATE/DELETE operations into AUDIT_LOGS.
 */
export const tablesDB = new Proxy(tablesDBRaw as any, {
    get(target, prop) {
        if (prop === "createRow") {
            return async (args: any) => {
                const res = await target.createRow(args)

                const tableId = String(args?.tableId || "")
                if (tableId && tableId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "CREATE",
                        entityType: tableId,
                        entityId: String(res?.$id || args?.rowId || ""),
                        before: null,
                        after: res,
                        meta: {
                            source: "TablesDB.createRow",
                            databaseId: args?.databaseId,
                            tableId,
                        },
                    })
                }

                return res
            }
        }

        if (prop === "updateRow") {
            return async (args: any) => {
                const tableId = String(args?.tableId || "")
                const rowId = String(args?.rowId || "")

                let before: any = null
                try {
                    if (tableId && rowId && tableId !== COLLECTIONS.AUDIT_LOGS) {
                        before = await target.getRow({
                            databaseId: args.databaseId,
                            tableId,
                            rowId,
                        })
                    }
                } catch {
                    // ignore
                }

                const res = await target.updateRow(args)

                if (tableId && rowId && tableId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "UPDATE",
                        entityType: tableId,
                        entityId: rowId,
                        before,
                        after: res,
                        meta: {
                            source: "TablesDB.updateRow",
                            databaseId: args?.databaseId,
                            tableId,
                        },
                    })
                }

                return res
            }
        }

        if (prop === "deleteRow") {
            return async (args: any) => {
                const tableId = String(args?.tableId || "")
                const rowId = String(args?.rowId || "")

                let before: any = null
                try {
                    if (tableId && rowId && tableId !== COLLECTIONS.AUDIT_LOGS) {
                        before = await target.getRow({
                            databaseId: args.databaseId,
                            tableId,
                            rowId,
                        })
                    }
                } catch {
                    // ignore
                }

                const res = await target.deleteRow(args)

                if (tableId && rowId && tableId !== COLLECTIONS.AUDIT_LOGS) {
                    await writeAuditLogInternal({
                        action: "DELETE",
                        entityType: tableId,
                        entityId: rowId,
                        before,
                        after: null,
                        meta: {
                            source: "TablesDB.deleteRow",
                            databaseId: args?.databaseId,
                            tableId,
                        },
                    })
                }

                return res
            }
        }

        const v = target[prop]
        return typeof v === "function" ? v.bind(target) : v
    },
}) as any
