# CertiChain — Decentralized Academic Certificate Verification System

CertiChain is an end-to-end academic credential issuance, verification, and forensic auditing platform combining **Ethereum Solidity smart contracts (`CertificateRegistry.sol`)**, **deterministic SHA-256 hashing**, **multi-format document forensics**, **Cloud SQL (PostgreSQL) with Drizzle ORM**, and **Google Search Grounding** for external authority verification.

---

## Table of Contents
1. [Problem & Solution](#1-problem--solution)
2. [Core Capabilities](#2-core-capabilities)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Getting Started](#6-getting-started)
7. [Environment Variables](#7-environment-variables)
8. [Blockchain & Smart Contract Workflow](#8-blockchain--smart-contract-workflow)
9. [API Endpoints](#9-api-endpoints)
10. [Testing & Verification](#10-testing--verification)
11. [Demo Credentials & Sample Records](#11-demo-credentials--sample-records)

---

## 1. Problem & Solution

Traditional paper and centralized PDF academic certificates suffer from forgery, grade alteration, slow manual registrar verification, and single-point-of-failure storage.

CertiChain solves this by:
- Computing canonical SHA-256 fingerprints (`bytes32`) over normalized credential metadata and optional attached original files.
- Anchoring only privacy-preserving cryptographic hashes, certificate IDs, issuer addresses, timestamps, and revocation flags on-chain (keeping sensitive student PII off public ledgers).
- Enabling anyone—employers, universities, or students—to verify authenticity in seconds via Certificate ID, file upload (in any format), or QR code scan.

---

## 2. Core Capabilities

### Blockchain & Credential Lifecycle
- **Authorized Issuance Portal (`/admin/issue`)**: Role-protected registrar workflow supporting standard degrees as well as custom certificate types, optional original file attachments (any format up to 25 MB), automatic `CERT-YYYY-XXXXXX` ID generation, and smart-contract anchoring.
- **Automated PDF, QR & JSON Artifacts**: Generates verifiable A4 PDF certificates (`pdf-lib`), high-contrast QR PNG codes (`qrcode`), and canonical JSON credential exports.
- **On-Chain Revocation & Audit Trail**: Permanent revocation recorded on-chain and logged in verification history (`/admin/history`), plus live Recharts analytics on `/admin`.

### Multi-Format Public Verification & Forensics (`/verify`)
- **Three Verification Modes**:
  1. **Certificate ID Lookup**: Queries the blockchain ledger and supports optional field tamper simulation.
  2. **Unrestricted File Upload (`POST /api/verify/upload`)**: Accepts PDF, PNG, JPG, JSON, DOCX, TXT, UTF-16, and arbitrary binary formats. Inspects exact binary SHA-256 matches, embedded CertiChain JSON/metadata payloads, official QR PNG matches, PDF FlateDecode streams, PKCS#7 `/ByteRange` digital signatures, and editor/tampering signals.
  3. **QR Code Scanner**: Supports live browser camera scanning and uploaded QR image decoding via `jsQR`.
- **Clear Four-State Verdicts**: `AUTHENTIC`, `TAMPERED`, `REVOKED`, and `NOT_FOUND` with side-by-side SHA-256 hash comparison and forensic breakdown.

### Cloud Persistence
- **Cloud SQL (PostgreSQL) + Drizzle ORM**: Relational schema (`users`, `certificates`, `verification_logs`) managed via Drizzle Kit (`src/db/schema.ts`) and lazy `pg.Pool` connection pooling.

### External Issuing Authority Search Grounding
- **Google Search Grounding (`gemini-4-hydrogen` + `googleSearch`)**: Integrated directly into `/verify` to verify external issuing institutions (e.g., university registrars, MOOC portals like NPTEL) against live web citations.

---

## 3. System Architecture

```text
ADMIN / PUBLIC ──► REACT + VITE FRONTEND (Port 3000)
                      └──► Express API Server (server.ts)
                             ├──► @google/genai (Google Search Grounding on /verify)
                             ├──► Drizzle ORM + pg.Pool ──► Cloud SQL (PostgreSQL)
                             ├──► SQLite (Local Ledger & Offline Fallback)
                             └──► SHA-256 + Ethers.js v6 ──► CertificateRegistry.sol (EVM / Demo Ledger)
```

---

## 4. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Recharts, Lucide React, `jsQR` |
| **Backend Server** | Node.js, Express, TypeScript (`tsx`), Multer, `pdf-lib`, `qrcode`, `bcryptjs`, `jsonwebtoken` |
| **Blockchain** | Solidity `^0.8.20`, `solc`, Hardhat, `ethers` v6, MetaMask (`window.ethereum`) |
| **Relational DB** | Cloud SQL for PostgreSQL, `drizzle-orm`, `drizzle-kit`, `pg` |
| **Auth & NoSQL** | Firebase Authentication (Google Sign-In), Cloud Firestore, `firebase-admin` |
| **AI & Grounding** | `@google/genai` (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`, `googleSearch` tool) |
| **Optional Python Ref** | FastAPI, Pydantic, SQLAlchemy, Web3.py, ReportLab (`/backend`) |

---

## 5. Project Structure

```text
.
├── server.ts                     # Main Express + Vite entry point (port 3000)
├── server/                       # Backend modules (routes, crypto, pdf, forensics, blockchain, gemini)
├── src/
│   ├── components/               # Layouts, VerificationResultCard, QrScanner, GeminiChatbotDrawer, ErrorBoundary
│   ├── context/                  # FirebaseContext (Google Sign-In, Firestore listeners & mutations)
│   ├── db/                       # Drizzle PostgreSQL schema, drizzle.config.ts, pg.Pool, query helpers
│   ├── lib/                      # Firebase client SDK & Admin SDK initialization
│   ├── middleware/               # Firebase ID token verification middleware
│   ├── pages/                    # Landing, Login, Verify, Registry, Details, Admin Dashboard/Issue/History
│   └── services/                 # API client & MetaMask wallet helpers
├── blockchain/                   # Solidity CertificateRegistry.sol, Hardhat config & deploy scripts
├── backend/                      # Reference Python FastAPI backend
├── tests/                        # Full-stack integration & cryptography test suite
├── firebase-blueprint.json       # Firestore entity & path blueprint
├── firestore.rules               # Hardened Firestore security rules
└── firestore.rules.test.ts       # Security rules verification tests
```

---

## 6. Getting Started

### Prerequisites
- **Node.js** `v20+` (`v22+` recommended) & **npm** `v10+`
- **MetaMask** (optional, for connecting a browser wallet to Hardhat `localhost:8545`)
- **Docker** (optional, via `docker-compose.yml`)

### Installation & Local Development
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start the integrated full-stack server (port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

For production builds:
```bash
npm run build
npm start
```

---

## 7. Environment Variables

See `.env.example` for server configuration keys:
- `PORT` (default `3000`) and `APP_URL`
- `GEMINI_API_KEY` — Server-side Gemini API key (never exposed to client bundles)
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — Registrar admin authentication
- `DATABASE_PATH` — Local SQLite file path (`./certichain.db`)
- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` — Runtime and Drizzle Kit variables for Cloud SQL (PostgreSQL)
- `BLOCKCHAIN_RPC_URL`, `CONTRACT_ADDRESS`, `BLOCKCHAIN_PRIVATE_KEY` — Optional Ethereum / Hardhat JSON-RPC node configuration

---

## 8. Blockchain & Smart Contract Workflow

If running a local Ethereum-compatible Hardhat node alongside CertiChain:

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat node
```

In a second terminal, deploy `CertificateRegistry.sol`:
```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

Set the resulting `CONTRACT_ADDRESS` and Hardhat development private key in `.env`. When no local Hardhat RPC node is active on `:8545`, CertiChain automatically runs in clearly labelled **Demo Ledger Mode** using compiled Solidity ABI hashing and local persistence rather than faking live on-chain RPC transactions.

---

## 9. API Endpoints

Interactive OpenAPI documentation is available at `/api/docs` and `/api/docs/openapi.json`.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Registrar administrator JWT login |
| `/api/auth/firebase-session` | `POST` | Verify Firebase Google Sign-In ID token & sync user |
| `/api/certificates` | `GET` / `POST` | Search registry or issue & anchor a new certificate (Admin) |
| `/api/certificates/:id/pdf` | `GET` | Download generated A4 PDF certificate (supports `?tamper_demo=true`) |
| `/api/certificates/:id/qr` | `GET` | Download verification QR PNG |
| `/api/certificates/:id/json` | `GET` | Export canonical credential JSON |
| `/api/certificates/:id/revoke` | `POST` | Permanently revoke certificate on ledger (Admin) |
| `/api/verify/id` | `POST` | Verify certificate by ID or modified fields |
| `/api/verify/upload` | `POST` | Verify uploaded file in any format + run document forensics |
| `/api/blockchain/status` | `GET` | Inspect Solidity compiler and blockchain network mode |
| `/api/gemini/chat` | `POST` | Multi-turn Gemini chatbot with role presets & Search Grounding |
| `/api/gemini/search-verify` | `POST` | Verify external institutions & portals via Google Search Grounding |

---

## 10. Testing & Verification

```bash
# TypeScript typecheck & production Vite build
npm run lint
npm run build

# Full-stack API, Solidity, cryptography, PDF/QR, tampering & Firestore rules tests
npx tsx --test tests/certichain.test.ts firestore.rules.test.ts

# Lint Firestore security rules
npx eslint firestore.rules

# Smart contract unit tests (inside /blockchain)
cd blockchain && npx hardhat test
```

---

## 11. Demo Credentials & Sample Records

- **Registrar Login (`/login`)**:
  - **Email**: `admin@certichain.edu`
  - **Password**: `CertiChain@2026` *(configured via `ADMIN_PASSWORD`)*
- **Seeded Sample Certificate IDs**:
  - `CERT-2026-A104F2` — Authentic / Active
  - `CERT-2026-B782C9` — Authentic / Active
  - `CERT-2026-C309D1` — Revoked
