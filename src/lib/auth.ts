/* eslint-disable @typescript-eslint/no-explicit-any */
import { Account, ID, Query, TablesDB } from "appwrite"
import { appwriteClient } from "./db"
import { publicEnv } from "./env"
import { COLLECTIONS, ATTR } from "@/model/schemaModel"

/**
 * Browser-safe Appwrite Account client.
 * Uses only VITE_PUBLIC_* env via publicEnv.
 */
export const account = new Account(appwriteClient)

function formatAppwriteError(err: any): string {
    return (
        err?.message ||
        (typeof err?.response === "string" ? err.response : null) ||
        "Something went wrong. Please try again."
    )
}

/**
 * ✅ One-time flag after password reset
 * We can't auto-verify server-side without API key / Functions,
 * so we mark a local flag and consume it after the user logs in once.
 */
const PW_RESET_FLAG_PREFIX = "workloadhub:pw_reset_done:"

function setPasswordResetDoneFlag(userId: string) {
    try {
        if (typeof window === "undefined") return
        const key = `${PW_RESET_FLAG_PREFIX}${userId}`
        localStorage.setItem(key, new Date().toISOString())
    } catch {
        // ignore
    }
}

function consumePasswordResetDoneFlag(userId: string): boolean {
    try {
        if (typeof window === "undefined") return false
        const key = `${PW_RESET_FLAG_PREFIX}${userId}`
        const value = localStorage.getItem(key)
        if (!value) return false
        localStorage.removeItem(key)
        return true
    } catch {
        return false
    }
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

/**
 * ✅ Runs AFTER login.
 * If the user just reset password (via recovery link),
 * we automatically mark them verified and mustChangePassword=false.
 */
async function applyAutoVerifyAfterFirstPasswordReset() {
    try {
        const me = await account.get().catch(() => null)
        if (!me) return

        const userId = String((me as any)?.$id || (me as any)?.id || "").trim()
        if (!userId) return

        const shouldVerifyNow = consumePasswordResetDoneFlag(userId)
        if (!shouldVerifyNow) return

        // ✅ Mark VERIFIED in prefs (this is your internal verification system)
        const updatePrefsFn = (account as any)["updatePrefs"]?.bind(account)
        if (updatePrefsFn) {
            await updatePrefsFn({
                mustChangePassword: false,
                isVerified: true,
                verifiedAt: new Date().toISOString(),
                verifiedBy: "password_reset",
            })
        }

        // ✅ Best-effort mirror to USER_PROFILES (optional)
        try {
            const dbId = getDatabaseId()
            const tablesDB = new TablesDB(appwriteClient)

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
            // ignore if schema doesn't have fields or permissions don't allow
        }
    } catch {
        // ignore
    }
}

export async function loginWithEmailPassword(email: string, password: string) {
    if (!email?.trim()) throw new Error("Email is required.")
    if (!password?.trim()) throw new Error("Password is required.")

    const createFn =
        (account as any)["createEmailPasswordSession"]?.bind(account) ??
        (account as any)["createEmailSession"]?.bind(account)

    if (!createFn) {
        throw new Error("Appwrite Account session method not available in this SDK version.")
    }

    try {
        const session = await createFn(email.trim(), password)

        // ✅ After login, auto-verify ONLY if a password reset was just done
        await applyAutoVerifyAfterFirstPasswordReset()

        return session
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}

export async function logoutCurrentSession() {
    try {
        /**
         * ✅ FIX: Avoid deprecated signature
         * NEW: account.deleteSession({ sessionId: "current" })
         */
        const fn = (account as any)["deleteSession"]?.bind(account)
        if (!fn) throw new Error("Account.deleteSession() is not available in this SDK version.")

        return await fn({ sessionId: "current" })
    } catch (err: any) {
        const msg = formatAppwriteError(err)
        if (msg.toLowerCase().includes("session")) return null
        throw new Error(msg)
    }
}

/**
 * ✅ NEW: Clear ALL sessions for this account (logout everywhere)
 * - Used after first-login password change to force re-login
 */
export async function logoutAllSessions() {
    try {
        const fn =
            (account as any)["deleteSessions"]?.bind(account) ??
            (account as any)["deleteAllSessions"]?.bind(account)

        if (fn) {
            try {
                return await fn()
            } catch {
                // some SDK variants might accept object param
                return await fn({})
            }
        }

        // fallback: at least clear current session
        return await logoutCurrentSession().catch(() => null)
    } catch (err: any) {
        const msg = formatAppwriteError(err)
        if (msg.toLowerCase().includes("session")) return null
        return null
    }
}

export async function getCurrentAccount() {
    try {
        return await account.get()
    } catch {
        return null
    }
}

/**
 * ✅ Create user (auto-generated userId)
 */
export async function createUserAccount(opts: {
    email: string
    password: string
    name?: string | null
}) {
    const email = opts.email?.trim().toLowerCase()
    const password = opts.password?.trim()
    const name = opts.name?.trim() || undefined

    if (!email) throw new Error("Email is required.")
    if (!password) throw new Error("Password is required.")
    if (password.length < 8) throw new Error("Password must be at least 8 characters.")

    try {
        const userId = ID.unique()

        const createUserFn = (account as any)["create"]?.bind(account)
        if (!createUserFn) throw new Error("Account.create() is not available in this SDK version.")

        return await createUserFn(userId, email, password, name)
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}

/**
 * ✅ Change password while logged-in
 *
 * ✅ FIXED HARD:
 * Appwrite SDK versions differ:
 * - updatePassword(password, oldPassword)
 * - updatePassword({ password, oldPassword })
 */
export async function updateMyPassword(oldPassword: string, newPassword: string) {
    if (!oldPassword?.trim()) throw new Error("Current password is required.")
    if (!newPassword?.trim()) throw new Error("New password is required.")
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.")

    try {
        const fn = (account as any)["updatePassword"]?.bind(account)
        if (!fn) throw new Error("Account.updatePassword() is not available in this SDK version.")

        const cleanOld = oldPassword.trim()
        const cleanNew = newPassword.trim()

        // ✅ Try common signature: (newPassword, oldPassword)
        try {
            return await fn(cleanNew, cleanOld)
        } catch {
            // ✅ Try object signature
            return await fn({
                password: cleanNew,
                oldPassword: cleanOld,
            })
        }
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}

/**
 * ✅ Update prefs
 */
export async function updateMyPrefs(prefs: Record<string, any>) {
    try {
        const fn = (account as any)["updatePrefs"]?.bind(account)
        if (!fn) throw new Error("Account.updatePrefs() is not available in this SDK version.")

        return await fn(prefs)
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}

/**
 * ✅ Helper: post JSON to Express backend
 */
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
 * ✅ Sends Password Reset Email (TOKEN-based via Express)
 * ✅ Supports optional redirectUrl override (no eslint unused warning)
 */
export async function requestPasswordRecovery(email: string, redirectUrl?: string) {
    if (!email?.trim()) throw new Error("Email is required.")

    const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
    const finalRedirectUrl = String(redirectUrl || "").trim() || `${publicEnv.APP_ORIGIN}/auth/reset-password`

    /**
     * ✅ PRIMARY: Express reset email (token)
     */
    try {
        return await postJson<{ ok: boolean; message: string }>(`${apiBase}/api/auth/forgot-password`, {
            email: email.trim().toLowerCase(),
            redirectUrl: finalRedirectUrl, // ✅ used (and future-proof)
        })
    } catch (err: any) {
        /**
         * ✅ FALLBACK: Appwrite built-in recovery (secret/userId)
         */
        try {
            const fn = (account as any)["createRecovery"]?.bind(account)
            if (!fn) throw new Error("Account.createRecovery() is not available in this SDK version.")
            return await fn({ email: email.trim(), url: finalRedirectUrl })
        } catch (e: any) {
            throw new Error(err?.message || e?.message || "Failed to send recovery email.")
        }
    }
}

/**
 * ✅ Completes reset password:
 *
 * Supports BOTH:
 * 1) TOKEN-based reset (Express): token
 * 2) Appwrite recovery reset: userId + secret
 */
export async function confirmPasswordRecovery(opts: {
    token?: string | null
    userId?: string | null
    secret?: string | null
    password: string
    passwordConfirm: string
}) {
    const token = String(opts.token || "").trim()
    const userId = String(opts.userId || "").trim()
    const secret = String(opts.secret || "").trim()
    const password = String(opts.password || "").trim()
    const passwordConfirm = String(opts.passwordConfirm || "").trim()

    if (!password) throw new Error("New password is required.")
    if (password.length < 8) throw new Error("Password must be at least 8 characters.")
    if (password !== passwordConfirm) throw new Error("Passwords do not match.")

    /**
     * ✅ TOKEN FLOW (Express)
     */
    if (token) {
        const apiBase = String(publicEnv.API_WORKLOADHUB_ORIGIN || "").replace(/\/$/, "")
        await postJson<{ ok: boolean; message?: string }>(`${apiBase}/api/auth/password-reset`, {
            token,
            password,
            passwordConfirm,
        })

        // ✅ if caller knows userId, auto-verify on next login
        if (userId) setPasswordResetDoneFlag(userId)

        return { ok: true }
    }

    /**
     * ✅ APPWRITE FLOW (userId + secret)
     */
    if (!userId) throw new Error("Missing userId.")
    if (!secret) throw new Error("Missing secret.")

    try {
        const fn = (account as any)["updateRecovery"]?.bind(account)
        if (!fn) throw new Error("Account.updateRecovery() is not available in this SDK version.")

        const result = await fn({
            userId,
            secret,
            password,
        })

        setPasswordResetDoneFlag(userId)
        return result
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}
