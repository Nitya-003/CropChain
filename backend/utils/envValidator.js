/**
 * Environment variable validation utility.
 * Ensures required env vars are set and have valid formats at startup.
 * Prevents cryptic runtime errors due to misconfiguration.
 */

const logger = require("./logger");

const REQUIRED_VARS = {
  MONGODB_URI: {
    description: "MongoDB connection string",
    validate: (v) =>
      v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"),
    hint: "Expected format: mongodb://host:port/db or mongodb+srv://...",
  },
  JWT_SECRET: {
    description: "JWT signing secret",
    validate: (v) => v.length >= 16,
    hint: "Minimum 16 characters. Generate with: openssl rand -hex 32",
  },
  JWT_REFRESH_SECRET: {
    description: "JWT refresh token secret (must differ from JWT_SECRET)",
    validate: (v) => v.length >= 16,
    hint: "Minimum 16 characters. Must NOT be the same as JWT_SECRET",
  },
  INFURA_URL: {
    description: "Infura RPC URL for blockchain interaction",
    validate: (v) => v.startsWith("https://") || v.startsWith("http://"),
    hint: "Expected format: https://polygon-mumbai.infura.io/v3/YOUR_KEY",
  },
  CONTRACT_ADDRESS: {
    description: "Deployed smart contract address",
    validate: (v) => /^0x[a-fA-F0-9]{40}$/.test(v),
    hint: "Expected format: 0x followed by 40 hexadecimal characters",
  },
  PRIVATE_KEY: {
    description: "Private key for blockchain transactions",
    validate: (v) => /^(0x)?[a-fA-F0-9]{64}$/.test(v),
    hint: "Expected a 64-character hex string (with or without 0x prefix)",
  },
  AUDIT_EVENT_HMAC_SECRET: {
    description: "HMAC secret for audit event hash-chain integrity",
    validate: (v) => v.length >= 32,
    hint: "Minimum 32 characters. Generate with: openssl rand -hex 32",
  },
};

const OPTIONAL_VARS_WARN = {
  REDIS_HOST: {
    description: "Redis host (required for BullMQ job queue)",
    hint: "Set REDIS_HOST if you need async blockchain transaction processing",
  },
  GEMINI_API_KEY: {
    description: "Google Gemini API key (needed for AI chatbot)",
    hint: "Set GEMINI_API_KEY to enable AI features",
  },
  OPENAI_API_KEY: {
    description: "OpenAI API key (alternative AI provider)",
    hint: "Set OPENAI_API_KEY if using OpenAI instead of Gemini",
  },
};

const validateEnv = () => {
  const errors = [];
  const warnings = [];

  Object.entries(REQUIRED_VARS).forEach(
    ([key, { description, validate, hint }]) => {
      const value = process.env[key];
      if (!value) {
        errors.push(`  - ${key}: ${description}${hint ? `. ${hint}` : ""}\n`);
      } else if (typeof validate === "function" && !validate(value)) {
        errors.push(`  - ${key}: value "${value}" has invalid format\n`);
      }
    },
  );

  if (process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET) {
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      errors.push(
        "  - JWT_SECRET and JWT_REFRESH_SECRET must be different values for security.",
      );
    }
  }

  Object.entries(OPTIONAL_VARS_WARN).forEach(([key, { description, hint }]) => {
    if (!process.env[key]) {
      warnings.push(
        `  - ${key} (optional): ${description}${hint ? `. ${hint}` : ""}\n`,
      );
    }
  });

  if (errors.length > 0) {
    logger.error("ENVIRONMENT VARIABLE VALIDATION FAILED");
    logger.error("The following required variables are missing or invalid:");
    errors.forEach((e) => logger.error(e));
    logger.error("Please configure these in your .env file.");
    logger.error("Refer to backend/.env.example for guidance.");
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn("ENVIRONMENT VARIABLE WARNINGS");
    logger.warn("The following optional variables are not set:");
    warnings.forEach((w) => logger.warn(w));
    logger.warn("Some features may not be available.");
  } else {
    logger.info("All required environment variables are valid.");
  }
};

module.exports = { validateEnv };
