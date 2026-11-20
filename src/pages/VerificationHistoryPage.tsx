import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AdminLayout } from "../components/AdminLayout";
import { api } from "../services/api";
import { AdminUser, VerificationLogItem } from "../types";

interface VerificationHistoryPageProps {
  user: AdminUser;
  onLogout: () => void;
}

export function VerificationHistoryPage({
  user,
  onLogout,
}: VerificationHistoryPageProps) {
  const [logs, setLogs] = useState<VerificationLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getVerificationHistory(100);
      setLogs(res.items);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const resultColor = (res: VerificationLogItem["verification_result"]) => {
    if (res === "AUTHENTIC") return "text-emerald-300";
    if (res === "TAMPERED") return "text-rose-300";
    if (res === "REVOKED") return "text-amber-300";
    return "text-slate-400";
  };

  return (
    <AdminLayout
      user={user}
      breadcrumb="Verification History"
      onLogout={onLogout}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Verification Audit History
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Privacy-preserving audit trail of verification requests. Uploaded
              document contents and personal student information are never logged.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900 text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1424] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Certificate ID</th>
                  <th className="py-3 px-4 font-medium">Request Type</th>
                  <th className="py-3 px-4 font-medium">Result</th>
                  <th className="py-3 px-4 font-medium">Status Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      Loading verification history...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      No verification checks have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                        <Link
                          to={`/verify?id=${encodeURIComponent(log.certificate_id)}`}
                          className="text-teal-300 hover:underline"
                        >
                          {log.certificate_id}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs uppercase text-slate-300 whitespace-nowrap">
                        {log.request_type}
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-xs font-semibold whitespace-nowrap ${resultColor(
                          log.verification_result
                        )}`}
                      >
                        {log.verification_result}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300 max-w-md truncate">
                        {log.status_detail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
