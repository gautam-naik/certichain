import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default("CertiChain User"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certificateId: text("certificate_id").notNull().unique(),
  studentName: text("student_name").notNull(),
  studentRollNumber: text("student_roll_number").notNull(),
  universityName: text("university_name").notNull(),
  degree: text("degree").notNull(),
  department: text("department").notNull(),
  academicYear: text("academic_year").notNull(),
  certificateType: text("certificate_type").notNull(),
  grade: text("grade").notNull().default("N/A"),
  issueDate: text("issue_date").notNull(),
  canonicalHash: text("canonical_hash").notNull(),
  pdfSha256: text("pdf_sha256").notNull().default(""),
  attachmentSha256: text("attachment_sha256").notNull().default(""),
  attachmentFilename: text("attachment_filename").notNull().default(""),
  attachmentMime: text("attachment_mime").notNull().default(""),
  txHash: text("tx_hash").notNull(),
  blockNumber: integer("block_number").notNull().default(0),
  networkName: text("network_name").notNull(),
  issuerAddress: text("issuer_address").notNull(),
  ledgerMode: text("ledger_mode").notNull().default("demo"),
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: text("revoked_at"),
  revokedReason: text("revoked_reason"),
  issuedByUid: text("issued_by_uid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationLogs = pgTable("verification_logs", {
  id: serial("id").primaryKey(),
  certificateId: text("certificate_id").notNull(),
  verificationResult: text("verification_result").notNull(),
  requestType: text("request_type").notNull(),
  statusDetail: text("status_detail").notNull(),
  verifierUid: text("verifier_uid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionKey: text("session_key").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  userUid: text("user_uid").notNull(),
  title: text("title").notNull(),
  rolePreset: text("role_preset").notNull().default("general"),
  model: text("model").notNull().default("gemini-4-hydrogen"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => chatSessions.id)
    .notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model").notNull().default("gemini-4-hydrogen"),
  sourcesJson: text("sources_json").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));
