/* eslint-disable @typescript-eslint/no-explicit-any */
import { Account, ID } from "appwrite"
import { appwriteClient } from "./db"
import { publicEnv } from "./env"

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
        return await createFn(email.trim(), password)
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
 */
export async function updateMyPassword(oldPassword: string, newPassword: string) {
    if (!oldPassword?.trim()) throw new Error("Current password is required.")
    if (!newPassword?.trim()) throw new Error("New password is required.")
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.")

    try {
        const fn = (account as any)["updatePassword"]?.bind(account)
        if (!fn) throw new Error("Account.updatePassword() is not available in this SDK version.")

        return await fn(newPassword.trim(), oldPassword.trim())
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
 * ✅ Sends Appwrite recovery email (Password Setup / Reset)
 * ✅ Uses NEW object-parameter overload (non-deprecated)
 */
export async function requestPasswordRecovery(email: string, redirectUrl?: string) {
    if (!email?.trim()) throw new Error("Email is required.")

    const url = redirectUrl?.trim() || `${publicEnv.APP_ORIGIN}/auth/reset-password`

    try {
        const fn = (account as any)["createRecovery"]?.bind(account)
        if (!fn) throw new Error("Account.createRecovery() is not available in this SDK version.")

        return await fn({ email: email.trim(), url })
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}

/**
 * ✅ Completes the password recovery flow (NO deprecated updateRecovery signature)
 * ✅ Uses NEW object-parameter overload:
 * account.updateRecovery({ userId, secret, password })
 */
export async function confirmPasswordRecovery(opts: {
    userId: string
    secret: string
    password: string
    passwordConfirm: string
}) {
    const { userId, secret, password, passwordConfirm } = opts

    if (!userId?.trim()) throw new Error("Missing userId.")
    if (!secret?.trim()) throw new Error("Missing secret.")
    if (!password?.trim()) throw new Error("New password is required.")
    if (password.length < 8) throw new Error("Password must be at least 8 characters.")
    if (password !== passwordConfirm) throw new Error("Passwords do not match.")

    try {
        const fn = (account as any)["updateRecovery"]?.bind(account)
        if (!fn) throw new Error("Account.updateRecovery() is not available in this SDK version.")

        // ✅ NEW overload (non-deprecated)
        return await fn({
            userId: userId.trim(),
            secret: secret.trim(),
            password: password.trim(),
        })
    } catch (err: any) {
        throw new Error(formatAppwriteError(err))
    }
}
