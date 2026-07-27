"use strict";

const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const ML_API_KEY = process.env.ML_API_KEY || "";

const MAX_RETRIES = 3;
const BASE_DELAY = 200;

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheKey(params) {
  return `${params.N}:${params.P}:${params.K}:${params.pH}:${params.temperature}:${params.humidity}:${params.rainfall}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  if (cache.size >= 100) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

async function getCropRecommendation(params) {
  const key = cacheKey(params);
  const cached = getCached(key);
  if (cached) return cached;

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/predict`, params, {
        timeout: 15_000,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": ML_API_KEY,
        },
      });
      setCache(key, response.data);
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
  throw lastError;
}

async function isMlServiceHealthy() {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/health`, {
      timeout: 5_000,
      headers: { "X-API-Key": ML_API_KEY },
    });
    return data.status === "ok";
  } catch {
    return false;
  }
}

module.exports = { getCropRecommendation, isMlServiceHealthy };
