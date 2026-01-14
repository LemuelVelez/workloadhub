
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import LandingPage from "./pages/landing";

import LoginPage from "./pages/auth/login";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />

      <Routes>
        {/* Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Friendly aliases */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/auth/forgot-password" replace />} />
        <Route path="/reset-password" element={<Navigate to="/auth/reset-password" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
