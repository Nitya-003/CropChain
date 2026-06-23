const didService = require('../services/didService');
const User = require('../models/User');
const VerificationEvent = require('../models/VerificationEvent');
const { appendAuditEvent } = require('../utils/auditLogger');

const BulkVerificationJob = require('../models/BulkVerificationJob');
const bulkVerificationService = require('../services/bulkVerificationService');
const mongoose = require('mongoose');
const { z } = require('zod');
const { validateParams } = require('../utils/validation');
const {
    handleZodValidation,
    handleServerError,
    requireIdempotencyKey,
    handleVerificationWithIdempotency,
} = require('../utils/verificationControllerHelpers');

const {
    handleIdempotencyOnly: handleRevokeIdempotency,
} = require('../utils/verificationIdempotencyRevoke');
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

const getVerificationEventsSchema = z.object({
    userId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid User ID format').optional(),
    action: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

const userQuerySchema = z.object({
    search: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    role: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
});

const buildUserQueryFilter = (query, isVerified) => {
    const filter = {
        'verification.isVerified': isVerified ? true : { $ne: true },
    };

    if (!isVerified) {
        filter.role = { $nin: [ROLES.ADMIN, ROLES.SUPER_ADMIN] };
    }

    if (query.role) {
        if (!isVerified && [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(query.role)) {
            filter.role = { $in: [] };
        } else {
            filter.role = query.role;
        }
    }

    if (query.search) {
        const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
            { name: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } },
        ];
    }

    const dateField = isVerified ? 'verification.verifiedAt' : 'createdAt';
    if (query.fromDate || query.toDate) {
        filter[dateField] = {};
        if (query.fromDate) {
            filter[dateField].$gte = new Date(query.fromDate);
        }
        if (query.toDate) {
            filter[dateField].$lte = new Date(query.toDate);
        }
    }

    const sortBy = query.sortBy || (isVerified ? 'verification.verifiedAt' : 'createdAt');
    const sortOrder = query.sortOrder?.toLowerCase() === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    return { filter, sort };
};


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
        if (!validatedData) return;

        const { userId, reason } = validatedData;
        const adminId = req.user.id;

        const idempotencyKey = requireIdempotencyKey(req, res);
        if (!idempotencyKey) return;

        return await handleRevokeIdempotency({
            req,
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: adminId,
            userId,
            reason,
            idempotencyKey,
            execute: async () => {
                const result = await didService.revokeCredential(userId, adminId, reason);

                // Audit: credential revoked (success)
                await appendAuditEvent({
                    action: 'credential_revoked',
                    actorId: adminId,
                    targetUserId: userId,
                    walletAddress: undefined,
                    status: 'success',
                    metadata: { originalAction: 'CREDENTIAL_REVOKE' },
                    req,
                });

                return result;
            },
            errorMeta: {
                code: 'CREDENTIAL_REVOKE_ERROR',
                message: 'Credential revocation failed',
            },
        });
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
        const validatedQuery = validateOrRespond(res, userQuerySchema, req.query);
        if (!validatedQuery) {
            return;
        }

        let page = validatedQuery.page || 1;
        let limit = validatedQuery.limit || 10;
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100;

        const skip = (page - 1) * limit;

        const { filter, sort } = buildUserQueryFilter(validatedQuery, false);

        const count = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('name email role walletAddress createdAt')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const response = apiResponse.successResponse(
            { count, page, limit, users },
            'Unverified users retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        return handleServerError(res, error, {
            code: 'FETCH_USERS_ERROR',
            message: 'Failed to fetch users',
        });
    }
};

/**
 * Get all verified users (Admin only)
 */
const getVerifiedUsers = async (req, res) => {
    try {
        const validatedQuery = validateOrRespond(res, userQuerySchema, req.query);
        if (!validatedQuery) {
            return;
        }

        let page = validatedQuery.page || 1;
        let limit = validatedQuery.limit || 10;
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100;

        const skip = (page - 1) * limit;

        const { filter, sort } = buildUserQueryFilter(validatedQuery, true);

        const count = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('name email role walletAddress verification.verifiedAt verification.verifiedBy')
            .populate('verification.verifiedBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const response = apiResponse.successResponse(
            { count, page, limit, users },
            'Verified users retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        return handleServerError(res, error, {
            code: 'FETCH_USERS_ERROR',
            message: 'Failed to fetch users',
        });
    }
};

const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Export unverified users as CSV (Admin only)
 */
const exportUnverifiedUsers = async (req, res) => {
    try {
        const validatedQuery = validateOrRespond(res, userQuerySchema, req.query);
        if (!validatedQuery) {
            return;
        }

        const { filter, sort } = buildUserQueryFilter(validatedQuery, false);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="unverified_users.csv"');

        res.write('Name,Email,Role,Wallet Address,Created At\n');

        const cursor = User.find(filter)
            .select('name email role walletAddress createdAt')
            .sort(sort)
            .cursor();

        for (let user = await cursor.next(); user != null; user = await cursor.next()) {
            const line = [
                escapeCSV(user.name),
                escapeCSV(user.email),
                escapeCSV(user.role),
                escapeCSV(user.walletAddress),
                escapeCSV(user.createdAt ? user.createdAt.toISOString() : ''),
            ].join(',') + '\n';
            res.write(line);
        }

        res.end();
    } catch (error) {
        if (res.headersSent) {
            res.end();
            return;
        }
        return handleServerError(res, error, {
            code: 'EXPORT_USERS_ERROR',
            message: 'Failed to export users',
        });
    }
};

/**
 * Export verified users as CSV (Admin only)
 */
const exportVerifiedUsers = async (req, res) => {
    try {
        const validatedQuery = validateOrRespond(res, userQuerySchema, req.query);
        if (!validatedQuery) {
            return;
        }

        const { filter, sort } = buildUserQueryFilter(validatedQuery, true);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="verified_users.csv"');

        res.write('Name,Email,Role,Wallet Address,Verified At,Verified By Email\n');

        const cursor = User.find(filter)
            .select('name email role walletAddress verification.verifiedAt verification.verifiedBy')
            .populate('verification.verifiedBy', 'email')
            .sort(sort)
            .cursor();

        for (let user = await cursor.next(); user != null; user = await cursor.next()) {
            const verifiedByEmail = user.verification?.verifiedBy?.email || '';
            const line = [
                escapeCSV(user.name),
                escapeCSV(user.email),
                escapeCSV(user.role),
                escapeCSV(user.walletAddress),
                escapeCSV(user.verification?.verifiedAt ? user.verification.verifiedAt.toISOString() : ''),
                escapeCSV(verifiedByEmail),
            ].join(',') + '\n';
            res.write(line);
        }

        res.end();
    } catch (error) {
        if (res.headersSent) {
            res.end();
            return;
        }
        return handleServerError(res, error, {
            code: 'EXPORT_USERS_ERROR',
            message: 'Failed to export users',
        });
    }
};


/**
 * Get verification audit events (Admin only)
 */
const getVerificationEvents = async (req, res) => {
    try {
        const validatedQuery = validateOrRespond(res, getVerificationEventsSchema, req.query);
        if (!validatedQuery) {
            return;
        }

        const { userId, action } = validatedQuery;
        let page = validatedQuery.page || 1;
        let limit = validatedQuery.limit || 10;

        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100;

        const skip = (page - 1) * limit;

        const filter = {};
        if (userId) {
            filter.userId = userId;
        }
        if (action) {
            filter.action = action;
        }

        const count = await VerificationEvent.countDocuments(filter);
        const events = await VerificationEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const response = apiResponse.successResponse(
            { count, page, limit, events },
            'Verification events retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        return handleServerError(res, error, {
            code: 'FETCH_EVENTS_ERROR',
            message: 'Failed to fetch verification events',
        });
    }
};

/**
 * Initiate challenges or trigger credential issuances in bulk via CSV (Admin only)
 */
const bulkIssueCredentials = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(apiResponse.validationErrorResponse(['CSV file is required']));
        }

        const csvText = req.file.buffer.toString('utf8');

        // Defense-in-depth: limit parsed input size (in bytes) independent of multer.
        const MAX_BULK_CSV_TEXT_BYTES = parseInt(process.env.MAX_BULK_CSV_TEXT_BYTES, 10) || (5 * 1024 * 1024);
        if (Buffer.byteLength(csvText, 'utf8') > MAX_BULK_CSV_TEXT_BYTES) {
            return res.status(400).json(
                apiResponse.validationErrorResponse([`CSV file too large. Max allowed is ${MAX_BULK_CSV_TEXT_BYTES} bytes`])
            );
        }

        const maxRowsPerJob = parseInt(process.env.MAX_BULK_ROWS_PER_JOB, 10) || 5000;

        const { validateHeadersExact, safeHeaderKey } = require('../utils/bulkCsvValidation');

        // Strict parse + header validation.
        const recordsRaw = bulkVerificationService.parseCSV(csvText);
        if (!Array.isArray(recordsRaw) || recordsRaw.length === 0) {
            return res.status(400).json(apiResponse.validationErrorResponse(['CSV file is empty or invalid']));
        }

        // Header check: parseCSV lowercases header names, so we can infer headers from first record.
        // We enforce exactly the expected set in order.
        const headers = Object.keys(recordsRaw[0] || {});
        const headerValidation = validateHeadersExact(headers);
        if (!headerValidation.ok) {
            return res.status(400).json(apiResponse.validationErrorResponse([headerValidation.error]));
        }

        // Validate + normalize rows (including userid/email rules, formats, action etc.).
        const { validateAndNormalizeCsvRecords, sanitizeForStorage } = require('../utils/bulkCsvValidation');
        const { records: normalizedRecords, rowErrors } = validateAndNormalizeCsvRecords({
            records: recordsRaw,
            maxRowsPerJob,
        });

        if (rowErrors.length > 0) {
            return res.status(400).json(apiResponse.validationErrorResponse(rowErrors.slice(0, 100))); // avoid huge error responses
        }

        if (normalizedRecords.length === 0) {
            return res.status(400).json(apiResponse.validationErrorResponse(['CSV has no valid rows']));
        }

        const adminId = req.user.id;
        const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
        const job = await BulkVerificationJob.create({
            status: 'pending',
            mode: dryRun ? 'dry-run' : 'bulk',
            totalRows: normalizedRecords.length,
            actorId: adminId,
        });

        // Background processing (service re-validates again)
        bulkVerificationService.processJob(job._id, normalizedRecords, adminId, { dryRun }).catch((err) => {
            console.error(`Error processing bulk verification job ${job._id}:`, err);
        });

        res.status(202).json(apiResponse.successResponse({
            jobId: job._id,
            status: job.status,
            mode: job.mode,
            totalRows: job.totalRows,
        }, 'Bulk verification job initiated successfully'));
        return;
    } catch (error) {
        return handleServerError(res, error, {
            code: 'BULK_VERIFICATION_ERROR',
            message: 'Failed to initiate bulk verification job',
        });
    }
};

/**
 * Get bulk job status and results (Admin only)
 */
const getBulkJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json(apiResponse.validationErrorResponse(['Invalid job ID format']));
        }

        const job = await BulkVerificationJob.findById(jobId);
        if (!job) {
            return res.status(404).json(apiResponse.errorResponse('Bulk verification job not found', 404));
        }

        res.json(apiResponse.successResponse(job, 'Bulk verification job retrieved successfully'));
    } catch (error) {
        return handleServerError(res, error, {
            code: 'BULK_VERIFICATION_STATUS_ERROR',
            message: 'Failed to retrieve bulk job status',
        });
    }
};

const streamBulkJobEvents = async (req, res) => {
    const { jobId } = req.params;

    const writeEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // Ensure the stream starts immediately.
    writeEvent('heartbeat', { ok: true, timestamp: new Date().toISOString() });

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        writeEvent('error', { message: 'Invalid job ID format' });
        res.end();
        return;
    }

    let lastProcessedRowsEmitted = 0;
    let lastJobStatusEmitted = null;
    let lastRowIndexEmitted = -1; // last rowNumber emitted from results

    const POLL_INTERVAL_MS = parseInt(process.env.BULK_JOB_SSE_POLL_INTERVAL_MS, 10) || 1000;
    const HEARTBEAT_INTERVAL_MS = parseInt(process.env.BULK_JOB_SSE_HEARTBEAT_INTERVAL_MS, 10) || 15000;

    let lastHeartbeatAt = Date.now();

    const safeClose = () => {
        try {
            res.end();
        } catch (_) {
            // ignore
        }
    };

    // If client disconnects, stop polling.
    req.on('close', () => {
        safeClose();
    });

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const jobDoc = await BulkVerificationJob.findById(jobId);
            const job = jobDoc && typeof jobDoc.lean === 'function' ? await jobDoc.lean() : jobDoc;

            if (!job) {
                writeEvent('error', { message: 'Bulk verification job not found' });
                safeClose();
                return;
            }

            const jobStatus = job.status;
            const totalRows = job.totalRows ?? 0;
            const processedRows = job.processedRows ?? 0;
            const successCount = job.successCount ?? 0;
            const failureCount = job.failureCount ?? 0;

            // Emit job status when it changes, or at least after progress changes.
            if (
                lastJobStatusEmitted !== jobStatus ||
                processedRows !== lastProcessedRowsEmitted
            ) {
                writeEvent('jobStatus', {
                    jobId,
                    status: jobStatus,
                    totalRows,
                    processedRows,
                    successCount,
                    failureCount,
                    timestamp: new Date().toISOString(),
                });

                lastJobStatusEmitted = jobStatus;
                lastProcessedRowsEmitted = processedRows;
            }

            // Emit newly available row results derived from `results`.
            if (Array.isArray(job.results) && processedRows > 0) {
                // `processedRows` indicates how many rows have been processed so far.
                const availableCount = Math.min(processedRows, job.results.length);

                // Results array is stored in CSV order, so slice [0..availableCount)
                for (let i = lastRowIndexEmitted + 1; i < availableCount; i++) {
                    const row = job.results[i];
                    if (!row) continue;
                    if (typeof row.rowNumber === 'number' && row.rowNumber - 2 > i) {
                        continue;
                    }
                    writeEvent('rowResult', {
                        jobId,
                        rowNumber: row.rowNumber,
                        userId: row.userId,
                        walletAddress: row.walletAddress,
                        action: row.action,
                        status: row.status,
                        error: row.error,
                        details: row.details,
                        timestamp: new Date().toISOString(),
                    });
                    lastRowIndexEmitted = i;
                }
            }

            // Done?
            if (jobStatus === 'completed' || jobStatus === 'failed') {
                writeEvent('done', {
                    jobId,
                    status: jobStatus,
                    totalRows,
                    processedRows,
                    successCount,
                    failureCount,
                    timestamp: new Date().toISOString(),
                });
                safeClose();
                return;
            }

            // Heartbeat keep-alive.
            if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
                writeEvent('heartbeat', { ok: true, timestamp: new Date().toISOString() });
                lastHeartbeatAt = Date.now();
            }

            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
    } catch (error) {
        try {
            if (!res.headersSent) {
                writeEvent('error', { message: 'SSE stream error', detail: error.message });
            } else {
                writeEvent('error', { message: 'SSE stream error', detail: error.message });
            }
        } catch (_) {
            // ignore
        }
        safeClose();
    }
};

const retryBulkFailedRows = async (req, res) => {

    try {
        const { jobId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json(apiResponse.validationErrorResponse(['Invalid job ID format']));
        }

        const job = await BulkVerificationJob.findById(jobId);
        if (!job) {
            return res.status(404).json(apiResponse.errorResponse('Bulk verification job not found', 404));
        }

        if (job.status !== 'completed') {
            return res.status(400).json(apiResponse.errorResponse('Bulk verification job must be completed before retry', 400));
        }

        const adminId = req.user.id;
        const failedRows = Array.isArray(job.results) ? job.results.filter((r) => r?.status === 'failure') : [];

        if (!failedRows.length) {
            return res.status(400).json(apiResponse.errorResponse('No failed rows found for this job', 400));
        }

        const retryJob = await bulkVerificationService.retryJob(jobId, failedRows, adminId);
        if (!retryJob) {
            return res.status(400).json(apiResponse.errorResponse('Retry could not be created (missing originalInput)', 400));
        }

        return res.status(202).json(apiResponse.successResponse({
            jobId: retryJob._id,
            status: retryJob.status,
            mode: retryJob.mode,
            totalRows: retryJob.totalRows,
            retriedFromJobId: job._id,
            failedRowsCount: failedRows.length,
        }, 'Bulk retry job initiated successfully'));
    } catch (error) {
        return handleServerError(res, error, {
            code: 'BULK_RETRY_FAILED_ROWS_ERROR',
            message: 'Failed to initiate bulk retry of failed rows',
        });
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
    getVerificationEvents,
    exportUnverifiedUsers,
    exportVerifiedUsers,
    bulkIssueCredentials,
    getBulkJobStatus,
    retryBulkFailedRows,
    streamBulkJobEvents,
};



