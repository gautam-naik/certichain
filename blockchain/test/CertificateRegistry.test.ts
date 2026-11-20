import { expect } from "chai";
import { ethers } from "hardhat";

describe("CertificateRegistry", function () {
  const sampleId = "CERT-2026-000101";
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("canonical-cert-payload-v1"));
  const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-cert-payload-v1"));

  async function deployFixture() {
    const [owner, issuer, unauthorized, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Factory.deploy();
    await registry.waitForDeployment();
    return { registry, owner, issuer, unauthorized, other };
  }

  it("registers a certificate successfully by owner or authorized issuer", async function () {
    const { registry, owner, issuer } = await deployFixture();

    await expect(registry.connect(owner).registerCertificate(sampleId, sampleHash))
      .to.emit(registry, "CertificateIssued");

    await registry.connect(owner).addIssuer(issuer.address);
    expect(await registry.authorizedIssuers(issuer.address)).to.equal(true);

    const secondId = "CERT-2026-000102";
    await expect(registry.connect(issuer).registerCertificate(secondId, sampleHash))
      .to.emit(registry, "CertificateIssued");
  });

  it("rejects duplicate certificate registration", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).registerCertificate(sampleId, sampleHash);

    await expect(
      registry.connect(owner).registerCertificate(sampleId, sampleHash)
    ).to.be.revertedWith("Certificate already registered");
  });

  it("rejects unauthorized issuance", async function () {
    const { registry, unauthorized } = await deployFixture();
    await expect(
      registry.connect(unauthorized).registerCertificate(sampleId, sampleHash)
    ).to.be.revertedWith("Caller is not an authorized issuer");
  });

  it("verifies an authentic certificate and detects incorrect hashes", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).registerCertificate(sampleId, sampleHash);

    const validRes = await registry.verifyCertificate(sampleId, sampleHash);
    expect(validRes.exists).to.equal(true);
    expect(validRes.hashMatches).to.equal(true);
    expect(validRes.revoked).to.equal(false);
    expect(validRes.issuer).to.equal(owner.address);

    const invalidRes = await registry.verifyCertificate(sampleId, tamperedHash);
    expect(invalidRes.exists).to.equal(true);
    expect(invalidRes.hashMatches).to.equal(false);
    expect(invalidRes.revoked).to.equal(false);

    const missingRes = await registry.verifyCertificate("CERT-MISSING", sampleHash);
    expect(missingRes.exists).to.equal(false);
  });

  it("revokes a certificate by owner and reflects revoked state", async function () {
    const { registry, owner } = await deployFixture();
    await registry.connect(owner).registerCertificate(sampleId, sampleHash);

    await expect(registry.connect(owner).revokeCertificate(sampleId))
      .to.emit(registry, "CertificateRevoked");

    const res = await registry.verifyCertificate(sampleId, sampleHash);
    expect(res.exists).to.equal(true);
    expect(res.revoked).to.equal(true);
  });

  it("rejects unauthorized revocation and issuer removal", async function () {
    const { registry, owner, issuer, unauthorized } = await deployFixture();
    await registry.connect(owner).registerCertificate(sampleId, sampleHash);
    await registry.connect(owner).addIssuer(issuer.address);

    await expect(
      registry.connect(unauthorized).revokeCertificate(sampleId)
    ).to.be.revertedWith("Caller is not the contract owner");

    await expect(
      registry.connect(issuer).revokeCertificate(sampleId)
    ).to.be.revertedWith("Caller is not the contract owner");

    await registry.connect(owner).removeIssuer(issuer.address);
    expect(await registry.authorizedIssuers(issuer.address)).to.equal(false);
  });
});
