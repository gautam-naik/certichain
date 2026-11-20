# CertiChain REST API Documentation

Base URL: `http://localhost:3000/api` (Express integrated server) or `http://localhost:8000/api` (FastAPI standalone).
Interactive OpenAPI JSON: `GET /api/docs/openapi.json` and HTML viewer: `GET /api/docs`.

## Authentication
- `POST /api/auth/login` — Authenticates an administrator with email and password; returns a signed JWT (`Bearer`).
- `POST /api/auth/logout` — Terminates client session.
- `GET /api/auth/me` — Returns current authenticated admin profile (`Authorization: Bearer <token>` required).

## Certificates
- `POST /api/certificates` *(Admin)* — Validates inputs, generates unique `CERT-YYYY-XXXXXX`, computes SHA-256 hash, anchors on `CertificateRegistry.sol`, stores metadata in SQLite, returns certificate & Tx hash.
- `GET /api/certificates` — Search and filter by `q`, `course`, `university`, `status`, `dateFrom`, `dateTo`, `page`, `limit`. Private fields (`student_roll_number`, `grade`) are omitted unless authenticated as Admin.
- `GET /api/certificates/{certificate_id}` — Returns certificate details (with PII masking for public callers).
- `GET /api/certificates/{certificate_id}/pdf` — Streams generated PDF certificate (`?tamper_demo=true` generates an altered PDF for tampering detection tests).
- `GET /api/certificates/{certificate_id}/qr` — Streams 320x320 PNG QR code resolving to `/verify?id={certificate_id}`.
- `POST /api/certificates/{certificate_id}/revoke` *(Admin)* — Permanently marks credential revoked on smart contract & SQLite.

## Verification
- `POST /api/verify/id` — Verifies by `certificate_id` and optional `fields` override (for tampering test). Logs outcome without PII.
- `POST /api/verify/upload` — Accepts multipart PDF upload (`.pdf`, max 5 MB, `%PDF-` magic-byte validated). Checks exact PDF SHA-256 and embedded canonical payload hash.
- `GET /api/verify/history` *(Admin)* — Returns recent verification audit records without storing uploaded files or student PII.

## Blockchain
- `GET /api/blockchain/status` — Reports live Hardhat/Ethereum RPC connectivity or Demo Ledger mode, compiler version, block number, and contract address.
- `GET /api/blockchain/certificate/{certificate_id}` — Queries on-chain / ledger record directly.
