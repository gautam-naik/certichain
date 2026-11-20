import crypto from "crypto";
import express, { Request, Response } from "express";
import multer from "multer";
import {
  authenticateCredentials,
  AuthenticatedRequest,
  extractOptionalUser,
  requireAdmin,
  signJwt,
} from "./auth.ts";
import {
  getBlockchainStatus,
  registerCertificateOnChain,
  revokeCertificateOnChain,
  verifyCertificateOnChain,
} from "./blockchain.ts";
import {
  CanonicalCertificateInput,
  computeCanonicalHash,
  computeFileSha256,
  decodeTextBuffer,
  generateCertificateId,
} from "./crypto.ts";
import { getDb } from "./db.ts";
import {
  buildForensicSignals,
  inspectDocxDocument,
  inspectImageDocument,
} from "./forensics.ts";
import {
  extractPdfDetails,
  generateCertificatePdf,
  generateQrPngBuffer,
} from "./pdf.ts";
import {
  ChatRolePreset,
  ChatTurnInput,
  runMultiTurnGeminiChat,
  runSearchGroundedVerificationLookup,
} from "./gemini.ts";
import {
  FirebaseAuthRequest,
  optionalFirebaseAuth,
  requireFirebaseAuth,
} from "../src/middleware/auth.ts";
import {
  getUserChatSessionsFromSql,
  getUserVerificationsFromSql,
  markCertificateRevokedInSql,
  persistChatTurnInSql,
  recordVerificationInSql,
  upsertCertificateInSql,
} from "../src/db/certichain-sql.ts";
import { getOrCreateUser } from "../src/db/users.ts";

interface CertificateRow {
  id: number;
  certificate_id: string;
  student_name: string;
  student_roll_number: string;
  university_name: string;
  degree: string;
  department: string;
  academic_year: string;
  certificate_type: string;
  grade: string;
  issue_date: string;
  canonical_hash: string;
  pdf_sha256: string;
  attachment_sha256: string;
  attachment_filename: string;
  attachment_mime: string;
  tx_hash: string;
  block_number: number;
  network_name: string;
  issuer_address: string;
  ledger_mode: string;
  revoked: number;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max, accepts any certificate file format
});

function conditionalUpload(
  req: Request,
  res: Response,
  next: express.NextFunction
) {
  if (req.is("multipart/form-data")) {
    upload.single("file")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || "Invalid file upload." });
        return;
      }
      next();
    });
  } else {
    next();
  }
}

function sanitizeString(val: unknown, maxLen = 180): string {
  if (typeof val !== "string") return "";
  return val.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function serializeCertificate(row: CertificateRow, isAdmin: boolean) {
  return {
    certificate_id: row.certificate_id,
    student_name: row.student_name,
    student_roll_number: isAdmin ? row.student_roll_number : undefined,
    university_name: row.university_name,
    degree: row.degree,
    department: row.department,
    academic_year: row.academic_year,
    certificate_type: row.certificate_type,
    grade: isAdmin ? row.grade : undefined,
    issue_date: row.issue_date,
    canonical_hash: row.canonical_hash,
    pdf_sha256: row.pdf_sha256,
    attachment_sha256: row.attachment_sha256 || undefined,
    attachment_filename: row.attachment_filename || undefined,
    attachment_mime: row.attachment_mime || undefined,
    tx_hash: row.tx_hash,
    block_number: row.block_number,
    network_name: row.network_name,
    issuer_address: row.issuer_address,
    ledger_mode: row.ledger_mode,
    revoked: Boolean(row.revoked),
    revoked_at: row.revoked_at,
    revoked_reason: row.revoked_reason,
    created_at: row.created_at,
  };
}

function logVerification(
  certificateId: string,
  result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND",
  requestType: "id" | "upload" | "qr",
  detail: string
) {
  const db = getDb();
  db.prepare(
    "INSERT INTO verification_logs (certificate_id, verification_result, request_type, status_detail, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(
    certificateId.trim().toUpperCase().slice(0, 64) || "UNKNOWN",
    result,
    requestType,
    detail.slice(0, 240),
    new Date().toISOString()
  );
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  // --- AUTHENTICATION ---
  router.post("/auth/login", (req: Request, res: Response) => {
    const email = sanitizeString(req.body?.email, 120);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = authenticateCredentials(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signJwt(user);
    res.json({
      token,
      token_type: "bearer",
      user,
    });
  });

  router.post("/auth/logout", (_req: Request, res: Response) => {
    res.json({ message: "Logged out successfully." });
  });

  router.get("/auth/me", requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // --- FIREBASE AUTH + CLOUD SQL SESSION SYNC ---
  router.post(
    "/auth/firebase-session",
    requireFirebaseAuth,
    async (req: FirebaseAuthRequest, res: Response) => {
      try {
        const fbUser = req.firebaseUser!;
        const email = fbUser.email || "";
        const displayName =
          typeof fbUser.name === "string"
            ? fbUser.name
            : email.split("@")[0] || "CertiChain User";

        const sqlUser = await getOrCreateUser(fbUser.uid, email, displayName);
        res.json({
          user: {
            uid: fbUser.uid,
            email,
            name: displayName,
            role: sqlUser?.role || "user",
          },
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : "Failed to synchronize user session.",
        });
      }
    }
  );

  router.get(
    "/user/verifications",
    requireFirebaseAuth,
    async (req: FirebaseAuthRequest, res: Response) => {
      try {
        const items = await getUserVerificationsFromSql(req.firebaseUser!.uid);
        res.json({ items });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : "Failed to load user verification history.",
        });
      }
    }
  );

  router.get(
    "/user/chat-sessions",
    requireFirebaseAuth,
    async (req: FirebaseAuthRequest, res: Response) => {
      try {
        const items = await getUserChatSessionsFromSql(req.firebaseUser!.uid);
        res.json({ items });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : "Failed to load user chat sessions.",
        });
      }
    }
  );

  // --- DASHBOARD ANALYTICS (Admin) ---
  router.get("/dashboard/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const totalIssued = (
        db.prepare("SELECT COUNT(*) as cnt FROM certificates").get() as { cnt: number }
      ).cnt;
      const revokedCount = (
        db
          .prepare("SELECT COUNT(*) as cnt FROM certificates WHERE revoked = 1")
          .get() as { cnt: number }
      ).cnt;
      const totalVerifications = (
        db.prepare("SELECT COUNT(*) as cnt FROM verification_logs").get() as {
          cnt: number;
        }
      ).cnt;
      const authenticVerifications = (
        db
          .prepare(
            "SELECT COUNT(*) as cnt FROM verification_logs WHERE verification_result = 'AUTHENTIC'"
          )
          .get() as { cnt: number }
      ).cnt;

      const issuanceByMonth = db
        .prepare(`
          SELECT substr(issue_date, 1, 7) as month, COUNT(*) as issued
          FROM certificates
          GROUP BY substr(issue_date, 1, 7)
          ORDER BY month ASC
        `)
        .all() as { month: string; issued: number }[];

      const verificationBreakdown = db
        .prepare(`
          SELECT verification_result as result, COUNT(*) as count
          FROM verification_logs
          GROUP BY verification_result
        `)
        .all() as { result: string; count: number }[];

      const blockchain = await getBlockchainStatus();

      res.json({
        totals: {
          issued: totalIssued,
          verified_authentic: authenticVerifications,
          revoked: revokedCount,
          verification_attempts: totalVerifications,
        },
        issuance_series: issuanceByMonth,
        verification_breakdown: verificationBreakdown,
        blockchain,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to load dashboard stats",
      });
    }
  });

  // --- CERTIFICATES ---
  router.post(
    "/certificates",
    conditionalUpload,
    requireAdmin,
    async (req: Request, res: Response) => {
      const reqId = crypto.randomBytes(4).toString("hex");
      try {
        const student_name = sanitizeString(req.body?.student_name, 120);
        const student_roll_number = sanitizeString(req.body?.student_roll_number, 60);
        const university_name = sanitizeString(req.body?.university_name, 160);
        const degree = sanitizeString(req.body?.degree, 160);
        const department = sanitizeString(req.body?.department, 120);
        const academic_year = sanitizeString(req.body?.academic_year, 40);
        const certificate_type = sanitizeString(req.body?.certificate_type, 80);
        const grade = sanitizeString(req.body?.grade, 40) || "N/A";
        let issue_date = sanitizeString(req.body?.issue_date, 30);
        if (/^\d{4}-\d{2}-\d{2}T/.test(issue_date)) {
          issue_date = issue_date.slice(0, 10);
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(issue_date)) {
          const [d, m, y] = issue_date.split("/");
          issue_date = `${y}-${m}-${d}`;
        }

        console.info(
          `[certificates/issue][req:${reqId}] contentType="${req.headers["content-type"] || "none"}" hasFile=${Boolean(req.file)} fileSize=${req.file?.size || 0} bodyKeys=[${Object.keys(req.body || {}).join(",")}]`
        );

        const missingFields: string[] = [];
        if (!student_name) missingFields.push("student_name");
        if (!student_roll_number) missingFields.push("student_roll_number");
        if (!university_name) missingFields.push("university_name");
        if (!degree) missingFields.push("degree");
        if (!department) missingFields.push("department");
        if (!academic_year) missingFields.push("academic_year");
        if (!certificate_type) missingFields.push("certificate_type");
        if (!issue_date) missingFields.push("issue_date");

        if (missingFields.length > 0) {
          console.warn(
            `[certificates/issue][req:${reqId}] 400 missing fields: ${missingFields.join(", ")}`
          );
          res.status(400).json({
            error: `Missing required certificate field(s): ${missingFields.join(", ")}.`,
          });
          return;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(issue_date)) {
          console.warn(
            `[certificates/issue][req:${reqId}] 400 invalid issue_date="${issue_date}"`
          );
          res.status(400).json({ error: "Issue date must be formatted as YYYY-MM-DD." });
          return;
        }

        const db = getDb();
        let certificate_id = generateCertificateId(issue_date);
        while (
          db
            .prepare("SELECT id FROM certificates WHERE certificate_id = ?")
            .get(certificate_id)
        ) {
          certificate_id = generateCertificateId(issue_date);
        }

        const canonicalInput: CanonicalCertificateInput = {
          certificate_id,
          student_name,
          student_roll_number,
          university_name,
          degree,
          department,
          academic_year,
          certificate_type,
          grade,
          issue_date,
        };

        const canonicalHash = computeCanonicalHash(canonicalInput);

        // Optional attached original certificate file (any format)
        const attachmentSha256 = req.file ? computeFileSha256(req.file.buffer) : "";
        const attachmentFilename = req.file
          ? sanitizeString(req.file.originalname, 160)
          : "";
        const attachmentMime = req.file
          ? sanitizeString(req.file.mimetype, 100)
          : "";

        // Step 1: Register on Smart Contract / Ledger FIRST (source of truth)
        const chainResult = await registerCertificateOnChain(certificate_id, canonicalHash);

        // Step 2: Generate PDF & calculate exact PDF file SHA-256
        const pdfBuffer = await generateCertificatePdf({
          ...canonicalInput,
          canonical_hash: canonicalHash,
          tx_hash: chainResult.txHash,
          network_name: chainResult.networkName,
        });
        const pdfSha256 = computeFileSha256(pdfBuffer);

        // Step 3: Persist metadata in SQLite
        const createdAt = new Date().toISOString();
        db.prepare(`
          INSERT INTO certificates (
            certificate_id, student_name, student_roll_number, university_name,
            degree, department, academic_year, certificate_type, grade, issue_date,
            canonical_hash, pdf_sha256, attachment_sha256, attachment_filename, attachment_mime,
            tx_hash, block_number, network_name,
            issuer_address, ledger_mode, revoked, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(
          certificate_id,
          student_name,
          student_roll_number,
          university_name,
          degree,
          department,
          academic_year,
          certificate_type,
          grade,
          issue_date,
          canonicalHash,
          pdfSha256,
          attachmentSha256,
          attachmentFilename,
          attachmentMime,
          chainResult.txHash,
          chainResult.blockNumber,
          chainResult.networkName,
          chainResult.issuerAddress,
          chainResult.ledgerMode,
          createdAt
        );

        const created = db
          .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
          .get(certificate_id) as unknown as CertificateRow;

        upsertCertificateInSql({
          certificateId: certificate_id,
          studentName: student_name,
          studentRollNumber: student_roll_number,
          universityName: university_name,
          degree,
          department,
          academicYear: academic_year,
          certificateType: certificate_type,
          grade,
          issueDate: issue_date,
          canonicalHash,
          pdfSha256,
          attachmentSha256,
          attachmentFilename,
          attachmentMime,
          txHash: chainResult.txHash,
          blockNumber: chainResult.blockNumber,
          networkName: chainResult.networkName,
          issuerAddress: chainResult.issuerAddress,
          ledgerMode: chainResult.ledgerMode,
        }).catch((sqlErr) => {
          console.warn("[CloudSQL] Certificate sync warning:", sqlErr);
        });

        res.status(201).json({
          certificate: serializeCertificate(created, true),
          message: "Certificate issued and anchored successfully.",
        });
      } catch (err) {
        res.status(500).json({
          error:
            err instanceof Error
              ? err.message
              : "Blockchain registration failed. Certificate was not issued.",
        });
      }
    }
  );

  router.get("/certificates", (req: Request, res: Response) => {
    const user = extractOptionalUser(req);
    const isAdmin = user?.role === "admin";
    const q = sanitizeString(req.query.q, 100).toLowerCase();
    const course = sanitizeString(req.query.course, 100).toLowerCase();
    const university = sanitizeString(req.query.university, 120).toLowerCase();
    const status = sanitizeString(req.query.status, 20).toLowerCase();
    const dateFrom = sanitizeString(req.query.dateFrom, 20);
    const dateTo = sanitizeString(req.query.dateTo, 20);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

    const db = getDb();
    const allRows = db
      .prepare("SELECT * FROM certificates ORDER BY created_at DESC")
      .all() as unknown as CertificateRow[];

    const filtered = allRows.filter((r) => {
      if (q) {
        const hay = `${r.certificate_id} ${r.student_name} ${r.degree} ${r.university_name} ${r.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (course && !r.degree.toLowerCase().includes(course)) return false;
      if (university && !r.university_name.toLowerCase().includes(university)) return false;
      if (status === "active" && r.revoked === 1) return false;
      if (status === "revoked" && r.revoked === 0) return false;
      if (dateFrom && r.issue_date < dateFrom) return false;
      if (dateTo && r.issue_date > dateTo) return false;
      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered
      .slice(start, start + limit)
      .map((row) => serializeCertificate(row, isAdmin));

    res.json({
      items,
      total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.get("/certificates/:certificate_id", (req: Request, res: Response) => {
    const user = extractOptionalUser(req);
    const isAdmin = user?.role === "admin";
    const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
      .get(id) as unknown as CertificateRow | undefined;

    if (!row) {
      res.status(404).json({ error: "Certificate not found." });
      return;
    }

    res.json({ certificate: serializeCertificate(row, isAdmin) });
  });

  router.get("/certificates/:certificate_id/pdf", async (req: Request, res: Response) => {
    try {
      const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();
      const tamperDemo = req.query.tamper_demo === "true";

      const db = getDb();
      const row = db
        .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
        .get(id) as unknown as CertificateRow | undefined;

      if (!row) {
        res.status(404).json({ error: "Certificate not found." });
        return;
      }

      const pdfBuffer = await generateCertificatePdf(
        {
          certificate_id: row.certificate_id,
          student_name: row.student_name,
          student_roll_number: row.student_roll_number,
          university_name: row.university_name,
          degree: row.degree,
          department: row.department,
          academic_year: row.academic_year,
          certificate_type: row.certificate_type,
          grade: row.grade,
          issue_date: row.issue_date,
          canonical_hash: row.canonical_hash,
          tx_hash: row.tx_hash,
          network_name: row.network_name,
          revoked: Boolean(row.revoked),
        },
        { tamperForDemo: tamperDemo }
      );

      // Update stored pdf_sha256 if it was a seeded record without an initial PDF digest
      if (!tamperDemo && !row.pdf_sha256) {
        const sha = computeFileSha256(pdfBuffer);
        db.prepare("UPDATE certificates SET pdf_sha256 = ? WHERE certificate_id = ?").run(
          sha,
          row.certificate_id
        );
      }

      const filename = tamperDemo
        ? `${row.certificate_id}-TAMPERED-TEST.pdf`
        : `${row.certificate_id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to generate PDF.",
      });
    }
  });

  router.get("/certificates/:certificate_id/qr", async (req: Request, res: Response) => {
    try {
      const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();
      const db = getDb();
      const row = db
        .prepare("SELECT certificate_id FROM certificates WHERE certificate_id = ?")
        .get(id);

      if (!row) {
        res.status(404).json({ error: "Certificate not found." });
        return;
      }

      const png = await generateQrPngBuffer(id);
      res.setHeader("Content-Type", "image/png");
      res.send(png);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to generate QR code.",
      });
    }
  });

  router.get("/certificates/:certificate_id/json", (req: Request, res: Response) => {
    const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
      .get(id) as unknown as CertificateRow | undefined;

    if (!row) {
      res.status(404).json({ error: "Certificate not found." });
      return;
    }

    const credentialJson = {
      certificate_id: row.certificate_id,
      student_name: row.student_name,
      student_roll_number: row.student_roll_number,
      university_name: row.university_name,
      degree: row.degree,
      department: row.department,
      academic_year: row.academic_year,
      certificate_type: row.certificate_type,
      grade: row.grade,
      issue_date: row.issue_date,
      canonical_hash: row.canonical_hash,
      tx_hash: row.tx_hash,
      network_name: row.network_name,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${row.certificate_id}.json"`
    );
    res.send(JSON.stringify(credentialJson, null, 2));
  });

  router.post(
    "/certificates/:certificate_id/revoke",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();
        const reason =
          sanitizeString(req.body?.reason, 200) || "Revoked by authorized administrator";

        const db = getDb();
        const row = db
          .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
          .get(id) as unknown as CertificateRow | undefined;

        if (!row) {
          res.status(404).json({ error: "Certificate not found." });
          return;
        }
        if (row.revoked) {
          res.status(409).json({ error: "Certificate is already revoked." });
          return;
        }

        const chainRes = await revokeCertificateOnChain(id);
        db.prepare(
          "UPDATE certificates SET revoked = 1, revoked_at = ?, revoked_reason = ? WHERE certificate_id = ?"
        ).run(chainRes.revokedAt, reason, id);

        markCertificateRevokedInSql(id, chainRes.revokedAt, reason).catch((sqlErr) => {
          console.warn("[CloudSQL] Certificate revoke sync warning:", sqlErr);
        });

        res.json({
          message: "Certificate permanently revoked on blockchain ledger.",
          certificate_id: id,
          revoked_at: chainRes.revokedAt,
          revoked_reason: reason,
          ledger_mode: chainRes.ledgerMode,
        });
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Revocation failed.",
        });
      }
    }
  );

  // --- VERIFICATION ---
  router.post("/verify/id", async (req: Request, res: Response) => {
    try {
      const certificate_id = sanitizeString(req.body?.certificate_id, 64).toUpperCase();
      const requestType =
        req.body?.source === "qr" ? "qr" : ("id" as "id" | "qr");
      const overrideFields = req.body?.fields as
        | Partial<CanonicalCertificateInput>
        | undefined;

      if (!certificate_id) {
        res.status(400).json({ error: "Certificate ID is required." });
        return;
      }

      const db = getDb();
      const dbCert = db
        .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
        .get(certificate_id) as unknown as CertificateRow | undefined;

      // Determine candidate hash from either submitted override fields (tamper test) or DB metadata
      let candidateHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (dbCert) {
        const payloadToHash: CanonicalCertificateInput = overrideFields
          ? {
              certificate_id,
              student_name:
                overrideFields.student_name ?? dbCert.student_name,
              student_roll_number:
                overrideFields.student_roll_number ?? dbCert.student_roll_number,
              university_name:
                overrideFields.university_name ?? dbCert.university_name,
              degree: overrideFields.degree ?? dbCert.degree,
              department: overrideFields.department ?? dbCert.department,
              academic_year:
                overrideFields.academic_year ?? dbCert.academic_year,
              certificate_type:
                overrideFields.certificate_type ?? dbCert.certificate_type,
              grade: overrideFields.grade ?? dbCert.grade,
              issue_date: overrideFields.issue_date ?? dbCert.issue_date,
            }
          : {
              certificate_id: dbCert.certificate_id,
              student_name: dbCert.student_name,
              student_roll_number: dbCert.student_roll_number,
              university_name: dbCert.university_name,
              degree: dbCert.degree,
              department: dbCert.department,
              academic_year: dbCert.academic_year,
              certificate_type: dbCert.certificate_type,
              grade: dbCert.grade,
              issue_date: dbCert.issue_date,
            };
        candidateHash = computeCanonicalHash(payloadToHash);
      }

      // Source of truth: always query blockchain / ledger! Never trust SQLite alone.
      const chainRecord = await verifyCertificateOnChain(certificate_id, candidateHash);

      let result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
      let explanation: string;

      if (!chainRecord.exists) {
        result = "NOT_FOUND";
        explanation =
          "Record not found: no certificate matching this ID exists on the blockchain smart contract. Unlike a tampering (hash mismatch) error, there is no registered on-chain fingerprint to compare against.";
      } else if (chainRecord.revoked) {
        result = "REVOKED";
        explanation =
          "This certificate exists on-chain, but it has been permanently revoked by an authorized administrator.";
      } else if (!dbCert || !chainRecord.hashMatches) {
        result = "TAMPERED";
        explanation =
          "Hash mismatch (tampering detected): a certificate record exists on the blockchain for this ID, but the submitted data does not match the original digital fingerprint recorded on the blockchain.";
      } else {
        result = "AUTHENTIC";
        explanation =
          "The computed SHA-256 hash matches the immutable blockchain record and the credential has not been revoked.";
      }

      logVerification(certificate_id, result, requestType, explanation);
      recordVerificationInSql({
        certificateId: certificate_id,
        verificationResult: result,
        requestType,
        statusDetail: explanation,
      }).catch((sqlErr) => {
        console.warn("[CloudSQL] Verification log sync warning:", sqlErr);
      });

      res.json({
        result,
        explanation,
        verification_method: requestType,
        certificate_id,
        hash_comparison: chainRecord.exists
          ? {
              submitted_hash: candidateHash,
              blockchain_hash: chainRecord.certificateHash,
              matches: chainRecord.hashMatches,
            }
          : null,
        blockchain: {
          exists_on_chain: chainRecord.exists,
          revoked_on_chain: chainRecord.revoked,
          issuer_address: chainRecord.issuer,
          issued_at_unix: chainRecord.issuedAt,
          tx_hash: chainRecord.txHash || dbCert?.tx_hash || null,
          block_number: chainRecord.blockNumber || dbCert?.block_number || null,
          network_name: chainRecord.networkName,
          ledger_mode: chainRecord.ledgerMode,
        },
        certificate: dbCert
          ? {
              certificate_id: dbCert.certificate_id,
              student_name: dbCert.student_name,
              university_name: dbCert.university_name,
              degree: dbCert.degree,
              department: dbCert.department,
              academic_year: dbCert.academic_year,
              certificate_type: dbCert.certificate_type,
              issue_date: dbCert.issue_date,
              revoked: chainRecord.revoked,
              revoked_at: dbCert.revoked_at,
              revoked_reason: dbCert.revoked_reason,
            }
          : null,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Verification failed.",
      });
    }
  });

  router.post(
    "/verify/upload",
    (req, res, next) => {
      upload.single("file")(req, res, (err) => {
        if (err) {
          console.warn("[verify/upload] Multer upload error:", err.message);
          res.status(400).json({ error: err.message || "Invalid file upload." });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const requestId = crypto.randomBytes(4).toString("hex");
      const startedAt = Date.now();
      try {
        if (!req.file) {
          console.warn(`[verify/upload][req:${requestId}] Rejected: no file field in multipart body`);
          res.status(400).json({ error: "Please upload a certificate file." });
          return;
        }

        if (!req.file.buffer || req.file.buffer.length === 0) {
          console.warn(
            `[verify/upload][req:${requestId}] Rejected empty file: name="${req.file.originalname}"`
          );
          res.status(400).json({ error: "Uploaded file is empty (0 bytes)." });
          return;
        }

        const headerHex = req.file.buffer.subarray(0, 8).toString("hex");
        const uploadedFileSha256 = computeFileSha256(req.file.buffer);
        const suppliedId = sanitizeString(req.body?.certificate_id, 64).toUpperCase();
        const qrPayload = sanitizeString(req.body?.qr_payload, 300) || undefined;

        console.info(
          `[verify/upload][req:${requestId}] Received file="${req.file.originalname}" size=${req.file.size}B declaredMime="${req.file.mimetype}" headerHex=${headerHex} fileSha256=${uploadedFileSha256} suppliedId="${suppliedId || "none"}" hasQrPayload=${Boolean(qrPayload)}`
        );

        const headerMagic = req.file.buffer.subarray(0, 5).toString("ascii");
        const isPdf = headerMagic === "%PDF-";
        const isPng =
          req.file.buffer.length >= 4 &&
          req.file.buffer[0] === 0x89 &&
          req.file.buffer[1] === 0x50 &&
          req.file.buffer[2] === 0x4e &&
          req.file.buffer[3] === 0x47;
        const isJpeg =
          req.file.buffer.length >= 3 &&
          req.file.buffer[0] === 0xff &&
          req.file.buffer[1] === 0xd8 &&
          req.file.buffer[2] === 0xff;
        const isZip =
          req.file.buffer.length >= 4 &&
          req.file.buffer[0] === 0x50 &&
          req.file.buffer[1] === 0x4b &&
          req.file.buffer[2] === 0x03 &&
          req.file.buffer[3] === 0x04;
        const filenameLower = req.file.originalname.toLowerCase();

        let extracted: CanonicalCertificateInput | null = null;
        let detectedHashes: string[] = [];
        let detectedUrls: string[] = [];
        let fileMetadata: Record<string, string> = {};
        let extractedTextPreview = "";
        let hasDigitalSignature = false;
        let editorWarnings: string[] = [];
        let detectedFormat = req.file.mimetype || "Binary / Document";
        let textEncoding = "binary";

        if (isPdf) {
          detectedFormat = "PDF Document";
          textEncoding = "pdf-binary";
          const pdfInfo = await extractPdfDetails(req.file.buffer);
          extracted = pdfInfo.canonical;
          detectedHashes = pdfInfo.detectedHashes;
          detectedUrls = pdfInfo.detectedUrls;
          extractedTextPreview = pdfInfo.extractedText;
          hasDigitalSignature = pdfInfo.hasDigitalSignature;
          fileMetadata = Object.fromEntries(
            Object.entries(pdfInfo.metadata).filter(([, v]) => Boolean(v))
          ) as Record<string, string>;
        } else if (isPng || isJpeg || req.file.mimetype.startsWith("image/")) {
          textEncoding = "image-binary";
          const imgInfo = inspectImageDocument(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
          );
          detectedFormat = imgInfo.detectedFormat;
          fileMetadata = imgInfo.metadata;
          detectedHashes = imgInfo.extractedHashes;
          detectedUrls = imgInfo.extractedUrls;
          editorWarnings = imgInfo.editorWarnings;
          if (imgInfo.extractedIds.length > 0) {
            extracted = {
              certificate_id: imgInfo.extractedIds[0],
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
        } else if (
          isZip &&
          (filenameLower.endsWith(".docx") ||
            req.file.mimetype.includes("wordprocessingml"))
        ) {
          textEncoding = "zip-xml";
          const docxInfo = inspectDocxDocument(req.file.buffer);
          detectedFormat = docxInfo.detectedFormat;
          fileMetadata = docxInfo.metadata;
          extractedTextPreview = docxInfo.extractedTextPreview;
          detectedHashes = docxInfo.extractedHashes;
          detectedUrls = docxInfo.extractedUrls;
          hasDigitalSignature = docxInfo.hasDigitalSignature;
          editorWarnings = docxInfo.editorWarnings;
          if (docxInfo.extractedIds.length > 0) {
            extracted = {
              certificate_id: docxInfo.extractedIds[0],
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
        } else {
          // Decode non-PDF, non-image, non-DOCX text/JSON/binary contents with BOM & UTF-16 support
          const decoded = decodeTextBuffer(req.file.buffer.subarray(0, 2 * 1024 * 1024));
          textEncoding = decoded.encoding;
          const trimmedText = decoded.text.trimStart();
          const looksJson =
            filenameLower.endsWith(".json") ||
            req.file.mimetype.includes("json") ||
            trimmedText.startsWith("{");

          let parsedJsonOk = false;
          if (looksJson) {
            detectedFormat = "JSON Credential";
            extractedTextPreview = decoded.text.slice(0, 600);
            try {
              const parsed = JSON.parse(decoded.text);
              const candidateObj =
                parsed &&
                typeof parsed === "object" &&
                parsed.certificate &&
                typeof parsed.certificate === "object"
                  ? parsed.certificate
                  : parsed;

              if (candidateObj && typeof candidateObj === "object") {
                parsedJsonOk = true;
                if (typeof candidateObj.certificate_id === "string") {
                  extracted = candidateObj as CanonicalCertificateInput;
                }
                if (typeof candidateObj.canonical_hash === "string") {
                  detectedHashes.push(candidateObj.canonical_hash.toLowerCase());
                }
              }
            } catch (jsonErr) {
              console.warn(
                `[verify/upload][req:${requestId}] JSON parse fallback (${decoded.encoding}):`,
                jsonErr instanceof Error ? jsonErr.message : String(jsonErr)
              );
            }
          }

          if (!parsedJsonOk) {
            // Scan decoded UTF-8/UTF-16/ASCII text for CERT-YYYY-XXXXXX IDs, URLs, and 0x... SHA-256 digests
            extractedTextPreview = decoded.text
              .replace(/[^\x20-\x7E\n\r\t]/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 600);
            const idMatch = decoded.text.match(/CERT-\d{4}-[A-Z0-9]{6}/i);
            if (idMatch) {
              extracted = {
                certificate_id: idMatch[0].toUpperCase(),
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
            for (const h of decoded.text.matchAll(/0x[a-fA-F0-9]{64}/g)) {
              detectedHashes.push(h[0].toLowerCase());
            }
            for (const u of decoded.text.matchAll(
              /https?:\/\/[^\s<>"{}|\\^`\[\]]{6,160}/gi
            )) {
              detectedUrls.push(u[0]);
            }
          }
        }

        const hasCompleteCanonical = Boolean(
          extracted &&
            extracted.certificate_id &&
            extracted.student_name &&
            extracted.student_roll_number &&
            extracted.university_name &&
            extracted.degree &&
            extracted.department &&
            extracted.academic_year &&
            extracted.certificate_type &&
            extracted.issue_date
        );

        console.info(
          `[verify/upload][req:${requestId}] Parsed format="${detectedFormat}" encoding=${textEncoding} extractedId="${extracted?.certificate_id || "none"}" completeCanonical=${hasCompleteCanonical} detectedHashes=${detectedHashes.length} detectedUrls=${detectedUrls.length}`
        );

        const db = getDb();
        const qrIdMatch = qrPayload
          ?.match(/CERT-\d{4}-[A-Z0-9]{6}/i)?.[0]
          ?.toUpperCase();

        const matchedByFile = db
          .prepare(
            "SELECT certificate_id FROM certificates WHERE lower(pdf_sha256) = ? OR lower(attachment_sha256) = ? OR lower(canonical_hash) = ? ORDER BY id DESC LIMIT 1"
          )
          .get(
            uploadedFileSha256.toLowerCase(),
            uploadedFileSha256.toLowerCase(),
            uploadedFileSha256.toLowerCase()
          ) as { certificate_id: string } | undefined;

        let certificateId = "";
        let idResolutionSource = "none";

        if (suppliedId) {
          certificateId = suppliedId;
          idResolutionSource = "user_supplied_id";
        } else if (matchedByFile) {
          certificateId = matchedByFile.certificate_id.toUpperCase();
          idResolutionSource = "db_exact_binary_sha256";
        } else if (extracted?.certificate_id) {
          certificateId = extracted.certificate_id.toUpperCase();
          idResolutionSource = "extracted_from_file";
        } else if (qrIdMatch) {
          certificateId = qrIdMatch;
          idResolutionSource = "qr_payload";
        } else if (detectedHashes.length > 0) {
          for (const dh of detectedHashes) {
            const matchedByHash = db
              .prepare(
                "SELECT certificate_id FROM certificates WHERE lower(canonical_hash) = ? ORDER BY id DESC LIMIT 1"
              )
              .get(dh) as { certificate_id: string } | undefined;
            if (matchedByHash) {
              certificateId = matchedByHash.certificate_id.toUpperCase();
              idResolutionSource = "db_canonical_hash";
              break;
            }
          }
        }

        console.info(
          `[verify/upload][req:${requestId}] ID resolution: certificateId="${certificateId || "NONE"}" source=${idResolutionSource}`
        );

        const extractedDetails = {
          filename: req.file.originalname,
          size_bytes: req.file.size,
          detected_format: detectedFormat,
          extracted_certificate_id: certificateId || null,
          extracted_canonical_fields:
            extracted && extracted.student_name ? extracted : null,
          extracted_hashes: Array.from(new Set(detectedHashes)),
          document_metadata:
            Object.keys(fileMetadata).length > 0 ? fileMetadata : null,
        };

        if (!certificateId) {
          const forensicReport = buildForensicSignals({
            result: "NOT_FOUND",
            exactFileMatch: false,
            isPdf,
            hasDigitalSignature,
            metadata: fileMetadata,
            extractedUrls: Array.from(new Set(detectedUrls)),
            qrPayload,
            editorWarnings,
          });
          console.info(
            `[verify/upload][req:${requestId}] Result=NOT_FOUND reason="No certificate ID or registered file SHA-256 found" durationMs=${Date.now() - startedAt}`
          );
          logVerification(
            "UNIDENTIFIED_FILE",
            "NOT_FOUND",
            "upload",
            `Uploaded file (${req.file.originalname}) has no matching record or CertiChain ID on ledger`
          );
          res.json({
            result: "NOT_FOUND",
            explanation:
              "Record not found: this file's SHA-256 fingerprint and metadata do not match any credential registered on the CertiChain blockchain ledger. Unlike a hash mismatch (tampering) error, no registered baseline record exists on-chain for this document.",
            verification_method: "upload",
            certificate_id: null,
            forensics: {
              legitimacy_label: forensicReport.legitimacy_label,
              signals: forensicReport.signals,
              extracted_text_preview: extractedTextPreview || null,
              extracted_urls: Array.from(new Set(detectedUrls)),
              qr_payload: qrPayload || null,
              has_digital_signature: hasDigitalSignature,
            },
            extracted_details: extractedDetails,
            file_integrity: {
              filename: req.file.originalname,
              mime_type: req.file.mimetype || "application/octet-stream",
              uploaded_file_sha256: uploadedFileSha256,
              exact_file_match: false,
            },
            hash_comparison: null,
            blockchain: null,
            certificate: null,
          });
          return;
        }

        const dbCert = db
          .prepare("SELECT * FROM certificates WHERE certificate_id = ?")
          .get(certificateId) as unknown as CertificateRow | undefined;

        const exactPdfMatch = Boolean(
          dbCert?.pdf_sha256 &&
            dbCert.pdf_sha256.toLowerCase() === uploadedFileSha256.toLowerCase()
        );
        const exactAttachmentMatch = Boolean(
          dbCert?.attachment_sha256 &&
            dbCert.attachment_sha256.toLowerCase() ===
              uploadedFileSha256.toLowerCase()
        );
        const exactFileMatch = exactPdfMatch || exactAttachmentMatch;

        // If the user uploaded a PNG directly, also check whether it matches the exact official CertiChain QR image
        let officialQrMatch = false;
        if (!exactFileMatch && isPng && dbCert) {
          const officialQrBuf = await generateQrPngBuffer(dbCert.certificate_id);
          const officialQrSha = computeFileSha256(officialQrBuf);
          officialQrMatch =
            officialQrSha.toLowerCase() === uploadedFileSha256.toLowerCase();
        }

        // Determine candidate hash with deterministic priority & logging:
        // 1. Exact binary match against registered PDF or registered non-PDF attachment -> verify stored canonical_hash on-chain
        // 2. Official CertiChain QR PNG exact binary match -> verify stored canonical_hash on-chain
        // 3. Complete extracted canonical fields (PDF embedded payload or JSON credential) -> recompute SHA-256
        // 4. Fallback -> raw uploaded file SHA-256 (detects tampered/altered non-PDF & external files)
        let candidateHash = uploadedFileSha256;
        let hashStrategy = "RAW_FILE_SHA256_FALLBACK";

        if (exactPdfMatch && dbCert) {
          candidateHash = dbCert.canonical_hash;
          hashStrategy = "EXACT_PDF_BINARY_MATCH";
        } else if (exactAttachmentMatch && dbCert) {
          candidateHash = dbCert.canonical_hash;
          hashStrategy = "EXACT_ATTACHMENT_BINARY_MATCH";
        } else if (officialQrMatch && dbCert) {
          candidateHash = dbCert.canonical_hash;
          hashStrategy = "OFFICIAL_QR_IMAGE_MATCH";
        } else if (hasCompleteCanonical && extracted) {
          candidateHash = computeCanonicalHash(extracted);
          hashStrategy = "EXTRACTED_CANONICAL_FIELDS";
        }

        console.info(
          `[verify/upload][req:${requestId}] Hash calculation: dbCertFound=${Boolean(dbCert)} exactPdfMatch=${exactPdfMatch} exactAttachmentMatch=${exactAttachmentMatch} officialQrMatch=${officialQrMatch} strategy=${hashStrategy} candidateHash=${candidateHash} dbCanonicalHash=${dbCert?.canonical_hash || "none"} storedAttachmentSha=${dbCert?.attachment_sha256 || "none"}`
        );

        const chainRecord = await verifyCertificateOnChain(certificateId, candidateHash);

        let result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
        let explanation: string;

        if (!chainRecord.exists) {
          result = "NOT_FOUND";
          explanation =
            "Record not found: no matching Certificate ID or registered file fingerprint exists on the blockchain ledger. Unlike a hash mismatch (tampering) error, this credential has no on-chain record to compare against.";
        } else if (chainRecord.revoked) {
          result = "REVOKED";
          explanation =
            "Not legitimate: this certificate was registered on-chain, but has been permanently revoked by an authorized administrator.";
        } else if (!chainRecord.hashMatches) {
          result = "TAMPERED";
          explanation =
            "Hash mismatch (tampering detected): the file content does not match the original digital fingerprint recorded on the blockchain. Even a single modified character, grade edit, or re-save in another editor alters the SHA-256 digest.";
        } else {
          result = "AUTHENTIC";
          explanation = exactFileMatch
            ? "Legitimate credential: exact binary SHA-256 digest of the uploaded file and the on-chain credential fingerprint both match the registered certificate."
            : officialQrMatch
            ? "Legitimate credential: uploaded QR image matches the official CertiChain verification QR code and the on-chain credential is active."
            : "Legitimate credential: canonical certificate data extracted from the uploaded file matches the immutable SHA-256 hash on the blockchain.";
        }

        console.info(
          `[verify/upload][req:${requestId}] Verdict=${result} strategy=${hashStrategy} chainExists=${chainRecord.exists} chainRevoked=${chainRecord.revoked} hashMatches=${chainRecord.hashMatches} ledgerMode=${chainRecord.ledgerMode} durationMs=${Date.now() - startedAt}`
        );

        const forensicReport = buildForensicSignals({
          result,
          exactFileMatch,
          officialQrMatch,
          isPdf,
          hasDigitalSignature,
          metadata: fileMetadata,
          extractedUrls: Array.from(new Set(detectedUrls)),
          qrPayload,
          editorWarnings,
        });

        logVerification(certificateId, result, "upload", explanation);
        recordVerificationInSql({
          certificateId,
          verificationResult: result,
          requestType: "upload",
          statusDetail: explanation,
        }).catch((sqlErr) => {
          console.warn("[CloudSQL] Upload verification sync warning:", sqlErr);
        });

        res.json({
          result,
          explanation,
          verification_method: "upload",
          certificate_id: certificateId,
          forensics: {
            legitimacy_label: forensicReport.legitimacy_label,
            signals: forensicReport.signals,
            extracted_text_preview: extractedTextPreview || null,
            extracted_urls: Array.from(new Set(detectedUrls)),
            qr_payload: qrPayload || null,
            has_digital_signature: hasDigitalSignature,
          },
          extracted_details: extractedDetails,
          file_integrity: {
            filename: req.file.originalname,
            mime_type: req.file.mimetype || "application/octet-stream",
            uploaded_file_sha256: uploadedFileSha256,
            stored_pdf_sha256: dbCert?.pdf_sha256 || null,
            stored_attachment_sha256: dbCert?.attachment_sha256 || null,
            exact_file_match: exactFileMatch,
          },
          hash_comparison: chainRecord.exists
            ? {
                submitted_hash: candidateHash,
                blockchain_hash: chainRecord.certificateHash,
                matches: chainRecord.hashMatches,
              }
            : null,
          blockchain: {
            exists_on_chain: chainRecord.exists,
            revoked_on_chain: chainRecord.revoked,
            issuer_address: chainRecord.issuer,
            issued_at_unix: chainRecord.issuedAt,
            tx_hash: chainRecord.txHash || dbCert?.tx_hash || null,
            block_number: chainRecord.blockNumber || dbCert?.block_number || null,
            network_name: chainRecord.networkName,
            ledger_mode: chainRecord.ledgerMode,
          },
          certificate: dbCert
            ? {
                certificate_id: dbCert.certificate_id,
                student_name: dbCert.student_name,
                university_name: dbCert.university_name,
                degree: dbCert.degree,
                department: dbCert.department,
                academic_year: dbCert.academic_year,
                certificate_type: dbCert.certificate_type,
                issue_date: dbCert.issue_date,
                revoked: chainRecord.revoked,
              }
            : null,
        });
      } catch (err) {
        console.error(
          `[verify/upload][req:${requestId}] Unhandled verification error:`,
          err instanceof Error ? err.stack || err.message : err
        );
        res.status(500).json({
          error: err instanceof Error ? err.message : "File verification failed.",
        });
      }
    }
  );

  router.get("/verify/history", requireAdmin, (req: Request, res: Response) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, certificate_id, verification_result, request_type, status_detail, created_at FROM verification_logs ORDER BY id DESC LIMIT ?"
      )
      .all(limit);
    res.json({ items: rows });
  });

  // --- BLOCKCHAIN STATUS & LOOKUP ---
  router.get("/blockchain/status", async (_req: Request, res: Response) => {
    try {
      const status = await getBlockchainStatus();
      res.json(status);
    } catch (err) {
      res.status(503).json({
        error: err instanceof Error ? err.message : "Blockchain status unavailable",
      });
    }
  });

  router.get(
    "/blockchain/certificate/:certificate_id",
    async (req: Request, res: Response) => {
      try {
        const id = sanitizeString(req.params.certificate_id, 64).toUpperCase();
        const db = getDb();
        const dbCert = db
          .prepare("SELECT canonical_hash FROM certificates WHERE certificate_id = ?")
          .get(id) as { canonical_hash: string } | undefined;

        const record = await verifyCertificateOnChain(
          id,
          dbCert?.canonical_hash ||
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
        res.json(record);
      } catch (err) {
        res.status(500).json({
          error: err instanceof Error ? err.message : "Blockchain lookup failed.",
        });
      }
    }
  );

  // --- OPENAPI / SWAGGER ---
  router.get("/docs/openapi.json", (_req: Request, res: Response) => {
    res.json({
      openapi: "3.0.3",
      info: {
        title: "CertiChain Decentralized Certificate Verification API",
        version: "1.0.0",
        description:
          "REST API for academic credential issuance, SHA-256 hashing, Solidity smart contract anchoring, PDF/QR generation, and public verification.",
      },
      paths: {
        "/api/auth/login": { post: { summary: "Admin login (JWT)" } },
        "/api/auth/logout": { post: { summary: "Logout session" } },
        "/api/auth/me": { get: { summary: "Current authenticated admin" } },
        "/api/certificates": {
          get: { summary: "Search and filter certificate registry" },
          post: { summary: "Issue new certificate (Admin)" },
        },
        "/api/certificates/{certificate_id}": {
          get: { summary: "Retrieve certificate metadata" },
        },
        "/api/certificates/{certificate_id}/pdf": {
          get: { summary: "Download generated PDF certificate" },
        },
        "/api/certificates/{certificate_id}/qr": {
          get: { summary: "Retrieve certificate QR code PNG" },
        },
        "/api/certificates/{certificate_id}/revoke": {
          post: { summary: "Revoke certificate on blockchain (Admin)" },
        },
        "/api/verify/id": {
          post: { summary: "Verify certificate by ID and/or submitted fields" },
        },
        "/api/verify/upload": {
          post: { summary: "Verify uploaded PDF certificate" },
        },
        "/api/verify/history": {
          get: { summary: "Retrieve verification audit logs (Admin)" },
        },
        "/api/blockchain/status": {
          get: { summary: "Blockchain RPC and Solidity compiler status" },
        },
        "/api/blockchain/certificate/{certificate_id}": {
          get: { summary: "Inspect on-chain / ledger record" },
        },
        "/api/auth/firebase-session": {
          post: { summary: "Verify Firebase Google Sign-In token and sync user to Cloud SQL" },
        },
        "/api/gemini/chat": {
          post: { summary: "Multi-turn Gemini chatbot with role presets and optional Google Search Grounding" },
        },
        "/api/gemini/search-verify": {
          post: { summary: "Google Search Grounding credential authority lookup using gemini-4-hydrogen" },
        },
      },
    });
  });

  // --- GEMINI MULTI-TURN CHATBOT & GOOGLE SEARCH GROUNDING ---
  router.post(
    "/gemini/chat",
    optionalFirebaseAuth,
    async (req: FirebaseAuthRequest, res: Response) => {
      try {
        const message =
          typeof req.body?.message === "string" ? req.body.message.trim() : "";
        if (!message) {
          res.status(400).json({ error: "Message text is required." });
          return;
        }
        if (message.length > 8000) {
          res
            .status(400)
            .json({ error: "Message exceeds 8000 character limit." });
          return;
        }

        const rolePreset = (
          ["general", "reasoning", "interactive", "fast"].includes(
            req.body?.rolePreset
          )
            ? req.body.rolePreset
            : "general"
        ) as ChatRolePreset;

        const useSearchGrounding = Boolean(req.body?.useSearchGrounding);
        const history = Array.isArray(req.body?.history)
          ? (req.body.history as ChatTurnInput[])
          : [];
        const certificateContext =
          typeof req.body?.certificateContext === "string"
            ? req.body.certificateContext
            : undefined;
        const sessionKey =
          typeof req.body?.sessionKey === "string" &&
          req.body.sessionKey.trim().length > 0
            ? req.body.sessionKey.trim().slice(0, 128)
            : `session-${crypto.randomBytes(6).toString("hex")}`;

        const chatResult = await runMultiTurnGeminiChat({
          message,
          history,
          rolePreset,
          useSearchGrounding,
          certificateContext,
        });

        if (req.firebaseUser?.uid && req.firebaseUser?.email) {
          persistChatTurnInSql({
            sessionKey,
            userUid: req.firebaseUser.uid,
            userEmail: req.firebaseUser.email,
            userDisplayName:
              typeof req.firebaseUser.name === "string"
                ? req.firebaseUser.name
                : undefined,
            title: message.slice(0, 80),
            rolePreset: chatResult.rolePreset,
            model: chatResult.model,
            userMessage: message,
            assistantReply: chatResult.reply,
            sourcesJson: JSON.stringify(chatResult.sources),
          }).catch((sqlErr) => {
            console.warn("[CloudSQL] Chat turn sync warning:", sqlErr);
          });
        }

        res.json({
          sessionKey,
          ...chatResult,
        });
      } catch (err) {
        const status =
          typeof (err as { status?: number })?.status === "number"
            ? (err as { status: number }).status
            : 500;
        res.status(status).json({
          error:
            err instanceof Error
              ? err.message
              : "Failed to generate Gemini chat response.",
        });
      }
    }
  );

  router.post("/gemini/search-verify", async (req: Request, res: Response) => {
    try {
      const query =
        typeof req.body?.query === "string" ? req.body.query.trim() : "";
      if (!query) {
        res.status(400).json({ error: "Search verification query is required." });
        return;
      }

      const institution =
        typeof req.body?.institution === "string"
          ? req.body.institution.trim().slice(0, 200)
          : undefined;
      const certificateId =
        typeof req.body?.certificateId === "string"
          ? req.body.certificateId.trim().slice(0, 64)
          : undefined;
      const extractedUrls = Array.isArray(req.body?.extractedUrls)
        ? req.body.extractedUrls
            .filter((u: unknown): u is string => typeof u === "string")
            .slice(0, 10)
        : undefined;

      const lookupResult = await runSearchGroundedVerificationLookup({
        query: query.slice(0, 1000),
        institution,
        certificateId,
        extractedUrls,
      });

      res.json(lookupResult);
    } catch (err) {
      const status =
        typeof (err as { status?: number })?.status === "number"
          ? (err as { status: number }).status
          : 500;
      res.status(status).json({
        error:
          err instanceof Error
            ? err.message
            : "Google Search grounding lookup failed.",
      });
    }
  });

  return router;
}
