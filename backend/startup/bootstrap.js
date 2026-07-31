const logger = require("../utils/logger");
const blockchainService = require("../services/blockchainService");
const ccipService = require("../services/ccipService");
const oracleService = require("../services/oracleService");
const keystore = require("../utils/keystore");
const startListener = require("../services/blockchainListener");
const createAdmin = require("../scripts/create-admin");
const { startAuctionSettlementJob } = require("../jobs/auctionSettlement");

const runStartupTasks = async (port) => {
  logger.info(`CropChain API server running on port ${port}`);
  logger.info(`Health check: http://localhost:${port}/api/health`);
  logger.info(`WebSocket endpoint: ws://localhost:${port}`);

  // Create admin user on startup
  await createAdmin();

  logger.info("Admin user created successfully");
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info("Security features enabled", {
    nosqlInjectionProtection: true,
    inputValidation: true,
    securityHeaders: true,
    requestLogging: true,
    jwtAuth: true,
    adminRoleAuth: true,
    websockets: true,
  });

  if (process.env.NODE_ENV === "production") {
    if (!process.env.MONGODB_URI) {
      logger.warn("MONGODB_URI not set - using in-memory storage");
    }
    if (!process.env.JWT_SECRET) {
      logger.warn("JWT_SECRET not set - authentication will not work");
    }
    if (!blockchainService.isAvailable()) {
      logger.warn("Blockchain configuration incomplete - running in demo mode");
    }
  }

  logger.info("Server startup complete");

  // Ensure the blockchain signer (encrypted keystore / KMS / Vault / legacy env)
  // has been resolved before starting any consumers of the contract.
  await blockchainService.initialize();

  // Start background auction settlement check
  startAuctionSettlementJob();

  // Start blockchain event listener
  const contract = blockchainService.getContract();
  if (contract) {
    try {
      startListener(contract);
      logger.info("Blockchain event listener started");
    } catch (error) {
      logger.error("Failed to start blockchain listener", {
        error: error.message,
      });
    }
  } else {
    logger.info("Skipping blockchain listener: no contract instance available");
  }

  // Initialize CCIP dispatch service.
  if (await ccipService.initialize()) {
    logger.info("CCIP service initialized");
  } else {
    logger.info("CCIP service not configured - cross-chain dispatch disabled");
  }

  // Start Oracle service for IoT data verification if blockchain is active
  if (
    process.env.ORACLE_ENABLED === "true" &&
    blockchainService.isAvailable() &&
    keystore.hasSigningMaterial("oracle")
  ) {
    try {
      await oracleService.initialize();
      logger.info("Oracle service started successfully");
    } catch (error) {
      logger.error("Failed to start Oracle service", { error: error.message });
      logger.warn("Continuing without Oracle service");
    }
  } else {
    logger.info("Oracle service disabled: set ORACLE_ENABLED=true to enable");
  }
};

module.exports = { runStartupTasks };
