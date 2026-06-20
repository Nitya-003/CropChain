const { z } = require('zod');

const MAX_ERROR_MSG_CHARS = parseInt(process.env.BULK_CSV_MAX_ERROR_CHARS, 10) || 500;

const sanitizeForStorage = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Prevent log/DB bloat from massive strings.
    return str.length > MAX_ERROR_MSG_CHARS ? `${str.slice(0, MAX_ERROR_MSG_CHARS)}…` : str;
};

const safeHeaderKey = (key) => {
    const normalized = String(key || '').toLowerCase().trim();
    // Prevent prototype pollution via CSV header names.
    if (normalized === '__proto__' || normalized === 'constructor' || normalized === 'prototype') {
        return null;
    }
    return normalized;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

const maxRowsPerJobDefault = parseInt(process.env.MAX_BULK_ROWS_PER_JOB, 10) || 5000;

const requiredHeaders = [
    'userid',
    'email',
    'walletaddress',
    'action',
    'signature',
    'nonce',
    'expiresat',
];

const optionalHeaders = [];

const buildHeaderError = (expected, actual) => {
    const a = actual.join(', ');
    return `Invalid CSV headers. Expected: ${expected.join(', ')}. Got: [${a}]`;
};

const parseIntOrUndef = (value) => {
    if (value === null || value === undefined) return undefined;
    const s = String(value).trim();
    if (!s) return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
};

const rowSchema = z.object({
    userid: z.string().optional().default(''),
    email: z.string().optional().default(''),
    walletaddress: z.string().optional().default(''),
    action: z.string().optional().default('ISSUE_CREDENTIAL'),
    signature: z.string().optional().default(''),
    nonce: z.string().optional().default(''),
    expiresat: z.string().optional().default(''),
});

const normalizeRow = (raw) => {
    // Ensure keys are in expected lowercase form already.
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) return null;

    const r = parsed.data;

    const userid = String(r.userid ?? '').trim();
    const email = String(r.email ?? '').trim();
    const walletaddress = String(r.walletaddress ?? '').trim();
    const action = String(r.action ?? 'ISSUE_CREDENTIAL').trim().toUpperCase();
    const signature = String(r.signature ?? '').trim();
    const nonce = String(r.nonce ?? '').trim();
    const expiresat = String(r.expiresat ?? '').trim();

    const expiresAtVal = expiresat ? parseIntOrUndef(expiresat) : undefined;

    return {
        userid,
        email,
        walletaddress,
        action,
        signature,
        nonce,
        expiresat,
        expiresAtVal,
    };
};

const validateRecord = ({ row, rowNumber }) => {
    const errors = [];

    const normalized = normalizeRow(row) || null;
    if (!normalized) {
        return [`Row ${rowNumber}: Invalid CSV row`];
    }

    const { userid, email, walletaddress, action, signature, nonce, expiresAtVal } = normalized;

    const supportedActions = ['ISSUE_CREDENTIAL', 'LINK_WALLET'];
    if (!action || !supportedActions.includes(action)) {
        errors.push(`Row ${rowNumber}: column action invalid. Expected one of ${supportedActions.join(', ')}`);
        // Keep going for more row-level errors.
    }

    // Action-specific rules
    const needsUserMapping = true; // Both actions operate on a target user.
    if (needsUserMapping && !userid && !email) {
        errors.push(`Row ${rowNumber}: column userid/email missing. Expected userid or email`);
    }

    if (userid) {
        if (!objectIdRegex.test(userid)) {
            errors.push(`Row ${rowNumber}: column userid invalid. Expected Mongo ObjectId /^[a-fA-F0-9]{24}$/`);
        }
    }

    if (email) {
        if (!emailRegex.test(email)) {
            errors.push(`Row ${rowNumber}: column email invalid. Expected email format`);
        }
    }

    if (!walletaddress) {
        errors.push(`Row ${rowNumber}: column walletaddress missing. Expected ${expectedNonEmpty('walletaddress')}`);
    } else if (!walletRegex.test(walletaddress)) {
        errors.push(`Row ${rowNumber}: column walletaddress invalid. Expected /^0x[a-fA-F0-9]{40}$/`);
    }

    const signaturePresent = Boolean(signature);

    if (action === 'ISSUE_CREDENTIAL' || action === 'LINK_WALLET') {
        // Signed actions: require nonce + expiresat
        if (signaturePresent) {
            if (!nonce) {
                errors.push(`Row ${rowNumber}: column nonce required because column signature is non-empty. Expected non-empty nonce`);
            }
            if (!expiresAtVal) {
                errors.push(
                    `Row ${rowNumber}: column expiresat invalid. Expected integer timestamp (milliseconds) because signature is non-empty`
                );
            }
        } else {
            // Unsigned / challenge-only: allowed (do not require nonce/expiresat)
        }

        // If your system later disallows unsigned challenge-only for some action,
        // encode it here.
    }

    // Extra action-specific tightening (optional):
    // Currently we allow unsigned challenge creation for both actions (existing behavior).

    return errors;
};



const validateAndNormalizeCsvRecords = ({ records, maxRowsPerJob }) => {
    const rowErrors = [];

    if (!Array.isArray(records)) {
        return { records: [], rowErrors: ['CSV parse failed'] };
    }

    if (records.length > maxRowsPerJob) {
        rowErrors.push(`CSV has too many rows. Max allowed is ${maxRowsPerJob}`);
        return { records: [], rowErrors };
    }

    const normalized = [];

    for (let i = 0; i < records.length; i++) {
        const rowNumber = i + 2;
        const row = records[i];

        const errors = validateRecord({ row, rowNumber });
        if (errors.length) {
            rowErrors.push(...errors);
            continue;
        }

        normalized.push(normalizeRow(row));
    }

    return { records: normalized, rowErrors };
};

const validateHeadersExact = (headers) => {
    const safe = headers.map(safeHeaderKey);
    if (safe.some((h) => h === null)) {
        return { ok: false, error: 'Invalid CSV headers' };
    }

    const normalized = safe.map((h) => h.toLowerCase().trim());

    // Exact match (order-sensitive)
    const expected = requiredHeaders;
    if (normalized.length !== expected.length) {
        return { ok: false, error: buildHeaderError(expected, normalized) };
    }

    for (let i = 0; i < expected.length; i++) {
        if (normalized[i] !== expected[i]) {
            return { ok: false, error: buildHeaderError(expected, normalized) };
        }
    }

    return { ok: true };
};

module.exports = {
    requiredHeaders,
    maxRowsPerJobDefault,
    sanitizeForStorage,
    safeHeaderKey,
    validateHeadersExact,
    validateAndNormalizeCsvRecords,
};

