import { eq } from "drizzle-orm";
import { db, isCloudSqlConfigured } from "./index.ts";
import { users } from "./schema.ts";

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  if (!isCloudSqlConfigured()) {
    return null;
  }
  try {
    const cleanName = displayName?.trim() || email.split("@")[0] || "CertiChain User";
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: cleanName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: cleanName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database query failed in getOrCreateUser:", error);
    throw new Error("Database query failed. Please try again later.", {
      cause: error,
    });
  }
}

export async function getUserByUid(uid: string) {
  if (!isCloudSqlConfigured()) {
    return null;
  }
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("Database query failed in getUserByUid:", error);
    throw new Error("Database query failed. Please try again later.", {
      cause: error,
    });
  }
}
