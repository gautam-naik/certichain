import zlib from "zlib";

export interface ForensicSignal {
  check: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

export interface DocumentInspectionResult {
  detectedFormat: string;
  metadata: Record<string, string>;
  extractedTextPreview: string;
  extractedUrls: string[];
  extractedIds: string[];
  extractedHashes: string[];
  hasDigitalSignature: boolean;
  editorWarnings: string[];
}

const SUSPICIOUS_EDITORS = [
  "photoshop",
  "canva",
  "gimp",
  "ilovepdf",
  "smallpdf",
  "sejda",
  "pdfescape",
  "pixlr",
  "foxit",
  "nitro",
  "coreldraw",
  "illustrator",
  "paint.net",
];

function findZipEntries(zipBuffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  // Scan local file headers PK\x03\x04
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    if (
      zipBuffer[offset] === 0x50 &&
      zipBuffer[offset + 1] === 0x4b &&
      zipBuffer[offset + 2] === 0x03 &&
      zipBuffer[offset + 3] === 0x04
    ) {
      const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      const nameLength = zipBuffer.readUInt16LE(offset + 26);
      const extraLength = zipBuffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;

      if (dataStart > zipBuffer.length) break;
      const fileName = zipBuffer.subarray(nameStart, nameStart + nameLength).toString("utf8");

      if (compressedSize > 0 && dataStart + compressedSize <= zipBuffer.length) {
        const rawData = zipBuffer.subarray(dataStart, dataStart + compressedSize);
        try {
          if (compressionMethod === 0) {
            entries.set(fileName, rawData);
          } else if (compressionMethod === 8) {
            entries.set(fileName, zlib.inflateRawSync(rawData));
          }
        } catch {
          // Skip malformed zip entry
        }
        offset = dataStart + compressedSize;
      } else {
        offset = dataStart;
      }
    } else {
      offset++;
    }
    if (entries.size > 40) break;
  }
  return entries;
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([^<]+)</`, "i"));
  return m?.[1]?.trim();
}

export function inspectImageDocument(buffer: Buffer, mime: string, filename: string): DocumentInspectionResult {
  const metadata: Record<string, string> = {};
  const editorWarnings: string[] = [];
  const extractedIds = new Set<string>();
  const extractedHashes = new Set<string>();
  const extractedUrls = new Set<string>();

  // PNG dimensions (IHDR)
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const w = buffer.readUInt32BE(16);
    const h = buffer.readUInt32BE(20);
    metadata.dimensions = `${w}x${h}px`;
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    // JPEG SOF dimensions scan
    let pos = 2;
    while (pos + 9 < buffer.length) {
      if (buffer[pos] !== 0xff) break;
      const marker = buffer[pos + 1];
      const segLen = buffer.readUInt16BE(pos + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        const h = buffer.readUInt16BE(pos + 5);
        const w = buffer.readUInt16BE(pos + 7);
        metadata.dimensions = `${w}x${h}px`;
        break;
      }
      if (segLen < 2) break;
      pos += 2 + segLen;
    }
  }

  // Scan printable ASCII / XMP / EXIF strings for software tags, URLs, and IDs
  const ascii = buffer.subarray(0, 524288).toString("latin1");
  const swMatch =
    ascii.match(/(?:Software|CreatorTool|xmp:CreatorTool)[>\s:=/"']{1,6}([A-Za-z0-9 ._()-]{3,50})/i) ||
    ascii.match(/(Adobe Photoshop[^<\x00]{0,30}|Canva[^<\x00]{0,20}|GIMP[^<\x00]{0,20}|Corel[^<\x00]{0,20})/i);
  if (swMatch?.[1]) {
    const tool = swMatch[1].trim();
    metadata.software = tool;
    if (SUSPICIOUS_EDITORS.some((ed) => tool.toLowerCase().includes(ed))) {
      editorWarnings.push(`Image metadata references graphic editor "${tool}".`);
    }
  }

  for (const m of ascii.matchAll(/CERT-\d{4}-[A-Z0-9]{6}/gi)) {
    extractedIds.add(m[0].toUpperCase());
  }
  for (const h of ascii.matchAll(/0x[a-fA-F0-9]{64}/g)) {
    extractedHashes.add(h[0].toLowerCase());
  }
  for (const u of ascii.matchAll(/https?:\/\/[^\s<>"{}|\\^`\[\]]{6,160}/gi)) {
    if (!u[0].includes("ns.adobe.com") && !u[0].includes("w3.org") && !u[0].includes("purl.org")) {
      extractedUrls.add(u[0]);
    }
  }

  return {
    detectedFormat: mime || `Image (${filename.split(".").pop()?.toUpperCase() || "IMG"})`,
    metadata,
    extractedTextPreview: "",
    extractedUrls: Array.from(extractedUrls).slice(0, 8),
    extractedIds: Array.from(extractedIds),
    extractedHashes: Array.from(extractedHashes),
    hasDigitalSignature: false,
    editorWarnings,
  };
}

export function inspectDocxDocument(buffer: Buffer): DocumentInspectionResult {
  const entries = findZipEntries(buffer);
  const metadata: Record<string, string> = {};
  const editorWarnings: string[] = [];
  const extractedIds = new Set<string>();
  const extractedHashes = new Set<string>();
  const extractedUrls = new Set<string>();
  let extractedTextPreview = "";

  const docXml = entries.get("word/document.xml")?.toString("utf8") || "";
  if (docXml) {
    extractedTextPreview = stripXmlTags(docXml).slice(0, 1000);
    for (const m of extractedTextPreview.matchAll(/CERT-\d{4}-[A-Z0-9]{6}/gi)) {
      extractedIds.add(m[0].toUpperCase());
    }
    for (const h of extractedTextPreview.matchAll(/0x[a-fA-F0-9]{64}/g)) {
      extractedHashes.add(h[0].toLowerCase());
    }
    for (const u of docXml.matchAll(/https?:\/\/[^\s<"']{6,180}/gi)) {
      if (!u[0].includes("schemas.openxmlformats.org") && !u[0].includes("schemas.microsoft.com")) {
        extractedUrls.add(u[0]);
      }
    }
  }

  const coreXml = entries.get("docProps/core.xml")?.toString("utf8") || "";
  if (coreXml) {
    const creator = extractXmlTag(coreXml, "creator");
    const lastModifiedBy = extractXmlTag(coreXml, "lastModifiedBy");
    const created = extractXmlTag(coreXml, "created");
    const modified = extractXmlTag(coreXml, "modified");
    if (creator) metadata.creator = creator;
    if (lastModifiedBy) metadata.lastModifiedBy = lastModifiedBy;
    if (created) metadata.created = created;
    if (modified) metadata.modified = modified;
    if (created && modified && created !== modified) {
      editorWarnings.push(`Word document modified (${modified}) after creation (${created}).`);
    }
  }

  return {
    detectedFormat: "Word Document (DOCX)",
    metadata,
    extractedTextPreview,
    extractedUrls: Array.from(extractedUrls).slice(0, 8),
    extractedIds: Array.from(extractedIds),
    extractedHashes: Array.from(extractedHashes),
    hasDigitalSignature: entries.has("_xmlsignatures/sig1.xml"),
    editorWarnings,
  };
}

export function buildForensicSignals(params: {
  result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
  exactFileMatch: boolean;
  officialQrMatch?: boolean;
  isPdf: boolean;
  hasDigitalSignature: boolean;
  metadata: Record<string, string>;
  extractedUrls: string[];
  qrPayload?: string;
  editorWarnings: string[];
}): {
  legitimacy_label: string;
  signals: ForensicSignal[];
} {
  const {
    result,
    exactFileMatch,
    officialQrMatch,
    isPdf,
    hasDigitalSignature,
    metadata,
    extractedUrls,
    qrPayload,
    editorWarnings,
  } = params;

  const signals: ForensicSignal[] = [];

  // 1. Blockchain Registry Signal
  if (result === "AUTHENTIC") {
    signals.push({
      check: "CertiChain Blockchain Ledger",
      status: "pass",
      detail: "Certificate ID and SHA-256 fingerprint match the immutable on-chain record and credential is active.",
    });
  } else if (result === "TAMPERED") {
    signals.push({
      check: "CertiChain Blockchain Ledger",
      status: "fail",
      detail: "Certificate ID exists on-chain, but the uploaded file or credential data does NOT match the anchored SHA-256 hash.",
    });
  } else if (result === "REVOKED") {
    signals.push({
      check: "CertiChain Blockchain Ledger",
      status: "fail",
      detail: "Certificate exists on-chain, but was permanently REVOKED by the issuing registrar.",
    });
  } else {
    signals.push({
      check: "CertiChain Blockchain Ledger",
      status: "warn",
      detail: "No matching SHA-256 digest or CertiChain ID was found on the blockchain ledger. External certificates cannot be cryptographically confirmed without issuer registration.",
    });
  }

  // 2. Binary File Integrity Signal
  signals.push({
    check: "Exact Binary File Integrity (SHA-256)",
    status: exactFileMatch || officialQrMatch ? "pass" : result === "TAMPERED" ? "fail" : "info",
    detail: exactFileMatch
      ? "Uploaded bytes match the exact SHA-256 digest recorded at issuance (0 bytes altered)."
      : officialQrMatch
      ? "Uploaded PNG matches the exact SHA-256 digest of the official CertiChain verification QR code."
      : result === "TAMPERED"
      ? "Uploaded file bytes differ from the original registered credential file."
      : "No exact binary file hash match found in the CertiChain registry.",
  });

  // 3. PDF Digital Signature / Timestamp Provenance
  if (isPdf) {
    signals.push({
      check: "Embedded PDF Digital Signature (PKCS#7)",
      status: hasDigitalSignature ? "pass" : "info",
      detail: hasDigitalSignature
        ? "PDF contains an embedded cryptographic /ByteRange signature dictionary."
        : "No embedded Adobe/PKCS#7 PDF signature block detected (CertiChain relies on blockchain SHA-256 anchoring instead).",
    });

    const producerOrCreator = `${metadata.producer || ""} ${metadata.creator || ""}`.trim();
    if (producerOrCreator) {
      const matchedEditor = SUSPICIOUS_EDITORS.find((ed) =>
        producerOrCreator.toLowerCase().includes(ed)
      );
      if (matchedEditor) {
        signals.push({
          check: "Document Producer / Editor Provenance",
          status: result === "AUTHENTIC" ? "info" : "warn",
          detail: `Document metadata indicates editing or export via "${producerOrCreator}" (common when certificates are edited or re-saved).`,
        });
      } else {
        signals.push({
          check: "Document Producer / Editor Provenance",
          status: "info",
          detail: `Document created/produced by: ${producerOrCreator}.`,
        });
      }
    }

    if (
      metadata.creationDate &&
      metadata.modDate &&
      metadata.creationDate !== metadata.modDate &&
      metadata.producer !== "CertiChain Credential Engine"
    ) {
      signals.push({
        check: "Timestamp Consistency (Created vs Modified)",
        status: "warn",
        detail: `PDF was modified (${metadata.modDate}) after its original creation date (${metadata.creationDate}).`,
      });
    }
  }

  for (const w of editorWarnings) {
    signals.push({
      check: "File Metadata Anomaly",
      status: "warn",
      detail: w,
    });
  }

  if (qrPayload || extractedUrls.length > 0) {
    signals.push({
      check: "Embedded QR / Verification Links",
      status: "info",
      detail: qrPayload
        ? `Decoded QR payload: ${qrPayload}`
        : `Found ${extractedUrls.length} verification/external URL(s) inside document.`,
    });
  }

  const legitimacy_label =
    result === "AUTHENTIC"
      ? "LEGITIMATE — VERIFIED ON CERTICHAIN"
      : result === "TAMPERED"
      ? "NOT LEGIT — TAMPERING / FORGERY DETECTED"
      : result === "REVOKED"
      ? "NOT LEGIT — CERTIFICATE REVOKED"
      : "UNVERIFIED — NOT REGISTERED ON CERTICHAIN";

  return { legitimacy_label, signals };
}
