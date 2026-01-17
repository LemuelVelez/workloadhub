/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom"
import { Toaster } from "sonner"

import Loading from "./components/loading"
import NotFoundPage from "./pages/not-found"

import LandingPage from "./pages/landing"

import LoginPage from "./pages/auth/login"
import ForgotPasswordPage from "./pages/auth/forgot-password"
import ResetPasswordPage from "./pages/auth/reset-password"
import ChangePasswordPage from "./pages/auth/change-password"

import { useSession } from "@/hooks/use-session"
import { authApi } from "@/api/auth"

import { needsFirstLoginPasswordChange } from "@/lib/first-login"

const AUTH_PENDING_KEY = "workloadhub:auth:pendingAt"

function getAuthPendingAgeMs(): number | null {
  try {
    if (typeof window === "undefined") return null
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

const AdminOverviewPage = React.lazy(() => import("./pages/dashboard/admin/overview"))
const AdminUsersPage = React.lazy(() => import("./pages/dashboard/admin/users"))
const AdminMasterDataManagementPage = React.lazy(
  () => import("./pages/dashboard/admin/master-data-management")
)

// ✅ NEW: Rooms & Facilities page
const AdminRoomsAndFacilitiesPage = React.lazy(
  () => import("./pages/dashboard/admin/rooms-and-facilities")
)

// ✅ NEW: Academic Term Setup page
const AdminAcademicTermSetupPage = React.lazy(
  () => import("./pages/dashboard/admin/academic-term-setup")
)

// ✅ NEW: Rules & Policies page
const AdminRulesAndPoliciesPage = React.lazy(
  () => import("./pages/dashboard/admin/rules-and-policies")
)

// ✅ NEW: Audit Logs page
const AdminAuditLogsPage = React.lazy(
  () => import("./pages/dashboard/admin/audit-logs")
)

function readBool(v: any) {
  return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function safeParsePrefs(prefs: any) {
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

function resolveUserId(user: any) {
  return String(user?.$id || user?.id || user?.userId || "").trim()
}

function getMustChangePasswordFromPrefs(user: any) {
  const rawPrefs =
    user?.prefs ??
    user?.preferences ??
    user?.profile?.prefs ??
    user?.profile?.preferences ??
    user?.data?.prefs ??
    user?.data?.preferences ??
    {}

  const prefs = safeParsePrefs(rawPrefs)
  return readBool(prefs?.mustChangePassword ?? user?.mustChangePassword)
}

function useAuthSnapshot() {
  const { loading: sessionLoading, isAuthenticated, user } = useSession()

  const [fallbackUser, setFallbackUser] = React.useState<any | null>(null)
  const [fallbackLoading, setFallbackLoading] = React.useState(false)
  const triedRef = React.useRef(false)

  const [sessionStuck, setSessionStuck] = React.useState(false)

  React.useEffect(() => {
    if (!sessionLoading) {
      setSessionStuck(false)
      return
    }
    if (isAuthenticated || user) {
      setSessionStuck(false)
      return
    }

    const t = window.setTimeout(() => {
      setSessionStuck(true)
    }, 6500)

    return () => window.clearTimeout(t)
  }, [sessionLoading, isAuthenticated, user])

  React.useEffect(() => {
    if (isAuthenticated || user) return
    if (triedRef.current) return

    let alive = true

    const runFallback = async () => {
      if (!alive) return
      triedRef.current = true
      setFallbackLoading(true)

      authApi
        .me()
        .then((me: any) => {
          if (!alive) return
          if (me) setFallbackUser(me)
        })
        .catch(() => null)
        .finally(() => {
          if (!alive) return
          setFallbackLoading(false)
        })
    }

    if (!sessionLoading) {
      void runFallback()
      return
    }

    const timeout = window.setTimeout(() => {
      void runFallback()
    }, 1200)

    return () => {
      alive = false
      window.clearTimeout(timeout)
    }
  }, [sessionLoading, isAuthenticated, user])

  const authed = Boolean(isAuthenticated || user || fallbackUser)
  const effectiveUser = user || fallbackUser

  const loading = !authed && !sessionStuck && (sessionLoading || fallbackLoading)

  return {
    loading,
    authed,
    user: effectiveUser,
  }
}

type GateStatus = "unknown" | "needs_change" | "clear"

function useNeedsPasswordChange(user: any) {
  const userId = React.useMemo(() => resolveUserId(user), [user])
  const prefsMustChange = React.useMemo(() => getMustChangePasswordFromPrefs(user), [user])

  const [status, setStatus] = React.useState<GateStatus>("unknown")

  React.useEffect(() => {
    let alive = true

    setStatus("unknown")

    const run = async () => {
      if (!userId) {
        if (alive) setStatus("clear")
        return
      }

      if (prefsMustChange) {
        if (alive) setStatus("needs_change")
        return
      }

      const needs = await needsFirstLoginPasswordChange(userId).catch(() => false)

      if (alive) {
        setStatus(needs ? "needs_change" : "clear")
      }
    }

    void run()

    return () => {
      alive = false
    }
  }, [userId, prefsMustChange])

  return {
    loading: status === "unknown",
    needsChange: status === "needs_change",
  }
}

function RequireAuth() {
  const location = useLocation()
  const snap = useAuthSnapshot()

  const pendingAge = getAuthPendingAgeMs()
  const isAuthPending = pendingAge !== null && pendingAge < 8000

  React.useEffect(() => {
    if (!snap.authed) return
    try {
      window.localStorage.removeItem(AUTH_PENDING_KEY)
    } catch {
      // ignore
    }
  }, [snap.authed])

  if (!snap.authed && (snap.loading || isAuthPending)) {
    return (
      <Loading
        title={isAuthPending ? "Signing you in…" : "Checking session…"}
        message={isAuthPending ? "Finalizing your session, please wait." : "Verifying your login session."}
        fullscreen
      />
    )
  }

  if (!snap.authed) {
    return <Navigate to="/auth/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}

function RequireGatePass() {
  const location = useLocation()
  const snap = useAuthSnapshot()
  const gate = useNeedsPasswordChange(snap.user)

  if (!snap.authed && snap.loading) {
    return <Loading title="Checking access…" message="Verifying your login session." fullscreen />
  }

  if (snap.authed && gate.loading) {
    return <Loading title="Checking access…" message="Validating password change requirement." fullscreen />
  }

  if (gate.needsChange) {
    if (location.pathname !== "/auth/change-password") {
      return (
        <Navigate
          to="/auth/change-password"
          replace
          state={{ gate: true, reason: "first_login" }}
        />
      )
    }
  }

  return <Outlet />
}

function RequireNeedsPasswordChange() {
  const snap = useAuthSnapshot()
  const gate = useNeedsPasswordChange(snap.user)

  if (!snap.authed && snap.loading) {
    return <Loading title="Checking requirement…" message="Verifying your login session." fullscreen />
  }

  if (snap.authed && gate.loading) {
    return <Loading title="Checking requirement…" message="Verifying password change rule." fullscreen />
  }

  if (!gate.needsChange) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

function DashboardIndexRedirect() {
  const snap = useAuthSnapshot()

  const rawRole =
    (snap.user as any)?.role ||
    (snap.user as any)?.type ||
    (snap.user as any)?.accountType ||
    (snap.user as any)?.prefs?.role ||
    "ADMIN"

  const role = String(rawRole).toLowerCase()

  if (role.includes("chair")) return <Navigate to="/dashboard/chair/overview" replace />
  if (role.includes("faculty")) return <Navigate to="/dashboard/faculty/overview" replace />

  return <Navigate to="/dashboard/admin/overview" replace />
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />

      <React.Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<RequireNeedsPasswordChange />}>
              <Route path="/auth/change-password" element={<ChangePasswordPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<RequireGatePass />}>
              <Route path="/dashboard" element={<Outlet />}>
                <Route index element={<DashboardIndexRedirect />} />
                <Route path="overview" element={<DashboardIndexRedirect />} />

                <Route path="users" element={<Navigate to="admin/users" replace />} />

                <Route path="admin" element={<Outlet />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<AdminOverviewPage />} />
                  <Route path="users" element={<AdminUsersPage />} />

                  <Route
                    path="master-data-management"
                    element={<AdminMasterDataManagementPage />}
                  />

                  {/* ✅ NEW: Rooms & Facilities */}
                  <Route
                    path="rooms-and-facilities"
                    element={<AdminRoomsAndFacilitiesPage />}
                  />

                  {/* ✅ NEW: Academic Term Setup */}
                  <Route
                    path="academic-term-setup"
                    element={<AdminAcademicTermSetupPage />}
                  />

                  {/* ✅ NEW: Rules & Policies */}
                  <Route
                    path="rules-and-policies"
                    element={<AdminRulesAndPoliciesPage />}
                  />

                  {/* ✅ NEW: Audit Logs */}
                  <Route
                    path="audit-logs"
                    element={<AdminAuditLogsPage />}
                  />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/login" element={<Navigate to="/auth/login" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/auth/forgot-password" replace />} />
          <Route path="/reset-password" element={<Navigate to="/auth/reset-password" replace />} />
          <Route path="/change-password" element={<Navigate to="/auth/change-password" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </React.Suspense>
    </>
  )
}
