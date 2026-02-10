const didService = require('../services/didService');
const User = require('../models/User');
const { z } = require('zod');

// Validation schemas
const linkWalletSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    signature: z.string().min(1, 'Signature is required'),
});

const issueCredentialSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    signature: z.string().min(1, 'Signature is required'),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const revokeCredentialSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    reason: z.string().min(1, 'Revocation reason is required'),
});

/**
 * Link wallet address to user account
 */
const linkWallet = async (req, res) => {
    try {
        const validationResult = linkWalletSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                message: validationResult.error.errors[0].message,
            });
        }

        const { walletAddress, signature } = validationResult.data;
        const userId = req.user.id;

        const result = await didService.linkWallet(userId, walletAddress, signature);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: 'Wallet linking failed',
            message: error.message,
        });
    }
};

/**
 * Issue verifiable credential (Mandi officer only)
 */
const issueCredential = async (req, res) => {
    try {
        const validationResult = issueCredentialSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                message: validationResult.error.errors[0].message,
            });
        }

        const { userId, signature, walletAddress } = validationResult.data;
        const verifierId = req.user.id;

        const result = await didService.issueCredential(userId, verifierId, signature, walletAddress);

        res.json(result);
    } catch (error) {
        res.status(400).json({
            error: 'Credential issuance failed',
            message: error.message,
        });
    }
};

/**
 * Revoke credential (Admin only)
 */
const revokeCredential = async (req, res) => {
    try {
        const validationResult = revokeCredentialSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation failed',
                message: validationResult.error.errors[0].message,
            });
        }

        const { userId, reason } = validationResult.data;
        const adminId = req.user.id;

        const result = await didService.revokeCredential(userId, adminId, reason);

        res.json(result);
    } catch (error) {
        res.status(400).json({
            error: 'Credential revocation failed',
            message: error.message,
        });
    }
};

/**
 * Check verification status
 */
const checkVerification = async (req, res) => {
    try {
        const { userId } = req.params;

        // Basic validation of userId (e.g., MongoDB ObjectId-style 24 hex chars)
        if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'User ID is required',
            });
        }

        if (!/^[a-fA-F0-9]{24}$/.test(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid identifier',
            });
        }

        const result = await didService.checkVerificationStatus(userId);

        res.json(result);
    } catch (error) {
        let statusCode = 500;

        const message = error && error.message ? error.message : 'An unexpected error occurred';
        const name = error && error.name ? error.name : '';

        // Map validation/format errors to 400
        if (
            name === 'CastError' ||
            name === 'ValidationError' ||
            /invalid/i.test(message)
        ) {
            statusCode = 400;
        }
        // Map "not found" semantics to 404
        else if (/not found/i.test(message)) {
            statusCode = 404;
        }

        res.status(statusCode).json({
            error: 'Verification check failed',
            message,
        });
    }
};

/**
 * Get all unverified users (Admin only)
 */
const getUnverifiedUsers = async (req, res) => {
    try {
        const users = await User.find({
            'verification.isVerified': { $ne: true },
            role: { $ne: 'admin' },
        }).select('name email role walletAddress createdAt');

        res.json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message,
        });
    }
};

/**
 * Get all verified users (Admin only)
 */
const getVerifiedUsers = async (req, res) => {
    try {
        const users = await User.find({
            'verification.isVerified': true,
        })
            .select('name email role walletAddress verification.verifiedAt verification.verifiedBy')
            .populate('verification.verifiedBy', 'name email');

        res.json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error.message,
        });
    }
};

module.exports = {
    linkWallet,
    issueCredential,
    revokeCredential,
    checkVerification,
    getUnverifiedUsers,
    getVerifiedUsers,
};
