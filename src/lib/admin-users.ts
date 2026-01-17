/* eslint-disable @typescript-eslint/no-explicit-any */
import { ID, Query, TablesDB } from "appwrite"

import { appwriteClient } from "@/lib/db"
import { publicEnv } from "@/lib/env"
import { COLLECTIONS, ATTR } from "@/model/schemaModel"

// ✅ NEW
import { upsertFirstLoginRecord } from "@/lib/first-login"

export type AdminUserRole = "ADMIN" | "CHAIR" | "FACULTY"

export type AdminUserCreateInput = {
    email: string
    name?: string | null
    role: AdminUserRole
    departmentId?: string | null
    isActive: boolean
}

export type AdminUserProfileInput = {
    userId: string
    email: string
    name?: string | null
    role: AdminUserRole
    departmentId?: string | null
    isActive: boolean
}

export type AdminUserProfileDoc = {
    $id: string
    $createdAt: string
    $updatedAt: string
    userId: string
    email: string
    name?: string | null
    role: string
    departmentId?: string | null
    isActive: boolean
}

export type DepartmentDocLite = {
    $id: string
    code: string
    name: string
    isActive: boolean
}

type BackendCredentialsResponse = {
    ok: boolean
    action: "created" | "resent"
    userId: string
    email: string
    message?: string
}

type BackendDeleteAuthUserResponse = {
    ok: boolean
    userId: string
    message?: string
}

type BackendSetAuthStatusResponse = {
    ok: boolean
    userId: string
    status: boolean
    message?: string
}

function getDatabaseId(): string {
    const anyEnv = publicEnv as any

    const dbId =
        anyEnv?.APPWRITE_DATABASE ||
        anyEnv?.APPWRITE_DATABASE_ID ||
        anyEnv?.DATABASE_ID ||
        anyEnv?.DB_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE ||
        null

    if (!dbId) throw new Error("Missing Appwrite Database ID in env.")
    return String(dbId)
}

const tablesDB = new TablesDB(appwriteClient)

async function postJson<T>(url: string, body: any): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body ?? {}),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok) {
        throw new Error(data?.message || `Request failed (${res.status})`)
    }

    return data as T
}

/**
 * ✅ SAFELY convert Appwrite DefaultRow -> AdminUserProfileDoc
 */
function toAdminUserProfileDoc(row: any): AdminUserProfileDoc {
    return {
        $id: String(row?.$id ?? row?.id ?? ""),
        $createdAt: String(row?.$createdAt ?? row?.createdAt ?? ""),
        $updatedAt: String(row?.$updatedAt ?? row?.updatedAt ?? ""),
        userId: String(row?.userId ?? ""),
        email: String(row?.email ?? ""),
        name: typeof row?.name === "string" ? row.name : row?.name ?? null,
        role: String(row?.role ?? ""),
        departmentId: row?.departmentId ?? null,
        isActive: Boolean(row?.isActive),
    }
}

export async function listDepartmentsLite(opts?: { activeOnly?: boolean }) {
    const activeOnly = opts?.activeOnly ?? true
    const dbId = getDatabaseId()

    const queries: string[] = [Query.limit(200), Query.orderAsc(ATTR.DEPARTMENTS.name)]
    if (activeOnly) queries.push(Query.equal(ATTR.DEPARTMENTS.isActive, true))

    const res = await tablesDB.listRows({
        databaseId: dbId,
        tableId: COLLECTIONS.DEPARTMENTS,
        queries,
    })

    return ((res as any)?.rows ?? []) as DepartmentDocLite[]
}

export async function listUserProfiles(opts?: { includeInactive?: boolean; limit?: number }) {
    const includeInactive = opts?.includeInactive ?? true
    const limit = opts?.limit ?? 200
    const dbId = getDatabaseId()

    const queries: string[] = [Query.limit(limit), Query.orderDesc("$createdAt")]
    if (!includeInactive) queries.push(Query.equal(ATTR.USER_PROFILES.isActive, true))

    const res = await tablesDB.listRows({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        queries,
    })

    const rows = ((res as any)?.rows ?? []) as any[]
    return rows.map(toAdminUserProfileDoc)
}

/**
 * ✅ Create user using Express backend
 * ✅ ALSO creates a first-login gate record
 */
export async function createUserWithInvite(input: AdminUserCreateInput) {
    const dbId = getDatabaseId()

    const email = input.email.trim().toLowerCase()
    const name = input.name?.trim() || ""
    const role = input.role
    const departmentId = input.departmentId?.trim() || null
    const isActive = Boolean(input.isActive)

    if (!email) throw new Error("Email is required.")
    if (!role) throw new Error("Role is required.")

    const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
    const resp = await postJson<BackendCredentialsResponse>(`${apiBase}/api/admin/send-login-credentials`, {
        email,
        name: name || undefined,
        resend: false,
    })

    const userId = String(resp?.userId || "").trim()
    if (!userId) throw new Error("Backend did not return a valid userId.")

    const payload: any = {
        userId,
        email,
        name: name || null,
        role,
        departmentId,
        isActive,
    }

    const row = await tablesDB.createRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: ID.unique(),
        data: payload,
    })

    await upsertFirstLoginRecord(userId, "created").catch(() => null)

    return toAdminUserProfileDoc(row)
}

export async function updateUserProfile(docId: string, patch: Partial<AdminUserProfileInput>) {
    const dbId = getDatabaseId()

    const payload: any = {}

    if (typeof patch.userId === "string") payload.userId = patch.userId.trim()
    if (typeof patch.email === "string") payload.email = patch.email.trim().toLowerCase()
    if (typeof patch.name === "string" || patch.name === null) payload.name = patch.name
    if (typeof patch.role === "string") payload.role = patch.role
    if (typeof patch.departmentId === "string" || patch.departmentId === null) payload.departmentId = patch.departmentId
    if (typeof patch.isActive === "boolean") payload.isActive = patch.isActive

    const row = await tablesDB.updateRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: docId,
        data: payload,
    })

    return toAdminUserProfileDoc(row)
}

/**
 * ✅ Toggle Active also disables/enables Appwrite Auth user (login blocked)
 */
export async function setUserActive(opts: { docId: string; userId: string; isActive: boolean }) {
    const dbId = getDatabaseId()

    const docId = String(opts.docId || "").trim()
    const userId = String(opts.userId || "").trim()
    const isActive = Boolean(opts.isActive)

    if (!docId) throw new Error("Missing docId.")
    if (!userId) throw new Error("Missing userId.")

    const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
    await postJson<BackendSetAuthStatusResponse>(`${apiBase}/api/admin/set-auth-status`, {
        userId,
        isActive,
    })

    const row = await tablesDB.updateRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: docId,
        data: { isActive },
    })

    return toAdminUserProfileDoc(row)
}

async function deleteFirstLoginRowsByUserId(userId: string) {
    const dbId = getDatabaseId()

    try {
        const res = await tablesDB.listRows({
            databaseId: dbId,
            tableId: COLLECTIONS.FIRST_LOGIN_USERS,
            queries: [Query.equal(ATTR.FIRST_LOGIN_USERS.userId, userId), Query.limit(50)],
        })

        const rows = ((res as any)?.rows ?? []) as any[]
        for (const r of rows) {
            const rowId = String(r?.$id || "").trim()
            if (!rowId) continue
            await tablesDB.deleteRow({
                databaseId: dbId,
                tableId: COLLECTIONS.FIRST_LOGIN_USERS,
                rowId,
            })
        }
    } catch {
        // ignore
    }
}

/**
 * ✅ DELETE USER (FULL):
 * 1) delete Appwrite Auth user (via Express admin key)
 * 2) delete USER_PROFILES row
 * 3) delete FIRST_LOGIN_USERS rows (cleanup)
 */
export async function deleteUserProfile(opts: { docId: string; userId: string }) {
    const dbId = getDatabaseId()

    const docId = String(opts.docId || "").trim()
    const userId = String(opts.userId || "").trim()

    if (!docId) throw new Error("Missing docId.")
    if (!userId) throw new Error("Missing userId.")

    const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
    await postJson<BackendDeleteAuthUserResponse>(`${apiBase}/api/admin/delete-auth-user`, {
        userId,
    })

    await tablesDB.deleteRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: docId,
    })

    await deleteFirstLoginRowsByUserId(userId).catch(() => null)

    return true
}

/**
 * ✅ Resend login credentials (Express backend)
 * ✅ ALSO re-enables first-login gate again (forces change password again)
 */
export async function resendUserCredentials(opts: { docId: string; userId: string; email: string; name?: string | null }) {
    const email = String(opts.email || "").trim().toLowerCase()
    const userId = String(opts.userId || "").trim()

    if (!email) throw new Error("Missing email.")
    if (!userId) throw new Error("Missing userId.")

    const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
    await postJson<BackendCredentialsResponse>(`${apiBase}/api/admin/send-login-credentials`, {
        email,
        name: opts.name || undefined,
        userId,
        resend: true,
    })

    await upsertFirstLoginRecord(userId, "resent").catch(() => null)

    return {
        ok: true,
        action: "resent",
        email,
        userId,
        message: "Credentials resent.",
    }
}
