/**
 * Blockchain Transaction Worker
 *
 * This worker processes blockchain transaction jobs from the BullMQ queue.
 * It handles gas estimation, transaction submission, retries, and error handling.
 *
 * Features:
 * - Intelligent gas estimation with dynamic adjustment
 * - Exponential backoff retry for network issues
 * - Transaction confirmation tracking
 * - Database sync status updates
 * - Comprehensive error handling and logging
 */

const { Worker } = require("bullmq");
const { ethers } = require("ethers");
const { createQueueConnection } = require("../config/redis");
const { QUEUE_NAMES, JOB_TYPES } = require("./blockchainQueue");
const Batch = require("../models/Batch");
const User = require("../models/User");
const { getStageNumber } = require("../constants/stages");
const { addEmailJob } = require("../jobs/queue");

// Gas configuration
const GAS_CONFIG = {
  maxFeePerGas: ethers.parseUnits("100", "gwei"), // Max 100 gwei
  maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"), // 2 gwei priority fee
  gasLimitMultiplier: 1.2, // 20% buffer on gas limit
  maxRetriesOnHighGas: 3, // Max retries when gas is too high
  waitForConfirmations: parseInt(process.env.BLOCKCHAIN_CONFIRMATIONS, 10) || 2,
};

// Worker instance
let worker = null;

// Blockchain connection
let provider = null;
let wallet = null;
let contract = null;

// Contract ABI
const contractABI = [
  "event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator)",
  "event BatchUpdated(bytes32 indexed batchId, uint8 stage, string actorName, string location, address indexed updatedBy)",
  "function getBatch(bytes32 batchId) view returns (tuple(bytes32 batchId, bytes32 cropTypeHash, string ipfsCID, uint256 quantity, uint256 createdAt, address creator, bool exists, bool isRecalled))",
  "function createBatch(bytes32 batchId, bytes32 cropTypeHash, string calldata ipfsCID, uint256 quantity, string calldata actorName, string calldata location, string calldata notes) returns (bool)",
  "function updateBatch(bytes32 batchId, uint8 stage, string calldata actorName, string calldata location, string calldata notes) returns (bool)",
];

/**
 * Initialize blockchain connection
 */
function initializeBlockchain() {
  const PROVIDER_URL = process.env.INFURA_URL;
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY) {
    console.warn(
      "[Worker] Blockchain not configured - running in simulation mode",
    );
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
    console.log("✓ Worker blockchain connection initialized");
    return true;
  } catch (error) {
    console.error("[Worker] Failed to initialize blockchain:", error.message);
    return false;
  }
}

/**
 * Estimate gas with buffer
 * @param {Function} contractMethod - Contract method to estimate gas for
 * @param {Array} args - Method arguments
 * @returns {Promise<bigint>} Estimated gas with buffer
 */
async function estimateGasWithBuffer(contractMethod, args) {
  try {
    const gasEstimate = await contractMethod.estimateGas(...args);
    const gasWithBuffer =
      (gasEstimate * BigInt(Math.floor(GAS_CONFIG.gasLimitMultiplier * 100))) /
      100n;
    console.log(
      `[Worker] Gas estimate: ${gasEstimate.toString()}, with buffer: ${gasWithBuffer.toString()}`,
    );
    return gasWithBuffer;
  } catch (error) {
    console.error("[Worker] Gas estimation failed:", error.message);
    // Return a safe default if estimation fails
    return 500000n; // Safe default for batch operations
  }
}

/**
 * Get current gas price with EIP-1559 support
 * @returns {Promise<Object>} Gas price parameters
 */
async function getGasPrice() {
  try {
    const feeData = await provider.getFeeData();

    return {
      maxFeePerGas: feeData.maxFeePerGas || GAS_CONFIG.maxFeePerGas,
      maxPriorityFeePerGas:
        feeData.maxPriorityFeePerGas || GAS_CONFIG.maxPriorityFeePerGas,
    };
  } catch (error) {
    console.error("[Worker] Failed to get gas price:", error.message);
    return {
      maxFeePerGas: GAS_CONFIG.maxFeePerGas,
      maxPriorityFeePerGas: GAS_CONFIG.maxPriorityFeePerGas,
    };
  }
}

/**
 * Wait for transaction confirmation with timeout
 * @param {Object} tx - Transaction object
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Transaction receipt
 */
async function waitForConfirmation(tx, timeout = 60000) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(async () => {
      console.log(
        `[Worker] Timeout waiting for ${tx.hash}, polling for receipt with grace period...`,
      );
      try {
        const receipt = await pollForReceipt(tx.hash, 30000);
        if (receipt) {
          console.log(
            `[Worker] Receipt found during grace period for ${tx.hash}`,
          );
          resolve(receipt);
          return;
        }
      } catch (pollError) {
        // Grace period polling failed
      }
      reject(new Error("Transaction confirmation timeout"));
    }, timeout);

    try {
      const receipt = await tx.wait(GAS_CONFIG.waitForConfirmations);
      clearTimeout(timeoutId);
      resolve(receipt);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Poll for a transaction receipt with timeout
 * Used as fallback when tx.wait() times out
 * @param {string} txHash - Transaction hash
 * @param {number} timeout - Polling timeout in milliseconds
 * @returns {Promise<Object|null>} Transaction receipt or null
 */
async function pollForReceipt(txHash, timeout = 30000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (err) {
      console.log(`[Worker] Receipt poll error for ${txHash}: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return null;
}

/**
 * Process createBatch job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Job result
 */
async function processCreateBatch(job) {
  const { batchId, data } = job.data;
  console.log(`[Worker] Processing createBatch for ${batchId}`);

  // Update progress
  await job.updateProgress(10);

  // Check if blockchain is configured
  if (!contract) {
    console.log(
      `[Worker] No blockchain connection - marking ${batchId} as pending`,
    );
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "pending",
          "blockchainJob.jobId": job.id,
          "blockchainJob.status": "simulated",
        },
      },
    );
    return { success: true, simulated: true, batchId };
  }

  try {
    // Update batch status to processing
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "pending",
          "blockchainJob.jobId": job.id,
          "blockchainJob.status": "processing",
          "blockchainJob.attempts": job.attemptsMade + 1,
        },
      },
    );

    await job.updateProgress(20);

    // Prepare blockchain data
    const batchIdBytes32 = ethers.encodeBytes32String(batchId);
    const cropTypeHash = ethers.encodeBytes32String(data.cropType || "unknown");
    const ipfsCID = data.ipfsCID || "";
    const quantity = data.quantity;
    const actorName = data.farmerName || "";
    const location = data.origin || "";
    const notes = data.description || "";

    await job.updateProgress(30);

    // Guard: check if the batch already exists on-chain (e.g. prior attempt succeeded but receipt timed out)
    try {
      const onChainBatch = await contract.getBatch(batchIdBytes32);
      if (onChainBatch.exists) {
        console.log(
          `[Worker] Batch ${batchId} already exists on-chain, skipping duplicate submission`,
        );
        await Batch.updateOne(
          { batchId },
          {
            $set: {
              syncStatus: "synced",
              "blockchainJob.status": "completed",
              "blockchainJob.completedAt": new Date(),
            },
          },
        );
        await job.updateProgress(100);
        return { success: true, batchId, skipped: true };
      }
    } catch (err) {
      console.log(
        `[Worker] Could not verify on-chain status for ${batchId}: ${err.message}`,
      );
    }

    // Estimate gas
    const gasLimit = await estimateGasWithBuffer(contract.createBatch, [
      batchIdBytes32,
      cropTypeHash,
      ipfsCID,
      quantity,
      actorName,
      location,
      notes,
    ]);

    await job.updateProgress(40);

    // Get gas price
    const gasPrice = await getGasPrice();
    console.log(
      `[Worker] Gas price - maxFee: ${ethers.formatUnits(gasPrice.maxFeePerGas, "gwei")} gwei`,
    );

    await job.updateProgress(50);

    // Submit transaction
    const tx = await contract.createBatch(
      batchIdBytes32,
      cropTypeHash,
      ipfsCID,
      quantity,
      actorName,
      location,
      notes,
      {
        gasLimit,
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      },
    );

    console.log(`[Worker] Transaction submitted: ${tx.hash}`);
    await job.updateProgress(60);

    // Update batch with transaction hash
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          blockchainHash: tx.hash,
          "blockchainJob.txHash": tx.hash,
          "blockchainJob.submittedAt": new Date(),
        },
      },
    );

    // Wait for confirmation
    const receipt = await waitForConfirmation(tx);
    console.log(
      `[Worker] Transaction confirmed in block ${receipt.blockNumber}`,
    );

    await job.updateProgress(90);

    // Update batch as synced
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "synced",
          "blockchainJob.status": "completed",
          "blockchainJob.completedAt": new Date(),
          "blockchainJob.blockNumber": receipt.blockNumber,
        },
      },
    );

    // Send email notification for blockchain confirmation
    try {
      const batchDoc = await Batch.findOne({ batchId }).lean();
      if (batchDoc) {
        const farmer = await User.findById(batchDoc.farmerId).lean();
        if (farmer && farmer.email) {
          await addEmailJob(
            farmer.email,
            `Blockchain Confirmation: Batch ${batchId} Created`,
            `<h2>Batch Creation Confirmed</h2>
                        <p>Hello ${farmer.name},</p>
                        <p>Your batch <strong>${batchId}</strong> has been successfully recorded on the blockchain.</p>
                        <p>Transaction Hash: <a href="https://sepolia.etherscan.io/tx/${tx.hash}">${tx.hash}</a></p>
                        <p>Block Number: ${receipt.blockNumber}</p>
                        <p>CropChain Team</p>`,
          );
        }
      }
    } catch (err) {
      console.error(
        `[Worker] Failed to queue email for ${batchId}:`,
        err.message,
      );
    }

    await job.updateProgress(100);

    return {
      success: true,
      batchId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error(`[Worker] createBatch failed for ${batchId}:`, error.message);

    // Check if error is recoverable
    const isRecoverable = isRecoverableError(error);

    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "error",
          "blockchainJob.status": isRecoverable ? "retrying" : "failed",
          "blockchainJob.error": error.message,
          "blockchainJob.lastAttemptAt": new Date(),
        },
      },
    );

    // If recoverable, throw to trigger retry
    if (isRecoverable) {
      throw error;
    }

    // If not recoverable, return failure (no retry)
    return {
      success: false,
      batchId,
      error: error.message,
      recoverable: false,
    };
  }
}

/**
 * Process updateBatch job
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Job result
 */
async function processUpdateBatch(job) {
  const { batchId, data } = job.data;
  console.log(`[Worker] Processing updateBatch for ${batchId}`);

  await job.updateProgress(10);

  if (!contract) {
    console.log(
      `[Worker] No blockchain connection - marking ${batchId} update as pending`,
    );
    return { success: true, simulated: true, batchId };
  }

  try {
    // Update batch status
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "pending",
          "blockchainJob.jobId": job.id,
          "blockchainJob.status": "processing",
          "blockchainJob.attempts": job.attemptsMade + 1,
        },
      },
    );

    await job.updateProgress(20);

    // Prepare update data
    const batchIdBytes32 = ethers.encodeBytes32String(batchId);
    const stage = mapStageToNumber(data.stage);
    const actorName = data.actor || "";
    const location = data.location || "";
    const notes = data.notes || "";

    await job.updateProgress(30);

    // Guard: check if a previous transaction for this batch already confirmed
    try {
      const prevBatchDoc = await Batch.findOne({ batchId }).lean();
      const prevTxHash =
        prevBatchDoc?.blockchainHash || prevBatchDoc?.blockchainJob?.txHash;
      if (prevTxHash) {
        const oldReceipt = await provider.getTransactionReceipt(prevTxHash);
        if (oldReceipt && oldReceipt.status === 1) {
          console.log(
            `[Worker] Previous tx ${prevTxHash} already confirmed for ${batchId}, skipping duplicate update`,
          );
          await Batch.updateOne(
            { batchId },
            {
              $set: {
                syncStatus: "synced",
                "blockchainJob.status": "completed",
                "blockchainJob.completedAt": new Date(),
              },
            },
          );
          await job.updateProgress(100);
          return { success: true, batchId, skipped: true };
        }
      }
    } catch (err) {
      console.log(
        `[Worker] Could not verify previous tx receipt for ${batchId}: ${err.message}`,
      );
    }

    // Estimate gas
    const gasLimit = await estimateGasWithBuffer(contract.updateBatch, [
      batchIdBytes32,
      stage,
      actorName,
      location,
      notes,
    ]);

    await job.updateProgress(40);

    // Get gas price
    const gasPrice = await getGasPrice();

    await job.updateProgress(50);

    // Submit transaction
    const tx = await contract.updateBatch(
      batchIdBytes32,
      stage,
      actorName,
      location,
      notes,
      {
        gasLimit,
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      },
    );

    console.log(`[Worker] Update transaction submitted: ${tx.hash}`);
    await job.updateProgress(60);

    // Update batch with transaction hash
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          blockchainHash: tx.hash,
          "blockchainJob.txHash": tx.hash,
          "blockchainJob.submittedAt": new Date(),
        },
      },
    );

    // Wait for confirmation
    const receipt = await waitForConfirmation(tx);
    console.log(`[Worker] Update confirmed in block ${receipt.blockNumber}`);

    await job.updateProgress(90);

    // Update batch as synced
    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "synced",
          "blockchainJob.status": "completed",
          "blockchainJob.completedAt": new Date(),
          "blockchainJob.blockNumber": receipt.blockNumber,
        },
      },
    );

    // Send email notification for blockchain update confirmation
    try {
      const batchDoc = await Batch.findOne({ batchId }).lean();
      if (batchDoc) {
        const farmer = await User.findById(batchDoc.farmerId).lean();
        if (farmer && farmer.email) {
          await addEmailJob(
            farmer.email,
            `Blockchain Confirmation: Batch ${batchId} Updated`,
            `<h2>Batch Update Confirmed</h2>
                        <p>Hello ${farmer.name},</p>
                        <p>The update to your batch <strong>${batchId}</strong> has been successfully recorded on the blockchain.</p>
                        <p>Transaction Hash: <a href="https://sepolia.etherscan.io/tx/${tx.hash}">${tx.hash}</a></p>
                        <p>Block Number: ${receipt.blockNumber}</p>
                        <p>CropChain Team</p>`,
          );
        }
      }
    } catch (err) {
      console.error(
        `[Worker] Failed to queue email for update of ${batchId}:`,
        err.message,
      );
    }

    await job.updateProgress(100);

    return {
      success: true,
      batchId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error(`[Worker] updateBatch failed for ${batchId}:`, error.message);

    const isRecoverable = isRecoverableError(error);

    await Batch.updateOne(
      { batchId },
      {
        $set: {
          syncStatus: "error",
          "blockchainJob.status": isRecoverable ? "retrying" : "failed",
          "blockchainJob.error": error.message,
          "blockchainJob.lastAttemptAt": new Date(),
        },
      },
    );

    if (isRecoverable) {
      throw error;
    }

    return {
      success: false,
      batchId,
      error: error.message,
      recoverable: false,
    };
  }
}

/**
 * Map stage string to contract enum value
 * Uses centralized stage mapping from constants/stages.js
 * @param {string} stage - Stage name
 * @returns {number} Stage enum value
 */
function mapStageToNumber(stage) {
  return getStageNumber(stage);
}

/**
 * Check if error is recoverable (should retry)
 * @param {Error} error - Error object
 * @returns {boolean} True if error is recoverable
 */
function isRecoverableError(error) {
  const recoverablePatterns = [
    "network",
    "timeout",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "nonce too low",
    "replacement transaction underpriced",
    "insufficient funds for gas",
    "rate limit",
  ];

  const errorMessage = error.message?.toLowerCase() || "";
  return recoverablePatterns.some((pattern) =>
    errorMessage.includes(pattern.toLowerCase()),
  );
}

/**
 * Job processor function
 * @param {Object} job - BullMQ job
 * @returns {Promise<Object>} Job result
 */
async function processJob(job) {
  console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);

  switch (job.name) {
    case JOB_TYPES.CREATE_BATCH:
      return processCreateBatch(job);
    case JOB_TYPES.UPDATE_BATCH:
      return processUpdateBatch(job);
    case JOB_TYPES.RECALL_BATCH:
      // Recalls are handled similarly to updates
      return processUpdateBatch(job);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}

/**
 * Initialize the worker
 * @returns {Worker} BullMQ Worker instance
 */
function initializeWorker() {
  if (worker) {
    return worker;
  }

  // Initialize blockchain connection
  initializeBlockchain();

  const connection = createQueueConnection();

  worker = new Worker(QUEUE_NAMES.BLOCKCHAIN, processJob, {
    connection,
    concurrency: parseInt(process.env.BLOCKCHAIN_WORKER_CONCURRENCY, 10) || 3,
    limiter: {
      max: parseInt(process.env.BLOCKCHAIN_RATE_LIMIT_MAX, 10) || 10,
      duration: parseInt(process.env.BLOCKCHAIN_RATE_LIMIT_WINDOW, 10) || 60000, // 10 transactions per minute
    },
  });

  // Worker event handlers
  worker.on("completed", (job, result) => {
    console.log(`[Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", err.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
  });

  console.log("✓ Blockchain transaction worker started");
  return worker;
}

/**
 * Get worker instance
 * @returns {Worker|null}
 */
function getWorker() {
  return worker;
}

/**
 * Stop the worker gracefully
 */
async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    console.log("✓ Blockchain worker stopped");
  }
}

/**
 * Get worker statistics
 * @returns {Object} Worker stats
 */
function getWorkerStats() {
  if (!worker) {
    return { running: false };
  }

  return {
    running: true,
    isRunning: worker.isRunning(),
    isPaused: worker.isPaused(),
  };
}

module.exports = {
  initializeWorker,
  getWorker,
  stopWorker,
  getWorkerStats,
  processJob,
  processCreateBatch,
  processUpdateBatch,
  initializeBlockchain,
};
