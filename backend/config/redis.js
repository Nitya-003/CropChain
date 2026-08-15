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
const logger = require("../utils/logger");

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
      logger.error("[Redis] Max connection retries reached");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    logger.warn(
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
      logger.warn("[Redis] Reconnecting due to error", { error: err.message });
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
      logger.info("✓ Redis connection established");
    });

    redisConnection.on("ready", () => {
      logger.info("✓ Redis connection ready");
    });

    redisConnection.on("error", (err) => {
      logger.error("❌ Redis connection error", { error: err.message });
    });

    redisConnection.on("close", () => {
      logger.warn("⚠️ Redis connection closed");
    });

    redisConnection.on("reconnecting", () => {
      logger.warn("🔄 Redis reconnecting...");
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
  const connection = new Redis({
    ...connectionOptions,
    maxRetriesPerRequest: null, // BullMQ requires this to be null
  });

  // BullMQ does not attach an 'error' listener to the user-provided
  // connection. If the ioredis client emits 'error' with no listener
  // (e.g. during a Redis failover / socket disconnect), Node treats it as
  // an unhandled error and the process crashes with
  // UnhandledPromiseRejectionError. Log the error here and let ioredis
  // recover via retryStrategy / reconnectOnError instead of crashing.
  connection.on("error", (err) => {
    logger.error("❌ BullMQ Redis connection error", {
      error: err.message,
    });
  });
  connection.on("close", () => {
    logger.warn("⚠️ BullMQ Redis connection closed");
  });
  connection.on("reconnecting", (delay) => {
    logger.warn(
      `🔄 BullMQ Redis reconnecting in ${delay}ms...`,
    );
  });

  return connection;
}

/**
 * Close Redis connection gracefully
 */
async function closeRedisConnection() {
  if (redisConnection) {
    try {
      await redisConnection.quit();
      logger.info("✓ Redis connection closed gracefully");
      redisConnection = null;
    } catch (err) {
      logger.error("❌ Error closing Redis connection", { error: err.message });
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
    logger.error("❌ Redis health check failed", { error: err.message });
    return false;
  }
}

/**
 * Create dedicated Redis Pub/Sub client instances for Socket.IO horizontal scaling
 * @returns {{ pubClient: Redis, subClient: Redis }} Dedicated pub/sub connections
 */
function createPubSubClients() {
  const pubClient = new Redis({
    ...connectionOptions,
    maxRetriesPerRequest: null,
  });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (err) => {
    logger.error("❌ Redis PubClient error", { error: err.message });
  });

  subClient.on("error", (err) => {
    logger.error("❌ Redis SubClient error", { error: err.message });
  });

  return { pubClient, subClient };
}

module.exports = {
  getRedisConnection,
  createQueueConnection,
  createPubSubClients,
  closeRedisConnection,
  checkRedisHealth,
  connectionOptions,
};
