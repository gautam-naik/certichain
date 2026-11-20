import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { config } from "./config.ts";
import { computeCanonicalHash, computeCertificateIdHash } from "./crypto.ts";

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : config.databasePath;
  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id TEXT NOT NULL UNIQUE,
      student_name TEXT NOT NULL,
      student_roll_number TEXT NOT NULL,
      university_name TEXT NOT NULL,
      degree TEXT NOT NULL,
      department TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      certificate_type TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT 'N/A',
      issue_date TEXT NOT NULL,
      canonical_hash TEXT NOT NULL,
      pdf_sha256 TEXT NOT NULL DEFAULT '',
      attachment_sha256 TEXT NOT NULL DEFAULT '',
      attachment_filename TEXT NOT NULL DEFAULT '',
      attachment_mime TEXT NOT NULL DEFAULT '',
      tx_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL DEFAULT 0,
      network_name TEXT NOT NULL,
      issuer_address TEXT NOT NULL,
      ledger_mode TEXT NOT NULL DEFAULT 'demo',
      revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at TEXT,
      revoked_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id TEXT NOT NULL,
      verification_result TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status_detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS demo_onchain_ledger (
      certificate_id_hash TEXT PRIMARY KEY,
      certificate_id TEXT NOT NULL UNIQUE,
      certificate_hash TEXT NOT NULL,
      issuer TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      exists_flag INTEGER NOT NULL DEFAULT 1,
      revoked INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER,
      tx_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL
    );
  `);

  const existingCols = (
    dbInstance.prepare("PRAGMA table_info(certificates)").all() as Array<{ name: string }>
  ).map((c) => c.name);
  for (const col of [
    ["attachment_sha256", "TEXT NOT NULL DEFAULT ''"],
    ["attachment_filename", "TEXT NOT NULL DEFAULT ''"],
    ["attachment_mime", "TEXT NOT NULL DEFAULT ''"],
  ] as const) {
    if (!existingCols.includes(col[0])) {
      dbInstance.exec(`ALTER TABLE certificates ADD COLUMN ${col[0]} ${col[1]};`);
    }
  }

  seedInitialData(dbInstance);
  return dbInstance;
}

function seedInitialData(db: DatabaseSync): void {
  const adminRow = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(config.adminEmail.toLowerCase());

  if (!adminRow) {
    const hash = bcrypt.hashSync(config.adminPassword, 10);
    db.prepare(
      "INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?, ?, 'admin', ?, ?)"
    ).run(
      config.adminEmail.toLowerCase(),
      config.adminName,
      hash,
      new Date().toISOString()
    );
  }

  const certCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM certificates")
    .get() as { cnt: number };

  if (certCountRow.cnt === 0) {
    const demoIssuer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const samples = [
      {
        certificate_id: "CERT-2026-A104F2",
        student_name: "Aarav Sharma",
        student_roll_number: "CS2022041",
        university_name: "National Institute of Technology & Computing",
        degree: "B.Tech in Computer Science & Engineering",
        department: "Computer Science",
        academic_year: "2022-2026",
        certificate_type: "Degree Certificate",
        grade: "9.24 CGPA",
        issue_date: "2026-06-15",
        revoked: 0,
        daysAgo: 28,
      },
      {
        certificate_id: "CERT-2026-B782C9",
        student_name: "Maya Lin",
        student_roll_number: "EE2022108",
        university_name: "National Institute of Technology & Computing",
        degree: "M.Sc in Distributed Systems & Cryptography",
        department: "Information Security",
        academic_year: "2024-2026",
        certificate_type: "Postgraduate Honours",
        grade: "9.61 CGPA",
        issue_date: "2026-07-02",
        revoked: 0,
        daysAgo: 14,
      },
      {
        certificate_id: "CERT-2026-C309D1",
        student_name: "Rohan Deshmukh",
        student_roll_number: "ME2021019",
        university_name: "Pacific Polytechnic University",
        degree: "B.Eng in Mechanical Automation",
        department: "Mechanical Engineering",
        academic_year: "2021-2025",
        certificate_type: "Provisional Degree",
        grade: "8.10 CGPA",
        issue_date: "2026-05-10",
        revoked: 1,
        daysAgo: 40,
      },
    ];

    samples.forEach((item, idx) => {
      const canonicalHash = computeCanonicalHash(item);
      const idHash = computeCertificateIdHash(item.certificate_id);
      const txHash =
        "0x" +
        crypto
          .createHash("sha256")
          .update(`demo-seed-tx:${item.certificate_id}:${canonicalHash}`)
          .digest("hex");
      const blockNumber = 1001 + idx;
      const createdAt = new Date(
        Date.now() - item.daysAgo * 24 * 60 * 60 * 1000
      ).toISOString();
      const issuedUnix = Math.floor(new Date(createdAt).getTime() / 1000);
      const revokedAt = item.revoked
        ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      db.prepare(`
        INSERT INTO certificates (
          certificate_id, student_name, student_roll_number, university_name,
          degree, department, academic_year, certificate_type, grade, issue_date,
          canonical_hash, pdf_sha256, tx_hash, block_number, network_name,
          issuer_address, ledger_mode, revoked, revoked_at, revoked_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 'Demo Ledger (Hardhat RPC Offline)', ?, 'demo', ?, ?, ?, ?)
      `).run(
        item.certificate_id,
        item.student_name,
        item.student_roll_number,
        item.university_name,
        item.degree,
        item.department,
        item.academic_year,
        item.certificate_type,
        item.grade,
        item.issue_date,
        canonicalHash,
        txHash,
        blockNumber,
        demoIssuer,
        item.revoked,
        revokedAt,
        item.revoked ? "Academic record superseded by updated transcript" : null,
        createdAt
      );

      db.prepare(`
        INSERT INTO demo_onchain_ledger (
          certificate_id_hash, certificate_id, certificate_hash, issuer,
          issued_at, exists_flag, revoked, revoked_at, tx_hash, block_number
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        idHash,
        item.certificate_id,
        canonicalHash,
        demoIssuer,
        issuedUnix,
        item.revoked,
        item.revoked ? Math.floor(Date.now() / 1000) - 432000 : null,
        txHash,
        blockNumber
      );
    });

    const sampleLogs = [
      ["CERT-2026-A104F2", "AUTHENTIC", "id", "Hash matched demo ledger record", 6],
      ["CERT-2026-B782C9", "AUTHENTIC", "qr", "QR scan verified against ledger", 4],
      ["CERT-2026-C309D1", "REVOKED", "id", "Certificate marked revoked on ledger", 3],
      ["CERT-2026-A104F2", "TAMPERED", "upload", "Uploaded PDF hash mismatch detected", 2],
      ["CERT-2026-999999", "NOT_FOUND", "id", "No matching record on ledger", 1],
    ] as const;

    for (const [cid, result, reqType, detail, days] of sampleLogs) {
      db.prepare(
        "INSERT INTO verification_logs (certificate_id, verification_result, request_type, status_detail, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(
        cid,
        result,
        reqType,
        detail,
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      );
    }
  }
}
