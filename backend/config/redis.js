/**
 * Redis Configuration for BullMQ Job Queue
 *
 * This module provides Redis connection configuration for the BullMQ job queue
 * that handles asynchronous blockchain transactions.
 *
 * Benefits:
 * - Prevents API timeouts during high gas periods
 * - Provides robust retry mechanism for failed transactions
 * - Ensures eventual consistency between database and blockchain
 */

const Redis = require("ioredis");

// Redis connection settings
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB, 10) || 0;

// Maximum retries for Redis connection
const MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES, 10) || 10;

// Connection options
const connectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  maxRetriesPerRequest: MAX_RETRIES,
  retryStrategy: (times) => {
    if (times > MAX_RETRIES) {
      console.error("[Redis] Max connection retries reached");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    console.log(
      `[Redis] Retrying connection in ${delay}ms (attempt ${times}/${MAX_RETRIES})`,
    );
    return delay;
  },
  enableReadyCheck: true,
  enableOfflineQueue: true,
  // Reconnect on error
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ECONNRESET", "ECONNREFUSED"];
    if (targetErrors.some((e) => err.message.includes(e))) {
      console.log("[Redis] Reconnecting due to error:", err.message);
      return true;
    }
    return false;
  },
};

// Create Redis connection instance
let redisConnection = null;

/**
 * Get or create Redis connection
 * @returns {Redis} Redis connection instance
 */
function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new Redis(connectionOptions);

    redisConnection.on("connect", () => {
      console.log("✓ Redis connection established");
    });

    redisConnection.on("ready", () => {
      console.log("✓ Redis connection ready");
    });

    redisConnection.on("error", (err) => {
      console.error("❌ Redis connection error:", err.message);
    });

    redisConnection.on("close", () => {
      console.log("⚠️ Redis connection closed");
    });

    redisConnection.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });
  }

  return redisConnection;
}

/**
 * Create a new Redis connection for BullMQ
 * BullMQ requires a new connection instance per queue
 * @returns {Redis} New Redis connection instance
 */
function createQueueConnection() {
  return new Redis({
    ...connectionOptions,
    maxRetriesPerRequest: null, // BullMQ requires this to be null
  });
}

/**
 * Close Redis connection gracefully
 */
async function closeRedisConnection() {
  if (redisConnection) {
    try {
      await redisConnection.quit();
      console.log("✓ Redis connection closed gracefully");
      redisConnection = null;
    } catch (err) {
      console.error("❌ Error closing Redis connection:", err.message);
      redisConnection.disconnect(false);
      redisConnection = null;
    }
  }
}

/**
 * Check Redis connection health
 * @returns {Promise<boolean>} True if Redis is healthy
 */
async function checkRedisHealth() {
  try {
    const connection = getRedisConnection();
    const result = await connection.ping();
    return result === "PONG";
  } catch (err) {
    console.error("❌ Redis health check failed:", err.message);
    return false;
  }
}

module.exports = {
  getRedisConnection,
  createQueueConnection,
  closeRedisConnection,
  checkRedisHealth,
  connectionOptions,
};
