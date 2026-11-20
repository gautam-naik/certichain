import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  QrCode,
  Lock,
  Layers,
  CheckCircle2,
  Search,
} from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";

interface LandingPageProps {
  isAuthenticated: boolean;
}

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const [quickId, setQuickId] = useState("");
  const navigate = useNavigate();

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickId.trim().toUpperCase();
    if (cleaned) {
      navigate(`/verify?id=${encodeURIComponent(cleaned)}`);
    } else {
      navigate("/verify");
    }
  };

  return (
    <PublicLayout isAuthenticated={isAuthenticated}>
      {/* Hero Section */}
      <section className="relative border-b border-slate-800/80 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium text-teal-400 tracking-wide">
              Solidity ^0.8.20 · SHA-256 Fingerprinting · QR Verification
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white mt-4 leading-[1.12] [text-wrap:balance]">
              Trust Every Certificate. Verify on Blockchain.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              CertiChain anchors cryptographic SHA-256 fingerprints of academic
              credentials onto an Ethereum-compatible smart contract while
              keeping sensitive student records off public ledgers.
            </p>

            {/* Quick Verify Input + Primary CTAs */}
            <form
              onSubmit={handleQuickVerify}
              className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickId}
                  onChange={(e) => setQuickId(e.target.value)}
                  placeholder="Enter Certificate ID (e.g. CERT-2026-A104F2)"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#0D1424] border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Verify Certificate</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
              <Link
                to="/verify?tab=upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:text-white transition-colors font-medium whitespace-nowrap"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Upload Certificate File</span>
              </Link>
              <Link
                to={isAuthenticated ? "/admin" : "/login"}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-[#0D1424] text-slate-200 hover:border-slate-500 hover:text-white transition-colors font-medium whitespace-nowrap"
              >
                <Lock className="w-4 h-4 text-teal-400" />
                <span>{isAuthenticated ? "Open Admin Dashboard" : "Admin Login"}</span>
              </Link>
              <Link
                to="/registry"
                className="text-slate-400 hover:text-teal-300 transition-colors font-medium"
              >
                Browse Public Registry
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 flex items-stretch">
            <div className="w-full rounded-2xl border border-slate-800 bg-[#0D1424] overflow-hidden relative min-h-[280px]">
              <img
                src="/src/assets/images/hero_certichain_seal_1795103566109.jpg"
                alt="Cryptographic academic credential seal anchored on dark slate blockchain blocks"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070B14]/85 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
                <span className="font-mono">
                  Contract: CertificateRegistry.sol
                </span>
                <span className="text-teal-300 font-medium">
                  Zero On-Chain PII Architecture
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works: Three-Step Workflow */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-teal-400">Verification Workflow</p>
          <h2 className="font-display text-3xl font-bold text-white mt-2 [text-wrap:balance]">
            Three deterministic steps from issuance to instant verification
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-800/90 bg-[#0D1424] p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-teal-400">
                01. Issue Certificate
              </span>
              <FileCheck2 className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white mt-4">
              Canonical Normalization & Hashing
            </h3>
            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed">
              Authorized university registrars submit student degree details.
              The backend normalizes fields deterministically and computes a
              unique SHA-256 digest alongside a generated PDF and QR code.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0D1424] p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-teal-400">
                02. Secure on Blockchain
              </span>
              <Layers className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white mt-4">
              Immutable Smart Contract Anchor
            </h3>
            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed">
              Only the 32-byte certificate hash, keccak256 ID key, issuer
              address, and timestamp are written to CertificateRegistry.sol.
              Duplicate registrations and unauthorized issuers are rejected.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0D1424] p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-teal-400">
                03. Verify Instantly
              </span>
              <QrCode className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white mt-4">
              Tampering & Revocation Detection
            </h3>
            <p className="mt-2.5 text-sm text-slate-300 leading-relaxed">
              Employers scan the QR code, enter a Certificate ID, or upload the
              PDF. CertiChain recalculates the SHA-256 digest and compares it
              directly against the blockchain record.
            </p>
          </div>
        </div>
      </section>

      {/* Technology & Architecture Section */}
      <section
        id="architecture"
        className="border-y border-slate-800/80 bg-[#0A101D] py-20"
      >
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#070B14] aspect-[4/3]">
              <img
                src="/src/assets/images/architecture_ledger_node_1795103567706.jpg"
                alt="University research archive and cryptographic server vault"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-medium text-teal-400">
                System Architecture
              </p>
              <h2 className="font-display text-3xl font-bold text-white mt-2">
                Hybrid Off-Chain Storage with On-Chain Truth
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                Public blockchains are permanent by design, making them
                unsuitable for storing raw student identities. CertiChain
                separates metadata storage from cryptographic proof.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1424]">
                <p className="text-xs font-mono text-teal-400">Smart Contract</p>
                <p className="text-sm font-semibold text-white mt-1">
                  Solidity ^0.8.20 & Hardhat EVM
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Role-restricted issuance, revocation state, and event logs.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1424]">
                <p className="text-xs font-mono text-teal-400">Cryptography</p>
                <p className="text-sm font-semibold text-white mt-1">
                  SHA-256 & Keccak-256 Digests
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Single-character PDF or field edits trigger immediate mismatch.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1424]">
                <p className="text-xs font-mono text-teal-400">Credential Engine</p>
                <p className="text-sm font-semibold text-white mt-1">
                  Automated PDF & QR Generation
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  High-resolution certificates with scannable verification links.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1424]">
                <p className="text-xs font-mono text-teal-400">Wallet & API</p>
                <p className="text-sm font-semibold text-white mt-1">
                  Ethers.js, MetaMask & REST API
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  JWT-protected admin issuance and open public verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs font-medium text-teal-400">
              Institutional Benefits
            </p>
            <h2 className="font-display text-3xl font-bold text-white mt-2">
              Eliminate Manual Registrar Bottlenecks
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              Replace weeks of manual email inquiries with cryptographic certainty
              that any verifier can confirm in under two seconds.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                title: "Tamper-Proof Detection",
                body: "Altered grades, names, or issue dates produce a completely mismatched SHA-256 digest.",
              },
              {
                title: "On-Chain Revocation",
                body: "Superseded or fraudulent credentials are invalidated immediately via smart contract state.",
              },
              {
                title: "Privacy-Preserving Ledger",
                body: "Roll numbers and academic grades never appear on public blockchain nodes.",
              },
              {
                title: "Zero-Account Verification",
                body: "Recruiters and institutions verify credentials freely via ID, PDF upload, or webcam QR.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl border border-slate-800/90 bg-[#0D1424]"
              >
                <div className="flex items-center gap-2 text-teal-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <h3 className="font-display text-base font-semibold text-white">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-2xl border border-slate-800 bg-[#0D1424] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              Ready to verify an academic credential?
            </h3>
            <p className="text-sm text-slate-300 mt-1.5">
              Test authentic verification, PDF tampering detection, or QR scanning right now.
            </p>
          </div>
          <Link
            to="/verify"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Verification Portal</span>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
