const crypto = require('crypto');
const User = require('../models/User');
const BulkVerificationJob = require('../models/BulkVerificationJob');
const VerificationEvent = require('../models/VerificationEvent');
const didService = require('./didService');
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
                // Escaped double quote ("") -> actual double quote character
                currentField += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip \n
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
        lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const headers = lines[0].map(h => h.toLowerCase().trim());
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Skip entirely empty lines
        if (line.length === 0 || (line.length === 1 && line[0] === '')) {
            continue;
        }
        const record = {};
        headers.forEach((header, index) => {
            record[header] = line[index] || '';
        });
        records.push(record);
    }

    return records;
};

/**
 * Background processor for bulk verification jobs
 * @param {string} jobId - Database BulkVerificationJob ObjectId
 * @param {Array<Object>} records - List of parsed records from CSV
 * @param {string} adminId - Admin/actor user ID
 */
const processJob = async (jobId, records, adminId) => {
    const job = await BulkVerificationJob.findById(jobId);
    if (!job) return;

    job.status = 'processing';
    await job.save();

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // CSV is 1-indexed, header is row 1
        const inputUserId = record.userid || '';
        const email = record.email || '';
        const walletAddress = record.walletaddress || '';
        const actionStr = (record.action || 'ISSUE_CREDENTIAL').toUpperCase();
        const signature = record.signature || '';
        const nonce = record.nonce || '';
        const expiresAtVal = record.expiresat ? parseInt(record.expiresat, 10) : undefined;

        let userId = inputUserId;
        let action = CHALLENGE_ACTIONS[actionStr] || CHALLENGE_ACTIONS.ISSUE_CREDENTIAL;

        try {
            // 1. Resolve User
            let user = null;
            if (userId) {
                if (/^[a-fA-F0-9]{24}$/.test(userId)) {
                    user = await User.findById(userId);
                }
            } else if (email) {
                user = await User.findOne({ email });
                if (user) {
                    userId = user._id.toString();
                }
            }

            if (!user) {
                throw new Error('User not found');
            }

            userId = user._id.toString();

            // 2. Validate walletAddress
            if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                throw new Error('Invalid wallet address');
            }

            // 3. Derive Idempotency Key
            const idempotencyKey = crypto
                .createHash('sha256')
                .update(`${userId}:${walletAddress.toLowerCase()}:${action}`)
                .digest('hex');

            // 4. Reserve Idempotency Key
            const fingerprint = createFingerprint({ action, actorId: adminId, userId, walletAddress });
            const reservation = await reserveIdempotencyKey({
                action,
                actorId: adminId,
                key: idempotencyKey,
                fingerprint,
            });

            if (!reservation.reserved) {
                if (reservation.record && reservation.record.state === 'completed') {
                    results.push({
                        rowNumber,
                        userId,
                        walletAddress,
                        action,
                        idempotencyKey,
                        status: 'skipped',
                        details: { message: 'Request already processed (idempotency)', response: reservation.record.response },
                    });
                    successCount++;
                    continue;
                } else {
                    throw new Error('Request already in progress or duplicate idempotency key');
                }
            }

            // 5. Check if user is already verified (for ISSUE_CREDENTIAL)
            if (action === CHALLENGE_ACTIONS.ISSUE_CREDENTIAL && user.verification?.isVerified) {
                results.push({
                    rowNumber,
                    userId,
                    walletAddress,
                    action,
                    idempotencyKey,
                    status: 'skipped',
                    details: { message: 'User is already verified' },
                });
                successCount++;
                await storeCompletedIdempotencyRecord({
                    action,
                    actorId: adminId,
                    key: idempotencyKey,
                    fingerprint,
                    response: { success: true, message: 'User already verified' },
                });
                continue;
            }

            // 6. Process Action
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

            // 7. Store Completed Idempotency Record
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
            results.push({
                rowNumber,
                userId: userId || undefined,
                walletAddress: walletAddress || undefined,
                action,
                status: 'failure',
                error: error.message || error.toString(),
            });
            failureCount++;
        }

        // Update progress after each row
        job.processedRows = i + 1;
        await job.save();
    }

    job.status = 'completed';
    job.successCount = successCount;
    job.failureCount = failureCount;
    job.results = results;
    await job.save();
};

module.exports = {
    parseCSV,
    processJob,
};


