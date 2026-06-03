const didService = require('../services/didService');
const User = require('../models/User');
const { z } = require('zod');
const { validateParams } = require('../utils/validation');
const {
    handleZodValidation,
    handleServerError,
    requireIdempotencyKey,
    handleVerificationWithIdempotency,
} = require('../utils/verificationControllerHelpers');
const apiResponse = require('../utils/apiResponse');
const { ROLES } = require('../constants/permissions');
const {
    CHALLENGE_ACTIONS,
    createChallenge,
} = require('../services/verificationSecurityService');

// Validation schemas
const linkWalletSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    signature: z.string().min(1, 'Signature is required'),
    nonce: z.string().min(1, 'Nonce is required'),
    expiresAt: z.coerce.number().int().positive('Expiry timestamp is required'),
});

const issueCredentialSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    signature: z.string().min(1, 'Signature is required'),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    nonce: z.string().min(1, 'Nonce is required'),
    expiresAt: z.coerce.number().int().positive('Expiry timestamp is required'),
});

const linkWalletChallengeSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const issueCredentialChallengeSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const revokeCredentialSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    reason: z.string().min(1, 'Revocation reason is required'),
});

const checkVerificationParamsSchema = z.object({
    userId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

// Internal helpers for logic de-duplication
const validateOrRespond = (res, schema, body) => {
    const result = handleZodValidation(res, schema, body);
    return result.ok ? result.data : null;
};

const getIdempotencyKeyOrReturn = (req, res) => {
    return requireIdempotencyKey(req, res);
};

const withVerificationAction = async ({
    req,
    res,
    schema,
    body,
    action,
    actorIdFromReq,
    execute,
    errorMeta,
}) => {
    try {
        const validatedData = validateOrRespond(res, schema, body);
        if (!validatedData) {
            return;
        }

        const idempotencyKey = getIdempotencyKeyOrReturn(req, res);
        if (!idempotencyKey) {
            return;
        }

        const { walletAddress, signature, nonce, expiresAt, userId } = validatedData;
        const actorId = actorIdFromReq;
        const targetUserId = userId || actorId;

        return await handleVerificationWithIdempotency({
            res,
            action,
            actorId,
            userId: targetUserId,
            walletAddress,
            signature,
            nonce,
            expiresAt,
            idempotencyKey,
            execute: (challenge) => execute(validatedData, challenge),
        });
    } catch (error) {
        return handleServerError(res, error, errorMeta);
    }
};

const generateLinkWalletChallenge = async (req, res) => {
    try {
        const validatedData = validateOrRespond(res, linkWalletChallengeSchema, req.body);

        if (!validatedData) {
            return;
        }

        const userId = req.user.id;
        const { walletAddress } = validatedData;

        const challenge = await createChallenge({
            action: CHALLENGE_ACTIONS.LINK_WALLET,
            actorId: userId,
            userId,
            walletAddress,
        });

        res.json(apiResponse.successResponse({ challenge }, 'Wallet linking challenge generated'));
    } catch (error) {
        return handleServerError(res, error, {
            code: 'WALLET_LINK_CHALLENGE_ERROR',
            message: 'Failed to generate wallet linking challenge',
        });
    }
};

const generateIssueCredentialChallenge = async (req, res) => {
    try {
        const validatedData = validateOrRespond(res, issueCredentialChallengeSchema, req.body);

        if (!validatedData) {
            return;
        }

        const actorId = req.user.id;
        const { userId, walletAddress } = validatedData;

        const challenge = await createChallenge({
            action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
            actorId,
            userId,
            walletAddress,
        });

        res.json(apiResponse.successResponse({ challenge }, 'Credential issuance challenge generated'));
    } catch (error) {
        return handleServerError(res, error, {
            code: 'CREDENTIAL_ISSUE_CHALLENGE_ERROR',
            message: 'Failed to generate credential issuance challenge',
        });
    }
};

/**
 * Link wallet address to user account
 */
const linkWallet = async (req, res) => {
    return withVerificationAction({
        req,
        res,
        schema: linkWalletSchema,
        body: req.body,
        action: CHALLENGE_ACTIONS.LINK_WALLET,
        actorIdFromReq: req.user.id,
        execute: (validatedData, challenge) =>
            didService.linkWallet(req.user.id, validatedData.walletAddress, validatedData.signature, challenge),
        errorMeta: {
            code: 'WALLET_LINKING_ERROR',
            message: 'Wallet linking failed',
        },
    });
};

/**
 * Issue verifiable credential (Mandi officer only)
 */
const issueCredential = async (req, res) => {
    return withVerificationAction({
        req,
        res,
        schema: issueCredentialSchema,
        body: req.body,
        action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
        actorIdFromReq: req.user.id,
        execute: (validatedData, challenge) =>
            didService.issueCredential(validatedData.userId, req.user.id, validatedData.signature, validatedData.walletAddress, challenge),
        errorMeta: {
            code: 'CREDENTIAL_ISSUE_ERROR',
            message: 'Credential issuing failed',
        },
    });
};

/**
 * Revoke credential (Admin only)
 */
const revokeCredential = async (req, res) => {
    try {
        const validatedData = validateOrRespond(res, revokeCredentialSchema, req.body);

        if (!validatedData) {
            return;
        }

        const { userId, reason } = validatedData;
        const adminId = req.user.id;

        const result = await didService.revokeCredential(userId, adminId, reason);

        res.json(result);
    } catch (error) {
        return handleServerError(res, error, {
            code: 'CREDENTIAL_REVOKE_ERROR',
            message: 'Credential revocation failed',
        });
    }
};

/**
 * Check verification status
 */
const checkVerification = async (req, res) => {
    try {
        const validatedParams = validateParams(res, checkVerificationParamsSchema, req.params);

        if (!validatedParams) {
            return;
        }

        const { userId } = validatedParams;

        const result = await didService.checkVerificationStatus(userId);

        res.json(result);
    } catch (error) {
        return handleServerError(res, error, {
            code: 'VERIFICATION_CHECK_ERROR',
            message: 'Verification check failed',
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
            role: { $nin: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
        }).select('name email role walletAddress createdAt');

        const response = apiResponse.successResponse(
            { count: users.length, users },
            'Unverified users retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        res.status(500).json(
            apiResponse.errorResponse('Failed to fetch users', 'FETCH_USERS_ERROR', 500)
        );
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

        const response = apiResponse.successResponse(
            { count: users.length, users },
            'Verified users retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        res.status(500).json(
            apiResponse.errorResponse('Failed to fetch users', 'FETCH_USERS_ERROR', 500)
        );
    }
};

module.exports = {
    generateLinkWalletChallenge,
    generateIssueCredentialChallenge,
    linkWallet,
    issueCredential,
    revokeCredential,
    checkVerification,
    getUnverifiedUsers,
    getVerifiedUsers,
};
