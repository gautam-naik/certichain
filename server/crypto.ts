import crypto from "crypto";
import { ethers } from "ethers";

export interface CanonicalCertificateInput {
  certificate_id: string;
  student_name: string;
  student_roll_number: string;
  university_name: string;
  degree: string;
  department: string;
  academic_year: string;
  certificate_type: string;
  grade?: string | null;
  issue_date: string;
}

function cleanText(val: string | null | undefined): string {
  return (val ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Produces a deterministic, sorted-key canonical JSON string for a certificate.
 * Any modification to any field produces a completely different SHA-256 digest.
 */
export function normalizeCertificateData(
  input: CanonicalCertificateInput
): string {
  const canonical = {
    academic_year: cleanText(input.academic_year),
    certificate_id: cleanText(input.certificate_id).toUpperCase(),
    certificate_type: cleanText(input.certificate_type),
    degree: cleanText(input.degree),
    department: cleanText(input.department),
    grade: cleanText(input.grade || "N/A"),
    issue_date: cleanText(input.issue_date),
    student_name: cleanText(input.student_name),
    student_roll_number: cleanText(input.student_roll_number).toUpperCase(),
    university_name: cleanText(input.university_name),
  };
  return JSON.stringify(canonical);
}

/**
 * Computes 0x-prefixed 32-byte SHA-256 hash compatible with Solidity bytes32.
 */
export function computeCanonicalHash(input: CanonicalCertificateInput): string {
  const normalized = normalizeCertificateData(input);
  const digest = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  return `0x${digest}`;
}

export function computeFileSha256(buffer: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const digest = crypto.createHash("sha256").update(buf).digest("hex");
  return `0x${digest}`;
}

/**
 * Decodes text-based non-PDF file buffers while handling UTF-8 BOM and UTF-16 LE/BE encodings.
 */
export function decodeTextBuffer(buffer: Buffer): {
  text: string;
  encoding: "utf8" | "utf8-bom" | "utf16le" | "utf16be";
  hadBom: boolean;
} {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return {
      text: buffer.subarray(3).toString("utf8"),
      encoding: "utf8-bom",
      hadBom: true,
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return {
      text: buffer.subarray(2).toString("utf16le"),
      encoding: "utf16le",
      hadBom: true,
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = Buffer.from(buffer.subarray(2));
    body.swap16();
    return {
      text: body.toString("utf16le"),
      encoding: "utf16be",
      hadBom: true,
    };
  }
  return {
    text: buffer.toString("utf8"),
    encoding: "utf8",
    hadBom: false,
  };
}

/**
 * Matches Solidity: keccak256(abi.encodePacked(certificateId))
 */
export function computeCertificateIdHash(certificateId: string): string {
  return ethers.solidityPackedKeccak256(["string"], [certificateId.trim().toUpperCase()]);
}

export function generateCertificateId(issueDate?: string): string {
  const year = issueDate && /^\d{4}/.test(issueDate)
    ? issueDate.slice(0, 4)
    : new Date().getFullYear().toString();
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `CERT-${year}-${suffix}`;
}
