import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import LoginPage from "./pages/auth/login";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";

function HomeFallback() {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-10">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">WorkloadHub</h1>
          <p className="text-muted-foreground">
            Home page is not wired yet. Update <code className="px-1">src/App.tsx</code> to point to your real
            dashboard/home.
          </p>
          <p className="text-sm text-muted-foreground">
            Routes ready: <code className="px-1">/auth/login</code>,{" "}
            <code className="px-1">/auth/forgot-password</code>,{" "}
            <code className="px-1">/auth/reset-password</code>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * NOTE:
 * This file assumes you already wrap the app with <BrowserRouter> in src/main.tsx (Vite default).
 * Example:
 *   ReactDOM.createRoot(...).render(
 *     <BrowserRouter>
 *       <App />
 *     </BrowserRouter>
 *   )
 */
export default function App() {
  return (
    <>
      {/* Sonner global toaster */}
      <Toaster richColors position="top-right" />

      <Routes>
        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Default redirects */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/auth/forgot-password" replace />} />
        <Route path="/reset-password" element={<Navigate to="/auth/reset-password" replace />} />

        {/* Home (replace with your dashboard later) */}
        <Route path="/" element={<HomeFallback />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
