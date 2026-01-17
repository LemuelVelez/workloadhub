/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react"
import { toast } from "sonner"

import { authApi } from "@/api/auth"
import { useSession } from "@/hooks/use-session"

// ✅ NEW
import { needsFirstLoginPasswordChange } from "@/lib/first-login"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"
const FORCE_RELOGIN_KEY = "workloadhub:forceReLoginAt"

type LoginLocationState = {
    from?: string
    forceReLogin?: boolean
}

function markAuthPending() {
    try {
        window.localStorage.setItem(AUTH_PENDING_KEY, String(Date.now()))
    } catch {
        // ignore
    }
}

function clearAuthPending() {
    try {
        window.localStorage.removeItem(AUTH_PENDING_KEY)
    } catch {
        // ignore
    }
}

function getAuthPendingAgeMs(): number | null {
    try {
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

function requestSessionRefresh() {
    try {
        window.localStorage.setItem("workloadhub:sessionRefreshAt", String(Date.now()))
    } catch {
        // ignore
    }

    try {
        window.dispatchEvent(new CustomEvent("workloadhub:session-refresh"))
    } catch {
        // ignore
    }
}

function readBool(v: unknown) {
    return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function safeParsePrefs(prefs: unknown) {
    if (!prefs) return {}
    if (typeof prefs === "string") {
        try {
            const parsed = JSON.parse(prefs)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }
    if (typeof prefs === "object") return prefs
    return {}
}

/**
 * ✅ NEW: Unwrap user objects safely
 */
function unwrapUser(u: any) {
    if (!u) return null

    if (u?.$id || u?.id || u?.userId) return u
    if (u?.data && (u.data.$id || u.data.id || u.data.userId)) return u.data
    if (u?.user && (u.user.$id || u.user.id || u.user.userId)) return u.user

    return u
}

function resolveUserId(user: any) {
    const me = unwrapUser(user)
    return String(me?.$id || me?.id || me?.userId || "").trim()
}

/**
 * ✅ Gate flags
 */
function getGateFlags(user: any) {
    const me = unwrapUser(user)

    const rawPrefs =
        me?.prefs ??
        me?.preferences ??
        me?.profile?.prefs ??
        me?.profile?.preferences ??
        me?.data?.prefs ??
        me?.data?.preferences ??
        {}

    const prefs = safeParsePrefs(rawPrefs)

    const mustChangePassword = readBool((prefs as any)?.mustChangePassword ?? me?.mustChangePassword)
    return { mustChangePassword }
}

function safeRedirectTarget(from: unknown) {
    const s = String(from || "").trim()
    if (!s) return "/dashboard"
    if (s.startsWith("/auth")) return "/dashboard"
    return s
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T) {
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

async function getMeWithRetry(maxAttempts = 10) {
    const delays = [0, 120, 200, 350, 550, 800, 1100, 1500, 2000, 2600]
    const attempts = Math.max(2, Math.min(maxAttempts, delays.length))

    for (let i = 0; i < attempts; i++) {
        if (delays[i] > 0) {
            await new Promise((r) => setTimeout(r, delays[i]))
        }

        const me = await authApi.me().catch(() => null)
        if (me) return me
    }

    return null
}

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const { loading: sessionLoading, isAuthenticated, user } = useSession()

    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)

    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const state = (location.state ?? null) as LoginLocationState | null

    const from = React.useMemo(() => {
        return safeRedirectTarget(state?.from)
    }, [state?.from])

    const postLoginTargetRef = React.useRef<string>(from)

    // ✅ prevent multi-redirect glitches
    const redirectingRef = React.useRef(false)
    const autoRedirectDoneRef = React.useRef(false)

    // ✅ block auto-redirect while a manual login submit is running
    const submittingLoginRef = React.useRef(false)

    // ✅ fallback redirect if user bounced back to login while session is being created
    const authPendingRedirectTriedRef = React.useRef(false)

    React.useEffect(() => {
        postLoginTargetRef.current = from
    }, [from])

    // ✅ If we just forced logout after password change, do NOT auto-redirect
    const forceReLogin = React.useMemo(() => {
        if (state?.forceReLogin === true) return true

        try {
            const t = Number(window.localStorage.getItem(FORCE_RELOGIN_KEY) || "")
            if (!Number.isFinite(t)) return false
            return Date.now() - t < 15000
        } catch {
            return false
        }
    }, [state?.forceReLogin])

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem("workloadhub:lastEmail")
            if (saved && !email) setEmail(saved)
        } catch {
            // ignore
        }

        // ✅ Cleanup old pending keys if stale
        try {
            const age = getAuthPendingAgeMs()
            if (age !== null && age > 20000) {
                clearAuthPending()
            }
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * ✅ Auto-redirect if already logged in (session restored)
     */
    React.useEffect(() => {
        if (forceReLogin) return
        if (sessionLoading) return
        if (!isAuthenticated) return
        if (autoRedirectDoneRef.current) return
        if (redirectingRef.current) return
        if (submittingLoginRef.current) return

        autoRedirectDoneRef.current = true
        redirectingRef.current = true

        const run = async () => {
            const { mustChangePassword } = getGateFlags(user)

            if (mustChangePassword) {
                navigate("/auth/change-password", { replace: true, state: { gate: true } })
                return
            }

            const userId = resolveUserId(user)
            if (userId) {
                const needs = await withTimeout(
                    needsFirstLoginPasswordChange(userId).catch(() => false),
                    900,
                    false
                )
                if (needs) {
                    navigate("/auth/change-password", { replace: true, state: { gate: true } })
                    return
                }
            }

            navigate(postLoginTargetRef.current || "/dashboard", { replace: true })
        }

        void run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forceReLogin, sessionLoading, isAuthenticated, user])

    /**
     * ✅ CRITICAL FIX:
     * If user gets bounced back to login while auth pending,
     * we do a direct authApi.me() check and force redirect again.
     */
    React.useEffect(() => {
        if (forceReLogin) return
        if (loading) return
        if (submittingLoginRef.current) return
        if (redirectingRef.current) return
        if (isAuthenticated) return

        const age = getAuthPendingAgeMs()
        if (age === null || age > 8000) return
        if (authPendingRedirectTriedRef.current) return

        authPendingRedirectTriedRef.current = true

        const run = async () => {
            const meRaw = await getMeWithRetry()
            const me = unwrapUser(meRaw)

            if (!me) return

            // ✅ We are actually signed in → redirect now
            const userId = resolveUserId(me)
            let target = postLoginTargetRef.current || "/dashboard"

            const { mustChangePassword } = getGateFlags(me)

            let needsGate = mustChangePassword
            if (!needsGate && userId) {
                needsGate = await withTimeout(
                    needsFirstLoginPasswordChange(userId).catch(() => false),
                    900,
                    false
                )
            }

            if (needsGate) target = "/auth/change-password"

            redirectingRef.current = true
            autoRedirectDoneRef.current = true
            navigate(target, { replace: true, state: target === "/auth/change-password" ? { gate: true } : undefined })
        }

        void run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forceReLogin, loading, isAuthenticated])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (loading) return
        if (redirectingRef.current) return

        const cleanEmail = email.trim().toLowerCase()
        const cleanPassword = password

        if (!cleanEmail) {
            setError("Email is required.")
            return
        }

        if (!cleanPassword) {
            setError("Password is required.")
            return
        }

        submittingLoginRef.current = true

        setLoading(true)
        markAuthPending()

        // ✅ consume force re-login flag now
        try {
            window.localStorage.removeItem(FORCE_RELOGIN_KEY)
        } catch {
            // ignore
        }

        try {
            await authApi.login(cleanEmail, cleanPassword)

            // ✅ notify session hooks right away
            requestSessionRefresh()

            try {
                window.localStorage.setItem("workloadhub:lastEmail", cleanEmail)
            } catch {
                // ignore
            }

            const meRaw = await getMeWithRetry()
            const me = unwrapUser(meRaw)

            toast.success("Signed in ✅")

            // ✅ Decide target (FAST + safe timeout)
            let target = postLoginTargetRef.current || "/dashboard"

            if (me) {
                const userId = resolveUserId(me)
                const { mustChangePassword } = getGateFlags(me)

                let needsGate = mustChangePassword

                if (!needsGate && userId) {
                    needsGate = await withTimeout(
                        needsFirstLoginPasswordChange(userId).catch(() => false),
                        900,
                        false
                    )
                }

                if (needsGate) {
                    target = "/auth/change-password"
                }
            }

            /**
             * ✅ IMPORTANT FIX:
             * DO NOT clear AUTH_PENDING_KEY here.
             * Let App.tsx clear it after auth snapshot becomes authed.
             * This prevents bouncing back to /auth/login.
             */

            autoRedirectDoneRef.current = true
            redirectingRef.current = true
            navigate(target, { replace: true, state: target === "/auth/change-password" ? { gate: true } : undefined })
        } catch (err: any) {
            setError(err?.message || "Login failed. Please try again.")
            redirectingRef.current = false
            clearAuthPending()
        } finally {
            setLoading(false)
            submittingLoginRef.current = false
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
                <Card className="w-full">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Sign in</CardTitle>
                        <CardDescription>Enter your email and password to continue.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Sign in failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-9"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-9 pr-10"
                                        disabled={loading}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 top-1 h-8 w-8"
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={loading}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            <Separator />

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in…
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>

                            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                                ✅ If this is your first login, you will be asked to change your password.
                            </div>
                        </form>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between">
                        <Link to="/auth/forgot-password" className="text-sm underline-offset-4 hover:underline">
                            Forgot password?
                        </Link>
                        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                            Back home
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
