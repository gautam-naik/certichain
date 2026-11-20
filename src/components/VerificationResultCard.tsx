import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  Ban,
  SearchX,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  Info,
  FileText,
  Link2,
} from "lucide-react";
import { VerificationResponse } from "../types";

interface VerificationResultCardProps {
  data: VerificationResponse;
}

export function VerificationResultCard({ data }: VerificationResultCardProps) {
  const statusMap = {
    AUTHENTIC: {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      badgeText: "LEGITIMATE — VERIFIED ON CERTICHAIN",
      Icon: ShieldCheck,
    },
    TAMPERED: {
      border: "border-rose-500/40",
      bg: "bg-rose-500/10",
      text: "text-rose-300",
      badgeText: "HASH MISMATCH — TAMPERING OR MODIFICATION DETECTED",
      Icon: ShieldAlert,
    },
    REVOKED: {
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      badgeText: "NOT LEGIT — CREDENTIAL REVOKED",
      Icon: Ban,
    },
    NOT_FOUND: {
      border: "border-slate-700",
      bg: "bg-slate-800/40",
      text: "text-amber-200",
      badgeText: "NOT FOUND — NOT REGISTERED ON BLOCKCHAIN",
      Icon: SearchX,
    },
  };

  const statusStyles = statusMap[data.result] || statusMap.NOT_FOUND;
  const Icon = statusStyles.Icon;
  const headlineLabel =
    data.result === "TAMPERED"
      ? "HASH MISMATCH — TAMPERING / CONTENT MISMATCH"
      : data.result === "NOT_FOUND"
      ? "NOT FOUND — NO RECORD REGISTERED ON BLOCKCHAIN"
      : data.forensics?.legitimacy_label || statusStyles.badgeText;

  return (
    <section
      aria-label="Verification Result"
      className={`rounded-xl border ${statusStyles.border} bg-[#0D1424] overflow-hidden`}
    >
      {/* Result Header Banner */}
      <div className={`px-6 py-5 border-b ${statusStyles.border} ${statusStyles.bg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Icon className={`w-7 h-7 shrink-0 mt-0.5 ${statusStyles.text}`} />
            <div>
              <p className={`text-xs font-mono font-semibold tracking-wide ${statusStyles.text}`}>
                {headlineLabel}
              </p>
              <h3 className="font-display text-xl font-bold text-white mt-1">
                {data.certificate_id || data.extracted_details?.filename || "Uploaded Document"}
              </h3>
            </div>
          </div>

          {data.certificate && (
            <Link
              to={`/certificates/${encodeURIComponent(data.certificate.certificate_id)}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900/90 border border-slate-700 text-slate-200 hover:border-teal-500/60 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>View Certificate Details</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-200 leading-relaxed">
          {data.explanation}
        </p>
      </div>

      {/* Detailed Breakdown */}
      <div className="p-6 space-y-6">
        {data.certificate && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-6 border-b border-slate-800/80">
            <div>
              <p className="text-xs text-slate-400">Student Name</p>
              <p className="text-sm font-semibold text-white mt-1">
                {data.certificate.student_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Issuing University</p>
              <p className="text-sm font-semibold text-white mt-1">
                {data.certificate.university_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Course / Degree</p>
              <p className="text-sm font-semibold text-white mt-1">
                {data.certificate.degree}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Department & Year</p>
              <p className="text-sm text-slate-200 mt-1">
                {data.certificate.department} · {data.certificate.academic_year}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Issue Date</p>
              <p className="text-sm font-mono tabular-nums text-slate-200 mt-1">
                {data.certificate.issue_date}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Revocation Status</p>
              <p
                className={`text-sm font-semibold mt-1 ${
                  data.certificate.revoked ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                {data.certificate.revoked ? "Revoked" : "Active (Not Revoked)"}
              </p>
            </div>
          </div>
        )}

        {/* Diagnostic Failure Explanation: Not Found vs Hash Mismatch */}
        {data.result === "TAMPERED" && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-rose-200">
                  Why This Failed: Cryptographic Hash Mismatch (Tampering)
                </h4>
                <p className="text-xs text-rose-100/90 leading-relaxed">
                  <strong>
                    The file content does not match the original digital fingerprint recorded on the blockchain.
                  </strong>{" "}
                  A registered record for this Certificate ID <em>was found</em> on-chain, which proves an authentic original exists—but your submitted file or fields produced a different SHA-256 digest.
                </p>
                <ul className="text-xs text-slate-200 list-disc pl-4 space-y-1 pt-1">
                  <li>
                    A field (student name, degree, grade, or date) was altered after issuance.
                  </li>
                  <li>
                    The PDF or image was opened and re-saved/edited in third-party software (changing its binary structure without a matching canonical payload).
                  </li>
                  <li>
                    An unrelated file referencing a valid Certificate ID was uploaded.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {data.result === "NOT_FOUND" && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-slate-900/80 space-y-3">
            <div className="flex items-start gap-2.5">
              <SearchX className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-amber-200">
                  Why This Failed: Record Not Found on Blockchain
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  No matching Certificate ID or file SHA-256 fingerprint exists on the CertiChain smart contract. Because no on-chain record exists, there is no registered digital fingerprint to compare against.
                </p>
                <ul className="text-xs text-slate-300 list-disc pl-4 space-y-1 pt-1">
                  <li>
                    <strong>External / Third-Party Certificate:</strong> Credentials issued outside CertiChain (e.g., NPTEL, Coursera, or another university portal) are not registered on this ledger. Use the{" "}
                    <span className="text-sky-300 font-medium">Verify External Issuing Authority</span>{" "}
                    search section below to verify external portals.
                  </li>
                  <li>
                    <strong>Unregistered or Mistyped ID:</strong> Double-check the Certificate ID format (<span className="font-mono">CERT-YYYY-XXXXXX</span>).
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/20">
                <p className="font-semibold text-amber-200">
                  Not Found (Current Result)
                </p>
                <p className="text-slate-400 mt-0.5">
                  No on-chain record exists for this ID or file at all—meaning it was never issued on CertiChain.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-rose-500/20">
                <p className="font-semibold text-rose-300">
                  Hash Mismatch / Tampered
                </p>
                <p className="text-slate-400 mt-0.5">
                  A valid record exists on-chain, but the file content does not match the original digital fingerprint recorded on the blockchain.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Hash Comparison */}
        {data.hash_comparison && data.result !== "NOT_FOUND" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                SHA-256 Cryptographic Comparison
              </h4>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  data.hash_comparison.matches ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {data.hash_comparison.matches ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Exact Match
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" /> Hash Mismatch (File Content Differs)
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 block mb-1">
                  Submitted File / Data SHA-256:
                </span>
                <span className="text-slate-100 break-all">
                  {data.hash_comparison.submitted_hash}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="text-slate-400 block mb-1">
                  Blockchain Registered Fingerprint:
                </span>
                <span className="text-teal-300 break-all">
                  {data.hash_comparison.blockchain_hash}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded File Integrity */}
        {data.file_integrity && (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-1.5">
            <p className="font-semibold text-slate-200">
              Uploaded File Integrity Check
              {data.file_integrity.filename
                ? ` · ${data.file_integrity.filename}`
                : ""}
            </p>
            {data.file_integrity.mime_type && (
              <p className="text-slate-400">
                Detected Format:{" "}
                <span className="font-mono text-slate-300">
                  {data.file_integrity.mime_type}
                </span>
              </p>
            )}
            <p className="text-slate-400 font-mono break-all">
              Uploaded File SHA-256: {data.file_integrity.uploaded_file_sha256}
            </p>
            <p className="text-slate-300">
              Exact Binary File Match:{" "}
              <span
                className={
                  data.file_integrity.exact_file_match
                    ? "text-emerald-300 font-semibold"
                    : "text-amber-300 font-semibold"
                }
              >
                {data.file_integrity.exact_file_match
                  ? "Yes (Unmodified Registered Certificate File)"
                  : "No (Re-saved, modified, or canonical-only check)"}
              </span>
            </p>
          </div>
        )}

        {/* Extracted Values from Uploaded File */}
        {data.extracted_details && (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <p className="font-semibold text-slate-200">
              Extracted Document Values
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="text-slate-400">Format & Size: </span>
                <span className="font-mono">
                  {data.extracted_details.detected_format} (
                  {Math.max(1, Math.round(data.extracted_details.size_bytes / 1024))} KB)
                </span>
              </div>
              <div>
                <span className="text-slate-400">Extracted Certificate ID: </span>
                <span className="font-mono text-teal-300">
                  {data.extracted_details.extracted_certificate_id || "None detected"}
                </span>
              </div>
            </div>
            {data.extracted_details.extracted_canonical_fields && (
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-300">
                {Object.entries(data.extracted_details.extracted_canonical_fields).map(
                  ([k, v]) =>
                    v ? (
                      <div key={k} className="truncate">
                        <span className="text-slate-400 capitalize">
                          {k.replace(/_/g, " ")}:{" "}
                        </span>
                        <span className="font-mono text-slate-200">{v}</span>
                      </div>
                    ) : null
                )}
              </div>
            )}
            {data.extracted_details.document_metadata && (
              <div className="pt-2 border-t border-slate-800/80 text-slate-400">
                Document Metadata:{" "}
                <span className="font-mono text-slate-300">
                  {Object.entries(data.extracted_details.document_metadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Forensic Authenticity & Tampering Inspection */}
        {data.forensics && (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-3">
            <p className="font-semibold text-slate-200">
              Document Forensics & Legitimacy Signals
            </p>
            <div className="space-y-2">
              {data.forensics.signals.map((sig, idx) => {
                const badge =
                  sig.status === "pass"
                    ? { icon: Check, color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" }
                    : sig.status === "fail"
                    ? { icon: X, color: "text-rose-300", bg: "bg-rose-500/10 border-rose-500/30" }
                    : sig.status === "warn"
                    ? { icon: AlertTriangle, color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/30" }
                    : { icon: Info, color: "text-slate-300", bg: "bg-slate-800/60 border-slate-700" };
                const SigIcon = badge.icon;
                return (
                  <div
                    key={`${sig.check}-${idx}`}
                    className={`p-2.5 rounded-md border ${badge.bg} flex items-start gap-2.5`}
                  >
                    <SigIcon className={`w-4 h-4 shrink-0 mt-0.5 ${badge.color}`} />
                    <div>
                      <p className={`font-semibold ${badge.color}`}>{sig.check}</p>
                      <p className="text-slate-300 mt-0.5 leading-relaxed">{sig.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {(data.forensics.qr_payload || data.forensics.extracted_urls.length > 0) && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <p className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Detected Verification Links / QR Payload</span>
                </p>
                {data.forensics.qr_payload && (
                  <p className="font-mono text-teal-300 break-all">
                    QR: {data.forensics.qr_payload}
                  </p>
                )}
                {data.forensics.extracted_urls.map((url) => (
                  <p key={url} className="font-mono text-slate-300 break-all">
                    {url}
                  </p>
                ))}
              </div>
            )}

            {data.forensics.extracted_text_preview && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1">
                <p className="font-medium text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>Extracted Document Text Preview</span>
                </p>
                <p className="font-mono text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-800/80 max-h-28 overflow-y-auto break-words leading-relaxed">
                  {data.forensics.extracted_text_preview}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Blockchain Reference */}
        {data.blockchain && (
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Blockchain Network / Mode</span>
              <span className="text-slate-200 font-medium mt-0.5 block">
                {data.blockchain.network_name}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Transaction Reference</span>
              <span className="text-slate-200 font-mono break-all mt-0.5 block">
                {data.blockchain.tx_hash || "Not recorded"}
                {data.blockchain.block_number
                  ? ` (Block #${data.blockchain.block_number})`
                  : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Authorized Issuer Address</span>
              <span className="text-slate-200 font-mono break-all mt-0.5 block">
                {data.blockchain.issuer_address}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Verification Method</span>
              <span className="text-slate-200 uppercase font-mono mt-0.5 block">
                {data.verification_method}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
