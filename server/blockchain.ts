import crypto from "crypto";
import { ethers } from "ethers";
import { config } from "./config.ts";
import { computeCertificateIdHash } from "./crypto.ts";
import { getDb } from "./db.ts";
import { compileCertificateRegistry } from "./solidity.ts";

export type LedgerMode = "ethereum-rpc" | "demo";

export interface BlockchainStatus {
  connected: boolean;
  mode: LedgerMode;
  networkName: string;
  chainId: number | null;
  blockNumber: number;
  contractAddress: string;
  contractCompiled: boolean;
  compilerVersion: string;
  rpcUrl: string;
  notice: string | null;
}

export interface OnChainRecord {
  exists: boolean;
  certificateHash: string;
  hashMatches: boolean;
  revoked: boolean;
  issuer: string;
  issuedAt: number;
  txHash: string;
  blockNumber: number;
  ledgerMode: LedgerMode;
  networkName: string;
}

let activeContractAddress = config.contractAddress;

async function getRpcProviderAndContract(): Promise<{
  provider: ethers.JsonRpcProvider;
  contract: ethers.Contract;
  signerAddress: string;
  networkName: string;
  chainId: number;
  blockNumber: number;
} | null> {
  if (!config.blockchainRpcUrl) return null;

  try {
    const provider = new ethers.JsonRpcProvider(config.blockchainRpcUrl, undefined, {
      staticNetwork: false,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("RPC timeout")), 1200)
    );

    const network = await Promise.race([provider.getNetwork(), timeoutPromise]);
    const blockNumber = await Promise.race([provider.getBlockNumber(), timeoutPromise]);
    const compiled = compileCertificateRegistry();

    let signer: ethers.Signer;
    if (config.blockchainPrivateKey) {
      signer = new ethers.Wallet(config.blockchainPrivateKey, provider);
    } else {
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        return null;
      }
      signer = accounts[0];
    }

    const signerAddress = await signer.getAddress();

    if (!activeContractAddress) {
      const factory = new ethers.ContractFactory(
        compiled.abi as ethers.InterfaceAbi,
        compiled.bytecode,
        signer
      );
      const deployed = await factory.deploy();
      await deployed.waitForDeployment();
      activeContractAddress = await deployed.getAddress();
    }

    const contract = new ethers.Contract(
      activeContractAddress,
      compiled.abi as ethers.InterfaceAbi,
      signer
    );

    return {
      provider,
      contract,
      signerAddress,
      networkName:
        network.name && network.name !== "unknown"
          ? network.name
          : `Hardhat Local (Chain ${Number(network.chainId)})`,
      chainId: Number(network.chainId),
      blockNumber,
    };
  } catch {
    return null;
  }
}

export async function getBlockchainStatus(): Promise<BlockchainStatus> {
  const compiled = compileCertificateRegistry();
  const rpc = await getRpcProviderAndContract();

  if (rpc) {
    return {
      connected: true,
      mode: "ethereum-rpc",
      networkName: rpc.networkName,
      chainId: rpc.chainId,
      blockNumber: rpc.blockNumber,
      contractAddress: activeContractAddress,
      contractCompiled: true,
      compilerVersion: compiled.compilerVersion,
      rpcUrl: config.blockchainRpcUrl,
      notice: null,
    };
  }

  if (config.strictBlockchainMode) {
    throw new Error(
      `Strict blockchain mode enabled, but RPC at ${config.blockchainRpcUrl} is unreachable.`
    );
  }

  const db = getDb();
  const maxBlockRow = db
    .prepare("SELECT COALESCE(MAX(block_number), 1000) as maxBlock FROM demo_onchain_ledger")
    .get() as { maxBlock: number };

  return {
    connected: false,
    mode: "demo",
    networkName: "Demo Ledger (Hardhat RPC Offline)",
    chainId: 31337,
    blockNumber: maxBlockRow.maxBlock,
    contractAddress: activeContractAddress || "Not deployed (Demo Ledger Mode)",
    contractCompiled: true,
    compilerVersion: compiled.compilerVersion,
    rpcUrl: config.blockchainRpcUrl,
    notice:
      "Local Hardhat JSON-RPC node is not running. Operating in clearly labelled Demo Ledger mode using compiled Solidity ABI & SHA-256 verification.",
  };
}

export async function registerCertificateOnChain(
  certificateId: string,
  canonicalHash: string
): Promise<{
  txHash: string;
  blockNumber: number;
  issuerAddress: string;
  networkName: string;
  ledgerMode: LedgerMode;
}> {
  const rpc = await getRpcProviderAndContract();

  if (rpc) {
    const tx = await rpc.contract.registerCertificate(certificateId, canonicalHash);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      issuerAddress: rpc.signerAddress,
      networkName: rpc.networkName,
      ledgerMode: "ethereum-rpc",
    };
  }

  if (config.strictBlockchainMode) {
    throw new Error("Blockchain RPC unreachable while STRICT_BLOCKCHAIN_MODE=true");
  }

  const db = getDb();
  const idHash = computeCertificateIdHash(certificateId);
  const existing = db
    .prepare("SELECT certificate_id FROM demo_onchain_ledger WHERE certificate_id_hash = ?")
    .get(idHash);

  if (existing) {
    throw new Error("Certificate already registered on ledger");
  }

  const maxBlockRow = db
    .prepare("SELECT COALESCE(MAX(block_number), 1000) as maxBlock FROM demo_onchain_ledger")
    .get() as { maxBlock: number };
  const blockNumber = maxBlockRow.maxBlock + 1;
  const issuedAt = Math.floor(Date.now() / 1000);
  const issuerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const txHash =
    "0x" +
    crypto
      .createHash("sha256")
      .update(`demo-tx:${certificateId}:${canonicalHash}:${Date.now()}:${crypto.randomUUID()}`)
      .digest("hex");

  db.prepare(`
    INSERT INTO demo_onchain_ledger (
      certificate_id_hash, certificate_id, certificate_hash, issuer,
      issued_at, exists_flag, revoked, revoked_at, tx_hash, block_number
    ) VALUES (?, ?, ?, ?, ?, 1, 0, NULL, ?, ?)
  `).run(
    idHash,
    certificateId.trim().toUpperCase(),
    canonicalHash,
    issuerAddress,
    issuedAt,
    txHash,
    blockNumber
  );

  return {
    txHash,
    blockNumber,
    issuerAddress,
    networkName: "Demo Ledger (Hardhat RPC Offline)",
    ledgerMode: "demo",
  };
}

export async function verifyCertificateOnChain(
  certificateId: string,
  candidateHash: string
): Promise<OnChainRecord> {
  const rpc = await getRpcProviderAndContract();

  if (rpc) {
    const [exists, hashMatches, revoked, issuer, issuedAt] =
      await rpc.contract.verifyCertificate(certificateId, candidateHash);
    const [storedHash] = await rpc.contract.getCertificate(certificateId);
    const db = getDb();
    const meta = db
      .prepare("SELECT tx_hash, block_number FROM certificates WHERE certificate_id = ?")
      .get(certificateId.trim().toUpperCase()) as
      | { tx_hash: string; block_number: number }
      | undefined;

    return {
      exists: Boolean(exists),
      certificateHash: String(storedHash),
      hashMatches: Boolean(hashMatches),
      revoked: Boolean(revoked),
      issuer: String(issuer),
      issuedAt: Number(issuedAt),
      txHash: meta?.tx_hash || "",
      blockNumber: meta?.block_number || 0,
      ledgerMode: "ethereum-rpc",
      networkName: rpc.networkName,
    };
  }

  if (config.strictBlockchainMode) {
    throw new Error("Blockchain RPC unreachable while STRICT_BLOCKCHAIN_MODE=true");
  }

  const db = getDb();
  const idHash = computeCertificateIdHash(certificateId);
  const row = db
    .prepare("SELECT * FROM demo_onchain_ledger WHERE certificate_id_hash = ?")
    .get(idHash) as
    | {
        certificate_hash: string;
        issuer: string;
        issued_at: number;
        exists_flag: number;
        revoked: number;
        tx_hash: string;
        block_number: number;
      }
    | undefined;

  if (!row || !row.exists_flag) {
    return {
      exists: false,
      certificateHash: ethers.ZeroHash,
      hashMatches: false,
      revoked: false,
      issuer: ethers.ZeroAddress,
      issuedAt: 0,
      txHash: "",
      blockNumber: 0,
      ledgerMode: "demo",
      networkName: "Demo Ledger (Hardhat RPC Offline)",
    };
  }

  return {
    exists: true,
    certificateHash: row.certificate_hash,
    hashMatches: row.certificate_hash.toLowerCase() === candidateHash.toLowerCase(),
    revoked: Boolean(row.revoked),
    issuer: row.issuer,
    issuedAt: row.issued_at,
    txHash: row.tx_hash,
    blockNumber: row.block_number,
    ledgerMode: "demo",
    networkName: "Demo Ledger (Hardhat RPC Offline)",
  };
}

export async function revokeCertificateOnChain(certificateId: string): Promise<{
  revokedAt: string;
  ledgerMode: LedgerMode;
  txHash?: string;
}> {
  const rpc = await getRpcProviderAndContract();

  if (rpc) {
    const tx = await rpc.contract.revokeCertificate(certificateId);
    const receipt = await tx.wait();
    return {
      revokedAt: new Date().toISOString(),
      ledgerMode: "ethereum-rpc",
      txHash: receipt.hash,
    };
  }

  if (config.strictBlockchainMode) {
    throw new Error("Blockchain RPC unreachable while STRICT_BLOCKCHAIN_MODE=true");
  }

  const db = getDb();
  const idHash = computeCertificateIdHash(certificateId);
  const row = db
    .prepare("SELECT revoked FROM demo_onchain_ledger WHERE certificate_id_hash = ?")
    .get(idHash) as { revoked: number } | undefined;

  if (!row) {
    throw new Error("Certificate does not exist on ledger");
  }
  if (row.revoked) {
    throw new Error("Certificate already revoked");
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  db.prepare(
    "UPDATE demo_onchain_ledger SET revoked = 1, revoked_at = ? WHERE certificate_id_hash = ?"
  ).run(nowUnix, idHash);

  return {
    revokedAt: new Date().toISOString(),
    ledgerMode: "demo",
  };
}
