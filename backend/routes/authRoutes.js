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
    addFunds,
    setFallbackPassword
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const validateRegistration = require('../middleware/validateRegistration');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiters');

router.post('/register', validateRegistration, registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.post('/add-funds', protect, adminOnly, addFunds);

// Wallet authentication routes
router.get('/nonce', authLimiter, getNonce);
router.post('/wallet-login', authLimiter, walletLogin);
router.post('/wallet-register', registerLimiter, validateRegistration, walletRegister);
router.get('/nonce', getNonce);
router.post('/wallet-login', walletLogin);
router.post('/wallet-register', validateRegistration, walletRegister);
router.post('/set-fallback-password', protect, setFallbackPassword);
router.put('/profile', protect, updateProfile);

module.exports = router;
