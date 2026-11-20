import fs from "fs";
import path from "path";
import solc from "solc";

export interface CompiledContractArtifact {
  contractName: string;
  compilerVersion: string;
  abi: unknown[];
  bytecode: string;
  compiledAt: string;
}

let cachedArtifact: CompiledContractArtifact | null = null;

export function compileCertificateRegistry(): CompiledContractArtifact {
  if (cachedArtifact) {
    return cachedArtifact;
  }

  const contractPath = path.resolve(
    process.cwd(),
    "blockchain/contracts/CertificateRegistry.sol"
  );
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Smart contract source not found at ${contractPath}`);
  }

  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "CertificateRegistry.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const fatalErrors = output.errors.filter(
      (e: { severity: string }) => e.severity === "error"
    );
    if (fatalErrors.length > 0) {
      throw new Error(
        `Solidity compilation failed: ${fatalErrors
          .map((e: { formattedMessage: string }) => e.formattedMessage)
          .join("\n")}`
      );
    }
  }

  const compiled = output.contracts?.["CertificateRegistry.sol"]?.["CertificateRegistry"];
  if (!compiled || !compiled.abi || !compiled.evm?.bytecode?.object) {
    throw new Error("Solidity compiler did not emit ABI or bytecode for CertificateRegistry");
  }

  cachedArtifact = {
    contractName: "CertificateRegistry",
    compilerVersion: solc.version(),
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
    compiledAt: new Date().toISOString(),
  };

  return cachedArtifact;
}
