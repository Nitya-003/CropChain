const { ethers } = require("ethers");
const logger = require("../utils/logger");

const PROVIDER_URL =
  process.env.INFURA_URL ||
  process.env.SEPOLIA_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Contract ABI - aligned with CropChain.sol
const contractABI = [
  "event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator)",
  "event BatchUpdated(bytes32 indexed batchId, uint8 stage, string actorName, string location, address indexed updatedBy)",
  "function getBatch(bytes32 batchId) view returns (tuple(bytes32 batchId, bytes32 cropTypeHash, string ipfsCID, uint256 quantity, uint256 createdAt, address creator, bool exists, bool isRecalled))",
  "function getTotalBatches() view returns (uint256)",
  "function getBatchIdByIndex(uint256 index) view returns (bytes32)",
  "function createBatch(bytes32 batchId, bytes32 cropTypeHash, string calldata ipfsCID, uint256 quantity, string calldata actorName, string calldata location, string calldata notes) returns (bool)",
  "function updateBatch(bytes32 batchId, uint8 stage, string calldata actorName, string calldata location, string calldata notes) returns (bool)",
  "function setRole(address user, uint8 role)",
  "function roles(address user) view returns (uint8)",
];

let contractInstance = null;
let provider = null;
let wallet = null;
let _initPromise = null;

/**
 * Initialize the blockchain connection.
 *
 * Signing credentials are resolved via utils/keystore (encrypted JSON keystore,
 * AWS KMS, HashiCorp Vault, or plaintext env var as a deprecated fallback) so
 * the raw private key is never read directly from an environment variable.
 *
 * @returns {Promise<ethers.Contract|null>} Contract instance or null if not configured
 */
function initialize() {
  if (_initPromise) {
    return _initPromise;
  }

  if (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY) {
    logger.warn(
      "Blockchain not configured: Missing INFURA_URL, CONTRACT_ADDRESS, or PRIVATE_KEY",
    );
    return null;
  }

  try {
    provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contractInstance = new ethers.Contract(
      CONTRACT_ADDRESS,
      contractABI,
      wallet,
    );
    logger.info("✓ Blockchain contract initialized");
    return contractInstance;
  } catch (error) {
    logger.error("Failed to initialize blockchain connection:", {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get provider instance
 * @returns {ethers.JsonRpcProvider|null}
 */
function getProvider() {
  if (!provider && PROVIDER_URL) {
    provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  }
  return provider;
}

/**
 * Get wallet instance
 * @returns {ethers.Wallet|null} Wallet instance or null if not ready/configured
 */
function getWallet() {
  return wallet;
}

module.exports = {
  initialize,
  getContract,
  getProvider,
  getWallet,
  contractABI,
};
