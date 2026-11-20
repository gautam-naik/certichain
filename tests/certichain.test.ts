import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";

const tempDbPath = path.resolve(process.cwd(), "test-certichain.db");
process.env.DATABASE_PATH = tempDbPath;
process.env.STRICT_BLOCKCHAIN_MODE = "false";
process.env.BLOCKCHAIN_RPC_URL = "http://127.0.0.1:59999"; // Ensure offline demo mode during isolated unit tests

let compileCertificateRegistry: typeof import("../server/solidity.ts").compileCertificateRegistry;
let computeCanonicalHash: typeof import("../server/crypto.ts").computeCanonicalHash;
let computeCertificateIdHash: typeof import("../server/crypto.ts").computeCertificateIdHash;
let normalizeCertificateData: typeof import("../server/crypto.ts").normalizeCertificateData;

let server: http.Server;
let baseUrl = "";
let adminToken = "";
let issuedCertId = "";

test.before(async () => {
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(tempDbPath + suffix)) fs.unlinkSync(tempDbPath + suffix);
  }
  const solidityMod = await import("../server/solidity.ts");
  const cryptoMod = await import("../server/crypto.ts");
  const dbMod = await import("../server/db.ts");
  const routesMod = await import("../server/routes.ts");

  compileCertificateRegistry = solidityMod.compileCertificateRegistry;
  computeCanonicalHash = cryptoMod.computeCanonicalHash;
  computeCertificateIdHash = cryptoMod.computeCertificateIdHash;
  normalizeCertificateData = cryptoMod.normalizeCertificateData;

  dbMod.getDb();

  const app = express();
  app.use(express.json());
  app.use("/api", routesMod.createApiRouter());

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(tempDbPath + suffix)) {
      fs.unlinkSync(tempDbPath + suffix);
    }
  }
});

test("1. Solidity smart contract compiles with expected ABI & events", () => {
  const compiled = compileCertificateRegistry();
  assert.equal(compiled.contractName, "CertificateRegistry");
  assert.ok(compiled.bytecode.startsWith("0x60"));
  const abiNames = (compiled.abi as Array<{ name?: string }>).map((x) => x.name);
  for (const fn of [
    "registerCertificate",
    "verifyCertificate",
    "revokeCertificate",
    "addIssuer",
    "removeIssuer",
    "getCertificate",
    "CertificateIssued",
    "CertificateRevoked",
  ]) {
    assert.ok(abiNames.includes(fn), `Missing ABI member: ${fn}`);
  }
});

test("2. Canonical normalization & SHA-256 tampering sensitivity", () => {
  const base = {
    certificate_id: "CERT-2026-TEST01",
    student_name: "  Alice   Johnson ",
    student_roll_number: "cs2022001",
    university_name: "Test University",
    degree: "B.Tech CS",
    department: "Computer Science",
    academic_year: "2022-2026",
    certificate_type: "Degree Certificate",
    grade: "9.10 CGPA",
    issue_date: "2026-06-01",
  };
  const h1 = computeCanonicalHash(base);
  const h2 = computeCanonicalHash({ ...base, grade: "9.11 CGPA" });
  assert.equal(h1.length, 66);
  assert.notEqual(h1, h2);
  assert.ok(normalizeCertificateData(base).includes('"student_name":"Alice Johnson"'));
  assert.equal(computeCertificateIdHash("cert-2026-test01").length, 66);
});

test("3. Authentication: rejects invalid password and issues JWT for seeded admin", async () => {
  const badRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@certichain.edu", password: "wrong" }),
  });
  assert.equal(badRes.status, 401);

  const okRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@certichain.edu",
      password: process.env.ADMIN_PASSWORD || "CertiChain@2026",
    }),
  });
  assert.equal(okRes.status, 200);
  const body = (await okRes.json()) as { token: string; user: { role: string } };
  assert.ok(body.token);
  assert.equal(body.user.role, "admin");
  adminToken = body.token;
});

test("4. Authorization: blocks unauthenticated certificate issuance", async () => {
  const res = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_name: "Unauth" }),
  });
  assert.equal(res.status, 401);
});

test("5. Full Lifecycle: Issue -> Retrieve -> PDF/QR -> Verify Authentic -> Tamper -> Revoke", async () => {
  // Issue
  const issueRes = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      student_name: "Vikram Patel",
      student_roll_number: "IT2022055",
      university_name: "National Institute of Technology",
      degree: "B.Tech in Information Technology",
      department: "Information Technology",
      academic_year: "2022-2026",
      certificate_type: "Degree Certificate",
      grade: "9.35 CGPA",
      issue_date: "2026-07-15",
    }),
  });
  assert.equal(issueRes.status, 201);
  const issuedBody = (await issueRes.json()) as {
    certificate: { certificate_id: string; canonical_hash: string; tx_hash: string };
  };
  issuedCertId = issuedBody.certificate.certificate_id;
  assert.match(issuedCertId, /^CERT-2026-[A-F0-9]{6}$/);
  assert.ok(issuedBody.certificate.tx_hash.startsWith("0x"));

  // Public retrieval masks private roll number & grade
  const pubGet = await fetch(`${baseUrl}/api/certificates/${issuedCertId}`);
  assert.equal(pubGet.status, 200);
  const pubJson = (await pubGet.json()) as {
    certificate: { student_roll_number?: string; student_name: string };
  };
  assert.equal(pubJson.certificate.student_name, "Vikram Patel");
  assert.equal(pubJson.certificate.student_roll_number, undefined);

  // Admin retrieval includes roll number
  const adminGet = await fetch(`${baseUrl}/api/certificates/${issuedCertId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminJson = (await adminGet.json()) as {
    certificate: { student_roll_number?: string };
  };
  assert.equal(adminJson.certificate.student_roll_number, "IT2022055");

  // PDF generation & QR PNG
  const pdfRes = await fetch(`${baseUrl}/api/certificates/${issuedCertId}/pdf`);
  assert.equal(pdfRes.status, 200);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBuf.subarray(0, 5).toString("ascii"), "%PDF-");

  const qrRes = await fetch(`${baseUrl}/api/certificates/${issuedCertId}/qr`);
  assert.equal(qrRes.status, 200);
  const qrBuf = Buffer.from(await qrRes.arrayBuffer());
  assert.equal(qrBuf[0], 0x89);
  assert.equal(qrBuf.subarray(1, 4).toString("ascii"), "PNG");

  // Verify by ID -> AUTHENTIC
  const verifyIdRes = await fetch(`${baseUrl}/api/verify/id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certificate_id: issuedCertId }),
  });
  const verifyIdJson = (await verifyIdRes.json()) as { result: string };
  assert.equal(verifyIdJson.result, "AUTHENTIC");

  // Verify by authentic PDF upload -> AUTHENTIC + exact_file_match
  const form = new FormData();
  form.append(
    "file",
    new Blob([pdfBuf], { type: "application/pdf" }),
    `${issuedCertId}.pdf`
  );
  const uploadRes = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: form,
  });
  const uploadJson = (await uploadRes.json()) as {
    result: string;
    file_integrity: { exact_file_match: boolean };
  };
  assert.equal(uploadJson.result, "AUTHENTIC");
  assert.equal(uploadJson.file_integrity.exact_file_match, true);

  // Tamper Test 1: Modified field -> TAMPERED
  const tamperFieldRes = await fetch(`${baseUrl}/api/verify/id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      certificate_id: issuedCertId,
      fields: { grade: "10.00 CGPA" },
    }),
  });
  const tamperFieldJson = (await tamperFieldRes.json()) as { result: string };
  assert.equal(tamperFieldJson.result, "TAMPERED");

  // Tamper Test 2: Tampered PDF upload -> TAMPERED
  const tamperedPdfRes = await fetch(
    `${baseUrl}/api/certificates/${issuedCertId}/pdf?tamper_demo=true`
  );
  const tamperedBuf = Buffer.from(await tamperedPdfRes.arrayBuffer());
  const tamperForm = new FormData();
  tamperForm.append(
    "file",
    new Blob([tamperedBuf], { type: "application/pdf" }),
    "tampered.pdf"
  );
  const tamperUploadRes = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: tamperForm,
  });
  const tamperUploadJson = (await tamperUploadRes.json()) as { result: string };
  assert.equal(tamperUploadJson.result, "TAMPERED");

  // Non-existent -> NOT_FOUND (must NOT emit misleading hash_comparison)
  const missingRes = await fetch(`${baseUrl}/api/verify/id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certificate_id: "CERT-2026-FFFFFF" }),
  });
  const missingJson = (await missingRes.json()) as {
    result: string;
    explanation: string;
    hash_comparison: unknown;
  };
  assert.equal(missingJson.result, "NOT_FOUND");
  assert.equal(missingJson.hash_comparison, null);
  assert.match(missingJson.explanation, /not found/i);

  // Revoke -> REVOKED
  const revokeRes = await fetch(
    `${baseUrl}/api/certificates/${issuedCertId}/revoke`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: "Integration test revocation" }),
    }
  );
  assert.equal(revokeRes.status, 200);

  const afterRevokeRes = await fetch(`${baseUrl}/api/verify/id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certificate_id: issuedCertId }),
  });
  const afterRevokeJson = (await afterRevokeRes.json()) as { result: string };
  assert.equal(afterRevokeJson.result, "REVOKED");

  // Audit history recorded all checks
  const historyRes = await fetch(`${baseUrl}/api/verify/history`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(historyRes.status, 200);
  const historyJson = (await historyRes.json()) as { items: unknown[] };
  assert.ok(historyJson.items.length >= 5);
});

test("6. Non-PDF Formats: custom certificate type, PNG/binary attachment & JSON credential verification", async () => {
  const binaryCert = Buffer.from("FAKEPNG-OFFICIAL-DIPLOMA-BYTES-2026");
  const issueForm = new FormData();
  issueForm.append("student_name", "Neha Kulkarni");
  issueForm.append("student_roll_number", "DS2023012");
  issueForm.append("university_name", "Tech Horizon Institute");
  issueForm.append("degree", "Executive Certificate in Applied AI");
  issueForm.append("department", "Data Science");
  issueForm.append("academic_year", "2025-2026");
  issueForm.append("certificate_type", "Blockchain Micro-Credential");
  issueForm.append("grade", "Distinction");
  issueForm.append("issue_date", "2026-08-01");
  issueForm.append(
    "file",
    new Blob([binaryCert], { type: "image/png" }),
    "diploma-badge.png"
  );

  const issueRes = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: issueForm,
  });
  assert.equal(issueRes.status, 201);
  const issueBody = (await issueRes.json()) as {
    certificate: {
      certificate_id: string;
      certificate_type: string;
      attachment_filename?: string;
    };
  };
  const customId = issueBody.certificate.certificate_id;
  assert.equal(issueBody.certificate.certificate_type, "Blockchain Micro-Credential");
  assert.equal(issueBody.certificate.attachment_filename, "diploma-badge.png");

  // 1) Verify exact unmodified PNG attachment without even entering Certificate ID
  const pngForm = new FormData();
  pngForm.append("file", new Blob([binaryCert], { type: "image/png" }), "diploma-badge.png");
  const pngVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: pngForm,
  });
  const pngJson = (await pngVerify.json()) as {
    result: string;
    certificate_id: string;
    file_integrity: { exact_file_match: boolean };
  };
  assert.equal(pngJson.result, "AUTHENTIC");
  assert.equal(pngJson.certificate_id, customId);
  assert.equal(pngJson.file_integrity.exact_file_match, true);

  // 2) Verify tampered PNG uploaded with Certificate ID -> TAMPERED
  const alteredForm = new FormData();
  alteredForm.append("certificate_id", customId);
  alteredForm.append(
    "file",
    new Blob([Buffer.from("FAKEPNG-TAMPERED-DIPLOMA-BYTES-2026")], { type: "image/png" }),
    "diploma-badge.png"
  );
  const alteredRes = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: alteredForm,
  });
  const alteredJson = (await alteredRes.json()) as { result: string };
  assert.equal(alteredJson.result, "TAMPERED");

  // 3) Export JSON credential & verify it -> AUTHENTIC; tamper JSON -> TAMPERED
  const jsonExportRes = await fetch(`${baseUrl}/api/certificates/${customId}/json`);
  assert.equal(jsonExportRes.status, 200);
  const jsonText = await jsonExportRes.text();

  const jsonForm = new FormData();
  jsonForm.append("file", new Blob([jsonText], { type: "application/json" }), `${customId}.json`);
  const jsonVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: jsonForm,
  });
  const jsonVerifyBody = (await jsonVerify.json()) as { result: string };
  assert.equal(jsonVerifyBody.result, "AUTHENTIC");

  const tamperedJsonText = jsonText.replace("Distinction", "Honours Plus");
  const tamperedJsonForm = new FormData();
  tamperedJsonForm.append(
    "file",
    new Blob([tamperedJsonText], { type: "application/json" }),
    `${customId}-tampered.json`
  );
  const tamperedJsonVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: tamperedJsonForm,
  });
  const tamperedJsonBody = (await tamperedJsonVerify.json()) as { result: string };
  assert.equal(tamperedJsonBody.result, "TAMPERED");

  // 4) Generic / external text file upload returns clear output + extracted_details + forensics
  const extForm = new FormData();
  extForm.append(
    "file",
    new Blob([Buffer.from("External transcript referencing CERT-2026-A104F2")], {
      type: "text/plain",
    }),
    "transcript.txt"
  );
  const extVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: extForm,
  });
  assert.equal(extVerify.status, 200);
  const extJson = (await extVerify.json()) as {
    result: string;
    forensics: {
      legitimacy_label: string;
      signals: Array<{ check: string; status: string }>;
      extracted_text_preview: string | null;
    };
    extracted_details: {
      filename: string;
      extracted_certificate_id: string | null;
    };
  };
  assert.equal(extJson.extracted_details.filename, "transcript.txt");
  assert.equal(extJson.extracted_details.extracted_certificate_id, "CERT-2026-A104F2");
  assert.equal(extJson.result, "TAMPERED");
  assert.ok(extJson.forensics.legitimacy_label.includes("NOT LEGIT"));
  assert.ok(extJson.forensics.signals.length >= 2);
  assert.ok(extJson.forensics.extracted_text_preview?.includes("External transcript"));

  // 5) Unregistered external file returns UNVERIFIED forensics verdict & SHA-256 integrity
  const unregForm = new FormData();
  unregForm.append(
    "file",
    new Blob([Buffer.from("Third-party course certificate https://example.edu/verify/9988")], {
      type: "text/plain",
    }),
    "external-cert.txt"
  );
  const unregVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: unregForm,
  });
  assert.equal(unregVerify.status, 200);
  const unregJson = (await unregVerify.json()) as {
    result: string;
    forensics: {
      legitimacy_label: string;
      extracted_urls: string[];
    };
  };
  assert.equal(unregJson.result, "NOT_FOUND");
  assert.ok(unregJson.forensics.legitimacy_label.includes("UNVERIFIED"));
  assert.ok(unregJson.forensics.extracted_urls.includes("https://example.edu/verify/9988"));
});

test("7. Non-PDF Edge Cases: BOM JSON, partial JSON attachment, UTF-16LE text, QR PNG & forged text", async () => {
  // A) Official QR PNG uploaded directly -> AUTHENTIC
  const qrRes = await fetch(`${baseUrl}/api/certificates/CERT-2026-A104F2/qr`);
  const qrBuf = Buffer.from(await qrRes.arrayBuffer());
  const qrForm = new FormData();
  qrForm.append("file", new Blob([qrBuf], { type: "image/png" }), "CERT-2026-A104F2.png");
  qrForm.append("certificate_id", "CERT-2026-A104F2");
  const qrVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: qrForm,
  });
  const qrJson = (await qrVerify.json()) as { result: string };
  assert.equal(qrJson.result, "AUTHENTIC");

  // B) JSON credential with UTF-8 BOM -> AUTHENTIC
  const jsonExportRes = await fetch(`${baseUrl}/api/certificates/CERT-2026-A104F2/json`);
  const jsonText = await jsonExportRes.text();
  const bomBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(jsonText, "utf8")]);
  const bomForm = new FormData();
  bomForm.append("file", new Blob([bomBuf], { type: "application/json" }), "bom.json");
  const bomVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: bomForm,
  });
  const bomJson = (await bomVerify.json()) as { result: string };
  assert.equal(bomJson.result, "AUTHENTIC");

  // C) Partial custom JSON attached at issuance -> exactAttachmentMatch must take precedence -> AUTHENTIC
  const customJsonBuf = Buffer.from(
    JSON.stringify({ certificate_id: "EXTERNAL-REF", student_name: "Priya Menon", badge: "Gold" }),
    "utf8"
  );
  const issueForm = new FormData();
  issueForm.append("student_name", "Priya Menon");
  issueForm.append("student_roll_number", "CS2023088");
  issueForm.append("university_name", "Tech Horizon Institute");
  issueForm.append("degree", "B.Tech CS");
  issueForm.append("department", "CS");
  issueForm.append("academic_year", "2023-2027");
  issueForm.append("certificate_type", "Custom JSON Badge");
  issueForm.append("issue_date", "2026-08-10");
  issueForm.append("file", new Blob([customJsonBuf], { type: "application/json" }), "badge.json");

  const issueRes = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: issueForm,
  });
  assert.equal(issueRes.status, 201);
  const issued = (await issueRes.json()) as {
    certificate: { certificate_id: string; canonical_hash: string };
  };

  const attachForm = new FormData();
  attachForm.append("file", new Blob([customJsonBuf], { type: "application/json" }), "badge.json");
  const attachVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: attachForm,
  });
  const attachJson = (await attachVerify.json()) as {
    result: string;
    certificate_id: string;
    file_integrity: { exact_file_match: boolean };
  };
  assert.equal(attachJson.result, "AUTHENTIC");
  assert.equal(attachJson.certificate_id, issued.certificate.certificate_id);
  assert.equal(attachJson.file_integrity.exact_file_match, true);

  // D) Forged .txt pasting canonical_hash must return TAMPERED, NOT AUTHENTIC
  const forgedTxt = Buffer.from(
    `Fake degree mentioning ${issued.certificate.canonical_hash}`,
    "utf8"
  );
  const forgedForm = new FormData();
  forgedForm.append("file", new Blob([forgedTxt], { type: "text/plain" }), "forged.txt");
  const forgedVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: forgedForm,
  });
  const forgedJson = (await forgedVerify.json()) as { result: string };
  assert.equal(forgedJson.result, "TAMPERED");

  // E) UTF-16 LE encoded text file containing CERT ID extracts ID & detects TAMPERED
  const utf16Buf = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from("Altered certificate CERT-2026-A104F2", "utf16le"),
  ]);
  const utf16Form = new FormData();
  utf16Form.append("file", new Blob([utf16Buf], { type: "text/plain" }), "utf16.txt");
  const utf16Verify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: utf16Form,
  });
  const utf16Json = (await utf16Verify.json()) as {
    result: string;
    extracted_details: { extracted_certificate_id: string | null };
  };
  assert.equal(utf16Json.extracted_details.extracted_certificate_id, "CERT-2026-A104F2");
  assert.equal(utf16Json.result, "TAMPERED");

  // F) Empty 0-byte file rejected cleanly with 400
  const emptyForm = new FormData();
  emptyForm.append("file", new Blob([], { type: "text/plain" }), "empty.txt");
  const emptyVerify = await fetch(`${baseUrl}/api/verify/upload`, {
    method: "POST",
    body: emptyForm,
  });
  assert.equal(emptyVerify.status, 400);
});

test("8. Issuance Robustness: multipart 401 without stream reset, Unicode PDF safety & date normalization", async () => {
  // Unauthenticated multipart upload returns clean 401 JSON
  const unauthForm = new FormData();
  unauthForm.append("student_name", "Test");
  unauthForm.append("file", new Blob([Buffer.from("PNG")], { type: "image/png" }), "cert.png");
  const unauthRes = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    body: unauthForm,
  });
  assert.equal(unauthRes.status, 401);

  // Unicode symbols (em-dash, bullet, star) + DD/MM/YYYY date + attached file issue cleanly
  const unicodeForm = new FormData();
  unicodeForm.append("student_name", "Riya Kapoor");
  unicodeForm.append("student_roll_number", "NP2026001");
  unicodeForm.append("university_name", "IIT Madras – NPTEL");
  unicodeForm.append("degree", "Cloud Computing • Elite + Gold ★");
  unicodeForm.append("department", "Computer Science");
  unicodeForm.append("academic_year", "2025-2026");
  unicodeForm.append("certificate_type", "NPTEL Online Certification");
  unicodeForm.append("grade", "91% (Top 2%)");
  unicodeForm.append("issue_date", "19/11/2026");
  unicodeForm.append(
    "file",
    new Blob([Buffer.from("NPTEL-CERT-SAMPLE-BYTES")], { type: "image/png" }),
    "nptel.png"
  );

  const okRes = await fetch(`${baseUrl}/api/certificates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: unicodeForm,
  });
  assert.equal(okRes.status, 201);
  const okJson = (await okRes.json()) as {
    certificate: { certificate_id: string; issue_date: string };
  };
  assert.equal(okJson.certificate.issue_date, "2026-11-19");

  const pdfCheck = await fetch(
    `${baseUrl}/api/certificates/${okJson.certificate.certificate_id}/pdf`
  );
  assert.equal(pdfCheck.status, 200);
});



