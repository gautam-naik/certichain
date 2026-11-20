export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "admin";
}

export interface Certificate {
  certificate_id: string;
  student_name: string;
  student_roll_number?: string;
  university_name: string;
  degree: string;
  department: string;
  academic_year: string;
  certificate_type: string;
  grade?: string;
  issue_date: string;
  canonical_hash: string;
  pdf_sha256?: string;
  attachment_sha256?: string;
  attachment_filename?: string;
  attachment_mime?: string;
  tx_hash: string;
  block_number: number;
  network_name: string;
  issuer_address: string;
  ledger_mode: "ethereum-rpc" | "demo";
  revoked: boolean;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  created_at: string;
}

export interface BlockchainStatus {
  connected: boolean;
  mode: "ethereum-rpc" | "demo";
  networkName: string;
  chainId: number | null;
  blockNumber: number;
  contractAddress: string;
  contractCompiled: boolean;
  compilerVersion: string;
  rpcUrl: string;
  notice: string | null;
}

export interface DashboardStats {
  totals: {
    issued: number;
    verified_authentic: number;
    revoked: number;
    verification_attempts: number;
  };
  issuance_series: { month: string; issued: number }[];
  verification_breakdown: { result: string; count: number }[];
  blockchain: BlockchainStatus;
}

export type VerificationOutcome = "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";

export interface ForensicSignal {
  check: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

export interface VerificationResponse {
  result: VerificationOutcome;
  explanation: string;
  verification_method: "id" | "upload" | "qr";
  certificate_id: string | null;
  forensics?: {
    legitimacy_label: string;
    signals: ForensicSignal[];
    extracted_text_preview: string | null;
    extracted_urls: string[];
    qr_payload: string | null;
    has_digital_signature: boolean;
  };
  extracted_details?: {
    filename: string;
    size_bytes: number;
    detected_format: string;
    extracted_certificate_id: string | null;
    extracted_canonical_fields: Record<string, string> | null;
    extracted_hashes: string[];
    document_metadata: Record<string, string> | null;
  };
  file_integrity?: {
    filename?: string;
    mime_type?: string;
    uploaded_file_sha256: string;
    stored_pdf_sha256?: string | null;
    stored_attachment_sha256?: string | null;
    exact_file_match: boolean;
  };
  hash_comparison: {
    submitted_hash: string;
    blockchain_hash: string;
    matches: boolean;
  } | null;
  blockchain: {
    exists_on_chain: boolean;
    revoked_on_chain: boolean;
    issuer_address: string;
    issued_at_unix: number;
    tx_hash: string | null;
    block_number: number | null;
    network_name: string;
    ledger_mode: "ethereum-rpc" | "demo";
  } | null;
  certificate: {
    certificate_id: string;
    student_name: string;
    university_name: string;
    degree: string;
    department: string;
    academic_year: string;
    certificate_type: string;
    issue_date: string;
    revoked: boolean;
    revoked_at?: string | null;
    revoked_reason?: string | null;
  } | null;
}

export interface VerificationLogItem {
  id: number;
  certificate_id: string;
  verification_result: VerificationOutcome;
  request_type: "id" | "upload" | "qr";
  status_detail: string;
  created_at: string;
}

export type ChatRolePreset = "general" | "reasoning" | "interactive" | "fast";

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeminiChatResponse {
  sessionKey: string;
  reply: string;
  model: string;
  rolePreset: ChatRolePreset;
  usedSearchGrounding: boolean;
  sources: GroundingSource[];
  searchQueries: string[];
}

export interface SearchVerifyResponse {
  summary: string;
  model: string;
  sources: GroundingSource[];
  searchQueries: string[];
}

