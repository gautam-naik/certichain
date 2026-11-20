import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

export interface WalletConnection {
  address: string;
  chainId: number;
  networkName: string;
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function connectMetaMask(): Promise<WalletConnection> {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask browser extension not detected. Install MetaMask to connect a local Hardhat wallet."
    );
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    address,
    chainId: Number(network.chainId),
    networkName:
      network.name && network.name !== "unknown"
        ? network.name
        : `Chain ID ${Number(network.chainId)}`,
  };
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
