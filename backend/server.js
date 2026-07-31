require("dotenv").config();
const http = require("http");
const app = require("./app");
const logger = require("./utils/logger");
const socketService = require("./services/socketService");
const setupErrorHandling = require("./startup/errorHandling");
const { gracefulShutdown } = require("./utils/shutdown");
const { runStartupTasks } = require("./startup/bootstrap");
const blockchainQueue = require("./services/blockchainQueue");
const blockchainWorker = require("./services/blockchainWorker");
const notificationQueue = require("./jobs/queue");
const notificationWorker = require("./jobs/worker");

setupErrorHandling();

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

socketService.initializeSocketIO(server);
logger.info("Socket.IO integration complete");

process.on("SIGTERM", () => gracefulShutdown(server, "SIGTERM"));
process.on("SIGINT", () => gracefulShutdown(server, "SIGINT"));

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, async () => {
    await runStartupTasks(PORT);
    logger.info(`CropChain API server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);

    try {
      blockchainQueue.initializeQueue();
      blockchainWorker.initializeWorker();
      logger.info(
        "BullMQ Queue and Worker initialized for blockchain transactions",
      );
    } catch (error) {
      logger.error("Failed to initialize BullMQ for blockchain jobs", {
        error: error.message,
      });
    }

    try {
      notificationQueue.initializeQueue();
      notificationWorker.initializeWorker();
      logger.info("BullMQ Queue and Worker initialized for notifications");
    } catch (error) {
      logger.error("Failed to initialize BullMQ for notifications", {
        error: error.message,
      });
    }

    try {
      const { startSpoilageRiskAgent } = require("./jobs/spoilageRiskAgent");
      startSpoilageRiskAgent(60000);
      logger.info("Background AI spoilage risk agent initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize background AI spoilage risk agent:", {
        error: error.message,
      });
    }
  });
}

module.exports = app;
