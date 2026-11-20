import { NextFunction, Request, Response } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../lib/firebase-admin.ts";
import { getOrCreateUser } from "../db/users.ts";

export interface FirebaseAuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
}

export const requireFirebaseAuth = async (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Firebase ID token" });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Empty Firebase ID token" });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decodedToken;

    if (decodedToken.email) {
      await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email,
        typeof decodedToken.name === "string" ? decodedToken.name : undefined
      ).catch((err) => {
        console.warn("Non-fatal Cloud SQL user sync warning:", err);
      });
    }

    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid Firebase ID token" });
  }
};

export const optionalFirebaseAuth = async (
  req: FirebaseAuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (token) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.firebaseUser = decodedToken;
      } catch {
        // Ignore non-Firebase JWT (e.g., local admin JWT) on optional endpoints
      }
    }
  }
  next();
};
