import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  jwtSecret:
    process.env.JWT_SECRET || "certichain-dev-secret-change-in-production-2026",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  adminEmail: process.env.ADMIN_EMAIL || "admin@certichain.edu",
  adminPassword: process.env.ADMIN_PASSWORD || "CertiChain@2026",
  adminName: process.env.ADMIN_NAME || "Dr. Elena Vance (Registrar)",
  databasePath: path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH || "./certichain.db"
  ),
  blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545",
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || "",
  strictBlockchainMode: process.env.STRICT_BLOCKCHAIN_MODE === "true",
};
