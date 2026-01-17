/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Safe environment access for Vite apps:
 * - Public (client-safe): import.meta.env.VITE_*
 * - Private (server-only): process.env.*
 *
 * IMPORTANT:
 * - Never expose secrets with the VITE_ prefix.
 * - Do NOT import/call getServerEnv() from browser/client code.
 */

type MaybeString = string | undefined

function required(name: string, value: MaybeString): string {
    const v = value?.trim()
    if (!v) {
        // Helpful debug (shows what Vite actually injected)
        const keys =
            typeof window !== "undefined"
                ? Object.keys((import.meta as any).env ?? {}).filter((k) => k.startsWith("VITE_"))
                : Object.keys((globalThis as any)?.process?.env ?? {}).filter((k) => k.startsWith("VITE_"))

        throw new Error(
            `[env] Missing required environment variable: ${name}\n` +
                `Available VITE_* keys: ${keys.join(", ") || "(none)"}\n\n` +
                `Fix:\n` +
                `1) Put it in the SAME folder as your vite.config.ts + package.json\n` +
                `2) Restart the Vite dev server after editing .env\n`
        )
    }
    return v
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
 * ✅ Client (Vite): import.meta.env is the SOURCE OF TRUTH
 * ✅ Server (Node/Appwrite): process.env
 */
function readEnv(key: string): string | undefined {
    if (isBrowser) {
        return (import.meta as any).env?.[key]
    }
    return (globalThis as any)?.process?.env?.[key]
}

/**
 * Public env (safe to use in browser)
 */
export function getPublicEnv() {
    return Object.freeze({
        APPWRITE_PROJECT_ID: required("VITE_PUBLIC_APPWRITE_PROJECT_ID", readEnv("VITE_PUBLIC_APPWRITE_PROJECT_ID")),

        APPWRITE_PROJECT_NAME: required(
            "VITE_PUBLIC_APPWRITE_PROJECT_NAME",
            readEnv("VITE_PUBLIC_APPWRITE_PROJECT_NAME")
        ),

        APPWRITE_ENDPOINT: normalizeUrl(
            "VITE_PUBLIC_APPWRITE_ENDPOINT",
            required("VITE_PUBLIC_APPWRITE_ENDPOINT", readEnv("VITE_PUBLIC_APPWRITE_ENDPOINT"))
        ),

        // supports both keys
        APPWRITE_DATABASE: required(
            "VITE_PUBLIC_APPWRITE_DATABASE_ID",
            readEnv("VITE_PUBLIC_APPWRITE_DATABASE_ID") ?? readEnv("VITE_PUBLIC_APPWRITE_DATABASE")
        ),

        APPWRITE_BUCKET: required("VITE_PUBLIC_APPWRITE_BUCKET", readEnv("VITE_PUBLIC_APPWRITE_BUCKET")),

        APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID: optional(
            "VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID",
            readEnv("VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID")
        ),

        /**
         * ✅ Frontend origin (used for redirect URLs)
         */
        APP_ORIGIN:
            optional("VITE_PUBLIC_APP_ORIGIN", readEnv("VITE_PUBLIC_APP_ORIGIN")) ??
            (isBrowser ? window.location.origin : undefined),

        /**
         * ✅ Express Backend Origin (Admin create user + email credentials)
         * Example: http://127.0.0.1:4000
         */
        API_WORKLOADHUB_ORIGIN:
            optional("VITE_PUBLIC_API_WORKLOADHUB_ORIGIN", readEnv("VITE_PUBLIC_API_WORKLOADHUB_ORIGIN")) ??
            "http://127.0.0.1:4000",
    } as const)
}

export const publicEnv = getPublicEnv()
export type PublicEnv = ReturnType<typeof getPublicEnv>

/**
 * Server-only env (secrets)
 * Call this ONLY from server/runtime code (Node / Appwrite Functions).
 */
export function getServerEnv() {
    if (isBrowser) {
        throw new Error("[env] getServerEnv() was called in the browser. This is not allowed.")
    }

    const procEnv: Record<string, string | undefined> = (globalThis as any)?.process?.env ?? {}

    return Object.freeze({
        // ✅ Backend API (Express) origin/base URL
        API_WORKLOADHUB_ORIGIN: normalizeUrl("API_WORKLOADHUB_ORIGIN", required("API_WORKLOADHUB_ORIGIN", procEnv.API_WORKLOADHUB_ORIGIN)),

        APPWRITE_API_KEY: required("APPWRITE_API_KEY", procEnv.APPWRITE_API_KEY),

        APPWRITE_EMAIL_PROVIDER_ID: required(
            "WorkloadHub_Gmail_SMTP",
            procEnv.WorkloadHub_Gmail_SMTP ?? procEnv.APPWRITE_EMAIL_PROVIDER_ID
        ),

        APPWRITE_FUNCTION_KEY: optional("APPWRITE_FUNCTION_KEY", procEnv.APPWRITE_FUNCTION_KEY),

        GMAIL_USER: optional("GMAIL_USER", procEnv.GMAIL_USER),
        GMAIL_APP_PASSWORD: optional("GMAIL_APP_PASSWORD", procEnv.GMAIL_APP_PASSWORD),
    } as const)
}

export type ServerEnv = ReturnType<typeof getServerEnv>
