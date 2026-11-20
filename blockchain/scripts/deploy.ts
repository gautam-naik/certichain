import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CertificateRegistry with account:", deployer.address);

  const Factory = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("CertificateRegistry deployed to:", address);

  const outPath = path.resolve(__dirname, "../deployment.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        contractAddress: address,
        deployer: deployer.address,
        network: (await ethers.provider.getNetwork()).name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Saved deployment metadata to:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
