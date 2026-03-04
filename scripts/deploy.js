const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CropChain contract with RBAC...");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Deploy the contract
  const CropChain = await ethers.getContractFactory("CropChain");
  const cropChain = await CropChain.deploy();

  await cropChain.deployed();

  console.log("CropChain contract deployed to:", cropChain.address);
  console.log("Transaction hash:", cropChain.deployTransaction.hash);
  console.log("Gas used:", cropChain.deployTransaction.gasLimit.toString());

  // Verify deployment and RBAC setup
  console.log("\n=== Verifying RBAC Setup ===");
  
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const owner = await cropChain.owner();
  const hasAdminRole = await cropChain.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  
  console.log("Contract owner:", owner);
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", hasAdminRole);
  
  // Get role constants
  const FARMER_ROLE = await cropChain.FARMER_ROLE();
  const MANDI_ROLE = await cropChain.MANDI_ROLE();
  const TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
  const RETAILER_ROLE = await cropChain.RETAILER_ROLE();
  
  console.log("\n=== Role Constants ===");
  console.log("FARMER_ROLE:", FARMER_ROLE);
  console.log("MANDI_ROLE:", MANDI_ROLE);
  console.log("TRANSPORTER_ROLE:", TRANSPORTER_ROLE);
  console.log("RETAILER_ROLE:", RETAILER_ROLE);
  
  // Verify role hierarchy
  const farmerAdmin = await cropChain.getRoleAdmin(FARMER_ROLE);
  const mandiAdmin = await cropChain.getRoleAdmin(MANDI_ROLE);
  const transporterAdmin = await cropChain.getRoleAdmin(TRANSPORTER_ROLE);
  const retailerAdmin = await cropChain.getRoleAdmin(RETAILER_ROLE);
  
  console.log("\n=== Role Hierarchy ===");
  console.log("FARMER_ROLE admin:", farmerAdmin);
  console.log("MANDI_ROLE admin:", mandiAdmin);
  console.log("TRANSPORTER_ROLE admin:", transporterAdmin);
  console.log("RETAILER_ROLE admin:", retailerAdmin);
  
  // Test basic functionality
  const totalBatches = await cropChain.getTotalBatches();
  console.log("\n=== Contract State ===");
  console.log("Total batches:", totalBatches.toString());
  console.log("Contract paused:", await cropChain.paused());

  // Save deployment info
  const deploymentInfo = {
    contractAddress: cropChain.address,
    transactionHash: cropChain.deployTransaction.hash,
    deployer: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    blockNumber: cropChain.deployTransaction.blockNumber,
    gasUsed: cropChain.deployTransaction.gasLimit?.toString(),
    gasPrice: cropChain.deployTransaction.gasPrice?.toString(),
    timestamp: new Date().toISOString(),
    rbac: {
      DEFAULT_ADMIN_ROLE,
      FARMER_ROLE,
      MANDI_ROLE,
      TRANSPORTER_ROLE,
      RETAILER_ROLE
    }
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Update your .env file with contract address:");
  console.log(`   CONTRACT_ADDRESS=${cropChain.address}`);
  console.log("\n2. Grant roles to stakeholders:");
  console.log("   Example: cropChain.grantStakeholderRole(FARMER_ROLE, farmerAddress)");
  console.log("\n3. Verify the contract on block explorer (if on testnet/mainnet):");
  console.log(`   npx hardhat verify --network <network> ${cropChain.address}`);
  console.log("\n4. Update your frontend/backend to use this contract address");
  console.log("\n5. Run tests to verify RBAC functionality:");
  console.log("   npx hardhat test");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
