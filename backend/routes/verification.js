const express = require('express');
const router = express.Router();
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
} = require('../controllers/verificationController');
const { protect, adminOnly } = require('../middleware/auth');

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

module.exports = router;
