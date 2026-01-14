export type RecoveryParams = {
    userId: string | null;
    secret: string | null;
};

export function readRecoveryParamsFromLocation(search: string): RecoveryParams {
    const sp = new URLSearchParams(search);
    return {
        userId: sp.get("userId"),
        secret: sp.get("secret"),
    };
}

export function hasValidRecoveryParams(p: RecoveryParams) {
    return Boolean(p.userId && p.secret);
}
