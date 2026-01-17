/* eslint-disable @typescript-eslint/no-explicit-any */
import { authApi } from "@/api/auth"
import { updateMyPrefs, logoutAllSessions } from "@/lib/auth"

// ✅ NEW
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

/**
 * ✅ Safe method invoker for different authApi signatures
 */
async function safeCall(fn: any, args1: any, args2?: any[]) {
    if (typeof fn !== "function") return null

    try {
        return await fn(args1)
    } catch {
        if (Array.isArray(args2)) {
            return await fn(...args2)
        }
        throw new Error("Request failed.")
    }
}

async function safeGetMe() {
    const candidates = [
        (authApi as any).me,
        (authApi as any).getMe,
        (authApi as any).getAccount,
        (authApi as any).account,
    ]

    for (const fn of candidates) {
        try {
            const r = await safeCall(fn, undefined, [])
            if (r) return r
        } catch {
            // try next
        }
    }

    return null
}

/**
 * ✅ Tries multiple possible backend endpoints to mark Appwrite auth verified
 */
export async function verifyAuthUserOnServer(userId: string) {
    const clean = String(userId || "").trim()
    if (!clean) return false

    const apiCandidates = [
        (authApi as any).verifyAuthUserOnServer,
        (authApi as any).verifyUserOnServer,
        (authApi as any).verifyAuthUser,
        (authApi as any).verifyUser,
    ]

    for (const fn of apiCandidates) {
        try {
            const r = await safeCall(fn, { userId: clean }, [clean])
            if (r) return true
        } catch {
            // try next
        }
    }

    const endpoints = ["/api/auth/verify-auth-user", "/api/auth/verify-user", "/api/auth/verify"]

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId: clean }),
            })
            if (res.ok) return true
        } catch {
            // try next
        }
    }

    return false
}

/**
 * ✅ First-login password change handler (UPDATED)
 */
export async function completeFirstLoginPasswordChange(input: {
    oldPassword: string
    newPassword: string
    confirmPassword: string
}) {
    const oldPassword = String(input?.oldPassword || "")
    const newPassword = String(input?.newPassword || "").trim()
    const confirmPassword = String(input?.confirmPassword || "").trim()

    if (!oldPassword) throw new Error("Current password is required.")
    if (!newPassword || newPassword.length < 8) throw new Error("New password must be at least 8 characters.")
    if (newPassword !== confirmPassword) throw new Error("Passwords do not match.")
    if (newPassword === oldPassword) throw new Error("New password must be different from the current password.")

    const changeCandidates = [
        (authApi as any).changePassword,
        (authApi as any).updatePassword,
        (authApi as any).setPassword,
        (authApi as any).completeFirstLoginPasswordChange,
    ]

    let changed = false

    for (const fn of changeCandidates) {
        try {
            await safeCall(
                fn,
                {
                    oldPassword,
                    newPassword,
                    confirmPassword,
                    password: newPassword,
                    passwordConfirm: confirmPassword,
                },
                [oldPassword, newPassword, confirmPassword]
            )
            changed = true
            break
        } catch {
            // try next
        }
    }

    if (!changed) {
        throw new Error("Password change endpoint is not available. Please check authApi implementation.")
    }

    await updateMyPrefs({
        mustChangePassword: false,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
    })

    const me: any = await safeGetMe()
    const resolvedUserId =
        String(me?.$id || me?.id || me?.userId || me?.data?.$id || me?.data?.id || "").trim() || ""

    if (resolvedUserId) {
        await verifyAuthUserOnServer(resolvedUserId).catch(() => null)
        await markFirstLoginCompleted(resolvedUserId).catch(() => null)
    }

    try {
        window.localStorage.setItem(FORCE_RELOGIN_KEY, String(Date.now()))
    } catch {
        // ignore
    }

    await logoutAllSessions().catch(() => null)

    requestSessionRefresh()

    return {
        ok: true,
        userId: resolvedUserId || null,
        loggedOut: true,
    }
}
