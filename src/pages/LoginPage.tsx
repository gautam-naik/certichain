import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { api, setAuthToken } from "../services/api";
import { AdminUser } from "../types";
import { useToast } from "../components/ToastContext";

interface LoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { pushToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid institutional email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setAuthToken(res.token);
      onLoginSuccess(res.user);
      pushToast(`Signed in as ${res.user.name}`, "success");
      navigate("/admin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout isAuthenticated={false}>
      <div className="max-w-md mx-auto px-6 py-20">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1424] p-8 shadow-2xl">
          <div className="flex items-center gap-3 text-teal-400">
            <div className="p-2.5 rounded-lg bg-teal-500/15 border border-teal-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-teal-400">
                Authorized Registrar Access
              </p>
              <h1 className="font-display text-xl font-bold text-white">
                Admin Sign In
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Sign in with your administrator credentials to issue certificates,
            anchor hashes on-chain, and audit verification history.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5 text-xs text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Institutional Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@certichain.edu"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-60 transition-colors"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Console"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-xs text-slate-400">
            Demo administrator account details are documented in{" "}
            <code className="text-slate-300 font-mono">README.md</code> and{" "}
            <code className="text-slate-300 font-mono">.env.example</code>.
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
