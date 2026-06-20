const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    generateLinkWalletChallenge,
    generateIssueCredentialChallenge,
    linkWallet,
    issueCredential,
    revokeCredential,
    checkVerification,
    getUnverifiedUsers,
    getVerifiedUsers,
    getVerificationEvents,
    exportUnverifiedUsers,
    exportVerifiedUsers,
    bulkIssueCredentials,
    getBulkJobStatus,
    retryBulkFailedRows,
    streamBulkJobEvents,
} = require('../controllers/verificationController');


const { protect, adminOnly, authorizeRoles } = require('../middleware/auth');
const {
    challengeLinkWalletLimiter,
    challengeLinkWalletIpLimiter,
    challengeIssueLimiter,
    challengeIssueIpLimiter,
    credentialIssuanceLimiter,
    credentialIssuanceIpLimiter,
    bulkCsvJobAdminLimiter,
    bulkCsvJobIpLimiter,
} = require('../middleware/rateLimiters');

// Multer in-memory storage configuration
// Security: strict content filtering + upload size caps (defense-in-depth)
const MAX_BULK_CSV_BYTES = parseInt(process.env.MAX_BULK_CSV_BYTES, 10) || 5 * 1024 * 1024; // 5MB

const upload = multer({
    limits: { fileSize: MAX_BULK_CSV_BYTES },
    fileFilter: (req, file, cb) => {
        const originalName = file.originalname || '';
        const ext = originalName.split('.').pop()?.toLowerCase();

        const allowedMimes = new Set(['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain']);
        const mimeOk = allowedMimes.has(String(file.mimetype || '').toLowerCase());
        const extOk = ext === 'csv';

        // Require both mime and extension to reduce spoofing risk.
        if (!mimeOk || !extOk) {
            return cb(new Error('Only .csv uploads are allowed'));
        }

        cb(null, true);
    },
});












// Public route

router.get('/check/:userId', checkVerification);

// Protected routes

// Role-based access:
// - Wallet linking (challenge + link): ADMIN, SUPER_ADMIN, MANDI
// - Credential issuance (challenge + issue): MANDI, ADMIN, SUPER_ADMIN
router.post(
    '/challenge/link-wallet',
    protect,
    authorizeRoles('admin', 'super_admin', 'mandi'),
    // IP + user abuse protection for challenge spamming
    challengeLinkWalletIpLimiter,
    challengeLinkWalletLimiter,
    generateLinkWalletChallenge
);
router.post(
    '/challenge/issue',
    protect,
    authorizeRoles('mandi', 'admin', 'super_admin'),
    // IP + user abuse protection for challenge spamming
    challengeIssueIpLimiter,
    challengeIssueLimiter,
    generateIssueCredentialChallenge
);
router.post(
    '/link-wallet',
    protect,
    authorizeRoles('admin', 'super_admin', 'mandi'),
    // Credential flow is sensitive: apply tighter limits
    credentialIssuanceIpLimiter,
    credentialIssuanceLimiter,
    linkWallet
);

// Admin only routes
router.post(
    '/issue',
    protect,
    authorizeRoles('admin', 'super_admin', 'mandi'),
    // Credential issuance is sensitive and should be rate limited
    credentialIssuanceIpLimiter,
    credentialIssuanceLimiter,
    issueCredential
);

router.post('/revoke', protect, adminOnly, revokeCredential);

router.get('/unverified', protect, adminOnly, getUnverifiedUsers);
router.get('/verified', protect, adminOnly, getVerifiedUsers);
router.get('/events', protect, adminOnly, getVerificationEvents);
router.get('/unverified/export', protect, adminOnly, exportUnverifiedUsers);
router.get('/verified/export', protect, adminOnly, exportVerifiedUsers);

// Bulk verification routes
router.post(
    '/bulk/issue-credential',
    protect,
    adminOnly,
    // Bulk CSV job initiation is sensitive: limit per admin + per IP
    bulkCsvJobIpLimiter,
    bulkCsvJobAdminLimiter,
    upload.single('file'),
    bulkIssueCredentials
);
router.get('/bulk/:jobId', protect, adminOnly, getBulkJobStatus);
router.get('/bulk/:jobId/events/stream', protect, adminOnly, streamBulkJobEvents);


router.post('/bulk/:jobId/retry-failed', protect, adminOnly, retryBulkFailedRows);

module.exports = router;

