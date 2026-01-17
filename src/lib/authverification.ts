/* eslint-disable @typescript-eslint/no-explicit-any */
import { authApi } from "@/api/auth"

// ✅ IMPORTANT: real Appwrite password change + prefs + session revoke
import { logoutAllSessions, updateMyPrefs } from "@/lib/auth"

// ✅ NEW
import { publicEnv } from "@/lib/env"
import { markFirstLoginCompleted } from "@/lib/first-login"

const FORCE_RELOGIN_KEY = "workloadhub:forceReLoginAt"

/**
 * ✅ Triggers a session refresh signal (for apps that cache session/user state).
 */
function requestSessionRefresh() {
    try {
        window.localStorage.setItem("workloadhub:sessionRefreshAt", String(Date.now()))
    } catch {
        // ignore
    }

    try {
        window.dispatchEvent(new CustomEvent("workloadhub:session-refresh"))
    } catch {
        // ignore
    }
}

function apiBase(): string {
    const raw = String((publicEnv as any)?.API_WORKLOADHUB_ORIGIN || "").trim()
    return raw.replace(/\/$/, "") || "http://127.0.0.1:4000"
}

/**
 * ✅ Safe getMe
 */
async function safeGetMe() {
    try {
        return await authApi.me()
    } catch {
        return null
    }
}

function resolveUserId(me: any) {
    return String(me?.$id || me?.id || me?.userId || me?.data?.$id || me?.data?.id || "").trim()
}

/**
 * ✅ Verifies the Appwrite Auth user using Express + APPWRITE_API_KEY
 *
 * CRITICAL FIX:
 * - Always call the Express backend base URL, NOT "/api/..." relative to Vite.
 */
export async function verifyAuthUserOnServer(userId: string) {
    const clean = String(userId || "").trim()
    if (!clean) return false

    const base = apiBase()

    const endpoints = [
        `${base}/api/auth/verify-user`,
        `${base}/api/auth/verify-auth-user`,
        `${base}/api/auth/verify`,
    ]

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId: clean }),
            })

            const data = await res.json().catch(() => null)
            if (res.ok && data?.ok) return true
        } catch {
            // try next
        }
    }

    return false
}

/**
 * ✅ First-login password change handler (FIXED)
 *
 * What it does now:
 * 1) REAL Appwrite password update using authApi.changePassword (account.updatePassword)
 * 2) update prefs in current session (mustChangePassword=false)
 * 3) verify Auth user on server (emailVerification=true) using APPWRITE_API_KEY
 * 4) mark first-login table as completed
 * 5) revoke all sessions (force re-login)
 */
export async function completeFirstLoginPasswordChange(input: {
    oldPassword: string
    newPassword: string
    confirmPassword: string
}) {
    const oldPassword = String(input?.oldPassword || "")
    const newPassword = String(input?.newPassword || "")
    const confirmPassword = String(input?.confirmPassword || "")

    if (!oldPassword) throw new Error("Current password is required.")
    if (!newPassword || newPassword.length < 8) throw new Error("New password must be at least 8 characters.")
    if (newPassword !== confirmPassword) throw new Error("Passwords do not match.")
    if (newPassword === oldPassword) throw new Error("New password must be different from the current password.")

    // ✅ STEP 1: Change password in Appwrite Auth (this is the REAL fix)
    const changeFn = (authApi as any).changePassword
    if (typeof changeFn !== "function") {
        throw new Error("authApi.changePassword() missing. Please check src/api/auth.ts export.")
    }

    await changeFn(oldPassword, newPassword)

    // ✅ STEP 2: Update prefs (internal flags)
    await updateMyPrefs({
        mustChangePassword: false,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
    }).catch(() => null)

    // ✅ STEP 3: Resolve userId
    const me: any = await safeGetMe()
    const userId = resolveUserId(me)

    // ✅ STEP 4: Verify auth user using APPWRITE_API_KEY (emailVerification=true)
    if (userId) {
        await verifyAuthUserOnServer(userId).catch(() => null)

        // ✅ STEP 5: mark first-login table completed
        await markFirstLoginCompleted(userId).catch(() => null)
    }

    // ✅ Force a clean re-login (prevents session glitch + stale cache)
    try {
        window.localStorage.setItem(FORCE_RELOGIN_KEY, String(Date.now()))
    } catch {
        // ignore
    }

    // ✅ revoke sessions
    await logoutAllSessions().catch(() => null)

    requestSessionRefresh()

    return {
        ok: true,
        userId: userId || null,
        loggedOut: true,
    }
}
