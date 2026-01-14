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

type MaybeString = string | undefined;

function required(name: string, value: MaybeString): string {
    if (value == null || value.trim() === "") {
        throw new Error(`[env] Missing required environment variable: ${name}`);
    }
    return value;
}

function optional(_name: string, value: MaybeString): string | undefined {
    const v = value?.trim();
    return v ? v : undefined;
}

function normalizeUrl(name: string, value: string): string {
    try {
        // Ensures valid URL and returns normalized string.
        // Keeps path (e.g. /v1) as provided.
        return new URL(value).toString().replace(/\/$/, "");
    } catch {
        throw new Error(`[env] Invalid URL for ${name}: ${value}`);
    }
}

const isBrowser = typeof window !== "undefined";

/**
 * Public env (safe to use in browser)
 * These come from Vite as import.meta.env.*
 */
export const publicEnv = Object.freeze({
    APPWRITE_PROJECT_ID: required(
        "VITE_PUBLIC_APPWRITE_PROJECT_ID",
        import.meta.env.VITE_PUBLIC_APPWRITE_PROJECT_ID
    ),

    APPWRITE_PROJECT_NAME: required(
        "VITE_PUBLIC_APPWRITE_PROJECT_NAME",
        import.meta.env.VITE_PUBLIC_APPWRITE_PROJECT_NAME
    ),

    APPWRITE_ENDPOINT: normalizeUrl(
        "VITE_PUBLIC_APPWRITE_ENDPOINT",
        required("VITE_PUBLIC_APPWRITE_ENDPOINT", import.meta.env.VITE_PUBLIC_APPWRITE_ENDPOINT)
    ),

    APPWRITE_DATABASE: required(
        "VITE_PUBLIC_APPWRITE_DATABASE",
        import.meta.env.VITE_PUBLIC_APPWRITE_DATABASE
    ),

    APPWRITE_BUCKET: required(
        "VITE_PUBLIC_APPWRITE_BUCKET",
        import.meta.env.VITE_PUBLIC_APPWRITE_BUCKET
    ),

    /**
     * Optional. If blank, we default to the current origin in the browser.
     * On the server (no window), it remains undefined unless set.
     */
    APP_ORIGIN:
        optional("VITE_PUBLIC_APP_ORIGIN", import.meta.env.VITE_PUBLIC_APP_ORIGIN) ??
        (isBrowser ? window.location.origin : undefined),
} as const);

export type PublicEnv = typeof publicEnv;

/**
 * Server-only env (secrets)
 * Call this ONLY from server/runtime code (Node).
 *
 * NOTE:
 * - In Vite client bundles, process.env is not reliable and may not exist.
 * - This function guards against browser usage.
 */
export function getServerEnv() {
    if (isBrowser) {
        throw new Error("[env] getServerEnv() was called in the browser. This is not allowed.");
    }

    // Avoid ReferenceError if process is not defined in some environments
    const procEnv: Record<string, string | undefined> =
        (globalThis as any)?.process?.env ?? {};

    return Object.freeze({
        GMAIL_USER: required("GMAIL_USER", procEnv.GMAIL_USER),
        GMAIL_APP_PASSWORD: required("GMAIL_APP_PASSWORD", procEnv.GMAIL_APP_PASSWORD),
        APPWRITE_API_KEY: required("APPWRITE_API_KEY", procEnv.APPWRITE_API_KEY),
    } as const);
}

export type ServerEnv = ReturnType<typeof getServerEnv>;
