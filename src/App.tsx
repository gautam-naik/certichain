import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ToastContext";
import { api, getAuthToken, setAuthToken } from "./services/api";
import { AdminUser } from "./types";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { IssueCertificatePage } from "./pages/IssueCertificatePage";
import { CertificateDetailsPage } from "./pages/CertificateDetailsPage";
import { VerifyPage } from "./pages/VerifyPage";
import { RegistryPage } from "./pages/RegistryPage";
import { VerificationHistoryPage } from "./pages/VerificationHistoryPage";

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = () => {
    api.logout().catch(() => {});
    setAuthToken(null);
    setUser(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-sm text-slate-400">
        Loading CertiChain...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
          <Route
            path="/"
            element={<LandingPage isAuthenticated={Boolean(user)} />}
          />
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/admin" replace />
              ) : (
                <LoginPage onLoginSuccess={setUser} />
              )
            }
          />
          <Route
            path="/verify"
            element={<VerifyPage isAuthenticated={Boolean(user)} />}
          />
          <Route
            path="/registry"
            element={<RegistryPage user={user} onLogout={handleLogout} />}
          />
          <Route
            path="/certificates/:id"
            element={
              <CertificateDetailsPage user={user} onLogout={handleLogout} />
            }
          />
          <Route
            path="/admin"
            element={
              user ? (
                <AdminDashboardPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/issue"
            element={
              user ? (
                <IssueCertificatePage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/admin/history"
            element={
              user ? (
                <VerificationHistoryPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
