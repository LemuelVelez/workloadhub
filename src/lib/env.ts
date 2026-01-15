/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Safe environment access for Vite apps:
 * - Public (client-safe): VITE_PUBLIC_*
 * - Private (server-only): process.env.*
 *
 * IMPORTANT:
 * - Never expose secrets with the VITE_ prefix.
 * - Do NOT import/call getServerEnv() from browser/client code.
 */

type MaybeString = string | undefined

function required(name: string, value: MaybeString): string {
    if (value == null || value.trim() === "") {
        throw new Error(`[env] Missing required environment variable: ${name}`)
    }
    return value
}

function optional(_name: string, value: MaybeString): string | undefined {
    const v = value?.trim()
    return v ? v : undefined
}

function normalizeUrl(name: string, value: string): string {
    try {
        return new URL(value).toString().replace(/\/$/, "")
    } catch {
        throw new Error(`[env] Invalid URL for ${name}: ${value}`)
    }
}

const isBrowser = typeof window !== "undefined"

/**
 * ✅ Vite: import.meta.env
 * ✅ Node/Appwrite Functions: process.env
 */
const metaEnv =
    ((import.meta as any)?.env ??
        ((globalThis as any)?.process?.env ?? {})) as Record<string, string | undefined>

/**
 * Public env (safe to use in browser)
 * These come from Vite as import.meta.env.*
 */
export const publicEnv = Object.freeze({
    APPWRITE_PROJECT_ID: required(
        "VITE_PUBLIC_APPWRITE_PROJECT_ID",
        metaEnv.VITE_PUBLIC_APPWRITE_PROJECT_ID
    ),

    APPWRITE_PROJECT_NAME: required(
        "VITE_PUBLIC_APPWRITE_PROJECT_NAME",
        metaEnv.VITE_PUBLIC_APPWRITE_PROJECT_NAME
    ),

    APPWRITE_ENDPOINT: normalizeUrl(
        "VITE_PUBLIC_APPWRITE_ENDPOINT",
        required("VITE_PUBLIC_APPWRITE_ENDPOINT", metaEnv.VITE_PUBLIC_APPWRITE_ENDPOINT)
    ),

    /**
     * ✅ Your .env uses VITE_PUBLIC_APPWRITE_DATABASE_ID
     * We support BOTH for backward compatibility.
     */
    APPWRITE_DATABASE: required(
        "VITE_PUBLIC_APPWRITE_DATABASE_ID",
        metaEnv.VITE_PUBLIC_APPWRITE_DATABASE_ID ?? metaEnv.VITE_PUBLIC_APPWRITE_DATABASE
    ),

    APPWRITE_BUCKET: required(
        "VITE_PUBLIC_APPWRITE_BUCKET",
        metaEnv.VITE_PUBLIC_APPWRITE_BUCKET
    ),

    /**
     * ✅ Appwrite Function ID for Admin Create User + Invite (client-safe)
     * Add this to .env:
     * VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID=xxxx
     */
    APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID: optional(
        "VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID",
        metaEnv.VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID ??
        metaEnv.VITE_PUBLIC_APPWRITE_FUNCTION_ID ??
        metaEnv.VITE_PUBLIC_APPWRITE_FUNCTION_KEY
    ),

    /**
     * Optional. If blank, we default to the current origin in the browser.
     */
    APP_ORIGIN:
        optional("VITE_PUBLIC_APP_ORIGIN", metaEnv.VITE_PUBLIC_APP_ORIGIN) ??
        (isBrowser ? window.location.origin : undefined),
} as const)

export type PublicEnv = typeof publicEnv

/**
 * Server-only env (secrets)
 * Call this ONLY from server/runtime code (Node / Appwrite Functions).
 */
export function getServerEnv() {
    if (isBrowser) {
        throw new Error("[env] getServerEnv() was called in the browser. This is not allowed.")
    }

    const procEnv: Record<string, string | undefined> =
        (globalThis as any)?.process?.env ?? {}

    return Object.freeze({
        APPWRITE_API_KEY: required("APPWRITE_API_KEY", procEnv.APPWRITE_API_KEY),

        /**
         * ✅ Your Appwrite Messaging Email Provider ID (Gmail SMTP provider)
         * This MUST exist in Appwrite Console -> Messaging -> Providers
         *
         * env key you provided:
         * WorkloadHub_Gmail_SMTP=xxxx
         */
        APPWRITE_EMAIL_PROVIDER_ID: required(
            "WorkloadHub_Gmail_SMTP",
            procEnv.WorkloadHub_Gmail_SMTP ?? procEnv.APPWRITE_EMAIL_PROVIDER_ID
        ),

        /**
         * Optional “shared secret” if you want internal calls to verify a header.
         * (Not required for normal client execution.)
         */
        APPWRITE_FUNCTION_KEY: optional("APPWRITE_FUNCTION_KEY", procEnv.APPWRITE_FUNCTION_KEY),

        // Optional (kept only if you still want them for other use cases)
        GMAIL_USER: optional("GMAIL_USER", procEnv.GMAIL_USER),
        GMAIL_APP_PASSWORD: optional("GMAIL_APP_PASSWORD", procEnv.GMAIL_APP_PASSWORD),
    } as const)
}

export type ServerEnv = ReturnType<typeof getServerEnv>
