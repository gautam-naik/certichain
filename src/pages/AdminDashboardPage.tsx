import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  FilePlus2,
  Search,
  Download,
  ExternalLink,
  Ban,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "../components/AdminLayout";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/ToastContext";
import { api } from "../services/api";
import { AdminUser, Certificate, DashboardStats } from "../types";

interface AdminDashboardPageProps {
  user: AdminUser;
  onLogout: () => void;
}

export function AdminDashboardPage({ user, onLogout }: AdminDashboardPageProps) {
  const { pushToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [totalCerts, setTotalCerts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, certsRes] = await Promise.all([
        api.getDashboardStats(),
        api.listCertificates({
          q: search.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          limit: 8,
        }),
      ]);
      setStats(statsRes);
      setCerts(certsRes.items);
      setTotalCerts(certsRes.total);
      setTotalPages(certsRes.total_pages);
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Failed to load dashboard data",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleConfirmRevoke = async (reason: string) => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.revokeCertificate(revokeTarget.certificate_id, reason);
      pushToast(
        `Certificate ${revokeTarget.certificate_id} revoked on ledger.`,
        "success"
      );
      setRevokeTarget(null);
      loadData();
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Revocation failed",
        "error"
      );
    } finally {
      setRevoking(false);
    }
  };

  return (
    <AdminLayout user={user} breadcrumb="Dashboard" onLogout={onLogout}>
      <div className="space-y-8">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Registrar Overview
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitor certificate issuance, verification activity, and smart contract ledger state.
            </p>
          </div>
          <Link
            to="/admin/issue"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Issue Certificate</span>
          </Link>
        </div>

        {/* Blockchain Network Status Banner */}
        {stats && (
          <div
            className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              stats.blockchain.connected
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {stats.blockchain.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  Blockchain Status: {stats.blockchain.networkName}
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  {stats.blockchain.notice
                    ? stats.blockchain.notice
                    : `Connected to live RPC (${stats.blockchain.rpcUrl}) · Contract ${stats.blockchain.contractAddress}`}
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-300 shrink-0 space-y-0.5">
              <div>solc {stats.blockchain.compilerVersion.split("+")[0]}</div>
              <div className="tabular-nums">
                Block #{stats.blockchain.blockNumber}
              </div>
            </div>
          </div>
        )}

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            {
              label: "Total Certificates Issued",
              value: stats?.totals.issued ?? "—",
              note: "Anchored on ledger",
            },
            {
              label: "Total Verified Authentic",
              value: stats?.totals.verified_authentic ?? "—",
              note: "Matched SHA-256 digest",
            },
            {
              label: "Revoked Certificates",
              value: stats?.totals.revoked ?? "—",
              note: "Invalidated credentials",
            },
            {
              label: "Verification Attempts",
              value: stats?.totals.verification_attempts ?? "—",
              note: "ID, PDF & QR lookups",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-800 bg-[#0D1424] p-5"
            >
              <p className="text-xs font-medium text-slate-400">{kpi.label}</p>
              <p className="font-display text-3xl font-bold text-white mt-2 tabular-nums">
                {kpi.value}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">{kpi.note}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
            <h2 className="font-display text-base font-semibold text-white">
              Certificate Issuance Over Time
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Monthly credentials anchored to CertificateRegistry
            </p>
            <div className="h-60 mt-4">
              {stats && stats.issuance_series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.issuance_series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        color: "#F8FAFC",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="issued"
                      stroke="#14B8A6"
                      fill="#14B8A6"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No issuance data yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
            <h2 className="font-display text-base font-semibold text-white">
              Verification Activity Breakdown
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribution across Authentic, Tampered, Revoked, and Not Found checks
            </p>
            <div className="h-60 mt-4">
              {stats && stats.verification_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.verification_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="result" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        color: "#F8FAFC",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="count" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No verification logs recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Certificates Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0D1424] overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Issued Certificates
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                Showing {certs.length} of {totalCerts} total records
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ID, student, course..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 w-56"
                />
              </form>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                {["all", "active", "revoked"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                      statusFilter === st
                        ? "bg-teal-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Certificate ID</th>
                  <th className="py-3 px-4 font-medium">Student Name</th>
                  <th className="py-3 px-4 font-medium">Course</th>
                  <th className="py-3 px-4 font-medium">Issue Date</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      Loading certificate records...
                    </td>
                  </tr>
                ) : certs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                      No matching certificates found.
                    </td>
                  </tr>
                ) : (
                  certs.map((c) => (
                    <tr
                      key={c.certificate_id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-teal-300 whitespace-nowrap">
                        {c.certificate_id}
                      </td>
                      <td className="py-3 px-4 text-slate-100 font-medium whitespace-nowrap">
                        {c.student_name}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {c.degree}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-400 whitespace-nowrap">
                        {c.issue_date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            c.revoked ? "text-amber-300" : "text-emerald-300"
                          }`}
                        >
                          {c.revoked ? "Revoked" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/certificates/${encodeURIComponent(c.certificate_id)}`}
                            className="p-1.5 rounded border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600"
                            title="View Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <a
                            href={`/api/certificates/${encodeURIComponent(c.certificate_id)}/pdf`}
                            className="p-1.5 rounded border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {!c.revoked && (
                            <button
                              type="button"
                              onClick={() => setRevokeTarget(c)}
                              className="p-1.5 rounded border border-slate-800 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/10"
                              title="Revoke Certificate"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-slate-800 disabled:opacity-40 hover:text-white"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded border border-slate-800 disabled:opacity-40 hover:text-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={`Revoke ${revokeTarget?.certificate_id || ""}?`}
        description="Revoking a certificate updates the smart contract ledger permanently. Public verifiers will see an ORANGE REVOKED warning when checking this credential."
        confirmLabel="Revoke on Ledger"
        requireReason
        loading={revoking}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
      />
    </AdminLayout>
  );
}
