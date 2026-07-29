'use strict';

const { ethers } = require('ethers');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

// ─── Provider / Contract config ───────────────────────────────────────────────
const PROVIDER_URL =
  process.env.INFURA_URL ||
  process.env.SEPOLIA_URL ||
  'https://ethereum-sepolia-rpc.publicnode.com';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Contract ABI - aligned with CropChain.sol
const contractABI = [
  'event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator)',
  'event BatchUpdated(bytes32 indexed batchId, uint8 stage, string actorName, string location, address indexed updatedBy)',
  'function getBatch(bytes32 batchId) view returns (tuple(bytes32 batchId, bytes32 cropTypeHash, string ipfsCID, uint256 quantity, uint256 createdAt, address creator, bool exists, bool isRecalled))',
  'function getTotalBatches() view returns (uint256)',
  'function getBatchIdByIndex(uint256 index) view returns (bytes32)',
  'function createBatch(bytes32 batchId, bytes32 cropTypeHash, string calldata ipfsCID, uint256 quantity, string calldata actorName, string calldata location, string calldata notes) returns (bool)',
  'function updateBatch(bytes32 batchId, uint8 stage, string calldata actorName, string calldata location, string calldata notes) returns (bool)',
  'function setRole(address user, uint8 role)',
  'function roles(address user) view returns (uint8)',
];

// ─── Cached instances ─────────────────────────────────────────────────────────
// These are populated lazily on first call to getContract() / getWallet()
let _provider = null;
let _wallet = null;
let _contractInstance = null;

// ─── Key retrieval ────────────────────────────────────────────────────────────

/**
 * Retrieves the blockchain signing private key securely.
 *
 * PRODUCTION  → fetches from AWS Secrets Manager using AWS_SECRET_ARN.
 *               The secret must be stored as JSON: { "private_key": "0x..." }
 *               PRIVATE_KEY must NOT be set in production.
 *
 * DEVELOPMENT → reads PRIVATE_KEY (or ETH_PRIVATE_KEY) from .env.
 *               Never use this path in production.
 *
 * @returns {Promise<string>} The private key as a 0x-prefixed hex string.
 */
async function getSigningKey() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.AWS_SECRET_ARN) {
      throw new Error(
        '[blockchain] Production requires AWS_SECRET_ARN to be set. ' +
        'Store your private key in AWS Secrets Manager and point ' +
        'AWS_SECRET_ARN at that secret. Never use PRIVATE_KEY in production.'
      );
    }

    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: process.env.AWS_SECRET_ARN,
      })
    );

    const secret = JSON.parse(response.SecretString);

    if (!secret.private_key) {
      throw new Error(
        '[blockchain] AWS Secrets Manager secret must contain a "private_key" field. ' +
        'Expected format: { "private_key": "0x..." }'
      );
    }

    return secret.private_key;
  }

  // ── Development / test fallback ──────────────────────────────────────────
  const devKey = process.env.PRIVATE_KEY || process.env.ETH_PRIVATE_KEY;

  if (!devKey) {
    throw new Error(
      '[blockchain] No signing key found. ' +
      'For local development set PRIVATE_KEY in your .env file. ' +
      'For production set AWS_SECRET_ARN instead.'
    );
  }

  return devKey;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the ethers.js provider, creating it once and caching it.
 * @returns {ethers.JsonRpcProvider|null}
 */
function getProvider() {
  if (_provider) return _provider;

  if (!PROVIDER_URL) {
    console.warn('[blockchain] No provider URL configured (INFURA_URL / SEPOLIA_URL).');
    return null;
  }

  _provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  return _provider;
}

/**
 * Returns the signing wallet, fetching the key securely on first call.
 * Caches the wallet after the first successful creation.
 *
 * @returns {Promise<ethers.Wallet|null>}
 */
async function getWallet() {
  if (_wallet) return _wallet;

  const provider = getProvider();
  if (!provider) return null;

  try {
    const privateKey = await getSigningKey();
    _wallet = new ethers.Wallet(privateKey, provider);
    return _wallet;
  } catch (err) {
    console.error('[blockchain] Failed to create wallet:', err.message);
    return null;
  }
}

/**
 * Returns the CropChain contract instance, creating it once and caching it.
 * Returns null (with a console warning) if configuration is incomplete.
 *
 * @returns {Promise<ethers.Contract|null>}
 */
async function getContract() {
  if (_contractInstance) return _contractInstance;

  if (!CONTRACT_ADDRESS) {
    console.warn('[blockchain] CONTRACT_ADDRESS is not set — blockchain features disabled.');
    return null;
  }

  const wallet = await getWallet();
  if (!wallet) {
    console.warn('[blockchain] Wallet unavailable — cannot create contract instance.');
    return null;
  }

  try {
    _contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
    console.log('✓ Blockchain contract initialised');
    return _contractInstance;
  } catch (err) {
    console.error('[blockchain] Failed to initialise contract:', err.message);
    return null;
  }
}

module.exports = {
  getContract,   // async — await it
  getWallet,     // async — await it
  getProvider,   // sync  — no await needed
  contractABI,
};