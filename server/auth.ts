import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.ts";
import { getDb } from "./db.ts";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signJwt(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] }
  );
}

export function authenticateCredentials(
  email: string,
  password: string
): AuthUser | null {
  const db = getDb();
  const user = db
    .prepare("SELECT id, email, name, role, password_hash FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as
    | {
        id: number;
        email: string;
        name: string;
        role: "admin";
        password_hash: string;
      }
    | undefined;

  if (!user) return null;
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function extractOptionalUser(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as unknown as {
      sub: number;
      email: string;
      name: string;
      role: "admin";
    };
    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = extractOptionalUser(req);
  if (!user || user.role !== "admin") {
    res.status(401).json({ error: "Unauthorized. Administrator login required." });
    return;
  }
  req.user = user;
  next();
}
