/* eslint-disable @typescript-eslint/no-explicit-any */
import { Account } from "appwrite";
import { appwriteClient } from "./db";
import { publicEnv } from "./env";

/**
 * Browser-safe Appwrite Account client.
 * Uses only VITE_PUBLIC_* env via publicEnv.
 */
export const account = new Account(appwriteClient);

function formatAppwriteError(err: any): string {
    return (
        err?.message ||
        (typeof err?.response === "string" ? err.response : null) ||
        "Something went wrong. Please try again."
    );
}

export async function loginWithEmailPassword(email: string, password: string) {
    if (!email?.trim()) throw new Error("Email is required.");
    if (!password?.trim()) throw new Error("Password is required.");

    // SDK compatibility: createEmailPasswordSession (newer) vs createEmailSession (older)
    const fn =
        (account as any).createEmailPasswordSession?.bind(account) ??
        (account as any).createEmailSession?.bind(account);

    if (!fn) throw new Error("Appwrite Account session method not available in this SDK version.");

    try {
        return await fn(email.trim(), password);
    } catch (err: any) {
        throw new Error(formatAppwriteError(err));
    }
}

export async function logoutCurrentSession() {
    try {
        return await account.deleteSession("current");
    } catch (err: any) {
        // If already logged out, don't hard fail
        const msg = formatAppwriteError(err);
        if (msg.toLowerCase().includes("session")) return null;
        throw new Error(msg);
    }
}

export async function getCurrentAccount() {
    try {
        return await account.get();
    } catch {
        return null;
    }
}

/**
 * Sends Appwrite recovery email (requires Email provider configured in Appwrite Console).
 * Appwrite will append ?userId=...&secret=... to the URL you provide.
 */
export async function requestPasswordRecovery(email: string, redirectUrl?: string) {
    if (!email?.trim()) throw new Error("Email is required.");

    const url =
        redirectUrl?.trim() ||
        // default: your VITE_PUBLIC_APP_ORIGIN + route
        `${publicEnv.APP_ORIGIN}/auth/reset-password`;

    try {
        return await account.createRecovery(email.trim(), url);
    } catch (err: any) {
        throw new Error(formatAppwriteError(err));
    }
}

/**
 * Completes the password recovery flow.
 *
 * NOTE:
 * Some Appwrite SDK versions type Account.updateRecovery(userId, secret, password) with ONLY 3 args.
 * We still validate passwordConfirm client-side.
 */
export async function confirmPasswordRecovery(opts: {
    userId: string;
    secret: string;
    password: string;
    passwordConfirm: string;
}) {
    const { userId, secret, password, passwordConfirm } = opts;

    if (!userId?.trim()) throw new Error("Missing userId.");
    if (!secret?.trim()) throw new Error("Missing secret.");
    if (!password?.trim()) throw new Error("New password is required.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (password !== passwordConfirm) throw new Error("Passwords do not match.");

    try {
        // ✅ Call with 3 args to satisfy your SDK typings
        return await account.updateRecovery(userId.trim(), secret.trim(), password);
    } catch (err: any) {
        throw new Error(formatAppwriteError(err));
    }
}
