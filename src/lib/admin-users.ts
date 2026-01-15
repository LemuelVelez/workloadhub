/* eslint-disable @typescript-eslint/no-explicit-any */
import { ID, Query, TablesDB } from "appwrite"

import { appwriteClient } from "@/lib/db"
import { publicEnv } from "@/lib/env"
import { COLLECTIONS, ATTR } from "@/model/schemaModel"

export type AdminUserRole = "ADMIN" | "CHAIR" | "FACULTY"

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

/**
 * ✅ FIXED:
 * Your env.ts exports DB id as publicEnv.APPWRITE_DATABASE
 * This function previously looked for APPWRITE_DATABASE_ID / DATABASE_ID / DB_ID (wrong keys),
 * so it always threw "Missing Appwrite Database ID in env."
 */
function getDatabaseId(): string {
    const anyEnv = publicEnv as any

    // ✅ Correct key (from src/lib/env.ts)
    const dbId =
        anyEnv?.APPWRITE_DATABASE ||
        anyEnv?.APPWRITE_DATABASE_ID ||
        anyEnv?.DATABASE_ID ||
        anyEnv?.DB_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE ||
        null

    if (!dbId) {
        throw new Error("Missing Appwrite Database ID in env.")
    }

    return String(dbId)
}

const tablesDB = new TablesDB(appwriteClient)

export async function listDepartmentsLite(opts?: { activeOnly?: boolean }) {
    const activeOnly = opts?.activeOnly ?? true
    const dbId = getDatabaseId()

    const queries: string[] = [Query.limit(200), Query.orderAsc(ATTR.DEPARTMENTS.name)]

    if (activeOnly) {
        queries.push(Query.equal(ATTR.DEPARTMENTS.isActive, true))
    }

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

    if (!includeInactive) {
        queries.push(Query.equal(ATTR.USER_PROFILES.isActive, true))
    }

    const res = await tablesDB.listRows({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        queries,
    })

    return ((res as any)?.rows ?? []) as AdminUserProfileDoc[]
}

export async function createUserProfile(input: AdminUserProfileInput) {
    const dbId = getDatabaseId()

    const payload = {
        userId: input.userId.trim(),
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim() || null,
        role: input.role,
        departmentId: input.departmentId?.trim() || null,
        isActive: Boolean(input.isActive),
    }

    if (!payload.userId) throw new Error("User ID is required.")
    if (!payload.email) throw new Error("Email is required.")
    if (!payload.role) throw new Error("Role is required.")

    const row = await tablesDB.createRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: ID.unique(),
        data: payload,
    })

    return row as any as AdminUserProfileDoc
}

export async function updateUserProfile(docId: string, patch: Partial<AdminUserProfileInput>) {
    const dbId = getDatabaseId()

    const payload: any = {}

    if (typeof patch.userId === "string") payload.userId = patch.userId.trim()
    if (typeof patch.email === "string") payload.email = patch.email.trim().toLowerCase()
    if (typeof patch.name === "string" || patch.name === null) payload.name = patch.name
    if (typeof patch.role === "string") payload.role = patch.role
    if (typeof patch.departmentId === "string" || patch.departmentId === null)
        payload.departmentId = patch.departmentId
    if (typeof patch.isActive === "boolean") payload.isActive = patch.isActive

    const row = await tablesDB.updateRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: docId,
        data: payload,
    })

    return row as any as AdminUserProfileDoc
}

export async function setUserActive(docId: string, isActive: boolean) {
    return updateUserProfile(docId, { isActive })
}

export async function deleteUserProfile(docId: string) {
    const dbId = getDatabaseId()

    await tablesDB.deleteRow({
        databaseId: dbId,
        tableId: COLLECTIONS.USER_PROFILES,
        rowId: docId,
    })

    return true
}
