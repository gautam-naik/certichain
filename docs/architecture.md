# CertiChain System Architecture

## 1. Design Principle: Hybrid Off-Chain Metadata + On-Chain Proof
Academic credentials contain personally identifiable information (student roll numbers, grades, institutional records) that must not be exposed permanently on public blockchains. CertiChain separates data storage from cryptographic verification:

- **Off-Chain Relational Metadata (SQLite)**: Stores normalized student and degree attributes, generated PDF SHA-256 digests, blockchain transaction hashes, and privacy-preserving verification audit logs.
- **On-Chain Truth (`CertificateRegistry.sol`)**: Stores only the `keccak256(certificateId)` key, `bytes32` SHA-256 canonical fingerprint, authorized issuer wallet address, issuance timestamp, and revocation flag.

## 2. Cryptographic Pipeline
1. **Normalization**: Fields (`certificate_id`, `student_name`, `student_roll_number`, `university_name`, `degree`, `department`, `academic_year`, `certificate_type`, `grade`, `issue_date`) are trimmed, whitespace-collapsed, and serialized into sorted-key canonical JSON.
2. **SHA-256 Digest**: A 32-byte (`0x...`) SHA-256 digest is computed from the canonical JSON string.
3. **Smart Contract Anchoring**: `registerCertificate(certificateId, certificateHash)` writes the digest to EVM storage only if `msg.sender` is an authorized issuer and the `certificateId` has never been registered.
4. **PDF & QR Generation**: A downloadable A4 landscape PDF is generated with an embedded QR code pointing to `/verify?id=<CERTIFICATE_ID>` and an embedded canonical payload in PDF metadata (`CERTICHAIN_CANONICAL_V1:`). Both exact binary PDF SHA-256 and canonical payload integrity can be verified.

## 3. Verification Truth Table
| On-Chain Exists | On-Chain Revoked | SHA-256 Matches | Outcome |
|---|---|---|---|
| `false` | — | — | **NOT_FOUND (Grey)** |
| `true` | `true` | — | **REVOKED (Orange)** |
| `true` | `false` | `false` | **TAMPERED (Red)** |
| `true` | `false` | `true` | **AUTHENTIC (Green)** |

SQLite alone is never trusted as proof of authenticity; verification always reads the smart contract / ledger state first.
