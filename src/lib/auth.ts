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

function getErrorStatus(err: any): number | null {
    const direct = Number(err?.code ?? err?.status ?? err?.response?.status)
    return Number.isFinite(direct) ? direct : null
}

function isUnauthorizedError(err: any): boolean {
    const status = getErrorStatus(err)
    if (status === 401) return true

    const msg = formatAppwriteError(err).toLowerCase()
    return (
        msg.includes("unauthorized") ||
        msg.includes("not authorized") ||
        msg.includes("missing scope") ||
        msg.includes("guest")
    )
}

function isSessionConflictError(err: any): boolean {
    const status = getErrorStatus(err)
    if (status === 409) return true

    const msg = formatAppwriteError(err).toLowerCase()
    return (
        msg.includes("session is active") ||
        msg.includes("active session already exists") ||
        msg.includes("already logged in") ||
        msg.includes("already has an active session") ||
        msg.includes("session already exists") ||
        msg.includes("too many sessions")
    )
}

function shouldRetryWithObjectSignature(err: any): boolean {
    const msg = formatAppwriteError(err).toLowerCase()
    return (
        msg.includes("missing required parameter") ||
        msg.includes("invalid param") ||
        msg.includes("expected object") ||
        msg.includes("cannot read properties")
    )
}

/**
 * ✅ One-time flag after password reset
 * We can't auto-verify server-side without API key / Functions,
 * so we mark a local flag and consume it after the user logs in once.
 */
const PW_RESET_FLAG_PREFIX = "workloadhub:pw_reset_done:"

/**
 * ✅ Session hint keys (to avoid noisy /account 401 when user is logged out)
 * If no hint exists, getCurrentAccount() will do a throttled cold probe.
 */
const AUTH_SESSION_HINT_KEY = "workloadhub:appwrite_has_session"
const AUTH_LAST_USER_ID_KEY = "workloadhub:appwrite_last_user_id"
const AUTH_SESSION_COLD_PROBE_AT_KEY = "workloadhub:appwrite_session_probe_at"
const AUTH_SESSION_COLD_PROBE_INTERVAL_MS = 60 * 1000

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

function setSessionHint(hasSession: boolean, userId?: string) {
    try {
        if (typeof window === "undefined") return
        if (hasSession) {
            localStorage.setItem(AUTH_SESSION_HINT_KEY, "1")
            localStorage.removeItem(AUTH_SESSION_COLD_PROBE_AT_KEY)
            if (userId?.trim()) {
                localStorage.setItem(AUTH_LAST_USER_ID_KEY, userId.trim())
            }
            return
        }
        localStorage.removeItem(AUTH_SESSION_HINT_KEY)
        localStorage.removeItem(AUTH_LAST_USER_ID_KEY)
    } catch {
        // ignore
    }
}

function hasSessionHint(): boolean {
    try {
        if (typeof window === "undefined") return false
        return localStorage.getItem(AUTH_SESSION_HINT_KEY) === "1"
    } catch {
        return false
    }
}

function clearSessionHint() {
    setSessionHint(false)
}

function canAttemptColdSessionProbe(): boolean {
    try {
        if (typeof window === "undefined") return false
        const raw = localStorage.getItem(AUTH_SESSION_COLD_PROBE_AT_KEY)
        const lastAt = Number(raw || 0)

        if (!Number.isFinite(lastAt) || lastAt <= 0) return true

        const age = Date.now() - lastAt
        return age < 0 || age >= AUTH_SESSION_COLD_PROBE_INTERVAL_MS
    } catch {
        return false
    }
}

function markColdSessionProbeAttempt() {
    try {
        if (typeof window === "undefined") return
        localStorage.setItem(AUTH_SESSION_COLD_PROBE_AT_KEY, String(Date.now()))
    } catch {
        // ignore
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

async function createSessionWithSdkFallback(
    createFn: (...args: any[]) => Promise<any>,
    email: string,
    password: string
) {
    try {
        // ✅ Primary signature for most browser SDK versions
        return await createFn(email, password)
    } catch (firstErr: any) {
        // ✅ Fallback for object-signature SDK variants
        if (!shouldRetryWithObjectSignature(firstErr)) throw firstErr
        return await createFn({
            email,
            password,
        })
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
        const cleanEmail = email.trim().toLowerCase()
        const cleanPassword = password

        let session: any

        try {
            session = await createSessionWithSdkFallback(createFn, cleanEmail, cleanPassword)
        } catch (createErr: any) {
            /**
             * ✅ FIX: if a session already exists, treat it as authenticated
             * and reuse current session instead of blocking login flow.
             */
            if (!isSessionConflictError(createErr)) throw createErr

            // try reusing existing active session
            const existingMe = await account.get().catch(() => null)
            if (existingMe) {
                const existingUserId = String((existingMe as any)?.$id || "").trim()
                setSessionHint(true, existingUserId || undefined)
                await applyAutoVerifyAfterFirstPasswordReset()

                // keep return shape session-like for callers expecting a payload
                return {
                    reused: true,
                    userId: existingUserId || undefined,
                }
            }

            // if conflict but no readable session, clear current and retry once
            await logoutCurrentSession().catch(() => null)
            session = await createSessionWithSdkFallback(createFn, cleanEmail, cleanPassword)
        }

        // ✅ Mark local session hint to avoid /account 401 spam while logged out
        setSessionHint(true)

        // ✅ Best effort: store current user id hint
        try {
            const me = await account.get()
            const userId = String((me as any)?.$id || "").trim()
            if (userId) setSessionHint(true, userId)
        } catch {
            // ignore
        }

        // ✅ After login, auto-verify ONLY if a password reset was just done
        await applyAutoVerifyAfterFirstPasswordReset()

        return session
    } catch (err: any) {
        clearSessionHint()
        throw new Error(formatAppwriteError(err))
    }
}

export async function logoutCurrentSession() {
    try {
        /**
         * ✅ FIX: Handle both signatures
         * - account.deleteSession({ sessionId: "current" })
         * - account.deleteSession("current")
         */
        const fn = (account as any)["deleteSession"]?.bind(account)
        if (!fn) throw new Error("Account.deleteSession() is not available in this SDK version.")

        try {
            return await fn({ sessionId: "current" })
        } catch (firstErr: any) {
            if (!shouldRetryWithObjectSignature(firstErr)) throw firstErr
            return await fn("current")
        }
    } catch (err: any) {
        const msg = formatAppwriteError(err)
        if (msg.toLowerCase().includes("session")) return null
        if (isUnauthorizedError(err)) return null
        throw new Error(msg)
    } finally {
        // ✅ always clear local session hint on logout path
        clearSessionHint()
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
    } finally {
        clearSessionHint()
    }
}

export async function getCurrentAccount() {
    /**
     * ✅ FIX: if hint is missing, do a throttled cold probe so existing cookie sessions
     * are still detected (prevents "already logged in but not redirected" issue).
     */
    if (!hasSessionHint()) {
        if (!canAttemptColdSessionProbe()) return null
        markColdSessionProbeAttempt()
    }

    try {
        const me = await account.get()
        const userId = String((me as any)?.$id || "").trim()
        setSessionHint(true, userId || undefined)
        return me
    } catch (err: any) {
        // ✅ If session expired/invalid, clear hint so future calls won't spam 401.
        if (isUnauthorizedError(err)) {
            clearSessionHint()
            return null
        }
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

            try {
                return await fn({ email: email.trim(), url: finalRedirectUrl })
            } catch (firstErr: any) {
                if (!shouldRetryWithObjectSignature(firstErr)) throw firstErr
                return await fn(email.trim(), finalRedirectUrl)
            }
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

        let result: any
        try {
            result = await fn({
                userId,
                secret,
                password,
            })
        } catch (firstErr: any) {
            if (!shouldRetryWithObjectSignature(firstErr)) throw firstErr
            result = await fn(userId, secret, password)
        }

        setPasswordResetDoneFlag(userId)
        return result
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}
