const rateLimit = require('express-rate-limit');
const { createAbuseAwareLimiter } = require('./abuseRateLimiter');

const isTestEnv = process.env.NODE_ENV === 'test';
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;

const createLimiter = (maxRequests, message) => rateLimit({
    windowMs: rateLimitWindowMs,
    max: isTestEnv ? 10000 : maxRequests,
    // Keep existing message behavior for backward compatibility
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

// ==================== Sensitive Abuse-Aware Limiters ====================
// Window configuration (per-route windows)
const CHALLENGE_WINDOW_MS = parseInt(process.env.CHALLENGE_RATE_LIMIT_WINDOW_MS, 10) || 10 * 60 * 1000; // 10 minutes
const CHALLENGE_USER_MAX = parseInt(process.env.CHALLENGE_RATE_LIMIT_USER_MAX, 10) || 10; // 10 / 10 min per user
const CHALLENGE_IP_MAX = parseInt(process.env.CHALLENGE_RATE_LIMIT_IP_MAX, 10) || 5; // 5 / 10 min per IP

// Credential issuance stricter limits
const CREDENTIAL_WINDOW_MS = parseInt(process.env.CREDENTIAL_RATE_LIMIT_WINDOW_MS, 10) || 10 * 60 * 1000;
const CREDENTIAL_USER_MAX = parseInt(process.env.CREDENTIAL_RATE_LIMIT_USER_MAX, 10) || 5;
const CREDENTIAL_IP_MAX = parseInt(process.env.CREDENTIAL_RATE_LIMIT_IP_MAX, 10) || 2;

// Bulk CSV job initiation (admin) - jobs per hour per admin (and per IP)
const BULK_WINDOW_MS = parseInt(process.env.BULK_JOB_RATE_LIMIT_WINDOW_MS, 10) || 60 * 60 * 1000; // 1 hour
const BULK_ADMIN_MAX = parseInt(process.env.BULK_JOB_RATE_LIMIT_ADMIN_MAX, 10) || 2; // 2 jobs / hour per admin
const BULK_IP_MAX = parseInt(process.env.BULK_JOB_RATE_LIMIT_IP_MAX, 10) || 2; // also cap per IP

const generic429 = 'Too many requests. Please try again later.';

// Key prefix is used only for audit log clarity.
const challengeLinkWalletLimiter = createAbuseAwareLimiter({
    windowMs: CHALLENGE_WINDOW_MS,
    max: CHALLENGE_USER_MAX,
    keyPrefix: 'challenge.link-wallet:user',
    useUserId: true,
    message: generic429,
    auditAction: 'challenge_spam',
});

const challengeLinkWalletIpLimiter = createAbuseAwareLimiter({
    windowMs: CHALLENGE_WINDOW_MS,
    max: CHALLENGE_IP_MAX,
    keyPrefix: 'challenge.link-wallet:ip',
    useUserId: false,
    message: generic429,
    auditAction: 'challenge_spam',
});

const challengeIssueLimiter = createAbuseAwareLimiter({
    windowMs: CHALLENGE_WINDOW_MS,
    max: CHALLENGE_USER_MAX,
    keyPrefix: 'challenge.issue:user',
    useUserId: true,
    message: generic429,
    auditAction: 'challenge_spam',
});

const challengeIssueIpLimiter = createAbuseAwareLimiter({
    windowMs: CHALLENGE_WINDOW_MS,
    max: CHALLENGE_IP_MAX,
    keyPrefix: 'challenge.issue:ip',
    useUserId: false,
    message: generic429,
    auditAction: 'challenge_spam',
});

const credentialIssuanceLimiter = createAbuseAwareLimiter({
    windowMs: CREDENTIAL_WINDOW_MS,
    max: CREDENTIAL_USER_MAX,
    keyPrefix: 'credential.issue:user',
    useUserId: true,
    message: generic429,
    auditAction: 'credential_abuse',
});

const credentialIssuanceIpLimiter = createAbuseAwareLimiter({
    windowMs: CREDENTIAL_WINDOW_MS,
    max: CREDENTIAL_IP_MAX,
    keyPrefix: 'credential.issue:ip',
    useUserId: false,
    message: generic429,
    auditAction: 'credential_abuse',
});

const bulkCsvJobAdminLimiter = createAbuseAwareLimiter({
    windowMs: BULK_WINDOW_MS,
    max: BULK_ADMIN_MAX,
    keyPrefix: 'bulk.job:admin',
    useUserId: true,
    message: generic429,
    auditAction: 'bulk_csv_abuse',
});

const bulkCsvJobIpLimiter = createAbuseAwareLimiter({
    windowMs: BULK_WINDOW_MS,
    max: BULK_IP_MAX,
    keyPrefix: 'bulk.job:ip',
    useUserId: false,
    message: generic429,
    auditAction: 'bulk_csv_abuse',
});

module.exports = {
    generalLimiter,
    authLimiter,
    batchLimiter,
    rateLimitWindowMs,
    rateLimitMaxRequests,

    // Sensitive per-route limiters
    challengeLinkWalletLimiter,
    challengeLinkWalletIpLimiter,
    challengeIssueLimiter,
    challengeIssueIpLimiter,

    credentialIssuanceLimiter,
    credentialIssuanceIpLimiter,

    bulkCsvJobAdminLimiter,
    bulkCsvJobIpLimiter,
};
