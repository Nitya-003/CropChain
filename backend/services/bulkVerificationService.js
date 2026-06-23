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

const reconstructRetryRecords = (failedRows = []) => {
    return failedRows
        .map((r) => r?.originalInput)
        .filter(Boolean)
        .map((input) => {
            const records = {
                userid: input.userid || '',
                email: input.email || '',
                walletaddress: input.walletaddress || '',
                action: (input.action || 'ISSUE_CREDENTIAL').toString(),
                signature: input.signature || '',
                nonce: input.nonce || '',
                expiresat: input.expiresat || '',
            };
            return records;
        });
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

    const BULK_JOB_CONCURRENCY = parseInt(process.env.BULK_JOB_CONCURRENCY, 10) || 10;
    const PROGRESS_UPDATE_EVERY = parseInt(process.env.BULK_JOB_PROGRESS_UPDATE_EVERY, 10) || 20;

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

    // Preserve CSV order in results.
    const results = new Array(records.length);

    // Progress tracking (avoid job.save() per-row).
    let completedCount = 0;
    let lastSavedCompletedCount = 0;
    let savePromise = Promise.resolve();

    let nextIndex = 0;

    const processRow = async (i) => {
        const record = records[i];
        const rowNumber = i + 2;

        const inputUserId = record.userid || '';
        const email = record.email || '';
        const walletAddress = record.walletaddress || '';
        const actionStr = (record.action || 'ISSUE_CREDENTIAL').toUpperCase();
        const signature = record.signature || '';
        const nonce = record.nonce || '';
        const expiresAtVal = record.expiresat ? parseInt(record.expiresat, 10) : undefined;

        // Store minimal retry inputs so admin can re-run failed rows without CSV re-upload.
        const originalInput = {
            userid: inputUserId,
            email,
            walletaddress: walletAddress,
            action: actionStr,
            signature,
            nonce,
            expiresat: record.expiresat || '',
        };

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
                    results[i] = {
                        rowNumber,
                        userId,
                        walletAddress,
                        action,
                        idempotencyKey,
                        status,
                        details: { message: 'Request already processed (idempotency)' },
                        originalInput,
                    };
                    return;
                }

                // Reserved but not completed
                const status = statusFor({ dryRun, outcomeType: 'failure' });
                results[i] = {
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status,
                    details: { message: 'Request already in progress or duplicate idempotency key' },
                    originalInput,
                };
                return;
            }

            // Already verified (issue credential only)
            if (action === CHALLENGE_ACTIONS.ISSUE_CREDENTIAL && user.verification?.isVerified) {
                const status = statusFor({ dryRun, outcomeType: 'skipped' });
                results[i] = {
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status,
                    details: { message: 'User is already verified' },
                    originalInput,
                };
                if (!dryRun) {
                    await storeCompletedIdempotencyRecord({
                        action,
                        actorId: adminId,
                        key: idempotencyKey,
                        fingerprint,
                        response: { success: true, message: 'User already verified' },
                    });
                }
                return;
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

                results[i] = {
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status: statusFor({ dryRun, outcomeType: 'success' }),
                    details: predictedDetails,
                    originalInput,
                };
                return;
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

            results[i] = {
                rowNumber,
                userId,
                walletAddress,
                action,
                idempotencyKey,
                status: 'success',
                details: outcome,
                originalInput,
            };
        } catch (error) {
            const status = statusFor({ dryRun, outcomeType: 'failure' });
            results[i] = {
                rowNumber,
                userId: userId || undefined,
                walletAddress: walletAddress || undefined,
                action,
                idempotencyKey: undefined,
                status,
                error: error.message || error.toString(),
                originalInput,
            };

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
    };

    const worker = async () => {
        while (true) {
            const i = nextIndex;
            nextIndex += 1;
            if (i >= records.length) return;

            await processRow(i);

            completedCount += 1;
            const currentCompleted = completedCount;
            if (
                currentCompleted - lastSavedCompletedCount >= PROGRESS_UPDATE_EVERY ||
                currentCompleted === records.length
            ) {
                lastSavedCompletedCount = currentCompleted;
                savePromise = savePromise.then(async () => {
                    const currentJob = await BulkVerificationJob.findById(jobId);
                    if (currentJob && currentJob.status === 'processing') {
                        currentJob.processedRows = currentCompleted;
                        await currentJob.save();
                    }
                }).catch((err) => {
                    console.error('Failed to save bulk job progress:', err);
                });
            }
        }
    };


    const concurrency = Math.max(1, Math.min(BULK_JOB_CONCURRENCY, records.length || 1));
    const workers = Array.from({ length: concurrency }).map(() => worker());
    await Promise.all(workers);

    // Wait for any pending intermediate saves to finish.
    await savePromise;

    const successCount = results.filter(
        (r) => r && ['success', 'skipped', 'dry-run-success', 'dry-run-skipped'].includes(r.status)
    ).length;
    const failureCount = results.filter(
        (r) => r && ['failure', 'dry-run-failure'].includes(r.status)
    ).length;

    // Load fresh job document to avoid version conflicts or overwrite issues.
    const finalJob = await BulkVerificationJob.findById(jobId);
    if (finalJob) {
        finalJob.status = 'completed';
        finalJob.successCount = successCount;
        finalJob.failureCount = failureCount;
        finalJob.results = results;
        finalJob.processedRows = records.length;
        await finalJob.save();
    }

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


const retryJob = async (jobId, failedRows, adminId) => {
    // Reconstruct records from stored originalInput.
    const retryRecords = reconstructRetryRecords(failedRows);

    if (!retryRecords.length) {
        return null;
    }

    const retryJob = await BulkVerificationJob.create({
        status: 'pending',
        mode: 'bulk',
        totalRows: retryRecords.length,
        actorId: adminId,
    });

    processJob(retryJob._id, retryRecords, adminId, { dryRun: false }).catch((err) => {
        console.error(`Error processing bulk retry job ${retryJob._id}:`, err);
    });

    return retryJob;
};


module.exports = {
    parseCSV,
    processJob,
    retryJob,
    reconstructRetryRecords,
};


