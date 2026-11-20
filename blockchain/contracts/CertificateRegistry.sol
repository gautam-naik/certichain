// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateRegistry
 * @notice Stores cryptographic SHA-256 certificate fingerprints on-chain
 *         without exposing sensitive personal student data.
 */
contract CertificateRegistry {
    struct Certificate {
        bytes32 certificateHash;
        address issuer;
        uint256 issuedAt;
        bool exists;
        bool revoked;
    }

    address public owner;
    mapping(bytes32 => Certificate) private certificates;
    mapping(address => bool) public authorizedIssuers;

    event CertificateIssued(
        bytes32 indexed certificateIdHash,
        bytes32 indexed certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );

    event CertificateRevoked(
        bytes32 indexed certificateIdHash,
        address indexed revokedBy,
        uint256 revokedAt
    );

    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the contract owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(
            authorizedIssuers[msg.sender] || msg.sender == owner,
            "Caller is not an authorized issuer"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender, msg.sender);
    }

    /**
     * @notice Computes the deterministic on-chain key for a certificate ID.
     */
    function getCertificateIdHash(
        string memory certificateId
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(certificateId));
    }

    /**
     * @notice Registers a new academic certificate SHA-256 fingerprint on-chain.
     * @param certificateId Unique human-readable certificate identifier (e.g., CERT-2026-8F4A12)
     * @param certificateHash 32-byte SHA-256 hash of canonical certificate metadata
     */
    function registerCertificate(
        string calldata certificateId,
        bytes32 certificateHash
    ) external onlyAuthorizedIssuer {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        require(certificateHash != bytes32(0), "Certificate hash cannot be zero");

        bytes32 idHash = getCertificateIdHash(certificateId);
        require(!certificates[idHash].exists, "Certificate already registered");

        certificates[idHash] = Certificate({
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            exists: true,
            revoked: false
        });

        emit CertificateIssued(idHash, certificateHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Verifies a certificate ID and candidate SHA-256 hash against the ledger.
     */
    function verifyCertificate(
        string calldata certificateId,
        bytes32 certificateHash
    )
        external
        view
        returns (
            bool exists,
            bool hashMatches,
            bool revoked,
            address issuer,
            uint256 issuedAt
        )
    {
        bytes32 idHash = getCertificateIdHash(certificateId);
        Certificate memory cert = certificates[idHash];
        if (!cert.exists) {
            return (false, false, false, address(0), 0);
        }
        return (
            true,
            cert.certificateHash == certificateHash,
            cert.revoked,
            cert.issuer,
            cert.issuedAt
        );
    }

    /**
     * @notice Retrieves stored on-chain record for a certificate ID.
     */
    function getCertificate(
        string calldata certificateId
    )
        external
        view
        returns (
            bytes32 certificateHash,
            address issuer,
            uint256 issuedAt,
            bool exists,
            bool revoked
        )
    {
        bytes32 idHash = getCertificateIdHash(certificateId);
        Certificate memory cert = certificates[idHash];
        return (
            cert.certificateHash,
            cert.issuer,
            cert.issuedAt,
            cert.exists,
            cert.revoked
        );
    }

    /**
     * @notice Permanently revokes an existing certificate. Restricted to contract administrator.
     */
    function revokeCertificate(string calldata certificateId) external onlyOwner {
        bytes32 idHash = getCertificateIdHash(certificateId);
        require(certificates[idHash].exists, "Certificate does not exist");
        require(!certificates[idHash].revoked, "Certificate already revoked");

        certificates[idHash].revoked = true;
        emit CertificateRevoked(idHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Authorizes an institutional wallet address to issue certificates.
     */
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid issuer address");
        require(!authorizedIssuers[issuer], "Issuer already authorized");
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer, msg.sender);
    }

    /**
     * @notice Removes issuance authorization from a wallet address.
     */
    function removeIssuer(address issuer) external onlyOwner {
        require(issuer != owner, "Cannot remove contract owner");
        require(authorizedIssuers[issuer], "Address is not an authorized issuer");
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer, msg.sender);
    }
}
