"use strict";

const axios = require("axios");
const logger = require("../utils/logger");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
// No fallback default: a missing key must fail closed instead of silently
// sending a publicly-known credential (see #1325).
const ML_API_KEY = process.env.ML_API_KEY;

const MAX_RETRIES = 3;
const BASE_DELAY = 200;

/**
 * Call the Python ML Service for Crop Quality / Spoilage Risk prediction
 * @param {number} temperature 
 * @param {number} humidity 
 * @param {string} cropType 
 */
async function predictQuality(temperature, humidity, cropType) {
  if (!ML_API_KEY) {
    const error = new Error(
      "ML_API_KEY is not configured. Set the ML_API_KEY environment variable " +
        "to a strong random secret (`openssl rand -hex 32`) matching the " +
        "ml-service deployment before calling the crop recommendation endpoint.",
    );
    logger.error("ML Service /quality aborted", { error: error.message });
    throw error;
  }

  let lastError;

  const payload = {
    temperature,
    humidity,
    cropType
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/quality`, payload, {
        timeout: 10_000,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": ML_API_KEY,
        },
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) =>
          setTimeout(r, BASE_DELAY * Math.pow(2, attempt)),
        );
      }
    }
  }

  logger.error("ML Service /quality failed after retries", {
    error: lastError.message,
    payload
  });
  throw lastError;
}

module.exports = { predictQuality };
