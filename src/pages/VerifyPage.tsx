import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import jsQR from "jsqr";
import {
  Search,
  UploadCloud,
  QrCode,
  ShieldCheck,
  FlaskConical,
  AlertCircle,
  Globe,
  ExternalLink,
} from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { QrScanner } from "../components/QrScanner";
import { VerificationResultCard } from "../components/VerificationResultCard";
import { useToast } from "../components/ToastContext";
import { api } from "../services/api";
import { SearchVerifyResponse, VerificationResponse } from "../types";

interface VerifyPageProps {
  isAuthenticated: boolean;
}

type VerifyTab = "id" | "upload" | "qr";

export function VerifyPage({ isAuthenticated }: VerifyPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get("id") || "";

  const initialTabParam = searchParams.get("tab");
  const initialTab: VerifyTab =
    initialTabParam === "upload" || initialTabParam === "qr" ? initialTabParam : "id";

  const { pushToast } = useToast();
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<VerifyTab>(initialTab);
  const [certId, setCertId] = useState(initialId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchVerifyResponse | null>(
    null
  );

  useEffect(() => {
    if (initialTabParam === "upload" || initialTabParam === "qr" || initialTabParam === "id") {
      setActiveTab(initialTabParam);
    }
  }, [initialTabParam]);

  const scrollToResult = () => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

  const tryExtractQrFromImage = async (
    file: File
  ): Promise<{ certId?: string; rawQr?: string }> => {
    if (!file.type.startsWith("image/")) return {};
    return new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const scales = [1, 0.5, 1.5];
          for (const scale of scales) {
            const w = Math.max(64, Math.round(img.width * scale));
            const h = Math.max(64, Math.round(img.height * scale));
            if (w > 2400 || h > 2400) continue;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code?.data) {
                const match = code.data.match(/CERT-\d{4}-[A-Z0-9]{6}/i);
                URL.revokeObjectURL(objUrl);
                resolve({
                  certId: match ? match[0].toUpperCase() : undefined,
                  rawQr: code.data,
                });
                return;
              }
            }
          }
        } catch {
          // Ignore canvas decode errors
        }
        URL.revokeObjectURL(objUrl);
        resolve({});
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve({});
      };
      img.src = objUrl;
    });
  };

  // Tamper-simulation field inputs
  const [tamperMode, setTamperMode] = useState(false);
  const [tamperFields, setTamperFields] = useState({
    student_name: "",
    degree: "",
    grade: "",
  });

  const runIdVerification = async (
    idToVerify: string,
    source: "id" | "qr" = "id"
  ) => {
    const trimmed = idToVerify.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a Certificate ID.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const overridePayload: Record<string, string> = {};
      if (tamperMode) {
        if (tamperFields.student_name.trim()) {
          overridePayload.student_name = tamperFields.student_name.trim();
        }
        if (tamperFields.degree.trim()) {
          overridePayload.degree = tamperFields.degree.trim();
        }
        if (tamperFields.grade.trim()) {
          overridePayload.grade = tamperFields.grade.trim();
        }
      }

      const res = await api.verifyById(trimmed, {
        source,
        fields:
          Object.keys(overridePayload).length > 0 ? overridePayload : undefined,
      });
      setResult(res);
      scrollToResult();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification request failed."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      setCertId(initialId);
      runIdVerification(initialId, "id");
    }
  }, [initialId]);

  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(certId.trim() ? { id: certId.trim().toUpperCase() } : {});
    runIdVerification(certId, "id");
  };

  const verifyUploadedFile = async (fileToVerify: File, explicitId?: string) => {
    setError(null);
    setLoading(true);
    try {
      const qrInfo = await tryExtractQrFromImage(fileToVerify);
      const idHint =
        explicitId?.trim().toUpperCase() ||
        certId.trim().toUpperCase() ||
        qrInfo.certId ||
        undefined;
      const res = await api.verifyByUpload(fileToVerify, idHint, qrInfo.rawQr);
      setResult(res);
      pushToast(
        res.forensics?.legitimacy_label || `Analysis complete: ${res.result}`,
        res.result === "AUTHENTIC" ? "success" : res.result === "TAMPERED" || res.result === "REVOKED" ? "error" : "info"
      );
      scrollToResult();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "File verification failed.";
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please choose a certificate file to verify.");
      return;
    }
    await verifyUploadedFile(selectedFile);
  };

  const handleSampleFileVerify = async (
    url: string,
    filename: string,
    mime: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Could not fetch sample certificate file.");
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], filename, { type: mime });
      setSelectedFile(sampleFile);
      await verifyUploadedFile(sampleFile);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Sample verification failed.";
      setError(msg);
      pushToast(msg, "error");
      setLoading(false);
    }
  };

  const handleQrSuccess = (scannedId: string) => {
    setCertId(scannedId);
    setActiveTab("id");
    setSearchParams({ id: scannedId });
    runIdVerification(scannedId, "qr");
  };

  const handleRunSearchLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const inferredQuery =
      searchQuery.trim() ||
      result?.certificate?.university_name ||
      result?.forensics?.extracted_urls?.[0] ||
      result?.extracted_details?.filename ||
      certId.trim();

    if (!inferredQuery) {
      setSearchError(
        "Enter an institution name, program (e.g., NPTEL), or verification URL to search."
      );
      return;
    }

    setSearchError(null);
    setSearchLoading(true);
    try {
      const res = await api.geminiSearchVerify({
        query: inferredQuery,
        institution: result?.certificate?.university_name,
        certificateId: result?.certificate_id || undefined,
        extractedUrls: result?.forensics?.extracted_urls,
      });
      setSearchResult(res);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Search grounding lookup failed."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <PublicLayout isAuthenticated={isAuthenticated}>
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="text-xs font-medium text-teal-400">
            Zero-Account Public Verification
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-2">
            Verify Academic Certificate
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-300 max-w-2xl">
            Every verification queries the immutable blockchain ledger record,
            recomputes the SHA-256 fingerprint, and checks revocation status.
          </p>
        </div>

        {/* Method Tabs */}
        <div className="rounded-2xl border border-slate-800 bg-[#0D1424] overflow-hidden">
          <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/60 p-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("id");
                setError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "id"
                  ? "bg-teal-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Certificate ID</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("upload");
                setError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "upload"
                  ? "bg-teal-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Certificate</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("qr");
                setError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "qr"
                  ? "bg-teal-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Code</span>
            </button>
          </div>

          <div className="p-6 lg:p-8">
            {error && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 flex items-start gap-2.5 text-xs text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === "id" && (
              <form onSubmit={handleIdSubmit} className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    placeholder="Enter Certificate ID (e.g., CERT-2026-A104F2)"
                    className="flex-1 px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loading ? "Verifying..." : "Verify on Ledger"}</span>
                  </button>
                </div>

                {/* Quick Demo IDs */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Sample IDs:</span>
                  {[
                    { id: "CERT-2026-A104F2", label: "Valid (A104F2)" },
                    { id: "CERT-2026-C309D1", label: "Revoked (C309D1)" },
                    { id: "CERT-2026-000000", label: "Unregistered" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setCertId(s.id);
                        setTamperMode(false);
                        runIdVerification(s.id, "id");
                      }}
                      className="px-2.5 py-1 rounded border border-slate-800 bg-slate-950 text-slate-300 hover:border-teal-500/50 hover:text-white font-mono transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Optional Field Integrity / Tamper Test */}
                <div className="pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setTamperMode((v) => !v)}
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-teal-300 transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>
                      {tamperMode
                        ? "Hide Field Tamper Test"
                        : "Test Tampering Detection (Override Certificate Fields)"}
                    </span>
                  </button>

                  {tamperMode && (
                    <div className="mt-4 p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
                      <p className="text-xs text-slate-400">
                        Enter modified values below (leave blank to keep original).
                        Changing even one character alters the SHA-256 hash and
                        triggers a <strong className="text-rose-300">TAMPERED</strong> alert.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={tamperFields.student_name}
                          onChange={(e) =>
                            setTamperFields((p) => ({
                              ...p,
                              student_name: e.target.value,
                            }))
                          }
                          placeholder="Modified Student Name"
                          className="px-3 py-2 rounded-lg bg-[#0D1424] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                        />
                        <input
                          type="text"
                          value={tamperFields.degree}
                          onChange={(e) =>
                            setTamperFields((p) => ({
                              ...p,
                              degree: e.target.value,
                            }))
                          }
                          placeholder="Modified Degree"
                          className="px-3 py-2 rounded-lg bg-[#0D1424] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                        />
                        <input
                          type="text"
                          value={tamperFields.grade}
                          onChange={(e) =>
                            setTamperFields((p) => ({
                              ...p,
                              grade: e.target.value,
                            }))
                          }
                          placeholder="Modified Grade (e.g. 10.0 CGPA)"
                          className="px-3 py-2 rounded-lg bg-[#0D1424] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}

            {activeTab === "upload" && (
              <form onSubmit={handleFileSubmit} className="space-y-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) {
                      setError(null);
                      if (dropped.size === 0) {
                        setError("Selected file is empty (0 bytes).");
                        return;
                      }
                      if (dropped.size > 25 * 1024 * 1024) {
                        setError("Selected file exceeds the 25 MB upload limit.");
                        return;
                      }
                      try {
                        const buf = await dropped.arrayBuffer();
                        setSelectedFile(
                          new File([buf], dropped.name, {
                            type: dropped.type || "application/octet-stream",
                            lastModified: dropped.lastModified,
                          })
                        );
                      } catch {
                        setSelectedFile(dropped);
                      }
                    }
                  }}
                  className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
                    dragActive
                      ? "border-teal-400 bg-teal-500/10"
                      : "border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <UploadCloud className="w-8 h-8 text-teal-400 mx-auto" />
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedFile
                      ? `${selectedFile.name} (${Math.max(
                          1,
                          Math.round(selectedFile.size / 1024)
                        )} KB)`
                      : "Drop or Select a Certificate File in Any Format"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF, PNG, JPG, JSON, DOCX, TXT, and any other file
                    format up to 25 MB. Computes SHA-256 file integrity and
                    extracts embedded canonical credentials or QR codes.
                  </p>
                  <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 cursor-pointer transition-colors">
                    <span>Choose Certificate File</span>
                    <input
                      type="file"
                      onChange={async (e) => {
                        const chosen = e.target.files?.[0];
                        setError(null);
                        if (!chosen) {
                          setSelectedFile(null);
                          return;
                        }
                        if (chosen.size === 0) {
                          setError("Selected file is empty (0 bytes).");
                          setSelectedFile(null);
                          return;
                        }
                        if (chosen.size > 25 * 1024 * 1024) {
                          setError("Selected file exceeds the 25 MB upload limit.");
                          setSelectedFile(null);
                          return;
                        }
                        try {
                          const buf = await chosen.arrayBuffer();
                          setSelectedFile(
                            new File([buf], chosen.name, {
                              type: chosen.type || "application/octet-stream",
                              lastModified: chosen.lastModified,
                            })
                          );
                        } catch {
                          setSelectedFile(chosen);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <input
                    type="text"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    placeholder="Optional Certificate ID (auto-detected for CertiChain PDFs, JSON, QR images & exact files)"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {loading ? "Analyzing File..." : "Analyze & Verify File"}
                    </span>
                  </button>
                </div>

                {/* Quick Sample File Tests */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Quick File Tests:</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSampleFileVerify(
                        "/api/certificates/CERT-2026-A104F2/pdf",
                        "CERT-2026-A104F2.pdf",
                        "application/pdf"
                      )
                    }
                    className="px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-mono transition-colors disabled:opacity-50"
                  >
                    Test Authentic PDF
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSampleFileVerify(
                        "/api/certificates/CERT-2026-A104F2/pdf?tamper_demo=true",
                        "CERT-2026-A104F2-TAMPERED.pdf",
                        "application/pdf"
                      )
                    }
                    className="px-2.5 py-1 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-mono transition-colors disabled:opacity-50"
                  >
                    Test Tampered PDF
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSampleFileVerify(
                        "/api/certificates/CERT-2026-A104F2/json",
                        "CERT-2026-A104F2.json",
                        "application/json"
                      )
                    }
                    className="px-2.5 py-1 rounded border border-slate-700 bg-slate-950 text-slate-300 hover:border-teal-500/50 hover:text-white font-mono transition-colors disabled:opacity-50"
                  >
                    Test Authentic JSON
                  </button>
                </div>
              </form>
            )}

            {activeTab === "qr" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Use your device camera to scan a certificate QR code, or
                  upload a saved QR PNG image.
                </p>
                <QrScanner onScanSuccess={handleQrSuccess} />
              </div>
            )}
          </div>
        </div>

        {/* Page 7: Verification Result */}
        <div ref={resultRef}>
          {result && <VerificationResultCard data={result} />}
        </div>

        {/* Google Search Grounding Institution Lookup */}
        <section className="rounded-2xl border border-slate-800 bg-[#0D1424] p-6 lg:p-7 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-sky-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Live Google Search Grounding · gemini-4-hydrogen</span>
              </p>
              <h2 className="font-display text-lg font-bold text-white mt-1">
                Verify External Issuing Authority & Portal URL
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Verify whether an institution, MOOC provider (e.g., NPTEL, Coursera), or QR URL extracted from an uploaded document belongs to an official verification domain.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleRunSearchLookup}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                result?.forensics?.extracted_urls?.[0] ||
                result?.certificate?.university_name ||
                "e.g., Official NPTEL certificate verification portal nptel.ac.in"
              }
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                {searchLoading ? "Searching Web..." : "Check Official Sources"}
              </span>
            </button>
          </form>

          {searchError && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200"
            >
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {searchResult.summary}
              </div>

              {searchResult.sources.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                    Grounded Web Sources
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {searchResult.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#0D1424] hover:border-sky-500/40 text-xs text-sky-300 transition-colors"
                      >
                        <span className="truncate">{src.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}
