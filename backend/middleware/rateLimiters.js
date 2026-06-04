const rateLimit = require('express-rate-limit');

const isTestEnv = process.env.NODE_ENV === 'test';
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

const createLimiter = (maxRequests, message) => rateLimit({
    windowMs: rateLimitWindowMs,
    max: isTestEnv ? 10000 : maxRequests,
    message: {
        error: message,
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const generalLimiter = createLimiter(
    rateLimitMaxRequests,
    'Too many requests from this IP, please try again later.'
);

const authLimiter = createLimiter(
    parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
    'Too many authentication attempts from this IP, please try again later.'
);

const batchLimiter = createLimiter(
    parseInt(process.env.BATCH_RATE_LIMIT_MAX, 10) || 20,
    'Too many batch operations from this IP, please try again later.'
);

module.exports = {
    generalLimiter,
    authLimiter,
    batchLimiter,
    rateLimitWindowMs,
    rateLimitMaxRequests,
};