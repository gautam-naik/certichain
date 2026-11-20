import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import zlib from "zlib";
import { config } from "./config.ts";
import { CanonicalCertificateInput } from "./crypto.ts";

export interface CertificatePdfData extends CanonicalCertificateInput {
  canonical_hash: string;
  tx_hash: string;
  network_name: string;
  revoked?: boolean;
}

const META_PREFIX = "CERTICHAIN_CANONICAL_V1:";

export async function generateQrPngBuffer(certificateId: string): Promise<Buffer> {
  const verifyUrl = `${config.appUrl}/verify?id=${encodeURIComponent(certificateId)}`;
  return QRCode.toBuffer(verifyUrl, {
    type: "png",
    width: 320,
    margin: 1,
    color: {
      dark: "#0A1628",
      light: "#FFFFFF",
    },
  });
}

function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u00B7]/g, "|")
    .replace(/\u20B9/g, "INR ")
    .replace(/[^\x20-\xFF]/g, " ");
}

export async function generateCertificatePdf(
  cert: CertificatePdfData,
  options?: { tamperForDemo?: boolean }
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 Landscape
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontSerifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontMono = await doc.embedFont(StandardFonts.Courier);

  const displayStudentName = options?.tamperForDemo
    ? cert.student_name
    : cert.student_name;
  const displayGrade = options?.tamperForDemo
    ? "10.00 CGPA (Altered)"
    : cert.grade || "N/A";

  // Background paper
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.985, 0.988, 0.992),
  });

  // Top dark navy header band
  page.drawRectangle({
    x: 24,
    y: height - 108,
    width: width - 48,
    height: 84,
    color: rgb(0.04, 0.08, 0.16),
  });

  // Outer institutional border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.06, 0.45, 0.42),
    borderWidth: 2.2,
  });

  // Inner hairline border
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: rgb(0.75, 0.78, 0.82),
    borderWidth: 0.75,
  });

  // University Header
  page.drawText(toWinAnsiSafe(cert.university_name.toUpperCase()), {
    x: 48,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: rgb(0.96, 0.98, 1),
  });

  page.drawText("OFFICIAL BLOCKCHAIN-VERIFIED ACADEMIC CREDENTIAL", {
    x: 48,
    y: height - 82,
    size: 9.5,
    font: fontBold,
    color: rgb(0.36, 0.85, 0.78),
  });

  // Certificate Type badge text on top right
  page.drawText(toWinAnsiSafe(cert.certificate_type.toUpperCase()), {
    x: width - 250,
    y: height - 68,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.92, 0.96),
  });

  // Main body copy
  page.drawText("THIS IS TO CERTIFY THAT", {
    x: 48,
    y: height - 154,
    size: 10,
    font: fontBold,
    color: rgb(0.35, 0.42, 0.5),
  });

  page.drawText(toWinAnsiSafe(displayStudentName), {
    x: 48,
    y: height - 194,
    size: 30,
    font: fontSerifBold,
    color: rgb(0.05, 0.09, 0.17),
  });

  page.drawText(
    toWinAnsiSafe(
      `Roll Number: ${cert.student_roll_number}   |   Academic Year: ${cert.academic_year}`
    ),
    {
      x: 48,
      y: height - 220,
      size: 11,
      font: fontRegular,
      color: rgb(0.3, 0.36, 0.44),
    }
  );

  page.drawText("has successfully fulfilled the academic requirements and been awarded", {
    x: 48,
    y: height - 256,
    size: 12,
    font: fontRegular,
    color: rgb(0.22, 0.27, 0.35),
  });

  page.drawText(toWinAnsiSafe(cert.degree), {
    x: 48,
    y: height - 288,
    size: 20,
    font: fontBold,
    color: rgb(0.05, 0.35, 0.33),
  });

  page.drawText(toWinAnsiSafe(`Department of ${cert.department}`), {
    x: 48,
    y: height - 314,
    size: 13,
    font: fontRegular,
    color: rgb(0.18, 0.23, 0.3),
  });

  page.drawText(toWinAnsiSafe(`Grade / Standing: ${displayGrade}`), {
    x: 48,
    y: height - 342,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.14, 0.22),
  });

  // Divider
  page.drawLine({
    start: { x: 48, y: 175 },
    end: { x: width - 210, y: 175 },
    thickness: 0.8,
    color: rgb(0.8, 0.84, 0.88),
  });

  // Metadata footer left
  page.drawText(`Certificate ID:  ${cert.certificate_id}`, {
    x: 48,
    y: 146,
    size: 10,
    font: fontMono,
    color: rgb(0.08, 0.12, 0.2),
  });

  page.drawText(`Issue Date:      ${cert.issue_date}`, {
    x: 48,
    y: 128,
    size: 10,
    font: fontMono,
    color: rgb(0.08, 0.12, 0.2),
  });

  page.drawText(`SHA-256 Digest:  ${cert.canonical_hash}`, {
    x: 48,
    y: 110,
    size: 8.5,
    font: fontMono,
    color: rgb(0.25, 0.32, 0.4),
  });

  page.drawText(`Ledger Tx Ref:   ${cert.tx_hash}`, {
    x: 48,
    y: 94,
    size: 8.5,
    font: fontMono,
    color: rgb(0.25, 0.32, 0.4),
  });

  const verifyUrl = `${config.appUrl}/verify?id=${cert.certificate_id}`;
  page.drawText(`Verify URL: ${verifyUrl}`, {
    x: 48,
    y: 72,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.06, 0.45, 0.42),
  });

  page.drawText(
    "Digital Verification Statement: Authenticity is anchored via cryptographic SHA-256 hash on CertiChain.",
    {
      x: 48,
      y: 52,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.46, 0.54),
    }
  );

  // Embed QR Code on bottom-right
  const qrBuffer = await generateQrPngBuffer(cert.certificate_id);
  const qrImage = await doc.embedPng(qrBuffer);
  page.drawImage(qrImage, {
    x: width - 178,
    y: 62,
    width: 124,
    height: 124,
  });

  page.drawText("SCAN TO VERIFY", {
    x: width - 156,
    y: 48,
    size: 8,
    font: fontBold,
    color: rgb(0.2, 0.27, 0.35),
  });

  // Embed canonical metadata payload inside PDF metadata Keywords
  const canonicalPayload: CanonicalCertificateInput = {
    certificate_id: cert.certificate_id,
    student_name: displayStudentName,
    student_roll_number: cert.student_roll_number,
    university_name: cert.university_name,
    degree: cert.degree,
    department: cert.department,
    academic_year: cert.academic_year,
    certificate_type: cert.certificate_type,
    grade: displayGrade,
    issue_date: cert.issue_date,
  };

  const encodedMeta = Buffer.from(JSON.stringify(canonicalPayload), "utf8").toString(
    "base64"
  );

  doc.setTitle(`CertiChain Academic Certificate - ${cert.certificate_id}`);
  doc.setAuthor(cert.university_name);
  doc.setSubject(`Certificate ID ${cert.certificate_id}`);
  doc.setKeywords([`${META_PREFIX}${encodedMeta}`]);
  doc.setProducer("CertiChain Credential Engine");
  doc.setCreator("CertiChain");
  const deterministicDate = new Date(`${cert.issue_date}T00:00:00.000Z`);
  if (!Number.isNaN(deterministicDate.getTime())) {
    doc.setCreationDate(deterministicDate);
    doc.setModificationDate(deterministicDate);
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export interface ExtractedPdfInfo {
  canonical: CanonicalCertificateInput | null;
  detectedIds: string[];
  detectedHashes: string[];
  detectedUrls: string[];
  extractedText: string;
  hasDigitalSignature: boolean;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modDate?: string;
  };
}

function decodePdfLiteralText(streamText: string): string {
  const chunks: string[] = [];
  // Match parenthesized PDF text literals like (Hello World) inside Tj/TJ operators
  const regex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  for (const m of streamText.matchAll(regex)) {
    const cleaned = m[1]
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 2) {
      chunks.push(cleaned);
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts embedded canonical certificate metadata, decompressed stream IDs, text, URLs, and SHA-256 hashes from a PDF.
 */
export async function extractPdfDetails(pdfBuffer: Buffer): Promise<ExtractedPdfInfo> {
  const detectedIds = new Set<string>();
  const detectedHashes = new Set<string>();
  const detectedUrls = new Set<string>();
  const textParts: string[] = [];
  let canonical: CanonicalCertificateInput | null = null;
  const metadata: ExtractedPdfInfo["metadata"] = {};

  try {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const keywords = doc.getKeywords() || "";
    const subject = doc.getSubject() || "";
    const title = doc.getTitle() || "";
    const author = doc.getAuthor() || "";
    const creator = doc.getCreator() || "";
    const producer = doc.getProducer() || "";
    const creationDate = doc.getCreationDate();
    const modDate = doc.getModificationDate();

    if (title) metadata.title = title;
    if (author) metadata.author = author;
    if (subject) metadata.subject = subject;
    if (creator) metadata.creator = creator;
    if (producer) metadata.producer = producer;
    if (creationDate && !Number.isNaN(creationDate.getTime())) {
      metadata.creationDate = creationDate.toISOString();
    }
    if (modDate && !Number.isNaN(modDate.getTime())) {
      metadata.modDate = modDate.toISOString();
    }

    const rawMatch = keywords
      .split(/[\s,;]+/)
      .find((token) => token.startsWith(META_PREFIX));

    if (rawMatch) {
      const b64 = rawMatch.slice(META_PREFIX.length);
      const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      if (parsed && typeof parsed.certificate_id === "string") {
        canonical = parsed as CanonicalCertificateInput;
        detectedIds.add(parsed.certificate_id.toUpperCase());
      }
    }

    for (const text of [subject, title, keywords]) {
      for (const m of text.matchAll(/CERT-\d{4}-[A-Z0-9]{6}/gi)) {
        detectedIds.add(m[0].toUpperCase());
      }
      for (const h of text.matchAll(/0x[a-fA-F0-9]{64}/g)) {
        detectedHashes.add(h[0].toLowerCase());
      }
    }
  } catch {
    // Continue to raw stream scanning even if pdf-lib metadata parsing fails
  }

  // Scan raw PDF text + inflated FlateDecode streams for CERT-YYYY-XXXXXX, URLs, and 0x... SHA-256 hashes
  const latin = pdfBuffer.toString("latin1");
  const hasDigitalSignature =
    /\/ByteRange\s*\[/.test(latin) && /\/Type\s*\/Sig\b|\/SubFilter\s*\/adbe\.pkcs7/i.test(latin);

  for (const m of latin.matchAll(/CERT-\d{4}-[A-Z0-9]{6}/gi)) {
    detectedIds.add(m[0].toUpperCase());
  }
  for (const h of latin.matchAll(/0x[a-fA-F0-9]{64}/g)) {
    detectedHashes.add(h[0].toLowerCase());
  }
  for (const u of latin.matchAll(/https?:\/\/[^\s)>"'\\]{6,180}/gi)) {
    detectedUrls.add(u[0]);
  }

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of latin.matchAll(streamRegex)) {
    try {
      const compressed = Buffer.from(match[1], "latin1");
      const inflated = zlib.inflateSync(compressed).toString("utf8");
      for (const m of inflated.matchAll(/CERT-\d{4}-[A-Z0-9]{6}/gi)) {
        detectedIds.add(m[0].toUpperCase());
      }
      for (const h of inflated.matchAll(/0x[a-fA-F0-9]{64}/g)) {
        detectedHashes.add(h[0].toLowerCase());
      }
      for (const u of inflated.matchAll(/https?:\/\/[^\s)>"'\\]{6,180}/gi)) {
        detectedUrls.add(u[0]);
      }
      const readable = decodePdfLiteralText(inflated);
      if (readable) {
        textParts.push(readable);
      }
    } catch {
      // Ignore non-zlib streams
    }
  }

  if (!canonical && detectedIds.size > 0) {
    const firstId = Array.from(detectedIds)[0];
    canonical = {
      certificate_id: firstId,
      student_name: "",
      student_roll_number: "",
      university_name: "",
      degree: "",
      department: "",
      academic_year: "",
      certificate_type: "",
      grade: "",
      issue_date: "",
    };
  }

  return {
    canonical,
    detectedIds: Array.from(detectedIds),
    detectedHashes: Array.from(detectedHashes),
    detectedUrls: Array.from(detectedUrls).slice(0, 10),
    extractedText: textParts.join(" ").replace(/\s+/g, " ").trim().slice(0, 1200),
    hasDigitalSignature,
    metadata,
  };
}

export async function extractCanonicalFromPdf(
  pdfBuffer: Buffer
): Promise<CanonicalCertificateInput | null> {
  const details = await extractPdfDetails(pdfBuffer);
  return details.canonical;
}
