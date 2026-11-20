import React from "react";
import { Link, useLocation } from "react-router-dom";

interface PublicLayoutProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
}

export function PublicLayout({
  children,
  isAuthenticated = false,
}: PublicLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-[#070B14] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            CertiChain
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href={isHome ? "#how-it-works" : "/#how-it-works"}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <Link
              to="/verify"
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                location.pathname.startsWith("/verify") ? "text-teal-400" : ""
              }`}
            >
              Verify
            </Link>
            <Link
              to="/registry"
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                location.pathname.startsWith("/registry") ? "text-teal-400" : ""
              }`}
            >
              Registry
            </Link>
            <a
              href={isHome ? "#architecture" : "/#architecture"}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={isAuthenticated ? "/admin" : "/login"}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? "Admin Console" : "Admin Login"}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800/80 bg-[#050811] py-10 mt-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-base font-bold text-white">
              CertiChain
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Decentralized Academic Certificate Verification System · Solidity ^0.8.20 & SHA-256
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <Link to="/verify" className="hover:text-slate-200 transition-colors">
              Verify Credential
            </Link>
            <Link to="/registry" className="hover:text-slate-200 transition-colors">
              Public Registry
            </Link>
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              OpenAPI Docs
            </a>
            <Link to="/login" className="hover:text-slate-200 transition-colors">
              Registrar Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
