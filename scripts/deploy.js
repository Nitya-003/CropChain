const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Balance:", (await deployer.getBalance()).toString());

  // Deploy EventRegistry
  const EventRegistry = await ethers.getContractFactory("EventRegistry");
  const eventRegistry = await EventRegistry.deploy();
  await eventRegistry.deployed();

  console.log("EventRegistry deployed to:", eventRegistry.address);

  // Deploy CropChain with registry address
  const CropChain = await ethers.getContractFactory("CropChain");
  const cropChain = await CropChain.deploy(eventRegistry.address);
  await cropChain.deployed();

  console.log("CropChain deployed to:", cropChain.address);

  // Basic verification
  const owner = await cropChain.owner();
  console.log("CropChain owner:", owner);

  const totalBatches = await cropChain.getTotalBatches();
  console.log("Initial batches:", totalBatches.toString());

  console.log("\n=== Deployment Summary ===");
  console.log({
    eventRegistry: eventRegistry.address,
    cropChain: cropChain.address,
    network: (await ethers.provider.getNetwork()).name,
  });

  console.log("\nNext step:");
  console.log(`Update your .env with:
EVENT_REGISTRY=${eventRegistry.address}
CONTRACT_ADDRESS=${cropChain.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });