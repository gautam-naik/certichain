import { desc, eq } from "drizzle-orm";
import { db, isCloudSqlConfigured } from "./index.ts";
import {
  certificates,
  chatMessages,
  chatSessions,
  users,
  verificationLogs,
} from "./schema.ts";

export async function upsertCertificateInSql(input: {
  certificateId: string;
  studentName: string;
  studentRollNumber: string;
  universityName: string;
  degree: string;
  department: string;
  academicYear: string;
  certificateType: string;
  grade: string;
  issueDate: string;
  canonicalHash: string;
  pdfSha256: string;
  attachmentSha256: string;
  attachmentFilename: string;
  attachmentMime: string;
  txHash: string;
  blockNumber: number;
  networkName: string;
  issuerAddress: string;
  ledgerMode: string;
  issuedByUid?: string;
}) {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await db
      .insert(certificates)
      .values({
        certificateId: input.certificateId,
        studentName: input.studentName,
        studentRollNumber: input.studentRollNumber,
        universityName: input.universityName,
        degree: input.degree,
        department: input.department,
        academicYear: input.academicYear,
        certificateType: input.certificateType,
        grade: input.grade,
        issueDate: input.issueDate,
        canonicalHash: input.canonicalHash,
        pdfSha256: input.pdfSha256,
        attachmentSha256: input.attachmentSha256,
        attachmentFilename: input.attachmentFilename,
        attachmentMime: input.attachmentMime,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
        networkName: input.networkName,
        issuerAddress: input.issuerAddress,
        ledgerMode: input.ledgerMode,
        revoked: false,
        issuedByUid: input.issuedByUid ?? null,
      })
      .onConflictDoUpdate({
        target: certificates.certificateId,
        set: {
          pdfSha256: input.pdfSha256,
          txHash: input.txHash,
          blockNumber: input.blockNumber,
        },
      })
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error("Database query failed in upsertCertificateInSql:", error);
    throw new Error("Database write failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function markCertificateRevokedInSql(
  certificateId: string,
  revokedAt: string,
  revokedReason: string
) {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await db
      .update(certificates)
      .set({
        revoked: true,
        revokedAt,
        revokedReason,
      })
      .where(eq(certificates.certificateId, certificateId))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error("Database query failed in markCertificateRevokedInSql:", error);
    throw new Error("Database update failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function recordVerificationInSql(input: {
  certificateId: string;
  verificationResult: string;
  requestType: string;
  statusDetail: string;
  verifierUid?: string;
}) {
  if (!isCloudSqlConfigured()) return null;
  try {
    const rows = await db
      .insert(verificationLogs)
      .values({
        certificateId: input.certificateId,
        verificationResult: input.verificationResult,
        requestType: input.requestType,
        statusDetail: input.statusDetail,
        verifierUid: input.verifierUid ?? null,
      })
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error("Database query failed in recordVerificationInSql:", error);
    throw new Error("Database write failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function getUserVerificationsFromSql(uid: string) {
  if (!isCloudSqlConfigured()) return [];
  try {
    return await db
      .select()
      .from(verificationLogs)
      .where(eq(verificationLogs.verifierUid, uid))
      .orderBy(desc(verificationLogs.createdAt))
      .limit(50);
  } catch (error) {
    console.error("Database query failed in getUserVerificationsFromSql:", error);
    throw new Error("Database query failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function persistChatTurnInSql(input: {
  sessionKey: string;
  userUid: string;
  userEmail: string;
  userDisplayName?: string;
  title: string;
  rolePreset: string;
  model: string;
  userMessage: string;
  assistantReply: string;
  sourcesJson: string;
}) {
  if (!isCloudSqlConfigured()) return null;
  try {
    const cleanName =
      input.userDisplayName?.trim() ||
      input.userEmail.split("@")[0] ||
      "CertiChain User";

    const [userRow] = await db
      .insert(users)
      .values({
        uid: input.userUid,
        email: input.userEmail,
        displayName: cleanName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.userEmail,
          displayName: cleanName,
          updatedAt: new Date(),
        },
      })
      .returning();

    const [sessionRow] = await db
      .insert(chatSessions)
      .values({
        sessionKey: input.sessionKey,
        userId: userRow.id,
        userUid: input.userUid,
        title: input.title.slice(0, 120),
        rolePreset: input.rolePreset,
        model: input.model,
      })
      .onConflictDoUpdate({
        target: chatSessions.sessionKey,
        set: {
          rolePreset: input.rolePreset,
          model: input.model,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db.insert(chatMessages).values([
      {
        sessionId: sessionRow.id,
        role: "user",
        content: input.userMessage,
        model: input.model,
        sourcesJson: "[]",
      },
      {
        sessionId: sessionRow.id,
        role: "model",
        content: input.assistantReply,
        model: input.model,
        sourcesJson: input.sourcesJson,
      },
    ]);

    return sessionRow;
  } catch (error) {
    console.error("Database query failed in persistChatTurnInSql:", error);
    throw new Error("Database query failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function getUserChatSessionsFromSql(uid: string) {
  if (!isCloudSqlConfigured()) return [];
  try {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userUid, uid))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(20);
  } catch (error) {
    console.error("Database query failed in getUserChatSessionsFromSql:", error);
    throw new Error("Database query failed. Please try again later.", {
      cause: error,
    });
  }
}
