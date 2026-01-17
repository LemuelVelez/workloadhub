/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query, TablesDB } from "appwrite";

import { appwriteClient } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { COLLECTIONS, ATTR } from "@/model/schemaModel";

function toBool(v: any) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
}

function getDatabaseId(): string {
    const anyEnv = publicEnv as any;

    const dbId =
        anyEnv?.APPWRITE_DATABASE ||
        anyEnv?.APPWRITE_DATABASE_ID ||
        anyEnv?.DATABASE_ID ||
        anyEnv?.DB_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE_ID ||
        (import.meta as any)?.env?.VITE_PUBLIC_APPWRITE_DATABASE ||
        null;

    if (!dbId) throw new Error("Missing Appwrite Database ID in env.");
    return String(dbId);
}

const tablesDB = new TablesDB(appwriteClient);

/**
 * ✅ Fetch first-login record for a specific userId
 */
export async function getFirstLoginRow(userId: string) {
    const clean = String(userId || "").trim();
    if (!clean) return null;

    try {
        const dbId = getDatabaseId();

        const res = await tablesDB.listRows({
            databaseId: dbId,
            tableId: COLLECTIONS.FIRST_LOGIN_USERS,
            queries: [Query.equal(ATTR.FIRST_LOGIN_USERS.userId, clean), Query.limit(1)],
        });

        const row = ((res as any)?.rows ?? [])[0] ?? null;
        return row || null;
    } catch {
        return null;
    }
}

/**
 * ✅ ONLY first-time users should be forced to change password
 * Logic:
 * - if a record exists AND completed=false => gate user to change-password page
 * - otherwise => allow dashboard access
 */
export async function needsFirstLoginPasswordChange(userId: string): Promise<boolean> {
    const row = await getFirstLoginRow(userId);
    if (!row) return false;

    const completed = toBool(row?.completed);
    const mustChangePassword = toBool(row?.mustChangePassword);

    return !completed || mustChangePassword;
}

/**
 * ✅ Upsert the first-login record
 * Used when:
 * - admin creates a user (created)
 * - admin resends credentials (resent)
 */
export async function upsertFirstLoginRecord(userId: string, mode: "created" | "resent" = "created") {
    const clean = String(userId || "").trim();
    if (!clean) return false;

    try {
        const dbId = getDatabaseId();
        const now = new Date().toISOString();

        const existing = await getFirstLoginRow(clean);

        if (existing?.$id) {
            await tablesDB.updateRow({
                databaseId: dbId,
                tableId: COLLECTIONS.FIRST_LOGIN_USERS,
                rowId: String(existing.$id),
                data: {
                    userId: clean,
                    mustChangePassword: true,
                    completed: false,
                    completedAt: null,
                    lastResetAt: mode === "resent" ? now : existing?.lastResetAt ?? null,
                },
            });
            return true;
        }

        // ✅ Create new record (use rowId=userId so it's stable)
        await tablesDB.createRow({
            databaseId: dbId,
            tableId: COLLECTIONS.FIRST_LOGIN_USERS,
            rowId: clean,
            data: {
                userId: clean,
                mustChangePassword: true,
                completed: false,
                createdAt: now,
                completedAt: null,
                lastResetAt: mode === "resent" ? now : null,
            },
        });

        return true;
    } catch {
        return false;
    }
}

/**
 * ✅ Mark first-login gate as completed
 * Called after:
 * - successful change-password
 * - successful reset-password + login
 */
export async function markFirstLoginCompleted(userId: string) {
    const clean = String(userId || "").trim();
    if (!clean) return false;

    try {
        const dbId = getDatabaseId();
        const now = new Date().toISOString();

        const existing = await getFirstLoginRow(clean);
        if (!existing?.$id) return true; // no record => not gated

        await tablesDB.updateRow({
            databaseId: dbId,
            tableId: COLLECTIONS.FIRST_LOGIN_USERS,
            rowId: String(existing.$id),
            data: {
                userId: clean,
                mustChangePassword: false,
                completed: true,
                completedAt: now,
            },
        });

        return true;
    } catch {
        return false;
    }
}

/**
 * ✅ NEW: Bulk fetch first-login status for multiple users
 * Used by Admin Users UI so we can display:
 * - "First Login Pending"
 * - "Completed"
 */
export async function getFirstLoginStatusMap(userIds: string[]) {
    const cleanIds = (userIds || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean);

    const out: Record<string, { completed: boolean; mustChangePassword: boolean; rowId?: string }> = {};

    if (cleanIds.length === 0) return out;

    try {
        const dbId = getDatabaseId();

        // Chunk to keep queries safe (Appwrite has query size limits)
        const CHUNK = 50;

        for (let i = 0; i < cleanIds.length; i += CHUNK) {
            const chunk = cleanIds.slice(i, i + CHUNK);

            const res = await tablesDB.listRows({
                databaseId: dbId,
                tableId: COLLECTIONS.FIRST_LOGIN_USERS,
                queries: [
                    Query.equal(ATTR.FIRST_LOGIN_USERS.userId, chunk),
                    Query.limit(200),
                ],
            });

            const rows = ((res as any)?.rows ?? []) as any[];

            for (const row of rows) {
                const uid = String(row?.userId || "").trim();
                if (!uid) continue;

                out[uid] = {
                    completed: toBool(row?.completed),
                    mustChangePassword: toBool(row?.mustChangePassword),
                    rowId: String(row?.$id ?? ""),
                };
            }
        }

        return out;
    } catch {
        return out;
    }
}
