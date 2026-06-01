const apiResponse = require('./apiResponse');
const {
    createFingerprint,
    getIdempotencyRecord,
    consumeChallenge,
    reserveIdempotencyKey,
    storeCompletedIdempotencyRecord,
    deleteIdempotencyRecord,
} = require('../services/verificationSecurityService');

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

module.exports = {
    handleVerificationWithIdempotency,
    getFingerprintAndExistingRecord,
    handleExistingIdempotencyRecord,
    consumeAndValidateChallenge,
    reserveOrHandleReservationOutcome,
    executeAndFinalizeIdempotency,
};