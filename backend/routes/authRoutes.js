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
  deleteAccount,
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/auth");
const validateRegistration = require("../middleware/validateRegistration");
const { authLimiter, registerLimiter } = require("../middleware/rateLimiters");
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
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Amit Patel"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "farmer@cropchain.io"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecretPass123!"
 *               role:
 *                 type: string
 *                 enum: [farmer, mandi, transporter, retailer]
 *                 example: "farmer"
 *               walletAddress:
 *                 type: string
 *                 example: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error or user already exists
 */
router.post("/register", validateRegistration, registerUser);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginCredentials'
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Invalid email or password
 */
router.post("/login", loginUser);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT access token using refresh cookie/token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh", refreshSession);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out user and clear auth cookies
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post("/logout", logoutUser);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password/:token", authLimiter, resetPassword);
router.post("/add-funds", protect, adminOnly, addFunds);

// Wallet authentication routes
router.get("/nonce", authLimiter, getNonce);
router.post("/wallet-login", authLimiter, walletLogin);
router.post("/wallet-register", registerLimiter, validateRegistration, walletRegister);
router.post("/set-fallback-password", protect, setFallbackPassword);
router.put("/profile", protect, updateProfile);
router.delete("/profile", protect, deleteAccount);

module.exports = router;
