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

import { useSession } from "@/hooks/use-session"

// ✅ Lazy-load dashboard pages
const AdminOverviewPage = React.lazy(() => import("./pages/dashboard/admin/overview"))
const AdminUsersPage = React.lazy(() => import("./pages/dashboard/admin/users"))

// ✅ (Optional) If you already have these pages, uncomment them
// const ChairOverviewPage = React.lazy(() => import("./pages/dashboard/chair/overview"))
// const FacultyOverviewPage = React.lazy(() => import("./pages/dashboard/faculty/overview"))

function RequireAuth() {
  const location = useLocation()
  const { loading, isAuthenticated } = useSession()

  if (loading) {
    return (
      <Loading
        title="Checking session…"
        message="Verifying your login session."
        fullscreen
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}

/**
 * ✅ Redirect /dashboard to the correct overview depending on the user's role
 * This prevents "Dashboard" and "Overview" being treated as the same item.
 */
function DashboardIndexRedirect() {
  const { user } = useSession()

  // ✅ adjust this field based on your backend user object
  const role = (user as any)?.role || (user as any)?.type || (user as any)?.accountType || "admin"

  if (role === "chair") return <Navigate to="/dashboard/chair/overview" replace />
  if (role === "faculty") return <Navigate to="/dashboard/faculty/overview" replace />

  // default: admin
  return <Navigate to="/dashboard/admin/overview" replace />
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />

      <React.Suspense fallback={<Loading />}>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* ✅ Protected Dashboard */}
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<Outlet />}>
              {/* ✅ Default dashboard route (role-based) */}
              <Route index element={<DashboardIndexRedirect />} />

              {/* ✅ Optional nice alias: /dashboard/overview */}
              <Route path="overview" element={<DashboardIndexRedirect />} />

              {/* ✅ Aliases (fix blank white space routes) */}
              <Route path="users" element={<Navigate to="admin/users" replace />} />

              {/* ✅ Admin pages */}
              <Route path="admin" element={<Outlet />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverviewPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Route>

              {/* ✅ Chair pages (ONLY if you already created them) */}
              {/* 
              <Route path="chair" element={<Outlet />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ChairOverviewPage />} />
              </Route>
              */}

              {/* ✅ Faculty pages (ONLY if you already created them) */}
              {/* 
              <Route path="faculty" element={<Outlet />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<FacultyOverviewPage />} />
              </Route>
              */}

              {/* Dashboard catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

          {/* Auth */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          {/* Friendly aliases */}
          <Route path="/login" element={<Navigate to="/auth/login" replace />} />
          <Route
            path="/forgot-password"
            element={<Navigate to="/auth/forgot-password" replace />}
          />
          <Route
            path="/reset-password"
            element={<Navigate to="/auth/reset-password" replace />}
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </React.Suspense>
    </>
  )
}
