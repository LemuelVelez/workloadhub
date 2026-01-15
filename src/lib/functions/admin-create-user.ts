/* eslint-disable @typescript-eslint/no-explicit-any */
import { Functions } from "appwrite"
import { appwriteClient } from "@/lib/db"
import { publicEnv } from "@/lib/env"

export type CreateAuthUserInvitePayload = {
    email: string
    name?: string | null

    /**
     * ✅ NEW: Used when resending credentials for existing user
     */
    userId?: string

    /**
     * ✅ NEW: When true -> function will NOT create new user.
     * It will reset password + resend credentials for existing user.
     */
    resend?: boolean
}

export type CreateAuthUserInviteResult = {
    ok: boolean
    userId: string
    email: string
    message?: string
    action?: "created" | "resent"
}

function safeJsonParse(raw: any) {
    if (raw == null) return null
    if (typeof raw === "object") return raw
    if (typeof raw !== "string") return null
    try {
        return JSON.parse(raw)
    } catch {
        return { raw }
    }
}

/**
 * ✅ Calls Appwrite Function:
 * - creates the auth user OR resends credentials
 * - sends the credentials email via Messaging provider (WorkloadHub_Gmail_SMTP)
 */
export async function createAuthUserAndSendCredentials(payload: CreateAuthUserInvitePayload) {
    const functionId = (publicEnv as any).APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID as string | undefined

    if (!functionId) {
        throw new Error(
            "Missing VITE_PUBLIC_APPWRITE_ADMIN_CREATE_USER_FUNCTION_ID in .env (your Function ID)."
        )
    }

    const functions = new Functions(appwriteClient as any)

    const exec = await (functions as any).createExecution({
        functionId,
        body: JSON.stringify(payload),
        async: false,
    })

    const status = (exec as any)?.responseStatusCode ?? (exec as any)?.status ?? 200

    const bodyRaw =
        (exec as any)?.responseBody ?? (exec as any)?.stdout ?? (exec as any)?.body ?? ""

    const parsed = safeJsonParse(bodyRaw) as any

    if (status >= 400 || parsed?.ok === false) {
        throw new Error(parsed?.message || "Failed to create user / send credentials email.")
    }

    if (!parsed?.userId) {
        throw new Error("Function did not return userId.")
    }

    return parsed as CreateAuthUserInviteResult
}
