const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CropChain contract...");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy the contract
  const CropChain = await ethers.getContractFactory("CropChain");
  const cropChain = await CropChain.deploy();

  await cropChain.deployed();

  console.log("CropChain contract deployed to:", cropChain.address);
  console.log("Transaction hash:", cropChain.deployTransaction.hash);

  // Verify deployment
  console.log("Verifying deployment...");
  const owner = await cropChain.owner();
  console.log("Contract owner:", owner);
  
  const totalBatches = await cropChain.getTotalBatches();
  console.log("Total batches:", totalBatches.toString());

  // Save deployment info
  const deploymentInfo = {
    contractAddress: cropChain.address,
    transactionHash: cropChain.deployTransaction.hash,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    blockNumber: cropChain.deployTransaction.blockNumber,
    gasUsed: cropChain.deployTransaction.gasLimit?.toString(),
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Update your .env file with the contract address:");
  console.log(`   CONTRACT_ADDRESS=${cropChain.address}`);
  console.log("\n2. Verify the contract on block explorer (if on testnet/mainnet):");
  console.log(`   npx hardhat verify --network <network> ${cropChain.address}`);
  console.log("\n3. Update your frontend/backend to use this contract address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
