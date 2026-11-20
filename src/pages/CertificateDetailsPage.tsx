import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  Copy,
  ShieldCheck,
  Ban,
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
} from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { AdminLayout } from "../components/AdminLayout";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/ToastContext";
import { api } from "../services/api";
import { AdminUser, Certificate } from "../types";

interface CertificateDetailsPageProps {
  user: AdminUser | null;
  onLogout: () => void;
}

export function CertificateDetailsPage({
  user,
  onLogout,
}: CertificateDetailsPageProps) {
  const { id } = useParams<{ id: string }>();
  const { pushToast } = useToast();

  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const loadCertificate = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCertificate(id);
      setCert(res.certificate);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load certificate."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificate();
  }, [id]);

  const copyUrl = async () => {
    if (!cert) return;
    const url = `${window.location.origin}/verify?id=${encodeURIComponent(
      cert.certificate_id
    )}`;
    await navigator.clipboard.writeText(url);
    pushToast("Verification URL copied to clipboard.", "success");
  };

  const handleRevoke = async (reason: string) => {
    if (!cert) return;
    setRevoking(true);
    try {
      await api.revokeCertificate(cert.certificate_id, reason);
      pushToast(`Revoked ${cert.certificate_id} on ledger.`, "success");
      setRevokeOpen(false);
      loadCertificate();
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Failed to revoke certificate",
        "error"
      );
    } finally {
      setRevoking(false);
    }
  };

  const content = (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={user ? "/admin" : "/registry"}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{user ? "Back to Dashboard" : "Back to Registry"}</span>
        </Link>
        {cert && (
          <Link
            to={`/verify?id=${encodeURIComponent(cert.certificate_id)}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 hover:text-teal-300"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Run Live Blockchain Verification</span>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1424] p-12 text-center text-sm text-slate-400">
          Loading credential record...
        </div>
      ) : error || !cert ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <p className="text-sm text-rose-200">{error || "Certificate not found."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1424] overflow-hidden">
          {/* Status Banner */}
          <div
            className={`px-6 py-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              cert.revoked ? "bg-amber-500/10" : "bg-emerald-500/5"
            }`}
          >
            <div>
              <p className="text-xs font-mono text-teal-400">
                {cert.certificate_id} · {cert.certificate_type}
              </p>
              <h1 className="font-display text-2xl font-bold text-white mt-1">
                {cert.student_name}
              </h1>
              <p className="text-sm text-slate-300 mt-0.5">
                {cert.degree} · {cert.university_name}
              </p>
            </div>

            <div className="shrink-0">
              {cert.revoked ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  Revoked Credential
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  Active Credential
                </span>
              )}
            </div>
          </div>

          {/* Body Grid */}
          <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-slate-400">University</p>
                  <p className="text-sm font-medium text-white mt-1">
                    {cert.university_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Department</p>
                  <p className="text-sm font-medium text-white mt-1">
                    {cert.department}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Academic Year</p>
                  <p className="text-sm font-mono text-slate-200 mt-1">
                    {cert.academic_year}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Issue Date</p>
                  <p className="text-sm font-mono tabular-nums text-slate-200 mt-1">
                    {cert.issue_date}
                  </p>
                </div>
                {cert.student_roll_number && (
                  <div>
                    <p className="text-xs text-slate-400">
                      Student Roll Number (Admin View)
                    </p>
                    <p className="text-sm font-mono text-slate-200 mt-1">
                      {cert.student_roll_number}
                    </p>
                  </div>
                )}
                {cert.grade && (
                  <div>
                    <p className="text-xs text-slate-400">Grade / Standing</p>
                    <p className="text-sm font-medium text-slate-200 mt-1">
                      {cert.grade}
                    </p>
                  </div>
                )}
              </div>

              {cert.revoked && cert.revoked_reason && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
                  <strong>Revocation Note:</strong> {cert.revoked_reason}
                  {cert.revoked_at ? ` (${cert.revoked_at.slice(0, 10)})` : ""}
                </div>
              )}

              <div className="space-y-3 pt-4 border-t border-slate-800 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    Canonical SHA-256 Digest:
                  </span>
                  <span className="text-teal-300 break-all">
                    {cert.canonical_hash}
                  </span>
                </div>
                {cert.attachment_sha256 && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">
                      Attached Source File ({cert.attachment_filename}):
                    </span>
                    <span className="text-slate-200 break-all">
                      {cert.attachment_sha256}
                    </span>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    Blockchain Transaction Hash:
                  </span>
                  <span className="text-slate-200 break-all">
                    {cert.tx_hash}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">
                      Blockchain Network:
                    </span>
                    <span className="text-slate-200">{cert.network_name}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">
                      Block Number & Issuer:
                    </span>
                    <span className="text-slate-200 break-all">
                      #{cert.block_number} · {cert.issuer_address}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href={`/api/certificates/${encodeURIComponent(
                    cert.certificate_id
                  )}/pdf`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF</span>
                </a>

                <a
                  href={`/api/certificates/${encodeURIComponent(
                    cert.certificate_id
                  )}/json`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download JSON</span>
                </a>

                <button
                  type="button"
                  onClick={copyUrl}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Verification URL</span>
                </button>

                <a
                  href={`/api/certificates/${encodeURIComponent(
                    cert.certificate_id
                  )}/pdf?tamper_demo=true`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition-colors"
                  title="Downloads a modified PDF with an altered grade for testing tampering detection on the Verify page"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Download Tampered PDF (Test)</span>
                </a>

                {user && !cert.revoked && (
                  <button
                    type="button"
                    onClick={() => setRevokeOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors ml-auto"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Revoke Certificate</span>
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Column */}
            <div className="lg:col-span-4 flex flex-col items-center p-6 rounded-xl border border-slate-800 bg-slate-950/60">
              <div className="p-3 rounded-xl bg-white">
                <img
                  src={`/api/certificates/${encodeURIComponent(
                    cert.certificate_id
                  )}/qr`}
                  alt={`QR Code for ${cert.certificate_id}`}
                  className="w-44 h-44"
                />
              </div>
              <p className="text-xs font-mono text-slate-300 mt-4">
                {cert.certificate_id}
              </p>
              <p className="text-xs text-slate-400 text-center mt-1.5">
                Scan with any camera or CertiChain QR Verifier to validate
                authenticity.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={revokeOpen}
        title={`Revoke ${cert?.certificate_id || ""}?`}
        description="This permanently marks the certificate as revoked on the smart contract ledger. All future verifications will return REVOKED."
        confirmLabel="Revoke on Ledger"
        requireReason
        loading={revoking}
        onCancel={() => setRevokeOpen(false)}
        onConfirm={handleRevoke}
      />
    </div>
  );

  if (user) {
    return (
      <AdminLayout
        user={user}
        breadcrumb={cert ? cert.certificate_id : "Certificate Details"}
        onLogout={onLogout}
      >
        {content}
      </AdminLayout>
    );
  }

  return <PublicLayout isAuthenticated={false}>{content}</PublicLayout>;
}
