import json
from pathlib import Path
from typing import Optional
from web3 import Web3
from app.core.config import settings

CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "certificateId", "type": "string"},
            {"internalType": "bytes32", "name": "certificateHash", "type": "bytes32"},
        ],
        "name": "registerCertificate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "certificateId", "type": "string"},
            {"internalType": "bytes32", "name": "certificateHash", "type": "bytes32"},
        ],
        "name": "verifyCertificate",
        "outputs": [
            {"internalType": "bool", "name": "exists", "type": "bool"},
            {"internalType": "bool", "name": "hashMatches", "type": "bool"},
            {"internalType": "bool", "name": "revoked", "type": "bool"},
            {"internalType": "address", "name": "issuer", "type": "address"},
            {"internalType": "uint256", "name": "issuedAt", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "string", "name": "certificateId", "type": "string"}],
        "name": "revokeCertificate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


class BlockchainService:
    def __init__(self) -> None:
        self.w3: Optional[Web3] = None
        if settings.BLOCKCHAIN_RPC_URL:
            w3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC_URL, request_kwargs={"timeout": 2}))
            if w3.is_connected():
                self.w3 = w3

    def get_status(self) -> dict:
        if self.w3 and settings.CONTRACT_ADDRESS:
            return {
                "connected": True,
                "mode": "ethereum-rpc",
                "networkName": f"Hardhat / EVM (Chain {self.w3.eth.chain_id})",
                "chainId": self.w3.eth.chain_id,
                "blockNumber": self.w3.eth.block_number,
                "contractAddress": settings.CONTRACT_ADDRESS,
                "rpcUrl": settings.BLOCKCHAIN_RPC_URL,
            }
        if settings.STRICT_BLOCKCHAIN_MODE:
            raise RuntimeError("Blockchain RPC unavailable while STRICT_BLOCKCHAIN_MODE=True")
        return {
            "connected": False,
            "mode": "demo",
            "networkName": "Demo Ledger (Hardhat RPC Offline)",
            "chainId": 31337,
            "blockNumber": 1000,
            "contractAddress": settings.CONTRACT_ADDRESS or "Not deployed",
            "rpcUrl": settings.BLOCKCHAIN_RPC_URL,
            "notice": "Start Hardhat node and set CONTRACT_ADDRESS for live on-chain transactions.",
        }

    def register_certificate(self, certificate_id: str, canonical_hash: str) -> dict:
        if not self.w3 or not settings.CONTRACT_ADDRESS or not settings.BLOCKCHAIN_PRIVATE_KEY:
            if settings.STRICT_BLOCKCHAIN_MODE:
                raise RuntimeError("Live blockchain node or contract configuration missing")
            raise RuntimeError(
                "Hardhat RPC / CONTRACT_ADDRESS not configured. Start local Hardhat node and deploy CertificateRegistry.sol."
            )

        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.CONTRACT_ADDRESS),
            abi=CONTRACT_ABI,
        )
        account = self.w3.eth.account.from_key(settings.BLOCKCHAIN_PRIVATE_KEY)
        nonce = self.w3.eth.get_transaction_count(account.address)
        tx = contract.functions.registerCertificate(
            certificate_id, Web3.to_bytes(hexstr=canonical_hash)
        ).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )
        signed = self.w3.eth.account.sign_transaction(tx, settings.BLOCKCHAIN_PRIVATE_KEY)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "issuer_address": account.address,
            "network_name": f"Ethereum RPC (Chain {self.w3.eth.chain_id})",
        }

    def verify_certificate(self, certificate_id: str, candidate_hash: str) -> dict:
        if not self.w3 or not settings.CONTRACT_ADDRESS:
            raise RuntimeError("Blockchain RPC or CONTRACT_ADDRESS unavailable")
        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.CONTRACT_ADDRESS),
            abi=CONTRACT_ABI,
        )
        exists, matches, revoked, issuer, issued_at = contract.functions.verifyCertificate(
            certificate_id, Web3.to_bytes(hexstr=candidate_hash)
        ).call()
        return {
            "exists": exists,
            "hash_matches": matches,
            "revoked": revoked,
            "issuer": issuer,
            "issued_at": issued_at,
        }

    def revoke_certificate(self, certificate_id: str) -> str:
        if not self.w3 or not settings.CONTRACT_ADDRESS or not settings.BLOCKCHAIN_PRIVATE_KEY:
            raise RuntimeError("Blockchain RPC or contract configuration unavailable")
        contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.CONTRACT_ADDRESS),
            abi=CONTRACT_ABI,
        )
        account = self.w3.eth.account.from_key(settings.BLOCKCHAIN_PRIVATE_KEY)
        nonce = self.w3.eth.get_transaction_count(account.address)
        tx = contract.functions.revokeCertificate(certificate_id).build_transaction(
            {
                "from": account.address,
                "nonce": nonce,
                "gas": 200000,
                "gasPrice": self.w3.eth.gas_price,
            }
        )
        signed = self.w3.eth.account.sign_transaction(tx, settings.BLOCKCHAIN_PRIVATE_KEY)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()
