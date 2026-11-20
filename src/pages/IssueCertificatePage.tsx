import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  Copy,
  ExternalLink,
  FilePlus2,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "../components/AdminLayout";
import { useToast } from "../components/ToastContext";
import { api } from "../services/api";
import { AdminUser, Certificate } from "../types";

interface IssueCertificatePageProps {
  user: AdminUser;
  onLogout: () => void;
}

export function IssueCertificatePage({
  user,
  onLogout,
}: IssueCertificatePageProps) {
  const { pushToast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    student_name: "",
    student_roll_number: "",
    university_name: "National Institute of Technology & Computing",
    degree: "",
    department: "",
    academic_year: "2022-2026",
    certificate_type: "Degree Certificate",
    grade: "",
    issue_date: today,
  });

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedCert, setIssuedCert] = useState<Certificate | null>(null);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    setError(null);
    if (!rawFile) {
      setAttachedFile(null);
      return;
    }
    if (rawFile.size === 0) {
      setError("Selected file is empty (0 bytes). Please choose a valid certificate file.");
      setAttachedFile(null);
      e.target.value = "";
      return;
    }
    if (rawFile.size > 25 * 1024 * 1024) {
      setError("Selected file exceeds the 25 MB upload limit.");
      setAttachedFile(null);
      e.target.value = "";
      return;
    }
    try {
      // Snapshot file bytes in memory immediately so Chrome never fails with ERR_UPLOAD_FILE_CHANGED while filling the form
      const buf = await rawFile.arrayBuffer();
      const bufferedFile = new File([buf], rawFile.name, {
        type: rawFile.type || "application/octet-stream",
        lastModified: rawFile.lastModified,
      });
      setAttachedFile(bufferedFile);
    } catch {
      setAttachedFile(rawFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const required: (keyof typeof form)[] = [
      "student_name",
      "student_roll_number",
      "university_name",
      "degree",
      "department",
      "academic_year",
      "certificate_type",
      "issue_date",
    ];
    for (const k of required) {
      if (!form[k].trim()) {
        setError("Please fill in all required certificate fields.");
        return;
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.issue_date.trim())) {
      setError("Issue Date must be formatted as YYYY-MM-DD.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.issueCertificate({
        ...form,
        grade: form.grade.trim() || undefined,
        file: attachedFile,
      });
      setIssuedCert(res.certificate);
      pushToast(
        `Certificate ${res.certificate.certificate_id} anchored successfully.`,
        "success"
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to issue certificate.";
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const copyVerificationLink = async (id: string) => {
    const url = `${window.location.origin}/verify?id=${encodeURIComponent(id)}`;
    await navigator.clipboard.writeText(url);
    pushToast("Verification link copied to clipboard.", "success");
  };

  return (
    <AdminLayout user={user} breadcrumb="Issue Certificate" onLogout={onLogout}>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Issue Academic Certificate
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Normalize credential fields, compute SHA-256 hash, anchor on the
            CertificateRegistry smart contract, and generate PDF + QR artifacts.
          </p>
        </div>

        {issuedCert ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-[#0D1424] p-7 space-y-6">
            <div className="flex items-start gap-3.5">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-emerald-300">
                  ISSUANCE CONFIRMED
                </p>
                <h2 className="font-display text-2xl font-bold text-white mt-1">
                  {issuedCert.certificate_id}
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Issued to <strong>{issuedCert.student_name}</strong> ·{" "}
                  {issuedCert.degree}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-4 border-t border-slate-800">
              <div className="md:col-span-8 space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    Canonical SHA-256 Digest:
                  </span>
                  <span className="text-teal-300 break-all">
                    {issuedCert.canonical_hash}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">
                    Blockchain Transaction Hash ({issuedCert.network_name}):
                  </span>
                  <span className="text-slate-100 break-all">
                    {issuedCert.tx_hash} (Block #{issuedCert.block_number})
                  </span>
                </div>
              </div>

              <div className="md:col-span-4 flex flex-col items-center p-4 rounded-xl bg-white">
                <img
                  src={`/api/certificates/${encodeURIComponent(issuedCert.certificate_id)}/qr`}
                  alt={`QR code for ${issuedCert.certificate_id}`}
                  className="w-36 h-36"
                />
                <span className="text-[11px] font-mono text-slate-700 mt-2">
                  {issuedCert.certificate_id}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={`/api/certificates/${encodeURIComponent(issuedCert.certificate_id)}/pdf`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>
              <a
                href={`/api/certificates/${encodeURIComponent(issuedCert.certificate_id)}/json`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-200 hover:border-slate-500"
              >
                <Download className="w-4 h-4" />
                <span>Download JSON</span>
              </a>
              <button
                type="button"
                onClick={() => copyVerificationLink(issuedCert.certificate_id)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-200 hover:border-slate-500"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Verification URL</span>
              </button>
              <Link
                to={`/certificates/${encodeURIComponent(issuedCert.certificate_id)}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-200 hover:border-slate-500"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Details</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIssuedCert(null);
                  setAttachedFile(null);
                  setForm((prev) => ({
                    ...prev,
                    student_name: "",
                    student_roll_number: "",
                    grade: "",
                  }));
                }}
                className="ml-auto text-sm text-teal-400 hover:text-teal-300 font-medium"
              >
                Issue Another Certificate
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-800 bg-[#0D1424] p-7 space-y-6"
          >
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5 text-xs text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.student_name}
                  onChange={(e) => updateField("student_name", e.target.value)}
                  placeholder="e.g., Priya Nair"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Student Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={form.student_roll_number}
                  onChange={(e) =>
                    updateField("student_roll_number", e.target.value)
                  }
                  placeholder="e.g., CS2022094"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  University Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.university_name}
                  onChange={(e) =>
                    updateField("university_name", e.target.value)
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Degree / Course *
                </label>
                <input
                  type="text"
                  required
                  value={form.degree}
                  onChange={(e) => updateField("degree", e.target.value)}
                  placeholder="e.g., B.Tech in Computer Science"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Department *
                </label>
                <input
                  type="text"
                  required
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  placeholder="e.g., Computer Science & Engineering"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Academic Year *
                </label>
                <input
                  type="text"
                  required
                  value={form.academic_year}
                  onChange={(e) => updateField("academic_year", e.target.value)}
                  placeholder="e.g., 2022-2026"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Certificate Type / Format *
                </label>
                <input
                  type="text"
                  required
                  list="certificate-type-suggestions"
                  value={form.certificate_type}
                  onChange={(e) =>
                    updateField("certificate_type", e.target.value)
                  }
                  placeholder="Enter any certificate type (e.g., Degree, Diploma, Transcript, Micro-Credential)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
                <datalist id="certificate-type-suggestions">
                  <option value="Degree Certificate" />
                  <option value="Postgraduate Honours" />
                  <option value="Provisional Degree" />
                  <option value="Diploma Certificate" />
                  <option value="Academic Transcript" />
                  <option value="Course Completion Certificate" />
                  <option value="Merit Certificate" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Grade / CGPA (Optional)
                </label>
                <input
                  type="text"
                  value={form.grade}
                  onChange={(e) => updateField("grade", e.target.value)}
                  placeholder="e.g., 9.40 CGPA"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Issue Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.issue_date}
                  onChange={(e) => updateField("issue_date", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Attach Source Certificate File (Optional — Any Format: PDF, PNG, JPG, DOCX, JSON, TXT)
                </label>
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <label className="inline-flex items-center px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-100 hover:bg-slate-700 cursor-pointer transition-colors">
                    <span>Choose File</span>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {attachedFile
                      ? `${attachedFile.name} (${Math.round(
                          attachedFile.size / 1024
                        )} KB)`
                      : "Optional: attach an existing certificate file in any format to register its SHA-256 digest."}
                  </span>
                  {attachedFile && (
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Student roll number and grade remain off-chain; only the SHA-256
                hash is written to the smart contract.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>
                  {submitting
                    ? "Anchoring on Blockchain..."
                    : "Issue & Anchor Certificate"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
