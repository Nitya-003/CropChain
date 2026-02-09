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

        const result = await didService.checkVerificationStatus(userId);

        res.json(result);
    } catch (error) {
        res.status(500).json({
            error: 'Verification check failed',
            message: error.message,
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
