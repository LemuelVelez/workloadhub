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

const AdminRoomsAndFacilitiesPage = React.lazy(
  () => import("./pages/dashboard/admin/rooms-and-facilities")
)

const AdminAcademicTermSetupPage = React.lazy(
  () => import("./pages/dashboard/admin/academic-term-setup")
)

const AdminRulesAndPoliciesPage = React.lazy(
  () => import("./pages/dashboard/admin/rules-and-policies")
)

const AdminAuditLogsPage = React.lazy(
  () => import("./pages/dashboard/admin/audit-logs")
)

const AdminRequestsPage = React.lazy(() => import("./pages/dashboard/admin/requests"))
const AdminSchedulesPage = React.lazy(() => import("./pages/dashboard/admin/schedules"))

const DashboardAccountsPage = React.lazy(() => import("./pages/dashboard/accounts"))
const DashboardSettingsPage = React.lazy(() => import("./pages/dashboard/settings"))

const DepartmentHeadFacultyWorkloadAssignmentPage = React.lazy(
  () => import("./pages/dashboard/department-head/faculty-workload-assignment")
)

// ✅ NEW: Department Head Faculty Availability
const DepartmentHeadFacultyAvailabilityPage = React.lazy(
  () => import("./pages/dashboard/department-head/faculty-availability")
)

// ✅ Department Head Class Scheduling
const DepartmentHeadClassSchedulingPage = React.lazy(
  () => import("./pages/dashboard/department-head/class-scheduling")
)

// ✅ NEW: Conflict Checker
const DepartmentHeadConflictCheckerPage = React.lazy(
  () => import("./pages/dashboard/department-head/conflict-checker")
)

function readBool(v: any) {
  return v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"
}

function safeParseObjectMaybe(v: any) {
  if (!v) return {}
  if (typeof v === "object") return v
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function unwrapUserLike(u: any) {
  if (!u) return null
  if (u?.$id || u?.id || u?.userId) return u
  if (u?.data && (u.data.$id || u.data.id || u.data.userId)) return u.data
  if (u?.user && (u.user.$id || u.user.id || u.user.userId)) return u.user
  return u
}

function resolveUserId(user: any) {
  const u = unwrapUserLike(user)
  return String(u?.$id || u?.id || u?.userId || "").trim()
}

function getMustChangePasswordFromPrefs(user: any) {
  const u = unwrapUserLike(user)

  const rawPrefs =
    u?.prefs ??
    u?.preferences ??
    u?.profile?.prefs ??
    u?.profile?.preferences ??
    u?.data?.prefs ??
    u?.data?.preferences ??
    {}

  const prefs = safeParseObjectMaybe(rawPrefs)
  return readBool(prefs?.mustChangePassword ?? u?.mustChangePassword)
}

/**
 * ✅ Role Resolver
 * Role merged from user_profiles.role inside useSession()
 */
type RoleKey = "admin" | "chair" | "faculty" | "unknown"
type AllowedRoleKey = Exclude<RoleKey, "unknown">

function resolveRoleKey(user: any): RoleKey {
  const u = unwrapUserLike(user)
  if (!u) return "unknown"

  const rawRole = u?.role || u?.type || u?.accountType || ""
  const role = String(rawRole || "").toLowerCase().trim()

  if (role.includes("admin")) return "admin"
  if (role.includes("chair") || role.includes("department head") || role.includes("dept head") || role.includes("scheduler")) {
    return "chair"
  }
  if (role.includes("faculty")) return "faculty"

  return "unknown"
}

function roleHomePath(role: RoleKey) {
  if (role === "admin") return "/dashboard/admin/overview"
  if (role === "chair") return "/dashboard/department-head/faculty-workload-assignment"
  if (role === "faculty") return "/dashboard/faculty/overview"
  return "/dashboard"
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
          const unwrapped = unwrapUserLike(me)
          if (unwrapped) setFallbackUser(unwrapped)
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

  const effectiveUser = unwrapUserLike(user) || unwrapUserLike(fallbackUser)
  const authed = Boolean(isAuthenticated || effectiveUser)

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

function RequireRole(props: { allow: AllowedRoleKey[] }) {
  const location = useLocation()
  const snap = useAuthSnapshot()

  if (!snap.authed && snap.loading) {
    return <Loading title="Checking access…" message="Verifying your login session." fullscreen />
  }

  if (!snap.authed) {
    return <Navigate to="/auth/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  const role = resolveRoleKey(snap.user)

  if (role === "unknown") {
    return <Loading title="Resolving role…" message="Loading your profile permissions." fullscreen />
  }

  const allowed = props.allow.includes(role)
  if (!allowed) {
    return (
      <Navigate
        to={roleHomePath(role)}
        replace
        state={{ denied: location.pathname }}
      />
    )
  }

  return <Outlet />
}

function DashboardIndexRedirect() {
  const snap = useAuthSnapshot()
  const role = resolveRoleKey(snap.user)

  if (role === "unknown") {
    return <Loading title="Resolving role…" message="Loading your dashboard route." fullscreen />
  }

  return <Navigate to={roleHomePath(role)} replace />
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

                <Route path="accounts" element={<DashboardAccountsPage />} />
                <Route path="settings" element={<DashboardSettingsPage />} />

                <Route path="users" element={<Navigate to="admin/users" replace />} />
                <Route path="requests" element={<Navigate to="admin/requests" replace />} />
                <Route path="schedules" element={<Navigate to="admin/schedules" replace />} />

                <Route path="admin" element={<RequireRole allow={["admin"]} />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<AdminOverviewPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="master-data-management" element={<AdminMasterDataManagementPage />} />
                  <Route path="rooms-and-facilities" element={<AdminRoomsAndFacilitiesPage />} />
                  <Route path="academic-term-setup" element={<AdminAcademicTermSetupPage />} />
                  <Route path="rules-and-policies" element={<AdminRulesAndPoliciesPage />} />
                  <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                  <Route path="requests" element={<AdminRequestsPage />} />
                  <Route path="schedules" element={<AdminSchedulesPage />} />
                </Route>

                {/* ✅ CHAIR Area */}
                <Route path="department-head" element={<RequireRole allow={["chair"]} />}>
                  <Route index element={<Navigate to="faculty-workload-assignment" replace />} />

                  <Route
                    path="faculty-workload-assignment"
                    element={<DepartmentHeadFacultyWorkloadAssignmentPage />}
                  />

                  {/* ✅ NEW: Faculty Availability */}
                  <Route
                    path="faculty-availability"
                    element={<DepartmentHeadFacultyAvailabilityPage />}
                  />

                  <Route
                    path="class-scheduling"
                    element={<DepartmentHeadClassSchedulingPage />}
                  />

                  {/* ✅ Conflict Checker */}
                  <Route
                    path="conflict-checker"
                    element={<DepartmentHeadConflictCheckerPage />}
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
