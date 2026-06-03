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
                validationResult.error.errors.map((err) => err.message)
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

    if (
        challengeRecord.expiresAt !== expiresAt ||
        challengeRecord.nonce !== nonce
    ) {
        return {
            response: handleDuplicateIdempotencyKey(res, 'Nonce does not match the active challenge'),
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

const executeAndFinalizeIdempotency = async ({
    res,
    action,
    actorId,
    idempotencyKey,
    fingerprint,
    challengeRecord,
    execute,
}) => {
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