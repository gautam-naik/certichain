# CertiChain Presentation Outline (12 Slides)

1. **Title**: CertiChain – Decentralized Academic Certificate Verification System
2. **Introduction to Blockchain**: Blocks, cryptographic hashes, decentralization, and immutability
3. **Problem Statement**: Forged degrees, slow manual registrar verification, and undetected document tampering
4. **Existing System**: Centralized certificate databases and single-point-of-failure limitations
5. **Proposed System**: CertiChain hybrid architecture and project objectives
6. **System Architecture**: React Frontend -> Backend API -> SQLite + SHA-256 -> Smart Contract -> Blockchain Ledger
7. **Working Mechanism**: Step-by-step certificate issuance and verification flow
8. **Smart Contract**: `CertificateRegistry.sol` functions (`registerCertificate`, `verifyCertificate`, `revokeCertificate`, `addIssuer`, `removeIssuer`) and access control
9. **Website Features**: Admin Dashboard, Issuance Form, Public Multi-Method Verification (ID, PDF Upload, QR Scanner)
10. **Implementation & Technology Stack**: React, TypeScript, Tailwind CSS, FastAPI/Express, SQLite, Solidity ^0.8.20, Hardhat, Ethers.js
11. **Testing & Results**: Automated test verification across authentic validation, tampering detection, and revocation
12. **Conclusion & Future Scope**: Multi-university consortiums, IPFS encrypted storage, and W3C Verifiable Credentials / DID integration
