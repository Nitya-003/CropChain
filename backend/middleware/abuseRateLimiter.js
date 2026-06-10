const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const isTestEnv = process.env.NODE_ENV === 'test';

const DEFAULT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;

const buildKeyGenerator = ({ useUserId }) => {
  // If req.user exists and has an id, use it. Otherwise fall back to IP.
  return (req) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').toString();
    const userId = req.user?.id || req.user?._id;

    if (useUserId && userId) {
      // Include route group marker in the key via additional prefix in middleware config
      return `user:${userId}|ip:${ip}`;
    }

    return `ip:${ip}`;
  };
};

const createAbuseAwareLimiter = ({
  windowMs = DEFAULT_WINDOW_MS,
  max,
  keyPrefix,
  useUserId = false,
  message = 'Too many requests. Please try again later.',
  auditAction = 'rate_limit_hit',
  auditMeta = {},
}) => {
  if (!max) throw new Error('createAbuseAwareLimiter: max is required');

  const limiter = rateLimit({
    windowMs,
    max: isTestEnv ? 10000 : max,
    keyGenerator: buildKeyGenerator({ useUserId }),
    // Always return a generic message (avoid revealing limit configuration)
    message: {
      error: message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res /*, next, options */) => {
      const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').toString();
      const userId = req.user?.id || req.user?._id || null;

      // Audit logging (no sensitive details to client)
      logger.warn(`[AUDIT] ${auditAction} - keyPrefix=${keyPrefix} method=${req.method} path=${req.originalUrl} ip=${ip} userId=${userId || 'anonymous'}`, {
        ...auditMeta,
        keyPrefix,
        method: req.method,
        path: req.originalUrl,
        ip,
        userId,
        timestamp: new Date().toISOString(),
      });

      res.status(429).json({
        success: false,
        message,
      });
    },
  });

  return limiter;
};

module.exports = {
  createAbuseAwareLimiter,
};

