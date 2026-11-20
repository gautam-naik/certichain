import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FilePlus2,
  Database,
  History,
  ShieldCheck,
  LogOut,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { AdminUser } from "../types";
import { connectMetaMask, shortenAddress, WalletConnection } from "../services/wallet";
import { useToast } from "./ToastContext";

interface AdminLayoutProps {
  children: React.ReactNode;
  user: AdminUser;
  breadcrumb: string;
  onLogout: () => void;
}

export function AdminLayout({
  children,
  user,
  breadcrumb,
  onLogout,
}: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [connecting, setConnecting] = useState(false);

  const navItems = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/issue", label: "Issue Certificate", icon: FilePlus2 },
    { to: "/registry", label: "Certificate Registry", icon: Database },
    { to: "/admin/history", label: "Verification History", icon: History },
    { to: "/verify", label: "Public Verifier", icon: ShieldCheck },
  ];

  const handleWalletConnect = async () => {
    setConnecting(true);
    try {
      const conn = await connectMetaMask();
      setWallet(conn);
      pushToast(`Connected wallet ${shortenAddress(conn.address)}`, "success");
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Failed to connect MetaMask",
        "error"
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleSignOut = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-[#0A101D]">
        <div className="h-16 px-6 flex items-center border-b border-slate-800/80">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap"
          >
            CertiChain
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="px-2">
            <p className="text-xs font-medium text-slate-200 truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#0A101D] border-r border-slate-800 flex flex-col h-full z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
              <Link
                to="/"
                className="font-display text-lg font-bold text-white"
                onClick={() => setMobileOpen(false)}
              >
                CertiChain
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active
                        ? "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                        : "text-slate-400 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm text-slate-400 truncate">
              <span>Admin</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className="text-slate-100 font-medium">{breadcrumb}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleWalletConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 text-slate-200 hover:border-teal-500/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {wallet
                  ? `${shortenAddress(wallet.address)} (${wallet.networkName})`
                  : connecting
                  ? "Connecting..."
                  : "Connect MetaMask"}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
