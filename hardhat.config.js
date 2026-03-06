require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();
const { ethers } = require("ethers");

/**
 * Generate a secure random private key for CI/CD environments
 * This ensures no hardcoded keys exist while maintaining test functionality
 */
function generateTestPrivateKey() {
  // Generate a cryptographically secure random private key
  const wallet = ethers.Wallet.createRandom();
  return wallet.privateKey;
}

/**
 * Get accounts array with secure fallback mechanism
 * @param {string} envKey - Environment variable name for private key
 * @returns {string[]} Array of private keys
 */
function getSecureAccounts(envKey) {
  const envPrivateKey = process.env[envKey];
  
  if (envPrivateKey && envPrivateKey.trim() !== "") {
    // Use provided private key from environment
    return [envPrivateKey.trim()];
  } else if (process.env.NODE_ENV === "test" || process.env.CI) {
    // For CI/CD testing, generate a random private key
    const testKey = generateTestPrivateKey();
    console.warn("⚠️  Using generated test private key for CI/CD environment");
    console.warn("   This key is randomly generated and should not hold real funds");
    return [testKey];
  } else {
    // For local development without env key, show clear error
    throw new Error(
      `❌ SECURITY ERROR: No ${envKey} found in environment variables!\n` +
      `   Please set ${envKey} in your .env file for blockchain transactions.\n` +
      `   For testing: Generate a new wallet at https://vanity-eth.tk/ or use: npx hardhat node\n` +
      `   NEVER use this address with real funds!`
    );
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Local development network
    localhost: {
      url: "http://127.0.0.1:8545",
      // For localhost, use the default Hardhat test accounts
      accounts: undefined // Let Hardhat manage accounts for local development
    },
    
    // Polygon Mumbai Testnet
    mumbai: {
      url: process.env.INFURA_URL || "https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID",
      accounts: getSecureAccounts("PRIVATE_KEY"),
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000
    },
    
    // Polygon Mainnet
    polygon: {
      url: process.env.POLYGON_URL || "https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID",
      accounts: getSecureAccounts("PRIVATE_KEY"),
      gasPrice: 30000000000, // 30 gwei
      gas: 6000000
    },
    
    // Ethereum Sepolia Testnet
    sepolia: {
      url: process.env.SEPOLIA_URL || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
      accounts: getSecureAccounts("PRIVATE_KEY"),
      gasPrice: 20000000000 // 20 gwei
    },
    
    // Ethereum Mainnet
    mainnet: {
      url: process.env.MAINNET_URL || "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
      accounts: getSecureAccounts("PRIVATE_KEY"),
      gasPrice: 20000000000 // 20 gwei
    }
  },
  
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY
    }
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  mocha: {
    timeout: 40000
  }
};
