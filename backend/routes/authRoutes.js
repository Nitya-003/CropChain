const express = require("express");
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
    setFallbackPassword,
    deleteAccount
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const validateRegistration = require('../middleware/validateRegistration');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiters');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Account registered successfully
 *       400:
 *         description: Validation error or email already in use
 */
router.post("/register", validateRegistration, registerUser);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and receive JWT session token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCredentials'
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid email or password
 */
router.post("/login", loginUser);
router.post("/refresh", refreshSession);
router.post("/logout", logoutUser);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password/:token", authLimiter, resetPassword);
router.post("/add-funds", protect, adminOnly, addFunds);

// Wallet authentication routes
router.get("/nonce", authLimiter, getNonce);
router.post("/wallet-login", authLimiter, walletLogin);
router.post("/wallet-register", registerLimiter, validateRegistration, walletRegister);
router.post("/set-fallback-password", protect, setFallbackPassword);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update authenticated user profile details
 *     tags: [Authentication]
 *     security:
 *       - Bearer: []
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put("/profile", protect, updateProfile);
router.get('/nonce', authLimiter, getNonce);
router.post('/wallet-login', authLimiter, walletLogin);
router.post('/wallet-register', registerLimiter, validateRegistration, walletRegister);
router.post('/set-fallback-password', protect, setFallbackPassword);
router.delete('/profile', protect, deleteAccount);

module.exports = router;

