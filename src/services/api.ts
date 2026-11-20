import {
  AdminUser,
  BlockchainStatus,
  Certificate,
  ChatRolePreset,
  DashboardStats,
  GeminiChatResponse,
  SearchVerifyResponse,
  VerificationLogItem,
  VerificationResponse,
} from "../types";

const TOKEN_KEY = "certichain_jwt_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    if (msg.toLowerCase().includes("failed to fetch")) {
      throw new Error(
        "Upload connection interrupted (Failed to fetch). Ensure the file is under 25 MB, re-select the file if it was modified on disk, and try again."
      );
    }
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const rawText = await res.text().catch(() => "");
    throw new Error(
      rawText && rawText.length < 200
        ? rawText
        : `Unexpected server response (${res.status}).`
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: AdminUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" }),

  me: () => apiFetch<{ user: AdminUser }>("/api/auth/me"),

  getDashboardStats: () => apiFetch<DashboardStats>("/api/dashboard/stats"),

  getBlockchainStatus: () =>
    apiFetch<BlockchainStatus>("/api/blockchain/status"),

  listCertificates: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return apiFetch<{
      items: Certificate[];
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>(`/api/certificates?${qs.toString()}`);
  },

  getCertificate: (id: string) =>
    apiFetch<{ certificate: Certificate }>(
      `/api/certificates/${encodeURIComponent(id)}`
    ),

  issueCertificate: (payload: {
    student_name: string;
    student_roll_number: string;
    university_name: string;
    degree: string;
    department: string;
    academic_year: string;
    certificate_type: string;
    grade?: string;
    issue_date: string;
    file?: File | null;
  }) => {
    if (payload.file) {
      const form = new FormData();
      form.append("student_name", payload.student_name);
      form.append("student_roll_number", payload.student_roll_number);
      form.append("university_name", payload.university_name);
      form.append("degree", payload.degree);
      form.append("department", payload.department);
      form.append("academic_year", payload.academic_year);
      form.append("certificate_type", payload.certificate_type);
      if (payload.grade) form.append("grade", payload.grade);
      form.append("issue_date", payload.issue_date);
      form.append("file", payload.file);
      return apiFetch<{ certificate: Certificate; message: string }>(
        "/api/certificates",
        {
          method: "POST",
          body: form,
        }
      );
    }

    const { file: _ignored, ...jsonPayload } = payload;
    return apiFetch<{ certificate: Certificate; message: string }>(
      "/api/certificates",
      {
        method: "POST",
        body: JSON.stringify(jsonPayload),
      }
    );
  },

  revokeCertificate: (id: string, reason: string) =>
    apiFetch<{
      message: string;
      certificate_id: string;
      revoked_at: string;
      revoked_reason: string;
    }>(`/api/certificates/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  verifyById: (
    certificate_id: string,
    options?: {
      source?: "id" | "qr";
      fields?: Record<string, string>;
    }
  ) =>
    apiFetch<VerificationResponse>("/api/verify/id", {
      method: "POST",
      body: JSON.stringify({
        certificate_id,
        source: options?.source || "id",
        fields: options?.fields,
      }),
    }),

  verifyByUpload: (file: File, certificateId?: string, qrPayload?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (certificateId) {
      form.append("certificate_id", certificateId);
    }
    if (qrPayload) {
      form.append("qr_payload", qrPayload);
    }
    return apiFetch<VerificationResponse>("/api/verify/upload", {
      method: "POST",
      body: form,
    });
  },

  getVerificationHistory: (limit = 100) =>
    apiFetch<{ items: VerificationLogItem[] }>(
      `/api/verify/history?limit=${limit}`
    ),

  geminiChat: (
    payload: {
      message: string;
      history: Array<{ role: "user" | "model"; text: string }>;
      rolePreset: ChatRolePreset;
      useSearchGrounding: boolean;
      certificateContext?: string;
      sessionKey?: string;
    },
    firebaseIdToken?: string | null
  ) =>
    apiFetch<GeminiChatResponse>("/api/gemini/chat", {
      method: "POST",
      headers: firebaseIdToken
        ? { Authorization: `Bearer ${firebaseIdToken}` }
        : undefined,
      body: JSON.stringify(payload),
    }),

  geminiSearchVerify: (payload: {
    query: string;
    institution?: string;
    certificateId?: string;
    extractedUrls?: string[];
  }) =>
    apiFetch<SearchVerifyResponse>("/api/gemini/search-verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
