const crypto = require('crypto');
const { getRedisConnection } = require('../config/redis');
const VerificationEvent = require('../models/VerificationEvent');

const CHALLENGE_TTL_SECONDS = parseInt(process.env.VERIFICATION_CHALLENGE_TTL_SECONDS, 10) || 180;
const IDEMPOTENCY_TTL_SECONDS = parseInt(process.env.VERIFICATION_IDEMPOTENCY_TTL_SECONDS, 10) || 24 * 60 * 60;

const CHALLENGE_ACTIONS = {
    LINK_WALLET: 'LINK_WALLET',
    ISSUE_CREDENTIAL: 'ISSUE_CREDENTIAL',
};

const buildChallengeKey = ({ action, actorId, nonce }) => `verification:challenge:${action}:${actorId}:${nonce}`;
const buildIdempotencyKey = ({ action, actorId, key }) => `verification:idempotency:${action}:${actorId}:${key}`;

const normalizeWalletAddress = (walletAddress) => (walletAddress ? walletAddress.toLowerCase() : walletAddress);

const createFingerprint = ({ action, actorId, userId, walletAddress }) => {
    const payload = {
        action,
        actorId,
        userId,
        walletAddress: normalizeWalletAddress(walletAddress),
    };

    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const buildVerificationMessage = ({ action, actorId, userId, walletAddress, nonce, expiresAt }) => {
    const lines = [
        'CropChain verification request',
        `Action: ${action}`,
        `Actor ID: ${actorId}`,
        `User ID: ${userId}`,
    ];

    if (walletAddress) {
        lines.push(`Wallet Address: ${normalizeWalletAddress(walletAddress)}`);
    }

    lines.push(`Nonce: ${nonce}`);
    lines.push(`Expires At: ${expiresAt}`);

    return lines.join('\n');
};

const parseJsonRecord = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === 'object') {
        return value;
    }

    return JSON.parse(value);
};

const createChallenge = async ({ action, actorId, userId, walletAddress }) => {
    const redis = getRedisConnection();
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (CHALLENGE_TTL_SECONDS * 1000);
    const record = {
        action,
        actorId,
        userId,
        walletAddress: normalizeWalletAddress(walletAddress),
        nonce,
        expiresAt,
        status: 'unused',
        createdAt: Date.now(),
    };

    await redis.set(buildChallengeKey({ action, actorId, nonce }), JSON.stringify(record), 'EX', CHALLENGE_TTL_SECONDS);

    // Persist audit event
    try {
        await VerificationEvent.create({
            action: 'challenge_created',
            actorId,
            userId,
            walletAddress: record.walletAddress,
            status: 'success',
            metadata: {
                challengeAction: action,
                nonce,
                expiresAt,
            },
        });
    } catch (error) {
        console.error('Failed to persist challenge_created verification event:', error);
    }

    return {
        nonce,
        expiresAt,
        action,
        actorId,
        userId,
        walletAddress: record.walletAddress,
    };
};

const consumeChallenge = async ({ action, actorId, nonce, userId, walletAddress, expiresAt }) => {
    const redis = getRedisConnection();
    const key = buildChallengeKey({ action, actorId, nonce });
    const rawRecord = await redis.eval(
        "local value = redis.call('GET', KEYS[1]); if not value then return nil end; redis.call('DEL', KEYS[1]); return value",
        1,
        key
    );

    const storedRecord = parseJsonRecord(rawRecord);

    if (!storedRecord) {
        return null;
    }

    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);

    if (
        storedRecord.action !== action ||
        storedRecord.actorId !== actorId ||
        storedRecord.userId !== userId ||
        storedRecord.expiresAt !== expiresAt ||
        normalizeWalletAddress(storedRecord.walletAddress) !== normalizedWalletAddress
    ) {
        return null;
    }

    if (storedRecord.expiresAt <= Date.now()) {
        return null;
    }

    return storedRecord;
};

const getIdempotencyRecord = async ({ action, actorId, key }) => {
    const redis = getRedisConnection();
    const rawRecord = await redis.get(buildIdempotencyKey({ action, actorId, key }));
    return parseJsonRecord(rawRecord);
};

const reserveIdempotencyKey = async ({ action, actorId, key, fingerprint }) => {
    const redis = getRedisConnection();
    const storageKey = buildIdempotencyKey({ action, actorId, key });
    const record = {
        state: 'pending',
        fingerprint,
        createdAt: Date.now(),
    };

    const result = await redis.set(storageKey, JSON.stringify(record), 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');

    if (result === 'OK') {
        return { reserved: true, key: storageKey, record };
    }

    const existingRecord = await getIdempotencyRecord({ action, actorId, key });

    return { reserved: false, key: storageKey, record: existingRecord };
};

const storeCompletedIdempotencyRecord = async ({ action, actorId, key, fingerprint, response, statusCode = 200 }) => {
    const redis = getRedisConnection();
    const storageKey = buildIdempotencyKey({ action, actorId, key });
    const record = {
        state: 'completed',
        fingerprint,
        statusCode,
        response,
        completedAt: Date.now(),
    };

    await redis.set(storageKey, JSON.stringify(record), 'EX', IDEMPOTENCY_TTL_SECONDS);

    return record;
};

const deleteIdempotencyRecord = async ({ action, actorId, key }) => {
    const redis = getRedisConnection();
    await redis.del(buildIdempotencyKey({ action, actorId, key }));
};

module.exports = {
    CHALLENGE_ACTIONS,
    buildVerificationMessage,
    createChallenge,
    consumeChallenge,
    createFingerprint,
    deleteIdempotencyRecord,
    getIdempotencyRecord,
    reserveIdempotencyKey,
    storeCompletedIdempotencyRecord,
};