const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CropChain contract with RBAC...");

  // Get the ContractFactory and Signers
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );

  // Deploy the contract
  const CropChain = await ethers.getContractFactory("CropChain");
  const cropChain = await CropChain.deploy();

  await cropChain.waitForDeployment();
  const contractAddress = await cropChain.getAddress();

  const tx = cropChain.deploymentTransaction();
  const receipt = await tx.wait();

  console.log("CropChain contract deployed to:", contractAddress);
  console.log("Transaction hash:", tx.hash);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Verify deployment and RBAC setup
  console.log("\n=== Verifying RBAC Setup ===");

  const DEFAULT_ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const owner = await cropChain.owner();
  const hasAdminRole = await cropChain.hasRole(
    DEFAULT_ADMIN_ROLE,
    deployer.address,
  );

  console.log("Contract owner:", owner);
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", hasAdminRole);

  // Get role constants
  const FARMER_ROLE = await cropChain.FARMER_ROLE();
  const MANDI_ROLE = await cropChain.MANDI_ROLE();
  const TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
  const RETAILER_ROLE = await cropChain.RETAILER_ROLE();
  const ORACLE_ROLE = await cropChain.ORACLE_ROLE();

  console.log("\n=== Role Constants ===");
  console.log("FARMER_ROLE:", FARMER_ROLE);
  console.log("MANDI_ROLE:", MANDI_ROLE);
  console.log("TRANSPORTER_ROLE:", TRANSPORTER_ROLE);
  console.log("RETAILER_ROLE:", RETAILER_ROLE);
  console.log("ORACLE_ROLE:", ORACLE_ROLE);

  // Verify role hierarchy
  const farmerAdmin = await cropChain.getRoleAdmin(FARMER_ROLE);
  const mandiAdmin = await cropChain.getRoleAdmin(MANDI_ROLE);
  const transporterAdmin = await cropChain.getRoleAdmin(TRANSPORTER_ROLE);
  const retailerAdmin = await cropChain.getRoleAdmin(RETAILER_ROLE);
  const oracleAdmin = await cropChain.getRoleAdmin(ORACLE_ROLE);

  console.log("\n=== Role Hierarchy ===");
  console.log("FARMER_ROLE admin:", farmerAdmin);
  console.log("MANDI_ROLE admin:", mandiAdmin);
  console.log("TRANSPORTER_ROLE admin:", transporterAdmin);
  console.log("RETAILER_ROLE admin:", retailerAdmin);
  console.log("ORACLE_ROLE admin:", oracleAdmin);

  // Test basic functionality
  const totalBatches = await cropChain.getTotalBatches();
  console.log("\n=== Contract State ===");
  console.log("Total batches:", totalBatches.toString());
  console.log("Contract paused:", await cropChain.paused());

  // Grant ORACLE_ROLE to a test oracle address
  console.log("\n=== Setting up Oracle Role ===");
  const signers = await ethers.getSigners();
  const oracle = signers[2] || signers[0]; // Fallback if less signers

  if (oracle) {
    try {
      const grantOracleTx = await cropChain.grantStakeholderRole(
        ORACLE_ROLE,
        oracle.address,
      );
      await grantOracleTx.wait();
      console.log("ORACLE_ROLE granted to:", oracle.address);
      console.log("Transaction hash:", grantOracleTx.hash);
    } catch (error) {
      console.error("Failed to grant ORACLE_ROLE:", error.message);
    }
  }

  // Verify oracle role
  const hasOracleRole = oracle
    ? await cropChain.hasRole(ORACLE_ROLE, oracle.address)
    : false;
  console.log("Oracle has ORACLE_ROLE:", hasOracleRole);

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    transactionHash: tx.hash,
    deployer: deployer.address,
    oracle: oracle?.address || null,
    network: (await ethers.provider.getNetwork()).name,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: tx.gasPrice?.toString() || "0",
    timestamp: new Date().toISOString(),
    rbac: {
      DEFAULT_ADMIN_ROLE,
      FARMER_ROLE,
      MANDI_ROLE,
      TRANSPORTER_ROLE,
      RETAILER_ROLE,
      ORACLE_ROLE,
    },
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Update your .env file with contract address:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  console.log("\n2. Grant roles to stakeholders:");
  console.log(
    "   Example: cropChain.grantStakeholderRole(FARMER_ROLE, farmerAddress)",
  );
  console.log(
    "   Example: cropChain.grantStakeholderRole(ORACLE_ROLE, oracleAddress)",
  );
  console.log(
    "\n3. Verify the contract on block explorer (if on testnet/mainnet):",
  );
  console.log(`   npx hardhat verify --network <network> ${contractAddress}`);
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
