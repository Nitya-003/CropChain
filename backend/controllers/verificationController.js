const didService = require('../services/didService');
const User = require('../models/User');
const { z } = require('zod');
const apiResponse = require('../utils/apiResponse');
const { ROLES } = require('../constants/permissions');
const {
    CHALLENGE_ACTIONS,
    createChallenge,
    consumeChallenge,
    createFingerprint,
    deleteIdempotencyRecord,
    getIdempotencyRecord,
    reserveIdempotencyKey,
    storeCompletedIdempotencyRecord,
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

const handleZodValidation = (res, schema, reqBody) => {
    const validationResult = schema.safeParse(reqBody);

    if (!validationResult.success) {
        res.status(400).json(
            apiResponse.validationErrorResponse(
                validationResult.error.errors.map(err => err.message)
            )
        );

        return { ok: false };
    }

    return { ok: true, data: validationResult.data };
};

const handleServerError = (res, error, { code, message }) => {
    console.error(message, error);

    return res.status(500).json(
        apiResponse.errorResponse(message, code, 500)
    );
};

const requireIdempotencyKey = (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key');

    if (!idempotencyKey || !idempotencyKey.trim()) {
        res.status(400).json(
            apiResponse.validationErrorResponse(['Idempotency-Key header is required'])
        );

        return null;
    }

    return idempotencyKey.trim();
};

const handleIdempotencyReplay = (res, record) => {
    return res.status(record.statusCode || 200).json(record.response);
};

const handleDuplicateIdempotencyKey = (res, message) => {
    return res.status(409).json(apiResponse.conflictResponse(message));
};

const handleChallengeValidation = (res, challengeRecord, requestPayload) => {
    if (!challengeRecord) {
        return handleDuplicateIdempotencyKey(res, 'Nonce is missing, expired, or already used');
    }

    if (
        challengeRecord.expiresAt !== requestPayload.expiresAt ||
        challengeRecord.nonce !== requestPayload.nonce
    ) {
        return handleDuplicateIdempotencyKey(res, 'Nonce does not match the active challenge');
    }

    return null;
};

const handleVerificationWithIdempotency = async ({
    res,
    action,
    actorId,
    userId,
    walletAddress,
    signature,
    nonce,
    expiresAt,
    idempotencyKey,
    execute,
}) => {
    const fingerprint = createFingerprint({ action, actorId, userId, walletAddress });
    const existingRecord = await getIdempotencyRecord({ action, actorId, key: idempotencyKey });

    if (existingRecord) {
        if (existingRecord.fingerprint !== fingerprint) {
            return handleDuplicateIdempotencyKey(res, 'Idempotency-Key was already used for a different request');
        }

        if (existingRecord.state === 'completed') {
            return handleIdempotencyReplay(res, existingRecord);
        }

        return handleDuplicateIdempotencyKey(res, 'Request with this Idempotency-Key is already in progress');
    }

    const challengeRecord = await consumeChallenge({
        action,
        actorId,
        nonce,
        userId,
        walletAddress,
        expiresAt,
    });

    const challengeError = handleChallengeValidation(res, challengeRecord, { nonce, expiresAt });

    if (challengeError) {
        return challengeError;
    }

    const reservation = await reserveIdempotencyKey({
        action,
        actorId,
        key: idempotencyKey,
        fingerprint,
    });

    if (!reservation.reserved) {
        if (!reservation.record) {
            return handleDuplicateIdempotencyKey(res, 'Unable to reserve the idempotency key');
        }

        if (reservation.record.fingerprint !== fingerprint) {
            return handleDuplicateIdempotencyKey(res, 'Idempotency-Key was already used for a different request');
        }

        if (reservation.record.state === 'completed') {
            return handleIdempotencyReplay(res, reservation.record);
        }

        return handleDuplicateIdempotencyKey(res, 'Request with this Idempotency-Key is already in progress');
    }

    try {
        const result = await execute(challengeRecord);
        await storeCompletedIdempotencyRecord({
            action,
            actorId,
            key: idempotencyKey,
            fingerprint,
            response: result,
            statusCode: 200,
        });

        return res.json(result);
    } catch (error) {
        await deleteIdempotencyRecord({ action, actorId, key: idempotencyKey });
        throw error;
    }
};

const generateLinkWalletChallenge = async (req, res) => {
    try {
        const validationResult = handleZodValidation(res, linkWalletChallengeSchema, req.body);

        if (!validationResult.ok) {
            return;
        }

        const userId = req.user.id;
        const { walletAddress } = validationResult.data;

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
        const validationResult = handleZodValidation(res, issueCredentialChallengeSchema, req.body);

        if (!validationResult.ok) {
            return;
        }

        const actorId = req.user.id;
        const { userId, walletAddress } = validationResult.data;

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
    try {
        const validationResult = handleZodValidation(res, linkWalletSchema, req.body);

        if (!validationResult.ok) {
            return;
        }

        const idempotencyKey = requireIdempotencyKey(req, res);

        if (!idempotencyKey) {
            return;
        }

        const { walletAddress, signature, nonce, expiresAt } = validationResult.data;
        const userId = req.user.id;

        return handleVerificationWithIdempotency({
            res,
            action: CHALLENGE_ACTIONS.LINK_WALLET,
            actorId: userId,
            userId,
            walletAddress,
            signature,
            nonce,
            expiresAt,
            idempotencyKey,
            execute: (challenge) => didService.linkWallet(userId, walletAddress, signature, challenge),
        });
    } catch (error) {
        return handleServerError(res, error, {
            code: 'WALLET_LINKING_ERROR',
            message: 'Wallet linking failed',
        });
    }
};

/**
 * Issue verifiable credential (Mandi officer only)
 */
const issueCredential = async (req, res) => {
    try {
        const validationResult = handleZodValidation(res, issueCredentialSchema, req.body);

        if (!validationResult.ok) {
            return;
        }

        const idempotencyKey = requireIdempotencyKey(req, res);

        if (!idempotencyKey) {
            return;
        }

        const { userId, signature, walletAddress, nonce, expiresAt } = validationResult.data;
        const verifierId = req.user.id;

        return handleVerificationWithIdempotency({
            res,
            action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
            actorId: verifierId,
            userId,
            walletAddress,
            signature,
            nonce,
            expiresAt,
            idempotencyKey,
            execute: (challenge) => didService.issueCredential(userId, verifierId, signature, walletAddress, challenge),
        });
    } catch (error) {
        return handleServerError(res, error, {
            code: 'CREDENTIAL_ISSUE_ERROR',
            message: 'Credential issuing failed',
        });
    }
};

/**
 * Revoke credential (Admin only)
 */
const revokeCredential = async (req, res) => {
    try {
        const validationResult = handleZodValidation(res, revokeCredentialSchema, req.body);

        if (!validationResult.ok) {
            return;
        }

        const { userId, reason } = validationResult.data;
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
        const { userId } = req.params;

        // Basic validation of userId (e.g., MongoDB ObjectId-style 24 hex chars)
        if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
            return res.status(400).json(
                apiResponse.errorResponse(
                    'User ID is required',
                    'MISSING_USERID',
                    400
                )
            );
        }

        if (!/^[a-fA-F0-9]{24}$/.test(userId)) {
            return res.status(400).json(
                apiResponse.errorResponse(
                    'User ID must be a valid identifier',
                    'INVALID_USERID',
                    400
                )
            );
        }

        const result = await didService.checkVerificationStatus(userId);

        res.json(result);
    } catch (error) {
        let statusCode = 500;
        let errorCode = 'VERIFICATION_CHECK_ERROR';

        const message = error && error.message ? error.message : 'An unexpected error occurred';
        const name = error && error.name ? error.name : '';

        // Map validation/format errors to 400
        if (
            name === 'CastError' ||
            name === 'ValidationError' ||
            /invalid/i.test(message)
        ) {
            statusCode = 400;
            errorCode = 'INVALID_DATA';
        }
        // Map "not found" semantics to 404
        else if (/not found/i.test(message)) {
            statusCode = 404;
            errorCode = 'NOT_FOUND';
        }

        res.status(statusCode).json(
            apiResponse.errorResponse(message, errorCode, statusCode)
        );
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
