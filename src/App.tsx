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
              {/* Default dashboard route */}
              <Route index element={<Navigate to="admin/overview" replace />} />

              {/* ✅ Aliases (fix blank white space routes) */}
              <Route path="users" element={<Navigate to="admin/users" replace />} />

              {/* Admin pages */}
              <Route path="admin/overview" element={<AdminOverviewPage />} />
              <Route path="admin/users" element={<AdminUsersPage />} />

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
