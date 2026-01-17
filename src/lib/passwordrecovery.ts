export type RecoveryParams = {
    token: string | null
    userId: string | null
    secret: string | null
}

export function readRecoveryParamsFromLocation(search: string): RecoveryParams {
    const sp = new URLSearchParams(search)
    return {
        token: sp.get("token"),
        userId: sp.get("userId"),
        secret: sp.get("secret"),
    }
}

/**
 * ✅ Valid if:
 * - Token-based reset (Express): token exists
 * - Appwrite recovery reset: userId + secret exists
 */
export function hasValidRecoveryParams(p: RecoveryParams) {
    return Boolean(p.token || (p.userId && p.secret))
}
