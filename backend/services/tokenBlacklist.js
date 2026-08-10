/**
 * JWT Revocation Blacklist (#1290)
 *
 * Access JWTs are stateless and remain cryptographically valid until natural
 * expiry, so logout / account deletion / admin deactivation left captured
 * tokens usable. This service maintains a revocation set keyed by the token's
 * `jti` (JWT ID), with an automatic TTL equal to the token's remaining
 * lifetime so entries self-expire and cannot grow unbounded.
 *
 * Storage strategy (graceful degradation):
 *   1. Redis via the shared ioredis connection (`jwt_blacklist:<jti>`,
 *      `PX` = remaining ms). Used in production where Redis is configured.
 *   2. In-memory Map fallback when Redis is unavailable / not configured
 *      (tests, local dev without Redis, or a Redis outage). Entries still
 *      expire via a scheduled sweep.
 *
 * The blacklist is best-effort on top of the existing `tokenVersion` check in
 * the auth middleware: `tokenVersion` invalidates *all* of a user's tokens
 * after a password change / explicit version bump; the blacklist invalidates a
 * *specific* token immediately on logout without disturbing other sessions.
 */

const crypto = require("crypto");
const logger = require("../utils/logger");

const BLACKLIST_PREFIX = "jwt_blacklist:";
const SWEEP_INTERVAL_MS = 60_000;

let redisConnection = null;
let inMemoryBlacklist = new Map(); // jti -> expiryMs (Date.now())
let sweepTimer = null;

function getRedis() {
  if (redisConnection) return redisConnection;
  try {
    // Lazy require to avoid a hard dependency at module load (e.g. tests that
    // mock ioredis). If Redis is not configured, this returns null and we fall
    // back to the in-memory store.
    const { getRedisConnection } = require("../config/redis");
    const conn = getRedisConnection();
    redisConnection = conn || null;
  } catch {
    redisConnection = null;
  }
  return redisConnection;
}

function ensureSweep() {
  if (sweepTimer) return;
  const now = Date.now();
  for (const [jti, exp] of inMemoryBlacklist) {
    if (exp <= now) inMemoryBlacklist.delete(jti);
  }
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of inMemoryBlacklist) {
      if (exp <= now) inMemoryBlacklist.delete(jti);
    }
  }, SWEEP_INTERVAL_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}

/**
 * Remaining lifetime (ms) of a decoded JWT, floored to 0.
 * @param {{ exp?: number }} decoded - decoded JWT payload
 * @returns {number}
 */
function remainingTtlMs(decoded) {
  if (!decoded || typeof decoded.exp !== "number") return 0;
  return Math.max(0, decoded.exp * 1000 - Date.now());
}

/**
 * Revoke a specific decoded JWT so it is rejected by the auth middleware
 * until its natural expiry.
 * @param {{ jti?: string, exp?: number }} decoded - decoded JWT payload
 * @returns {Promise<boolean>} true if the token was revoked
 */
async function revokeToken(decoded) {
  if (!decoded || !decoded.jti) return false;
  const ttlMs = remainingTtlMs(decoded);
  if (ttlMs <= 0) return false; // already expired, nothing to revoke

  const key = BLACKLIST_PREFIX + decoded.jti;
  const conn = getRedis();
  if (conn) {
    try {
      await conn.set(key, "1", "PX", ttlMs);
      return true;
    } catch (err) {
      logger.warn("[TokenBlacklist] Redis revoke failed, using in-memory fallback", {
        error: err.message,
      });
    }
  }
  inMemoryBlacklist.set(decoded.jti, Date.now() + ttlMs);
  ensureSweep();
  return true;
}

/**
 * Check whether a decoded JWT has been revoked.
 * @param {{ jti?: string }} decoded - decoded JWT payload
 * @returns {Promise<boolean>} true if revoked (must reject)
 */
async function isRevoked(decoded) {
  if (!decoded || !decoded.jti) return false;
  const conn = getRedis();
  if (conn) {
    try {
      const result = await conn.get(BLACKLIST_PREFIX + decoded.jti);
      return result != null;
    } catch (err) {
      logger.warn("[TokenBlacklist] Redis check failed, using in-memory fallback", {
        error: err.message,
      });
    }
  }
  const exp = inMemoryBlacklist.get(decoded.jti);
  if (exp == null) return false;
  if (exp <= Date.now()) {
    inMemoryBlacklist.delete(decoded.jti);
    return false;
  }
  return true;
}

/**
 * Generate a fresh, unique JWT ID (RFC 7519 `jti`).
 * @returns {string}
 */
function generateJti() {
  return crypto.randomUUID();
}

/** Test-only: clear the in-memory store and detach the sweep timer. */
function __reset() {
  inMemoryBlacklist = new Map();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

module.exports = {
  revokeToken,
  isRevoked,
  generateJti,
  remainingTtlMs,
  BLACKLIST_PREFIX,
  __reset,
};
