const express = require("express");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const errorHandlerMiddleware = require("./middleware/errorHandler");
const setupMiddleware = require("./startup/middleware");
const mongoose = require("mongoose");
const blockchainService = require("./services/blockchainService");

// Validate stage mapping on startup to prevent blockchain sync failures
const { validateStageMapping } = require("./constants/stages");
try {
  validateStageMapping();
} catch (error) {
  logger.error("CRITICAL ERROR: stage mapping validation failed", {
    error: error.message,
  });
  process.exit(1);
}

// Connect to Database
connectDB();

const app = express();

// ==================== MIDDLEWARE SETUP ====================
setupMiddleware(app);

// ==================== BLOCKCHAIN SERVICE INITIALIZATION ====================
if (process.env.NODE_ENV !== "test") {
  try {
    blockchainService.validateEnvironment();
  } catch (error) {
    logger.error("Blockchain configuration error", { error: error.message });
  }
}

const { validateEnv } = require("./utils/envValidator");
const keystore = require("./utils/keystore");
const REQUIRED_ENV_VARS = [
  "INFURA_URL",
  "CONTRACT_ADDRESS",
  "JWT_SECRET",
  "MONGODB_URI",
];
if (process.env.NODE_ENV !== "test") {
  REQUIRED_ENV_VARS.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  if (!keystore.hasSigningMaterial("default")) {
    throw new Error(
      "Missing blockchain signing credentials: set WALLET_KEYSTORE_PATH + " +
        "WALLET_KEYSTORE_PASSWORD (recommended), AWS KMS, HashiCorp Vault, or " +
        "PRIVATE_KEY (deprecated).",
    );
  }
  validateEnv();
}

// ==================== ROUTES ====================
const mainRoutes = require("./routes/index");
const oracleRoutes = require("./routes/oracle");
const authRoutes = require("./routes/authRoutes");
const verificationRoutes = require("./routes/verification");
const approvalRoutes = require("./routes/approvalRoutes");
const recommendRoutes = require("./routes/recommendRoutes");
const activityRoutes = require("./routes/activityRoutes");
const auctionRoutes = require("./routes/auctionRoutes");
const lifecycleRoutes = require("./routes/lifecycleRoutes");
const batchRoutes = require("./routes/batchRoutes");
const aiRoutes = require("./routes/aiRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const logisticsRoutes = require("./routes/logisticsRoutes");
const iotRoutes = require("./routes/iotRoutes");
const nftRoutes = require("./routes/nftRoutes");
const {
  authLimiter,
  registerLimiter,
  generalLimiter,
  batchLimiter,
  aiLimiter,
} = require("./middleware/rateLimiters");
const apiResponse = require("./utils/apiResponse");

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      blockchain: blockchainService.isAvailable() ? "connected" : "demo mode",
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    },
  });
});

app.use("/api", mainRoutes);
app.use("/api/oracle", oracleRoutes);
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "CropChain API Documentation",
  }),
);

// Log rate limit violations
app.use((err, req, res, next) => {
  if (res.statusCode === 429) {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
  }
  next(err);
});

// Auth Routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password/:token", authLimiter);
app.use("/api/auth", authRoutes);

// Other Routes
app.use("/api/verification", generalLimiter, verificationRoutes);
app.use("/api/recommend", aiLimiter, recommendRoutes);
app.use("/api/activities", generalLimiter, activityRoutes);
app.use("/api/approvals", batchLimiter, approvalRoutes);
app.use("/api/auctions", generalLimiter, auctionRoutes);

// Batches & Lifecycle
app.use("/api/batches", generalLimiter, lifecycleRoutes);
app.use("/api/batches", batchLimiter, batchRoutes);

// AI Chat
app.use("/api/ai", aiLimiter, aiRoutes);

// Notifications & Logistics
app.use("/api/notifications", notificationRoutes);
app.use("/api/logistics", generalLimiter, logisticsRoutes);

// Dynamic NFT Routes
app.use("/api/nft", generalLimiter, nftRoutes);

// IoT Data Ingestion
app.use("/api/iot", generalLimiter, iotRoutes);

// 404 handler
app.use("*", (req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  const response = apiResponse.notFoundResponse(
    "Endpoint",
    `${req.method} ${req.originalUrl}`,
  );
  res.status(404).json(response);
});

// Comprehensive Error Handler - Must be last middleware
app.use(errorHandlerMiddleware);

module.exports = app;
