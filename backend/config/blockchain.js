const { ethers } = require("ethers");
const logger = require("../utils/logger");
const keystore = require("../utils/keystore");

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
 * NOTE: This function is now async. A previous version fell back to a hardcoded
 * dummy private key (0x000...001) when PRIVATE_KEY was unset, which silently
 * signed real transactions with a publicly-known key. We now refuse to create a
 * wallet when no signing material is configured.
 *
 * @returns {Promise<ethers.Contract|null>} Contract instance or null if not configured
 */
async function initialize() {
  if (_initPromise) {
    return _initPromise;
  }

  if (!PROVIDER_URL || !CONTRACT_ADDRESS) {
    logger.warn(
      "Blockchain not configured: Missing INFURA_URL or CONTRACT_ADDRESS",
    );
    return null;
  }

  if (!keystore.hasSigningMaterial("default")) {
    logger.error(
      "Blockchain not initialized: no signing credentials configured. " +
        "Set up an encrypted keystore (WALLET_KEYSTORE_*), AWS KMS, Vault, " +
        "or PRIVATE_KEY env var. Refusing to fall back to a dummy key.",
    );
    return null;
  }

  _initPromise = (async () => {
    try {
      provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      wallet = await keystore.loadWallet(provider, "default");
      if (!wallet) {
        logger.error(
          "Blockchain not initialized: keystore.loadWallet() returned null.",
        );
        return null;
      }
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
  })();

  return _initPromise;
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

/**
 * Get contract instance. If not yet initialized, returns the pending init
 * promise (callers that need the instance synchronously should await
 * initialize() first, as BlockchainService.initialize() does).
 * @returns {ethers.Contract|Promise<ethers.Contract|null>|null}
 */
function getContract() {
  if (!contractInstance) {
    return initialize();
  }
  return contractInstance;
}

module.exports = {
  initialize,
  getContract,
  getProvider,
  getWallet,
  contractABI,
};
