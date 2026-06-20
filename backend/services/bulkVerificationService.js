const crypto = require('crypto');
const User = require('../models/User');
const BulkVerificationJob = require('../models/BulkVerificationJob');

const didService = require('./didService');
const { appendAuditEvent } = require('../utils/auditLogger');

const {
    CHALLENGE_ACTIONS,
    createChallenge,
    reserveIdempotencyKey,
    storeCompletedIdempotencyRecord,
    createFingerprint,
} = require('./verificationSecurityService');

/**
 * Parses CSV text adhering to RFC-4180 standards (supporting quoted fields, escaped quotes, commas, and multiline values).
 * @param {string} csvText - Raw CSV content
 * @returns {Array<Object>} List of parsed objects mapped to lowercase headers
 */
const parseCSV = (csvText) => {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentLine.push(currentField.trim());
            if (currentLine.length > 0 && (currentLine.length > 1 || currentLine[0] !== '')) {
                lines.push(currentLine);
            }
            currentLine = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }

    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.length > 0 && (currentLine.length > 1 || currentLine[0] !== '')) {
            lines.push(currentLine);
        }
    }

    if (lines.length === 0) return [];

    const headers = lines[0].map((h) => h.toLowerCase().trim());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0 || (line.length === 1 && line[0] === '')) continue;

        const record = {};
        headers.forEach((header, index) => {
            record[header] = line[index] || '';
        });
        records.push(record);
    }

    return records;
};

const statusFor = ({ dryRun, outcomeType }) => {
    if (!dryRun) return outcomeType;
    if (outcomeType === 'success') return 'dry-run-success';
    if (outcomeType === 'skipped') return 'dry-run-skipped';
    if (outcomeType === 'failure') return 'dry-run-failure';
    return outcomeType;
};

/**
 * Background processor for bulk verification jobs
 * @param {string} jobId - Database BulkVerificationJob ObjectId
 * @param {Array<Object>} records - List of parsed records from CSV
 * @param {string} adminId - Admin/actor user ID
 */
const processJob = async (jobId, records, adminId, { dryRun } = {}) => {
    const job = await BulkVerificationJob.findById(jobId);
    if (!job) return;

    job.status = 'processing';
    await job.save();

    try {
        await appendAuditEvent({
            action: 'bulk_job_initiated',
            actorId: adminId,
            status: 'success',
            metadata: { jobId, totalRows: records?.length || 0 },
            req: {},
        });
    } catch (_) {
        // best-effort
    }

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2;

        const inputUserId = record.userid || '';
        const email = record.email || '';
        const walletAddress = record.walletaddress || '';
        const actionStr = (record.action || 'ISSUE_CREDENTIAL').toUpperCase();
        const signature = record.signature || '';
        const nonce = record.nonce || '';
        const expiresAtVal = record.expiresat ? parseInt(record.expiresat, 10) : undefined;

        let userId = inputUserId;
        const action = CHALLENGE_ACTIONS[actionStr] || CHALLENGE_ACTIONS.ISSUE_CREDENTIAL;

        try {
            // Resolve user
            let user = null;
            if (userId && /^[a-fA-F0-9]{24}$/.test(userId)) {
                user = await User.findById(userId);
            } else if (!userId && email) {
                user = await User.findOne({ email });
                if (user) userId = user._id.toString();
            }

            if (!user) throw new Error('User not found');
            userId = user._id.toString();

            // Validate wallet
            if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                throw new Error('Invalid wallet address');
            }

            // Derive idempotency key
            const idempotencyKey = crypto
                .createHash('sha256')
                .update(`${userId}:${walletAddress.toLowerCase()}:${action}`)
                .digest('hex');

            const fingerprint = createFingerprint({ action, actorId: adminId, userId, walletAddress });
            const reservation = await reserveIdempotencyKey({
                action,
                actorId: adminId,
                key: idempotencyKey,
                fingerprint,
            });

            // Idempotency record already completed
            if (!reservation.reserved) {
                if (reservation.record && reservation.record.state === 'completed') {
                    const status = statusFor({ dryRun, outcomeType: 'skipped' });
                    results.push({
                        rowNumber,
                        userId,
                        walletAddress,
                        action,
                        idempotencyKey,
                        status,
                        details: { message: 'Request already processed (idempotency)' },
                    });
                    successCount++;
                    continue;
                }

                // Reserved but not completed
                const status = statusFor({ dryRun, outcomeType: 'failure' });
                results.push({
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status,
                    details: { message: 'Request already in progress or duplicate idempotency key' },
                });
                failureCount += dryRun ? 1 : 1;
                continue;
            }

            // Already verified (issue credential only)
            if (action === CHALLENGE_ACTIONS.ISSUE_CREDENTIAL && user.verification?.isVerified) {
                const status = statusFor({ dryRun, outcomeType: 'skipped' });
                results.push({
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status,
                    details: { message: 'User is already verified' },
                });
                if (!dryRun) {
                    await storeCompletedIdempotencyRecord({
                        action,
                        actorId: adminId,
                        key: idempotencyKey,
                        fingerprint,
                        response: { success: true, message: 'User already verified' },
                    });
                }
                successCount++;
                continue;
            }

            if (dryRun) {
                const predictedDetails = {
                    predicted: true,
                    message: 'Dry-run prediction: would execute side effects if dryRun=false',
                    willExecute: {
                        action,
                        signaturePresent: Boolean(signature),
                        nonceRequired: Boolean(signature),
                        idempotencyReserved: true,
                    },
                };

                results.push({
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status: statusFor({ dryRun, outcomeType: 'success' }),
                    details: predictedDetails,
                });
                successCount++;
                continue;
            }

            // Execute real side effects
            let outcome = null;

            if (signature) {
                if (!nonce || !expiresAtVal) {
                    throw new Error('Nonce and expiresAt are required when signature is provided');
                }

                if (action === CHALLENGE_ACTIONS.ISSUE_CREDENTIAL) {
                    const challengeRecord = {
                        action,
                        actorId: adminId,
                        userId,
                        walletAddress: walletAddress.toLowerCase(),
                        nonce,
                        expiresAt: expiresAtVal,
                    };
                    outcome = await didService.issueCredential(userId, adminId, signature, walletAddress, challengeRecord);
                } else if (action === CHALLENGE_ACTIONS.LINK_WALLET) {
                    const challengeRecord = {
                        action,
                        actorId: userId,
                        userId,
                        walletAddress: walletAddress.toLowerCase(),
                        nonce,
                        expiresAt: expiresAtVal,
                    };
                    outcome = await didService.linkWallet(userId, walletAddress, signature, challengeRecord);
                } else {
                    throw new Error(`Unsupported action: ${action}`);
                }
            } else {
                outcome = await createChallenge({
                    action,
                    actorId: adminId,
                    userId,
                    walletAddress,
                });
            }

            await storeCompletedIdempotencyRecord({
                action,
                actorId: adminId,
                key: idempotencyKey,
                fingerprint,
                response: outcome,
            });

            results.push({
                rowNumber,
                userId,
                walletAddress,
                action,
                idempotencyKey,
                status: 'success',
                details: outcome,
            });
            successCount++;
        } catch (error) {
            const status = statusFor({ dryRun, outcomeType: 'failure' });
            results.push({
                rowNumber,
                userId: userId || undefined,
                walletAddress: walletAddress || undefined,
                action,
                idempotencyKey: undefined,
                status,
                error: error.message || error.toString(),
            });
            failureCount++;

            try {
                await appendAuditEvent({
                    action: 'bulk_row_processed',
                    actorId: adminId,
                    targetUserId: userId || undefined,
                    walletAddress: walletAddress || undefined,
                    status: 'failure',
                    metadata: {
                        rowNumber,
                        bulkStatus: 'failed',
                        bulkAction: action,
                        errorType: error?.name || 'Error',
                    },
                    req: {},
                });
            } catch (_) {
                // best-effort
            }
        }

        job.processedRows = i + 1;
        await job.save();
    }

    job.status = 'completed';
    job.successCount = successCount;
    job.failureCount = failureCount;
    job.results = results;
    await job.save();

    try {
        await appendAuditEvent({
            action: 'bulk_job_completed',
            actorId: adminId,
            status: 'success',
            metadata: { jobId, totalRows: records?.length || 0, successCount, failureCount },
            req: {},
        });
    } catch (_) {
        // best-effort
    }
};

module.exports = {
    parseCSV,
    processJob,
};

