const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    walletLogin,
    walletRegister,
    getNonce,
    updateProfile,
    refreshSession,
    logoutUser,
    forgotPassword,
    resetPassword,
    addFunds
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const validateRegistration = require('../middleware/validateRegistration');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/register', validateRegistration, registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.post('/add-funds', protect, adminOnly, addFunds);

// Wallet authentication routes
router.get('/nonce', getNonce);
router.post('/wallet-login', walletLogin);
router.post('/wallet-register', validateRegistration, walletRegister);
router.put('/profile', protect, updateProfile);

module.exports = router;
