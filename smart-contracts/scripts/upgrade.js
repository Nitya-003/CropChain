const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS || process.env.CONTRACT_ADDRESS;
  if (!proxyAddress) {
    throw new Error("PROXY_ADDRESS environment variable must be set to run contract upgrade.");
  }

  console.log("=== Upgrading CropChain UUPS Proxy ===");
  console.log("Target Proxy Address:", proxyAddress);

  const [deployer] = await ethers.getSigners();
  console.log("Executing upgrade with account:", deployer.address);

  const CropChainV2Factory = await ethers.getContractFactory("CropChainUpgradeable");
  
  console.log("Upgrading proxy contract implementation...");
  const upgradedProxy = await upgrades.upgradeProxy(proxyAddress, CropChainV2Factory, {
    kind: "uups",
  });

  await upgradedProxy.waitForDeployment();
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("✅ Proxy Upgrade Successful!");
  console.log("Proxy Address (Unchanged):", proxyAddress);
  console.log("New Implementation Address:", newImplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
