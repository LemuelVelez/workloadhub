/* eslint-disable @typescript-eslint/no-explicit-any */
import { Query, TablesDB } from "appwrite"

import { appwriteClient } from "@/lib/db"
import { publicEnv } from "@/lib/env"
import { account, requestPasswordRecovery, updateMyPassword, updateMyPrefs } from "@/lib/auth"
import { COLLECTIONS, ATTR } from "@/model/schemaModel"

/**
 * ✅ Auth Verification Rules (Your requirement)
 * - When admin adds user: userId auto-generated
 * - Login credentials sent to user's email
 * - On first login: must change password
 * - After first password change: account becomes verified
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

function escapeHtml(s: string) {
    return (s || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
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

    // ✅ fallback to USER_PROFILES if available
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
                if (typeof row?.mustChangePassword === "boolean") mustChangePassword = row.mustChangePassword
                if (typeof row?.isVerified === "boolean") isVerified = row.isVerified
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

    // Optional mirror in USER_PROFILES table
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
 * ✅ Client-safe fallback: send setup password email using Appwrite Recovery email
 */
export async function sendInviteEmail(email: string) {
    if (!email?.trim()) throw new Error("Email is required.")

    const redirect = `${publicEnv.APP_ORIGIN}/auth/reset-password`
    await requestPasswordRecovery(email.trim().toLowerCase(), redirect)

    return true
}

/**
 * ✅ NEW: Send login credentials email to NEW user
 * - Server-side: uses Appwrite Messaging (SMTP Provider = WORKLOADHUB_GMAIL_SMTP)
 * - Browser fallback: uses Appwrite recovery email
 */
export async function sendNewUserCredentialsEmail(opts: {
    userId: string
    email: string
    tempPassword: string
    name?: string | null
}) {
    const email = opts.email?.trim().toLowerCase()
    const userId = opts.userId?.trim()
    const tempPassword = opts.tempPassword?.trim()
    const name = (opts.name || "").trim()

    if (!userId) throw new Error("Missing userId.")
    if (!email) throw new Error("Missing email.")
    if (!tempPassword) throw new Error("Missing temp password.")

    // ✅ If running in the browser, we cannot send custom email (needs API KEY)
    if (typeof window !== "undefined") {
        // Fallback: send reset/setup link instead
        await sendInviteEmail(email)
        return true
    }

    const origin = publicEnv.APP_ORIGIN || "http://localhost:5173"
    const loginUrl = `${origin}/auth/login`

    const subject = "Your WorkloadHub Login Credentials"

    const content = `
<div style="font-family:Arial,sans-serif;line-height:1.6">
  <h2 style="margin:0 0 12px">Welcome to WorkloadHub</h2>
  <p>Hello${name ? ` ${escapeHtml(name)}` : ""},</p>

  <p>Your account has been created by the administrator.</p>

  <div style="background:#f7f7f7;border:1px solid #e5e5e5;padding:12px;border-radius:8px">
    <p style="margin:0 0 8px"><b>Login URL:</b> <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
    <p style="margin:0 0 8px"><b>Email:</b> ${escapeHtml(email)}</p>
    <p style="margin:0"><b>Temporary Password:</b> <code>${escapeHtml(tempPassword)}</code></p>
  </div>

  <p style="margin-top:12px">
    ✅ On your first login, you must change your password.<br/>
    ✅ After changing your password, your account will be verified automatically.
  </p>

  <p style="color:#666;font-size:12px">
    If you did not expect this email, you may ignore it.
  </p>
</div>
`

    // ✅ Server-side send using Messaging provider from .env
    const { createTargetAndSendEmail } = await import("./email")

    await createTargetAndSendEmail({
        userId,
        email,
        subject,
        content,
        html: true,
        name: "WorkloadHub Email",
    })

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
