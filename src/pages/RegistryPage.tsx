import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, ShieldCheck } from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../services/api";
import { AdminUser, Certificate } from "../types";

interface RegistryPageProps {
  user: AdminUser | null;
  onLogout: () => void;
}

export function RegistryPage({ user, onLogout }: RegistryPageProps) {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    q: "",
    course: "",
    university: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });

  const loadRegistry = async (targetPage = page) => {
    setLoading(true);
    try {
      const res = await api.listCertificates({
        q: filters.q || undefined,
        course: filters.course || undefined,
        university: filters.university || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: targetPage,
        limit: 10,
      });
      setCerts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch {
      setCerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry(page);
  }, [page, filters.status]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadRegistry(1);
  };

  const inner = (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Certificate Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {user
              ? "Full administrative view of all issued academic credentials."
              : "Public credential index. Private student roll numbers and grades are masked."}
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 tabular-nums">
          {total} records indexed
        </span>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleApply}
        className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            placeholder="Search ID, name, department..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <input
          type="text"
          value={filters.course}
          onChange={(e) => setFilters((p) => ({ ...p, course: e.target.value }))}
          placeholder="Filter by course..."
          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
        />
        <input
          type="text"
          value={filters.university}
          onChange={(e) =>
            setFilters((p) => ({ ...p, university: e.target.value }))
          }
          placeholder="Filter by university..."
          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-teal-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="revoked">Revoked Only</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
        >
          Apply Filters
        </button>
      </form>

      {/* Registry Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1424] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs text-slate-400">
              <tr>
                <th className="py-3 px-4 font-medium">Certificate ID</th>
                <th className="py-3 px-4 font-medium">Recipient</th>
                <th className="py-3 px-4 font-medium">University & Course</th>
                <th className="py-3 px-4 font-medium">Issue Date</th>
                <th className="py-3 px-4 font-medium">Tx Reference</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Loading registry...
                  </td>
                </tr>
              ) : certs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    No certificates match the selected filters.
                  </td>
                </tr>
              ) : (
                certs.map((c) => (
                  <tr key={c.certificate_id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-mono text-xs text-teal-300 whitespace-nowrap">
                      {c.certificate_id}
                    </td>
                    <td className="py-3.5 px-4 text-white font-medium whitespace-nowrap">
                      {c.student_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-200 text-xs font-medium">
                        {c.degree}
                      </p>
                      <p className="text-slate-400 text-xs">{c.university_name}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-400 whitespace-nowrap">
                      {c.issue_date}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {c.tx_hash.slice(0, 12)}...
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          c.revoked ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        {c.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/verify?id=${encodeURIComponent(c.certificate_id)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-xs text-teal-300 hover:border-teal-500/60"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </Link>
                        <Link
                          to={`/certificates/${encodeURIComponent(c.certificate_id)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-xs text-slate-300 hover:text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </Link>
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
  );

  if (user) {
    return (
      <AdminLayout user={user} breadcrumb="Certificate Registry" onLogout={onLogout}>
        {inner}
      </AdminLayout>
    );
  }
  return <PublicLayout isAuthenticated={false}>{inner}</PublicLayout>;
}
