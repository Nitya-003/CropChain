const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const apiResponse = require('../utils/apiResponse');
const { verifyMessage } = require('ethers');
require('dotenv').config();

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
    role: z.enum(['farmer', 'transporter'], {
        errorMap: () => ({ message: 'Invalid role. Only farmer and transporter are allowed.' })
    })
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

const registerUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);

        if (!validationResult.success) {
            console.error('Validation Error Details:', JSON.stringify(validationResult.error, null, 2));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data provided. Please check your fields.',
                details: validationResult.error
            });
        }

        const { name, email, password, role } = validationResult.data;

        // Check if user exists (case-insensitive)
        const userExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

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
            const response = apiResponse.successResponse(
                {
                    token: generateToken(user._id, user.role, user.name),
                    user: sanitizeUser(user)
                },
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
            console.error('Validation Error Details:', JSON.stringify(validationResult.error, null, 2));
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
            const response = apiResponse.successResponse(
                {
                    token: generateToken(user._id, user.role, user.name),
                    user: sanitizeUser(user)
                },
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
    address: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    signature: z.string()
        .min(1, 'Signature is required'),
    nonce: z.string().optional()
});

// In-memory nonce store with automatic cleanup to prevent memory leak
const nonceStore = new Map();
const NONCE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

// Automatic cleanup job - runs every minute to remove expired nonces
// This prevents unbounded memory growth when users never complete auth
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of nonceStore.entries()) {
            if (now - value.expiresAt > 0) {
                nonceStore.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[NonceStore] Cleaned up ${cleanedCount} expired nonces. Current size: ${nonceStore.size}`);
        }
    }, 60 * 1000); // Run every 1 minute
}

/**
 * Generate a nonce for wallet authentication
 */
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
        nonceStore.set(address.toLowerCase(), {
            nonce,
            expiresAt: Date.now() + NONCE_EXPIRY_TIME
        });

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
        const storedNonce = nonceStore.get(normalizedAddress);
        
        // Use provided nonce or stored nonce
        const nonce = providedNonce || storedNonce?.nonce || 'Login to CropChain';

        // Clean up expired nonces
        if (storedNonce && storedNonce.expiresAt < Date.now()) {
            nonceStore.delete(normalizedAddress);
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Nonce expired. Please request a new one.')
            );
        }

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
        nonceStore.delete(normalizedAddress);

        // Generate JWT with user's role from database
        const response = apiResponse.successResponse(
            {
                token: generateToken(user._id, user.role, user.name),
                user: sanitizeUser(user)
            },
            'Wallet authentication successful'
        );
        
        return res.json(response);

    } catch (error) {
        console.error('Wallet login error:', error);
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
    role: z.enum(['farmer', 'transporter'], {
        errorMap: () => ({ message: 'Invalid role. Only farmer and transporter are allowed.' })
    })
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
        const storedNonce = nonceStore.get(normalizedAddress);
        const nonce = providedNonce || storedNonce?.nonce || 'Login to CropChain';

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

        // Create user (no password for wallet users - use crypto.randomBytes for security)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const user = await User.create({
            name,
            email,
            walletAddress: normalizedAddress,
            role,
            password: await bcrypt.hash(randomPassword, 12)
        });

        // Delete used nonce
        nonceStore.delete(normalizedAddress);

        const response = apiResponse.successResponse(
            {
                token: generateToken(user._id, user.role, user.name),
                user: sanitizeUser(user)
            },
            'Wallet registration successful',
            201
        );
        
        return res.status(201).json(response);

    } catch (error) {
        console.error('Wallet registration error:', error);
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

module.exports = {
    registerUser,
    loginUser,
    walletLogin,
    walletRegister,
    getNonce
};
