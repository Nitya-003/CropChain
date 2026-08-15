const jwt = require("jsonwebtoken");
require("dotenv").config();
const { generateJti } = require("../services/tokenBlacklist");

/**
 * Sign a short-lived access JWT. Includes a unique `jti` so an individual
 * token can be revoked (e.g. on logout) via the JWT blacklist, and `iat`/`exp`
 * are set by jsonwebtoken for blacklist TTL bookkeeping.
 */
const generateToken = (id, role, name, tokenVersion = 0) => {
  return jwt.sign({ id, role, name, tokenVersion, jti: generateJti() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  });
};

const generateRefreshToken = (id, tokenVersion = 0) => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!refreshSecret) {
    throw new Error(
      "JWT_REFRESH_SECRET is not configured. Please set it in your .env file.",
    );
  }

  return jwt.sign({ id, type: "refresh", tokenVersion }, refreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
module.exports.generateRefreshToken = generateRefreshToken;
