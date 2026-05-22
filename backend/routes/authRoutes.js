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
    logoutUser
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validateRegistration = require('../middleware/validateRegistration');

router.post('/register', validateRegistration, registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);

// Wallet authentication routes
router.get('/nonce', getNonce);
router.post('/wallet-login', walletLogin);
router.post('/wallet-register', walletRegister);
router.put('/profile', protect, updateProfile);

module.exports = router;
