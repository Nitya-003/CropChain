const { ethers } = require('ethers');

const PROVIDER_URL = process.env.INFURA_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract ABI - aligned with CropChain.sol
const contractABI = [
    "event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator)",
    "event BatchUpdated(bytes32 indexed batchId, uint8 stage, string actorName, string location, address indexed updatedBy)",
    "function getBatch(bytes32 batchId) view returns (tuple(bytes32 batchId, bytes32 cropTypeHash, string ipfsCID, uint256 quantity, uint256 createdAt, address creator, bool exists, bool isRecalled))",
    "function getTotalBatches() view returns (uint256)",
    "function getBatchIdByIndex(uint256 index) view returns (bytes32)",
    "function createBatch(bytes32 batchId, bytes32 cropTypeHash, string calldata ipfsCID, uint256 quantity, string calldata actorName, string calldata location, string calldata notes) returns (bool)",
    "function updateBatch(bytes32 batchId, uint8 stage, string calldata actorName, string calldata location, string calldata notes) returns (bool)"
];

let contractInstance = null;
let provider = null;
let wallet = null;

/**
 * Initialize blockchain connection and return contract instance
 * @returns {ethers.Contract|null} Contract instance or null if not configured
 */
function getContract() {
    if (contractInstance) {
        return contractInstance;
    }

    if (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY) {
        console.warn('Blockchain not configured: Missing INFURA_URL, CONTRACT_ADDRESS, or PRIVATE_KEY');
        return null;
    }

    try {
        provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
        console.log('✓ Blockchain contract initialized');
        return contractInstance;
    } catch (error) {
        console.error('Failed to initialize blockchain connection:', error.message);
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
 * @returns {ethers.Wallet|null}
 */
function getWallet() {
    if (!wallet && PRIVATE_KEY && provider) {
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    }
    return wallet;
}

module.exports = {
    getContract,
    getProvider,
    getWallet,
    contractABI
};
