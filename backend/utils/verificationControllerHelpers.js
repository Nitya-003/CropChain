const apiResponse = require('./apiResponse');
const { mapHttpError } = require('./httpErrorMapper');

const {
    createFingerprint,
    getIdempotencyRecord,
    consumeChallenge,
    reserveIdempotencyKey,
    storeCompletedIdempotencyRecord,
    deleteIdempotencyRecord,
} = require('../services/verificationSecurityService');

const handleZodValidation = (res, schema, reqBody) => {
    const validationResult = schema.safeParse(reqBody);

    if (!validationResult.success) {
        res.status(400).json(
            apiResponse.validationErrorResponse(
                validationResult.error.issues.map((err) => err.message)
            )
        );

        return { ok: false };
    }

    return { ok: true, data: validationResult.data };
};

const handleServerError = (res, error, fallbackMeta) => {
    console.error(fallbackMeta?.message || 'Server error', error);
    const { statusCode, body } = mapHttpError(error, fallbackMeta);
    return res.status(statusCode).json(body);
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

const getFingerprintAndExistingRecord = async ({ action, actorId, userId, walletAddress, idempotencyKey }) => {
    const fingerprint = createFingerprint({ action, actorId, userId, walletAddress });
    const existingRecord = await getIdempotencyRecord({ action, actorId, key: idempotencyKey });

    return { fingerprint, existingRecord };
};

const handleExistingIdempotencyRecord = (res, existingRecord, fingerprint) => {
    if (!existingRecord) {
        return null;
    }

    if (existingRecord.fingerprint !== fingerprint) {
        return handleDuplicateIdempotencyKey(res, 'Idempotency-Key was already used for a different request');
    }

    if (existingRecord.state === 'completed') {
        return handleIdempotencyReplay(res, existingRecord);
    }

    return handleDuplicateIdempotencyKey(res, 'Request with this Idempotency-Key is already in progress');
};

const consumeAndValidateChallenge = async ({ res, action, actorId, nonce, userId, walletAddress, expiresAt }) => {
    const challengeRecord = await consumeChallenge({
        action,
        actorId,
        nonce,
        userId,
        walletAddress,
        expiresAt,
    });

    if (!challengeRecord) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Nonce is missing, expired, or already used'),
        };
    }

    if (challengeRecord.action !== action) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge action mismatch'),
        };
    }

    const normalizedReqWallet = walletAddress ? walletAddress.toLowerCase() : walletAddress;
    const normalizedStoredWallet = challengeRecord.walletAddress ? challengeRecord.walletAddress.toLowerCase() : challengeRecord.walletAddress;
    if (normalizedStoredWallet !== normalizedReqWallet) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge wallet address mismatch'),
        };
    }

    if (challengeRecord.nonce !== nonce) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge nonce mismatch'),
        };
    }

    if (challengeRecord.expiresAt !== expiresAt) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge expiry mismatch'),
        };
    }

    if (challengeRecord.expiresAt <= Date.now()) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge has expired'),
        };
    }

    if (challengeRecord.userId !== userId) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Challenge user mismatch'),
        };
    }

    return { challengeRecord };
};

const reserveOrHandleReservationOutcome = async ({ res, action, actorId, idempotencyKey, fingerprint }) => {
    const reservation = await reserveIdempotencyKey({
        action,
        actorId,
        key: idempotencyKey,
        fingerprint,
    });

    if (reservation.reserved) {
        return { reservation };
    }

    if (!reservation.record) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Unable to reserve the idempotency key'),
        };
    }

    if (reservation.record.fingerprint !== fingerprint) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Idempotency-Key was already used for a different request'),
        };
    }

    if (reservation.record.state === 'completed') {
        return {
            response: handleIdempotencyReplay(res, reservation.record),
        };
    }

    return {
        response: handleDuplicateIdempotencyKey(res, 'Request with this Idempotency-Key is already in progress'),
    };
};

const { appendAuditEvent } = require('./auditLogger');

const executeAndFinalizeIdempotency = async ({
    res,
    action,
    actorId,
    idempotencyKey,
    fingerprint,
    challengeRecord,
    execute,
    req,
}) => {
    try {
        const targetUserId = challengeRecord?.userId;
        const walletAddress = challengeRecord?.walletAddress;

        // Log attempt (privacy-safe)
        try {
            await appendAuditEvent({
                action: 'verification_attempt',
                actorId,
                targetUserId,
                walletAddress,
                status: 'attempt',
                metadata: { originalAction: action },
                req,
            });
        } catch (eventErr) {
            console.error('Failed to log verification_attempt event:', eventErr);
        }


        // Emit socket status in_progress
        const socketService = require('../services/socketService');
        if (challengeRecord?.userId) {
            try {
                socketService.emitToVerificationRoom(challengeRecord.userId, 'verification.status.updated', {
                    userId: challengeRecord.userId,
                    newState: 'in_progress',
                    timestamp: Date.now(),
                    idempotencyKey,
                });
            } catch (sockErr) {
                console.error('Failed to emit socket verification status (in_progress):', sockErr.message);
            }
        }

        const result = await execute(challengeRecord);

        // Log success
        try {
            await appendAuditEvent({
                action: 'verification_success',
                actorId,
                targetUserId,
                walletAddress,
                idempotencyKey,
                status: 'success',
                metadata: { originalAction: action },
                req,
            });
        } catch (eventErr) {
            console.error('Failed to log verification_success event:', eventErr);
        }


        // Emit socket status success (verified or linked)
        if (challengeRecord?.userId) {
            try {
                socketService.emitToVerificationRoom(challengeRecord.userId, 'verification.status.updated', {
                    userId: challengeRecord.userId,
                    newState: action === 'LINK_WALLET' ? 'linked' : 'verified',
                    timestamp: Date.now(),
                    idempotencyKey,
                });
            } catch (sockErr) {
                console.error('Failed to emit socket verification status (success):', sockErr.message);
            }
        }

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
        // Log failure
        try {
            await appendAuditEvent({
                action: 'verification_failure',
                actorId,
                targetUserId,
                walletAddress,
                idempotencyKey,
                status: 'failure',
                // Privacy: do not persist raw stack/errors. Only store a coarse category.
                metadata: { originalAction: action, errorType: error?.name || 'Error' },
                req,
            });
        } catch (eventErr) {
            console.error('Failed to log verification_failure event:', eventErr);
        }


        // Emit socket status failure
        if (challengeRecord?.userId) {
            try {
                const socketService = require('../services/socketService');
                socketService.emitToVerificationRoom(challengeRecord.userId, 'verification.status.updated', {
                    userId: challengeRecord.userId,
                    newState: 'failed',
                    timestamp: Date.now(),
                    idempotencyKey,
                });
            } catch (sockErr) {
                console.error('Failed to emit socket verification status (failed):', sockErr.message);
            }
        }

        await deleteIdempotencyRecord({ action, actorId, key: idempotencyKey });
        throw error;
    }
};

const handleVerificationWithIdempotency = async (context) => {
    const { res, action, actorId, userId, walletAddress, nonce, expiresAt, idempotencyKey, execute } = context;

    const { fingerprint, existingRecord } = await getFingerprintAndExistingRecord({
        action,
        actorId,
        userId,
        walletAddress,
        idempotencyKey,
    });

    const existingRecordOutcome = handleExistingIdempotencyRecord(res, existingRecord, fingerprint);

    if (existingRecordOutcome) {
        return existingRecordOutcome;
    }

    const challengeOutcome = await consumeAndValidateChallenge({
        res,
        action,
        actorId,
        nonce,
        userId,
        walletAddress,
        expiresAt,
    });

    if (challengeOutcome.response) {
        return challengeOutcome.response;
    }

    const reservationOutcome = await reserveOrHandleReservationOutcome({
        res,
        action,
        actorId,
        idempotencyKey,
        fingerprint,
    });

    if (reservationOutcome.response) {
        return reservationOutcome.response;
    }

    return executeAndFinalizeIdempotency({
        res,
        action,
        actorId,
        idempotencyKey,
        fingerprint,
        challengeRecord: challengeOutcome.challengeRecord,
        execute,
    });
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

module.exports = {
    handleZodValidation,
    handleServerError,
    requireIdempotencyKey,
    handleIdempotencyReplay,
    handleDuplicateIdempotencyKey,
    handleChallengeValidation,
    handleVerificationWithIdempotency,
    getFingerprintAndExistingRecord,
    handleExistingIdempotencyRecord,
    consumeAndValidateChallenge,
    reserveOrHandleReservationOutcome,
    executeAndFinalizeIdempotency,
};