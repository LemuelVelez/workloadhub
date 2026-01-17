/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { authApi } from "@/api/auth"

export type SessionUser = {
    $id: string
    name?: string
    email?: string
    [key: string]: any
}

/**
 * ✅ Session Store (module cache)
 */
let cachedUser: SessionUser | null | undefined = undefined
let cachedError: string | null = null
let inflight: Promise<SessionUser | null> | null = null

const listeners = new Set<() => void>()

/**
 * ✅ Stability guards
 */
let lastFetchAt = 0
let fetchNonce = 0

const SESSION_REFRESH_KEY = "workloadhub:sessionRefreshAt"
const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"

const AUTH_PENDING_GRACE_MS = 8000
const ME_TIMEOUT_MS = 4500
const REVALIDATE_TTL_MS = 30000

function isBrowser() {
    return typeof window !== "undefined"
}

function notify() {
    listeners.forEach((fn) => fn())
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T) {
    if (!isBrowser()) return p
    let t: any = null

    return Promise.race([
        p,
        new Promise<T>((resolve) => {
            t = window.setTimeout(() => resolve(fallback), ms)
        }),
    ]).finally(() => {
        if (t) window.clearTimeout(t)
    })
}

function getAuthPendingAgeMs(): number | null {
    try {
        if (!isBrowser()) return null
        const v = window.localStorage.getItem(AUTH_PENDING_KEY)
        if (!v) return null
        const t = Number(v)
        if (!Number.isFinite(t)) return null
        const age = Date.now() - t
        return age >= 0 ? age : null
    } catch {
        return null
    }
}

function isAuthPendingNow() {
    const age = getAuthPendingAgeMs()
    return age !== null && age < AUTH_PENDING_GRACE_MS
}

/**
 * ✅ Safe unwrap (some SDKs return { data: {...} })
 */
function unwrapUser(u: any): SessionUser | null {
    if (!u) return null
    if (u?.$id || u?.id || u?.userId) return u as SessionUser
    if (u?.data && (u.data.$id || u.data.id || u.data.userId)) return u.data as SessionUser
    if (u?.user && (u.user.$id || u.user.id || u.user.userId)) return u.user as SessionUser
    return u as SessionUser
}

function setCache(nextUser: SessionUser | null | undefined, nextError: string | null) {
    cachedUser = nextUser
    cachedError = nextError
    notify()
}

/**
 * ✅ Core fetch (dedup + timeout + retry during login pending)
 */
async function fetchCurrentUserInternal(force = false): Promise<SessionUser | null> {
    // ✅ Prevent refetch spam (TTL), unless forced
    if (!force && cachedUser !== undefined) {
        const age = Date.now() - lastFetchAt
        if (age >= 0 && age < REVALIDATE_TTL_MS) {
            return cachedUser ?? null
        }
    }

    // ✅ Deduplicate inflight
    if (inflight) return inflight

    const myNonce = fetchNonce

    inflight = (async () => {
        try {
            // ✅ Best retries only during auth pending (first-login session creation window)
            const delays = isAuthPendingNow() ? [0, 120, 220, 400, 650, 1000] : [0]

            for (let i = 0; i < delays.length; i++) {
                if (delays[i] > 0) await sleep(delays[i])

                // if newer refresh started, stop
                if (myNonce !== fetchNonce) return null

                const meRaw = await withTimeout(authApi.me(), ME_TIMEOUT_MS, null)
                const me = unwrapUser(meRaw)

                if (me) {
                    lastFetchAt = Date.now()
                    setCache(me, null)
                    return me
                }
            }

            /**
             * ✅ IMPORTANT:
             * If auth is still pending, DO NOT lock user as "logged out" yet.
             * Keep cachedUser as undefined so route guards can wait safely.
             */
            if (isAuthPendingNow()) {
                setCache(undefined, null)
                return null
            }

            // Not pending -> truly unauthenticated
            lastFetchAt = Date.now()
            setCache(null, null)
            return null
        } catch (err: any) {
            // if a newer refresh started, ignore
            if (myNonce !== fetchNonce) return null

            const msg = err?.message || "Failed to load session."

            // during auth pending, don't hard-fail immediately
            if (isAuthPendingNow()) {
                setCache(undefined, null)
                return null
            }

            lastFetchAt = Date.now()
            setCache(null, msg)
            return null
        } finally {
            inflight = null
        }
    })()

    return inflight
}

/**
 * ✅ Public API: refresh session
 * - cancels old inflight by nonce increment
 * - forces new fetch
 */
export function refreshSession() {
    fetchNonce += 1
    inflight = null
    lastFetchAt = 0
    setCache(undefined, null)
    return fetchCurrentUserInternal(true)
}

/**
 * ✅ Public API: clear cache (force logged out)
 */
export function clearSessionCache() {
    fetchNonce += 1
    inflight = null
    lastFetchAt = 0
    setCache(null, null)
}

/**
 * useSession()
 * - user: current logged in user or null
 * - loading: true while checking session
 * - isAuthenticated: boolean
 * - refresh(): forces re-check
 */
export function useSession(opts?: { auto?: boolean }) {
    const auto = opts?.auto ?? true
    const [, force] = React.useState(0)

    // ✅ Subscribe to store updates
    React.useEffect(() => {
        const cb = () => force((n) => n + 1)
        listeners.add(cb)
        return () => {
            listeners.delete(cb)
        }
    }, [])

    // ✅ Auto-fetch on mount (only once)
    React.useEffect(() => {
        if (!auto) return
        if (cachedUser === undefined) {
            void fetchCurrentUserInternal(false)
        }
    }, [auto])

    /**
     * ✅ Listen to refresh signals:
     * - custom event: "workloadhub:session-refresh"
     * - storage key: "workloadhub:sessionRefreshAt" (cross-tab)
     */
    React.useEffect(() => {
        if (!isBrowser()) return

        const onCustomRefresh = () => {
            void refreshSession()
        }

        const onStorage = (e: StorageEvent) => {
            if (!e?.key) return
            if (e.key === SESSION_REFRESH_KEY) {
                void refreshSession()
            }
        }

        window.addEventListener("workloadhub:session-refresh", onCustomRefresh as any)
        window.addEventListener("storage", onStorage)

        return () => {
            window.removeEventListener("workloadhub:session-refresh", onCustomRefresh as any)
            window.removeEventListener("storage", onStorage)
        }
    }, [])

    const loading = cachedUser === undefined
    const user = cachedUser ?? null

    return {
        user,
        loading,
        error: cachedError,
        isAuthenticated: Boolean(user),
        refresh: refreshSession,
    }
}
