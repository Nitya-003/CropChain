const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { generateRefreshToken } = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const apiResponse = require('../utils/apiResponse');
const { verifyMessage } = require('ethers');
const { VALID_ROLES, ROLES } = require('../constants/permissions');
const logger = require('../utils/logger');
require('dotenv').config();
const Redis = require('ioredis');

let redis = null;

if (process.env.NODE_ENV !== 'test') {
    redis = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
    });

    redis.on('connect', () => {
    logger.info('Redis connected');
});

redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
});
}
// Validation Schemas
const registerSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .trim(),
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.enum(VALID_ROLES, {
        errorMap: () => ({ 
            message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
        })
    }).default(ROLES.FARMER)
});

const updateProfileSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .trim()
        .optional(),
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim()
        .optional(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
        .optional()
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field (name, email, or password) must be provided to update",
});

const loginSchema = z.object({
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim(),
    password: z.string()
        .min(1, 'Password is required')
});

// Sanitization helper
const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
});

const REFRESH_COOKIE_NAME = 'refreshToken';

const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
});

const parseCookieHeader = (cookieHeader = '') => {
    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [rawName, ...rawValue] = cookie.trim().split('=');
        if (!rawName || rawValue.length === 0) return cookies;

        cookies[rawName] = decodeURIComponent(rawValue.join('='));
        return cookies;
    }, {});
};

const buildAuthPayload = (user) => ({
    token: generateToken(user._id, user.role, user.name),
    user: sanitizeUser(user)
});

const attachRefreshCookie = (res, user) => {
    res.cookie(REFRESH_COOKIE_NAME, generateRefreshToken(user._id), getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
    const { maxAge, ...cookieOptions } = getRefreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
};

const registerUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);

        if (!validationResult.success) {
            logger.warn('Validation failed', { details: validationResult.error });
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data provided. Please check your fields.',
                details: validationResult.error
            });
        }

        const { name, email, password, role } = validationResult.data;

        // Check if user exists (case-insensitive)
        const userExists = await User.findOne({ email: email.toLowerCase() });

        if (userExists) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists with this email')
            );
        }

        // Hash password with higher cost factor
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role
        });

        if (user) {
            attachRefreshCookie(res, user);
            const response = apiResponse.successResponse(
                buildAuthPayload(user),
                'Registration successful',
                201
            );
            return res.status(201).json(response);

        } else {
            return res.status(400).json(
                apiResponse.errorResponse('Invalid user data', 'REGISTRATION_ERROR', 400)
            );
        }

    } catch (error) {
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists with this email')
            );
        }

        return res.status(500).json(
            apiResponse.errorResponse('Registration failed', 'REGISTRATION_FAILED', 500)
        );
    }
};

const loginUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
            logger.warn('Validation failed', { details: validationResult.error });
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid email or password format.',
                details: validationResult.error
            });
        }

        const { email, password } = validationResult.data;

        // Find user with password
        const user = await User.findOne({ email }).select('+password');

        if (user && (await bcrypt.compare(password, user.password))) {
            attachRefreshCookie(res, user);
            const response = apiResponse.successResponse(
                buildAuthPayload(user),
                'Login successful'
            );
            return res.json(response);
        } else {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid email or password')
            );
        }

    } catch (error) {
        return res.status(500).json(
            apiResponse.errorResponse('Login failed', 'LOGIN_FAILED', 500)
        );
    }
};

const updateProfile = async (req, res) => {
    try {
        const validationResult = updateProfileSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data provided. Please check your fields.',
                details: validationResult.error
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json(
                apiResponse.errorResponse('User not found', 'USER_NOT_FOUND', 404)
            );
        }

        const { name, email, password } = validationResult.data;

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ 
                email: email.toLowerCase(),
                _id: { $ne: user._id }
            });

            if (emailExists) {
                return res.status(409).json(
                    apiResponse.conflictResponse('Email is already in use by another account')
                );
            }
            user.email = email;
        }

        if (name) {
            user.name = name;
        }

        if (password) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await user.save();

        return res.status(200).json(
            apiResponse.successResponse(
                { user: sanitizeUser(updatedUser) },
                'Profile updated successfully'
            )
        );

    } catch (error) {
        logger.error('Profile update error', { error: error.message, stack: error.stack });
        return res.status(500).json(
            apiResponse.errorResponse('Profile update failed', 'UPDATE_FAILED', 500)
        );
    }
};

/**
 * Wallet Login - Authenticate user via wallet signature
 * 
 * Flow:
 * 1. User requests a nonce from backend (stored in DB or session)
 * 2. User signs the nonce with their wallet
 * 3. Frontend sends address and signature to this endpoint
 * 4. Backend verifies the signature matches the address
 * 5. Backend issues JWT with user's role from database
 * 
 * This ensures role is ALWAYS assigned by backend, never by frontend.
 */
const walletLoginSchema = z.object({
});

const getNonce = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json(
                apiResponse.errorResponse('Valid address is required', 'INVALID_ADDRESS', 400)
            );
        }

        // Generate a unique nonce
        const nonce = `CropChain Authentication ${Date.now()}`;
        
        // Store nonce with expiration (5 minutes)
   await redis.set(
    `nonce:${address.toLowerCase()}`,
    nonce,
    'EX',
    300
);
       

        return res.json(apiResponse.successResponse({ nonce }, 'Nonce generated'));
    } catch (error) {
        return res.status(500).json(
            apiResponse.errorResponse('Failed to generate nonce', 'NONCE_ERROR', 500)
        );
    }
};

/**
 * Verify wallet signature and authenticate user
 */
const walletLogin = async (req, res) => {
    try {
        // Validate request body
        const validationResult = walletLoginSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data',
                details: validationResult.error
            });
        }

        const { address, signature, nonce: providedNonce } = validationResult.data;
        const normalizedAddress = address.toLowerCase();

        // Get stored nonce
     const storedNonce = await redis.get(`nonce:${normalizedAddress}`);        
        // ALWAYS require stored nonce - never fall back to constant string
        if (!storedNonce) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('No authentication nonce found. Please request a new one.')
            );
        }
        
        // Use stored nonce (provided nonce is for backwards compatibility only)
    const nonce = storedNonce;
        // Clean up expired nonces
       
        // Verify the signature
        let recoveredAddress;
        try {
            recoveredAddress = verifyMessage(nonce, signature);
        } catch (error) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid signature')
            );
        }

        // Verify recovered address matches claimed address
        if (recoveredAddress.toLowerCase() !== normalizedAddress) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Signature verification failed - address mismatch')
            );
        }

        // Find user by wallet address
        const user = await User.findOne({ walletAddress: normalizedAddress });

        if (!user) {
            return res.status(403).json(
                apiResponse.errorResponse(
                    'Wallet not registered. Please register first.',
                    'WALLET_NOT_REGISTERED',
                    403
                )
            );
        }

        // Delete used nonce to prevent replay attacks
    await redis.del(`nonce:${normalizedAddress}`);
        // Generate JWT with user's role from database
        attachRefreshCookie(res, user);
        const response = apiResponse.successResponse(
            buildAuthPayload(user),
            'Wallet authentication successful'
        );
        
        return res.json(response);

    } catch (error) {
        logger.error('Wallet login error', { error: error.message, stack: error.stack });
        return res.status(500).json(
            apiResponse.errorResponse('Wallet authentication failed', 'WALLET_LOGIN_FAILED', 500)
        );
    }
};

/**
 * Register a new wallet user
 */
const walletRegisterSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .trim(),
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim(),
    walletAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    signature: z.string()
        .min(1, 'Signature is required'),
    nonce: z.string().optional(),
    role: z.enum(VALID_ROLES, {
        errorMap: () => ({ 
            message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
        })
    }).default(ROLES.FARMER)
});

const walletRegister = async (req, res) => {
    try {
        const validationResult = walletRegisterSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data',
                details: validationResult.error
            });
        }

        const { name, email, walletAddress, signature, nonce: providedNonce, role } = validationResult.data;
        const normalizedAddress = walletAddress.toLowerCase();

        // Get stored nonce
       const storedNonce = await redis.get(`nonce:${normalizedAddress}`);
        
        // ALWAYS require stored nonce - never fall back to constant string
        if (!storedNonce) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('No authentication nonce found. Please request a new one.')
            );
        }
        
        // Use stored nonce — storedNonce is a plain string returned from Redis
        const nonce = storedNonce;

        // Verify signature
        let recoveredAddress;
        try {
            recoveredAddress = verifyMessage(nonce, signature);
        } catch (error) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid signature')
            );
        }

        if (recoveredAddress.toLowerCase() !== normalizedAddress) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Signature verification failed')
            );
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [
                { email },
                { walletAddress: normalizedAddress }
            ]
        });

        if (existingUser) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists with this email or wallet')
            );
        }

        // Create user (no password for wallet users)
        // Generate cryptographically secure random password
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const user = await User.create({
            name,
            email,
            walletAddress: normalizedAddress,
            role,
            password: await bcrypt.hash(randomPassword, 12) // Secure random password for wallet users
        });

        // Delete used nonce
       await redis.del(`nonce:${normalizedAddress}`);

        attachRefreshCookie(res, user);
        const response = apiResponse.successResponse(
            buildAuthPayload(user),
            'Wallet registration successful',
            201
        );
        
        return res.status(201).json(response);

    } catch (error) {
        logger.error('Wallet registration error', { error: error.message, stack: error.stack });
        if (error.code === 11000) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists')
            );
        }
        return res.status(500).json(
            apiResponse.errorResponse('Wallet registration failed', 'WALLET_REGISTRATION_FAILED', 500)
        );
    }
};

const refreshSession = async (req, res) => {
    try {
        const cookies = parseCookieHeader(req.headers.cookie);
        const refreshToken = cookies[REFRESH_COOKIE_NAME];

        if (!refreshToken) {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Refresh token is required')
            );
        }

        const refreshSecret = process.env.JWT_REFRESH_SECRET;

        if (!refreshSecret) {
            logger.error('JWT_REFRESH_SECRET is not configured');

            return res.status(500).json(
                apiResponse.errorResponse(
                    'Refresh token secret is not configured',
                    'SERVER_CONFIGURATION_ERROR',
                    500
                )
            );
        }

        const decoded = jwt.verify(refreshToken, refreshSecret);

        if (decoded.type !== 'refresh') {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid refresh token')
            );
        }

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            clearRefreshCookie(res);

            return res.status(401).json(
                apiResponse.unauthorizedResponse('User not found')
            );
        }

        attachRefreshCookie(res, user);

        return res.json(
            apiResponse.successResponse(
                buildAuthPayload(user),
                'Session refreshed'
            )
        );

    } catch (error) {
        clearRefreshCookie(res);

        return res.status(401).json(
            apiResponse.unauthorizedResponse(
                'Invalid or expired refresh token'
            )
        );
    }
};

const logoutUser = (req, res) => {
    clearRefreshCookie(res);
    return res.json(
        apiResponse.successResponse(null, 'Logout successful')
    );
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json(
                apiResponse.errorResponse('Email is required', 'EMAIL_REQUIRED', 400)
            );
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json(
                apiResponse.errorResponse('User not found with this email', 'USER_NOT_FOUND', 404)
            );
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Hash token and set expire (15 minutes)
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

        await user.save();

        // Send email
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        const message = `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Please click on the link below or paste it into your browser to reset your password:</p>
            <a href="${resetUrl}" target="_blank">${resetUrl}</a>
            <p>This link is valid for 15 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            <p>CropChain Team</p>
        `;

        try {
            const notificationService = require('../services/notificationService');
            await notificationService.sendEmail(user.email, 'Password Reset Request', message);
            return res.json(
                apiResponse.successResponse(null, 'Password reset email sent successfully')
            );
        } catch (emailErr) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            return res.status(500).json(
                apiResponse.errorResponse('Email could not be sent', 'EMAIL_SEND_ERROR', 500)
            );
        }
    } catch (error) {
        return res.status(500).json(
            apiResponse.errorResponse('Server error during forgot password', 'SERVER_ERROR', 500)
        );
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json(
                apiResponse.errorResponse('New password is required', 'PASSWORD_REQUIRED', 400)
            );
        }

        if (password.length < 8) {
            return res.status(400).json(
                apiResponse.errorResponse('Password must be at least 8 characters long', 'INVALID_PASSWORD', 400)
            );
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json(
                apiResponse.errorResponse(
                    'Password must be 8-128 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                    'INVALID_PASSWORD',
                    400
                )
            );
        }

        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json(
                apiResponse.errorResponse('Invalid or expired password reset token', 'INVALID_TOKEN', 400)
            );
        }

        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        return res.json(
            apiResponse.successResponse(null, 'Password reset successful')
        );
    } catch (error) {
        return res.status(500).json(
            apiResponse.errorResponse('Server error during password reset', 'SERVER_ERROR', 500)
        );
    }
};

module.exports = {
    registerUser,
    loginUser,
    walletLogin,
    walletRegister,
    getNonce,
    updateProfile,
    refreshSession,
    logoutUser,
    forgotPassword,
    resetPassword
};
