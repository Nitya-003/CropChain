const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("=== Deploying CropChain UUPS Upgradeable Proxy ===");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );

  const CropChainFactory = await ethers.getContractFactory("CropChainUpgradeable");

  console.log("Deploying UUPS Proxy and Implementation...");
  const cropChainProxy = await upgrades.deployProxy(CropChainFactory, [], {
    kind: "uups",
    initializer: "initialize",
  });

  await cropChainProxy.waitForDeployment();
  const proxyAddress = await cropChainProxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("✅ CropChain UUPS Proxy deployed to:", proxyAddress);
  console.log("✅ CropChain Implementation deployed to:", implementationAddress);

  const owner = await cropChainProxy.owner();
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasAdmin = await cropChainProxy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);

  console.log("\n=== State & RBAC Verification ===");
  console.log("Contract Owner:", owner);
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", hasAdmin);
  console.log("Total Batches:", (await cropChainProxy.getTotalBatches()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
