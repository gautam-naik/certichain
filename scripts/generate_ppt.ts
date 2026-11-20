import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";

async function generatePresentation() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "CertiChain Engineering Team";
  pptx.title = "CertiChain – Decentralized Academic Certificate Verification System";

  const BG = "070B14";
  const CARD = "0D1424";
  const BORDER = "1E293B";
  const TEAL = "14B8A6";
  const TEAL_LIGHT = "5EEAD4";
  const WHITE = "F8FAFC";
  const MUTED = "94A3B8";
  const EMERALD = "34D399";
  const ROSE = "FB7185";
  const AMBER = "FBBF24";

  function applySlideBase(slide: PptxGenJS.Slide, slideNum: number, kicker: string, title: string) {
    slide.background = { color: BG };
    // Subtle top accent bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.06,
      fill: { color: TEAL },
    });
    if (slideNum > 1) {
      slide.addText(kicker.toUpperCase(), {
        x: 0.7,
        y: 0.35,
        w: 8,
        h: 0.28,
        fontSize: 10,
        bold: true,
        color: TEAL_LIGHT,
        fontFace: "Segoe UI",
      });
      slide.addText(title, {
        x: 0.7,
        y: 0.62,
        w: 11.9,
        h: 0.55,
        fontSize: 26,
        bold: true,
        color: WHITE,
        fontFace: "Segoe UI",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: 0.7,
        y: 1.24,
        w: 11.9,
        h: 0,
        line: { color: BORDER, width: 1 },
      });
    }
    slide.addText(`CertiChain  ·  Slide ${slideNum} of 12`, {
      x: 0.7,
      y: 7.05,
      w: 11.9,
      h: 0.25,
      fontSize: 9,
      color: MUTED,
      align: "right",
      fontFace: "Segoe UI",
    });
  }

  // SLIDE 1: Title
  {
    const s = pptx.addSlide();
    applySlideBase(s, 1, "", "");
    s.addText("BLOCKCHAIN TECHNOLOGY PROJECT", {
      x: 0.8,
      y: 1.3,
      w: 7,
      h: 0.35,
      fontSize: 11,
      bold: true,
      color: TEAL_LIGHT,
      fontFace: "Segoe UI",
    });
    s.addText("CertiChain", {
      x: 0.8,
      y: 1.75,
      w: 6.5,
      h: 0.9,
      fontSize: 48,
      bold: true,
      color: WHITE,
      fontFace: "Segoe UI",
    });
    s.addText("Decentralized Academic Certificate Verification System", {
      x: 0.8,
      y: 2.7,
      w: 6.4,
      h: 0.8,
      fontSize: 21,
      color: "CBD5E1",
      fontFace: "Segoe UI",
    });
    s.addText(
      "Solidity ^0.8.20  ·  SHA-256 Cryptography  ·  QR & PDF Engine  ·  React + FastAPI / Node",
      {
        x: 0.8,
        y: 3.7,
        w: 6.5,
        h: 0.5,
        fontSize: 12,
        color: MUTED,
        fontFace: "Segoe UI",
      }
    );

    const heroImgPath = path.resolve(
      process.cwd(),
      "src/assets/images/hero_certichain_seal_1795103566109.jpg"
    );
    if (fs.existsSync(heroImgPath)) {
      s.addImage({
        path: heroImgPath,
        x: 7.5,
        y: 1.5,
        w: 5.1,
        h: 2.87,
        rounding: true,
      });
    }

    s.addNotes(
      "Welcome everyone. Today we present CertiChain, a decentralized academic certificate verification platform built using Solidity smart contracts, SHA-256 cryptographic hashing, and automated PDF/QR generation."
    );
  }

  // SLIDE 2: Introduction to Blockchain
  {
    const s = pptx.addSlide();
    applySlideBase(s, 2, "Foundations", "Introduction to Blockchain");
    const pillars = [
      {
        title: "Cryptographic Blocks",
        desc: "Transactions are grouped into blocks linked sequentially via cryptographic hashes.",
      },
      {
        title: "SHA-256 & Keccak-256",
        desc: "One-way hash functions map arbitrary data to a fixed 32-byte fingerprint.",
      },
      {
        title: "Decentralization",
        desc: "Shared state removes reliance on a single university database administrator.",
      },
      {
        title: "Immutability",
        desc: "Once anchored in a block, historical issuance records cannot be silently altered.",
      },
    ];
    pillars.forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 0.7 + col * 6.05;
      const y = 1.6 + row * 2.45;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 5.8,
        h: 2.15,
        fill: { color: CARD },
        line: { color: BORDER, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(`0${idx + 1}. ${p.title}`, {
        x: x + 0.35,
        y: y + 0.35,
        w: 5.1,
        h: 0.4,
        fontSize: 17,
        bold: true,
        color: TEAL_LIGHT,
      });
      s.addText(p.desc, {
        x: x + 0.35,
        y: y + 0.85,
        w: 5.1,
        h: 1.0,
        fontSize: 13.5,
        color: "CBD5E1",
      });
    });
    s.addNotes(
      "Blockchain combines cryptographic hashing with append-only distributed ledgers. Even a single-bit change in input data alters the resulting SHA-256 digest completely, making tampering immediately detectable."
    );
  }

  // SLIDE 3: Problem Statement
  {
    const s = pptx.addSlide();
    applySlideBase(s, 3, "Motivation", "Problem Statement");
    const items = [
      {
        head: "Document Forgery",
        body: "Paper diplomas and standard PDFs are easily edited with consumer graphic tools.",
      },
      {
        head: "Slow Manual Verification",
        body: "Employers wait days or weeks for university registrars to reply to email requests.",
      },
      {
        head: "Undetected Tampering",
        body: "Grade or degree alterations cannot be caught visually without cryptographic fingerprints.",
      },
    ];
    items.forEach((it, idx) => {
      const x = 0.7 + idx * 4.05;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 1.85,
        w: 3.8,
        h: 4.1,
        fill: { color: CARD },
        line: { color: BORDER, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(it.head, {
        x: x + 0.3,
        y: 2.25,
        w: 3.2,
        h: 0.45,
        fontSize: 18,
        bold: true,
        color: ROSE,
      });
      s.addText(it.body, {
        x: x + 0.3,
        y: 2.85,
        w: 3.2,
        h: 2.4,
        fontSize: 14,
        color: "CBD5E1",
      });
    });
    s.addNotes(
      "Academic credential fraud undermines institutional trust. Standard PDFs lack verifiable proof of origin unless paired with an independent cryptographic anchor."
    );
  }

  // SLIDE 4: Existing System
  {
    const s = pptx.addSlide();
    applySlideBase(s, 4, "Current Landscape", "Existing Centralized Systems & Limitations");
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 1.65,
      w: 5.7,
      h: 4.7,
      fill: { color: CARD },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("Centralized Registrar Model", {
      x: 1.0,
      y: 1.95,
      w: 5.1,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: WHITE,
    });
    s.addText(
      "• Single institutional database holds all records\n• Verification requires manual phone/email checks\n• Paper seals and signatures are easy to clone\n• Vulnerable to silent internal database edits",
      {
        x: 1.0,
        y: 2.55,
        w: 5.1,
        h: 3.2,
        fontSize: 14,
        color: "CBD5E1",
        lineSpacing: 26,
      }
    );

    s.addShape(pptx.ShapeType.roundRect, {
      x: 6.8,
      y: 1.65,
      w: 5.8,
      h: 4.7,
      fill: { color: CARD },
      line: { color: TEAL, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("Key Limitations", {
      x: 7.1,
      y: 1.95,
      w: 5.2,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: TEAL_LIGHT,
    });
    s.addText(
      "• High administrative overhead per request\n• No standardized public verification API\n• Zero cryptographic hash comparison\n• Difficult cross-border credential validation",
      {
        x: 7.1,
        y: 2.55,
        w: 5.2,
        h: 3.2,
        fontSize: 14,
        color: "CBD5E1",
        lineSpacing: 26,
      }
    );
    s.addNotes(
      "Existing centralized portals rely solely on university-controlled databases. If the portal is offline or records are altered, verifiers have no independent cryptographic proof."
    );
  }

  // SLIDE 5: Proposed System
  {
    const s = pptx.addSlide();
    applySlideBase(s, 5, "Solution", "Proposed System: CertiChain");
    const goals = [
      ["Authorized Issuance", "JWT-authenticated registrars issue unique IDs & PDFs."],
      ["Privacy-Preserving", "Only SHA-256 hashes & issuer addresses go on-chain."],
      ["Instant Verification", "Verify via Certificate ID, PDF upload, or QR camera scan."],
      ["Revocation Support", "Admins can permanently revoke invalidated credentials."],
    ];
    goals.forEach(([t, d], i) => {
      const y = 1.65 + i * 1.25;
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y,
        w: 11.9,
        h: 1.05,
        fill: { color: CARD },
        line: { color: BORDER, width: 1 },
        rectRadius: 0.06,
      });
      s.addText(t, {
        x: 1.0,
        y: y + 0.18,
        w: 3.4,
        h: 0.65,
        fontSize: 16,
        bold: true,
        color: TEAL_LIGHT,
      });
      s.addText(d, {
        x: 4.5,
        y: y + 0.18,
        w: 7.8,
        h: 0.65,
        fontSize: 14,
        color: WHITE,
      });
    });
    s.addNotes(
      "CertiChain balances immutability with student privacy. Personal details remain in institutional SQLite storage while cryptographic fingerprints live on-chain."
    );
  }

  // SLIDE 6: System Architecture (Diagram)
  {
    const s = pptx.addSlide();
    applySlideBase(s, 6, "Blueprint", "System Architecture");
    const nodes = [
      { label: "React + Vite\nFrontend", x: 0.7, y: 2.3, w: 2.3, h: 1.3, c: TEAL },
      { label: "REST API\nBackend", x: 3.7, y: 2.3, w: 2.3, h: 1.3, c: BORDER },
      { label: "SQLite DB\nMetadata & Logs", x: 6.9, y: 1.6, w: 2.5, h: 1.15, c: BORDER },
      { label: "SHA-256\nCanonical Hash", x: 6.9, y: 3.25, w: 2.5, h: 1.15, c: BORDER },
      { label: "CertificateRegistry\nSolidity Contract", x: 10.1, y: 3.25, w: 2.5, h: 1.15, c: TEAL },
    ];
    nodes.forEach((n) => {
      s.addShape(pptx.ShapeType.roundRect, {
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        fill: { color: CARD },
        line: { color: n.c, width: 1.5 },
        rectRadius: 0.08,
      });
      s.addText(n.label, {
        x: n.x + 0.1,
        y: n.y + 0.15,
        w: n.w - 0.2,
        h: n.h - 0.3,
        fontSize: 13,
        bold: true,
        color: WHITE,
        align: "center",
        valign: "middle",
      });
    });
    // Connector arrows
    s.addShape(pptx.ShapeType.rightArrow, { x: 3.1, y: 2.8, w: 0.5, h: 0.3, fill: { color: TEAL } });
    s.addShape(pptx.ShapeType.rightArrow, { x: 6.15, y: 2.05, w: 0.6, h: 0.28, fill: { color: TEAL } });
    s.addShape(pptx.ShapeType.rightArrow, { x: 6.15, y: 3.65, w: 0.6, h: 0.28, fill: { color: TEAL } });
    s.addShape(pptx.ShapeType.rightArrow, { x: 9.5, y: 3.65, w: 0.5, h: 0.28, fill: { color: TEAL } });

    s.addText(
      "Source of Truth: Verification reads the smart contract record first and never trusts SQLite alone.",
      {
        x: 0.7,
        y: 5.3,
        w: 11.9,
        h: 0.6,
        fontSize: 14,
        color: TEAL_LIGHT,
        align: "center",
      }
    );
    s.addNotes(
      "This diagram illustrates the decoupled architecture: the backend normalizes inputs, generates a deterministic SHA-256 hash, anchors the hash on CertificateRegistry.sol, and persists off-chain metadata and PDF digests in SQLite."
    );
  }

  // SLIDE 7: Working Mechanism (Workflow Diagram)
  {
    const s = pptx.addSlide();
    applySlideBase(s, 7, "Execution Flow", "Step-by-Step Working Mechanism");
    const steps = [
      "1. Validate Form",
      "2. Generate ID",
      "3. Normalize & SHA-256",
      "4. Register On-Chain",
      "5. Save SQLite & PDF/QR",
    ];
    steps.forEach((st, idx) => {
      const x = 0.65 + idx * 2.45;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 2.0,
        w: 2.2,
        h: 1.3,
        fill: { color: CARD },
        line: { color: TEAL, width: 1.2 },
        rectRadius: 0.08,
      });
      s.addText(st, {
        x: x + 0.1,
        y: 2.1,
        w: 2.0,
        h: 1.1,
        fontSize: 13,
        bold: true,
        color: WHITE,
        align: "center",
        valign: "middle",
      });
    });

    const outcomes = [
      { label: "AUTHENTIC", color: EMERALD, desc: "Hash matches & not revoked" },
      { label: "TAMPERED", color: ROSE, desc: "SHA-256 digest mismatch" },
      { label: "REVOKED", color: AMBER, desc: "Revoked on smart contract" },
      { label: "NOT FOUND", color: MUTED, desc: "No record on blockchain" },
    ];
    outcomes.forEach((o, idx) => {
      const x = 0.65 + idx * 3.05;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 4.3,
        w: 2.85,
        h: 1.5,
        fill: { color: CARD },
        line: { color: o.color, width: 1.5 },
        rectRadius: 0.08,
      });
      s.addText(o.label, {
        x: x + 0.15,
        y: 4.55,
        w: 2.55,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: o.color,
        align: "center",
      });
      s.addText(o.desc, {
        x: x + 0.15,
        y: 5.05,
        w: 2.55,
        h: 0.5,
        fontSize: 12,
        color: "CBD5E1",
        align: "center",
      });
    });
    s.addNotes(
      "Top row shows the 5-stage issuance pipeline. If blockchain registration fails, no certificate is marked issued. Bottom row shows the 4 deterministic verification outcomes."
    );
  }

  // SLIDE 8: Smart Contract
  {
    const s = pptx.addSlide();
    applySlideBase(s, 8, "On-Chain Logic", "Smart Contract: CertificateRegistry.sol");
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 1.65,
      w: 5.7,
      h: 4.8,
      fill: { color: CARD },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("On-Chain Struct (Zero PII)", {
      x: 1.0,
      y: 1.9,
      w: 5.1,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: TEAL_LIGHT,
    });
    s.addText(
      "struct Certificate {\n  bytes32 certificateHash;\n  address issuer;\n  uint256 issuedAt;\n  bool exists;\n  bool revoked;\n}",
      {
        x: 1.0,
        y: 2.45,
        w: 5.1,
        h: 3.4,
        fontSize: 14,
        fontFace: "Consolas",
        color: WHITE,
      }
    );

    s.addShape(pptx.ShapeType.roundRect, {
      x: 6.75,
      y: 1.65,
      w: 5.85,
      h: 4.8,
      fill: { color: CARD },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("Core Functions & Access Control", {
      x: 7.05,
      y: 1.9,
      w: 5.2,
      h: 0.4,
      fontSize: 16,
      bold: true,
      color: TEAL_LIGHT,
    });
    s.addText(
      "• registerCertificate(id, hash)  [onlyAuthorizedIssuer]\n• verifyCertificate(id, hash)  [public view]\n• revokeCertificate(id)  [onlyOwner]\n• addIssuer(addr) / removeIssuer(addr)  [onlyOwner]\n• Duplicate ID prevention via exists flag\n• Emits CertificateIssued & CertificateRevoked",
      {
        x: 7.05,
        y: 2.45,
        w: 5.25,
        h: 3.5,
        fontSize: 13.5,
        color: "CBD5E1",
        lineSpacing: 24,
      }
    );
    s.addNotes(
      "CertificateRegistry.sol targets Solidity ^0.8.20. It is compiled using solc in-app and via Hardhat, enforcing strict issuer and owner modifiers."
    );
  }

  // SLIDE 9: Website Features
  {
    const s = pptx.addSlide();
    applySlideBase(s, 9, "User Experience", "Website & Portal Features");
    const feats = [
      {
        role: "Admin Console",
        pts: "Dashboard KPIs & Recharts analytics\nCertificate issuance & PDF/QR export\nPermanent revocation & audit history",
      },
      {
        role: "Student / Holder",
        pts: "Dedicated Certificate Details page\nDownloadable A4 official PDF\nShareable verification URL & QR",
      },
      {
        role: "Public Verifier",
        pts: "Zero-account verification portal\nID lookup, PDF upload & webcam QR\nInstant hash comparison breakdown",
      },
    ];
    feats.forEach((f, idx) => {
      const x = 0.7 + idx * 4.05;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 1.75,
        w: 3.8,
        h: 4.4,
        fill: { color: CARD },
        line: { color: TEAL, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(f.role, {
        x: x + 0.3,
        y: 2.05,
        w: 3.2,
        h: 0.45,
        fontSize: 18,
        bold: true,
        color: TEAL_LIGHT,
      });
      s.addText(f.pts, {
        x: x + 0.3,
        y: 2.75,
        w: 3.2,
        h: 2.8,
        fontSize: 13.5,
        color: "CBD5E1",
        lineSpacing: 26,
      });
    });
    s.addNotes(
      "CertiChain serves three user roles across 9 routes: institutional administrators, certificate holders, and public verifiers."
    );
  }

  // SLIDE 10: Implementation & Technology Stack
  {
    const s = pptx.addSlide();
    applySlideBase(s, 10, "Engineering", "Implementation & Technology Stack");
    const stack = [
      ["Frontend", "React 19, Vite, TypeScript, Tailwind CSS, Recharts, React Router, jsQR"],
      ["Backend API", "Node.js + Express (live preview) & Python FastAPI + Pydantic (/backend)"],
      ["Database", "SQLite persistence with masked public views & PII-free audit logs"],
      ["Blockchain", "Solidity ^0.8.20, Hardhat, Ethers.js v6, solc compiler, MetaMask"],
      ["PDF & QR", "pdf-lib / ReportLab A4 certificates with embedded QR & canonical metadata"],
    ];
    stack.forEach(([k, v], idx) => {
      const y = 1.65 + idx * 0.98;
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y,
        w: 11.9,
        h: 0.82,
        fill: { color: CARD },
        line: { color: BORDER, width: 1 },
        rectRadius: 0.06,
      });
      s.addText(k, {
        x: 1.0,
        y: y + 0.16,
        w: 2.5,
        h: 0.5,
        fontSize: 15,
        bold: true,
        color: TEAL_LIGHT,
      });
      s.addText(v, {
        x: 3.6,
        y: y + 0.16,
        w: 8.7,
        h: 0.5,
        fontSize: 13.5,
        color: WHITE,
      });
    });
    s.addNotes(
      "Where an external Hardhat RPC node is offline, the system switches explicitly to a clearly labelled Demo Ledger mode rather than simulating fake RPC responses."
    );
  }

  // SLIDE 11: Testing and Results (Real Actual Test Output!)
  {
    const s = pptx.addSlide();
    applySlideBase(s, 11, "Verification", "Testing and Observed Results");
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 1.65,
      w: 11.9,
      h: 4.8,
      fill: { color: CARD },
      line: { color: EMERALD, width: 1.2 },
      rectRadius: 0.08,
    });
    s.addText("Automated Integration Suite (npx tsx --test tests/certichain.test.ts): 5 / 5 Passed", {
      x: 1.0,
      y: 1.9,
      w: 11.3,
      h: 0.45,
      fontSize: 16,
      bold: true,
      color: EMERALD,
    });
    s.addText(
      "✓ Test 1: Solidity CertificateRegistry.sol compiled via solc with full ABI & events\n" +
        "✓ Test 2: Canonical normalization & SHA-256 detects 1-character grade modification\n" +
        "✓ Test 3: Admin JWT authentication & invalid password rejection (401)\n" +
        "✓ Test 4: Unauthenticated issuance blocked via RBAC middleware (401)\n" +
        "✓ Test 5: End-to-End Lifecycle — Issue -> PDF/QR -> AUTHENTIC -> Tamper (TAMPERED) -> Revoke (REVOKED) -> NOT_FOUND",
      {
        x: 1.0,
        y: 2.55,
        w: 11.3,
        h: 3.6,
        fontSize: 13.5,
        color: WHITE,
        lineSpacing: 26,
      }
    );
    s.addNotes(
      "All 5 automated test suites passed in our test run: Solidity compilation, SHA-256 sensitivity, JWT/RBAC security, authentic PDF upload verification, tampered PDF rejection, and permanent revocation."
    );
  }

  // SLIDE 12: Conclusion and Future Scope
  {
    const s = pptx.addSlide();
    applySlideBase(s, 12, "Roadmap", "Conclusion and Future Scope");
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.7,
      y: 1.75,
      w: 5.7,
      h: 4.4,
      fill: { color: CARD },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("Conclusion", {
      x: 1.0,
      y: 2.05,
      w: 5.1,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: TEAL_LIGHT,
    });
    s.addText(
      "CertiChain delivers tamper-evident, privacy-preserving academic credential verification backed by Solidity smart contracts, SHA-256 fingerprints, and instant QR/PDF checks.",
      {
        x: 1.0,
        y: 2.65,
        w: 5.1,
        h: 2.8,
        fontSize: 14.5,
        color: "CBD5E1",
        lineSpacing: 24,
      }
    );

    s.addShape(pptx.ShapeType.roundRect, {
      x: 6.75,
      y: 1.75,
      w: 5.85,
      h: 4.4,
      fill: { color: CARD },
      line: { color: BORDER, width: 1 },
      rectRadius: 0.08,
    });
    s.addText("Future Scope", {
      x: 7.05,
      y: 2.05,
      w: 5.2,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: TEAL_LIGHT,
    });
    s.addText(
      "• Multi-university consortium smart contract governance\n• Layer-2 rollup deployment for low-cost public anchoring\n• W3C Verifiable Credentials & Decentralized Identifiers (DID)\n• Encrypted IPFS backup for student-owned credentials",
      {
        x: 7.05,
        y: 2.65,
        w: 5.25,
        h: 2.9,
        fontSize: 14,
        color: "CBD5E1",
        lineSpacing: 26,
      }
    );
    s.addNotes(
      "In future iterations, CertiChain can scale across multi-university consortiums on Ethereum Layer-2 networks and adopt W3C Verifiable Credentials for cross-border portability. Thank you."
    );
  }

  const outFile = path.resolve(process.cwd(), "CertiChain_Blockchain_Project.pptx");
  await pptx.writeFile({ fileName: outFile });
  console.log("Generated presentation:", outFile);
}

generatePresentation().catch((err) => {
  console.error(err);
  process.exit(1);
});
