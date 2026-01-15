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
 * Lightweight shared session store (module-level cache)
 * so Header/Hero/CTA won't call authApi.me() 3 times.
 */
let cachedUser: SessionUser | null | undefined = undefined
let cachedError: string | null = null
let inflight: Promise<SessionUser | null> | null = null
const listeners = new Set<() => void>()

function notify() {
    listeners.forEach((fn) => fn())
}

async function fetchCurrentUser() {
    if (inflight) return inflight

    inflight = (async () => {
        try {
            const me = await authApi.me()
            cachedUser = me ? (me as SessionUser) : null
            cachedError = null
            return cachedUser
        } catch (err: any) {
            cachedUser = null
            cachedError = err?.message || "Failed to load session."
            return null
        } finally {
            inflight = null
            notify()
        }
    })()

    return inflight
}

export function refreshSession() {
    cachedUser = undefined
    cachedError = null
    notify()
    return fetchCurrentUser()
}

export function clearSessionCache() {
    cachedUser = null
    cachedError = null
    notify()
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

    React.useEffect(() => {
        const cb = () => force((n) => n + 1)
        listeners.add(cb)
        return () => {
            listeners.delete(cb)
        }
    }, [])

    React.useEffect(() => {
        if (!auto) return
        if (cachedUser === undefined) {
            void fetchCurrentUser()
        }
    }, [auto])

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
