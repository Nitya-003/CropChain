"use strict";

const axios = require("axios");
const logger = require("../utils/logger");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const ML_API_KEY = process.env.ML_API_KEY || "change-me-in-production";

const MAX_RETRIES = 3;
const BASE_DELAY = 200;

/**
 * Call the Python ML Service for Crop Quality / Spoilage Risk prediction
 * @param {number} temperature 
 * @param {number} humidity 
 * @param {string} cropType 
 */
async function predictQuality(temperature, humidity, cropType) {
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
