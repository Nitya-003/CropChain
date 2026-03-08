'use strict';

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

/**
 * Calls the Python ML microservice and returns the crop prediction.
 *
 * @param {{ N, P, K, pH, temperature, humidity, rainfall }} params
 * @returns {Promise<{ crop: string, confidence: number, alternatives: Array }>}
 */
async function getCropRecommendation(params) {
  const response = await axios.post(`${ML_SERVICE_URL}/predict`, params, {
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

/**
 * Liveness check — resolves true if the ML service is reachable.
 */
async function isMlServiceHealthy() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5_000 });
    return data.status === 'ok';
  } catch {
    return false;
  }
}

module.exports = { getCropRecommendation, isMlServiceHealthy };
