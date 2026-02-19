const express = require('express');
const router = express.Router();
const {
    linkWallet,
    issueCredential,
    revokeCredential,
    checkVerification,
    getUnverifiedUsers,
    getVerifiedUsers,
} = require('../controllers/verificationController');
const { protect, adminOnly } = require('../middleware/auth');

// Public route
router.get('/check/:userId', checkVerification);

// Protected routes
router.post('/link-wallet', protect, linkWallet);

// Admin only routes
router.post('/issue', protect, adminOnly, issueCredential);
router.post('/revoke', protect, adminOnly, revokeCredential);
router.get('/unverified', protect, adminOnly, getUnverifiedUsers);
router.get('/verified', protect, adminOnly, getVerifiedUsers);

module.exports = router;
