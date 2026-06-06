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
} = require('../controllers/verificationController');
const { protect, adminOnly } = require('../middleware/auth');

// Multer in-memory storage configuration
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Public route
router.get('/check/:userId', checkVerification);

// Protected routes
router.post('/challenge/link-wallet', protect, generateLinkWalletChallenge);
router.post('/challenge/issue', protect, adminOnly, generateIssueCredentialChallenge);
router.post('/link-wallet', protect, linkWallet);

// Admin only routes
router.post('/issue', protect, adminOnly, issueCredential);
router.post('/revoke', protect, adminOnly, revokeCredential);
router.get('/unverified', protect, adminOnly, getUnverifiedUsers);
router.get('/verified', protect, adminOnly, getVerifiedUsers);
router.get('/events', protect, adminOnly, getVerificationEvents);
router.get('/unverified/export', protect, adminOnly, exportUnverifiedUsers);
router.get('/verified/export', protect, adminOnly, exportVerifiedUsers);

// Bulk verification routes
router.post('/bulk/issue-credential', protect, adminOnly, upload.single('file'), bulkIssueCredentials);
router.get('/bulk/:jobId', protect, adminOnly, getBulkJobStatus);

module.exports = router;
