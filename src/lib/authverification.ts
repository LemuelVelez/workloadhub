/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query, TablesDB } from "appwrite"

import { appwriteClient } from "@/lib/db"
import { publicEnv } from "@/lib/env"
import { account, requestPasswordRecovery, updateMyPassword, updateMyPrefs } from "@/lib/auth"
import { COLLECTIONS, ATTR } from "@/model/schemaModel"

/**
 * ✅ Auth Verification Rules (Your requirement)
 * - When admin adds user: userId auto-generated
 * - Invite/login setup email is sent to user
 * - On first login: must change password
 * - After first password change: account becomes verified
 *
 * Implementation approach:
 * ✅ We track status using Appwrite account.prefs (best, user can update after password change).
 * ✅ We ALSO try to mirror it to USER_PROFILES table IF attributes exist (optional).
 *
 * NOTE: For email sending from client:
 * Appwrite Messaging "createEmail" requires Server SDK + API Key.
 * So client-safe approach is:
 * ✅ Send Appwrite Recovery Email (Password Setup Link)
 */

const tablesDB = new TablesDB(appwriteClient)

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

export type AuthGateState = {
    userId: string
    email?: string
    mustChangePassword: boolean
    isVerified: boolean
}

export function generateTempPassword(length = 14) {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghijkmnopqrstuvwxyz"
    const nums = "23456789"
    const sym = "!@#$%^&*_-+=?"

    const all = upper + lower + nums + sym
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)]

    const base = [
        pick(upper),
        pick(lower),
        pick(nums),
        pick(sym),
        ...Array.from({ length: Math.max(8, length) - 4 }, () => pick(all)),
    ]

    for (let i = base.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[base[i], base[j]] = [base[j], base[i]]
    }

    return base.join("")
}

/**
 * ✅ Read current logged-in user "verification state"
 */
export async function getAuthGateState(): Promise<AuthGateState | null> {
    const me = await account.get().catch(() => null)
    if (!me) return null

    const userId = (me as any).$id || (me as any).id
    const email = (me as any).email
    const prefs = ((me as any).prefs || {}) as any

    let mustChangePassword = Boolean(prefs?.mustChangePassword)
    let isVerified = Boolean(prefs?.isVerified)

    if (!("mustChangePassword" in prefs) || !("isVerified" in prefs)) {
        try {
            const dbId = getDatabaseId()
            const res = await tablesDB.listRows({
                databaseId: dbId,
                tableId: COLLECTIONS.USER_PROFILES,
                queries: [Query.equal(ATTR.USER_PROFILES.userId, userId), Query.limit(1)],
            })

            const row = ((res as any)?.rows ?? [])[0]
            if (row) {
                if (typeof row?.mustChangePassword === "boolean") {
                    mustChangePassword = row.mustChangePassword
                }
                if (typeof row?.isVerified === "boolean") {
                    isVerified = row.isVerified
                }
            }
        } catch {
            // ignore
        }
    }

    return {
        userId,
        email,
        mustChangePassword,
        isVerified,
    }
}

/**
 * ✅ Post-login redirect helper
 */
export async function getPostLoginRedirectPath() {
    const state = await getAuthGateState()
    if (!state) return null

    if (state.mustChangePassword || !state.isVerified) {
        return "/auth/change-password"
    }

    return null
}

/**
 * ✅ First login password change completion
 */
export async function completeFirstLoginPasswordChange(opts: {
    oldPassword: string
    newPassword: string
    confirmPassword: string
}) {
    const { oldPassword, newPassword, confirmPassword } = opts

    if (!oldPassword?.trim()) throw new Error("Current password is required.")
    if (!newPassword?.trim()) throw new Error("New password is required.")
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.")
    if (newPassword !== confirmPassword) throw new Error("Passwords do not match.")

    await updateMyPassword(oldPassword, newPassword)

    await updateMyPrefs({
        mustChangePassword: false,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
    })

    try {
        const me = await account.get()
        const userId = (me as any).$id

        const dbId = getDatabaseId()
        const res = await tablesDB.listRows({
            databaseId: dbId,
            tableId: COLLECTIONS.USER_PROFILES,
            queries: [Query.equal(ATTR.USER_PROFILES.userId, userId), Query.limit(1)],
        })

        const row = ((res as any)?.rows ?? [])[0]
        if (row?.$id) {
            await tablesDB.updateRow({
                databaseId: dbId,
                tableId: COLLECTIONS.USER_PROFILES,
                rowId: row.$id,
                data: {
                    mustChangePassword: false,
                    isVerified: true,
                },
            })
        }
    } catch {
        // ignore
    }

    return true
}

/**
 * ✅ Admin helper: send setup password email using Appwrite Recovery email
 */
export async function sendInviteEmail(email: string) {
    if (!email?.trim()) throw new Error("Email is required.")

    const redirect = `${publicEnv.APP_ORIGIN}/auth/reset-password`

    await requestPasswordRecovery(email.trim().toLowerCase(), redirect)
    return true
}

export async function initialPrefsTemplate() {
    return {
        mustChangePassword: true,
        isVerified: false,
        createdByAdmin: true,
        createdAt: new Date().toISOString(),
    }
}
