const crypto = require('crypto');
const VerificationEvent = require('../models/VerificationEvent');

const normalizeWallet = (w) => (w ? String(w).toLowerCase() : undefined);

const stableStringify = (value) => {
    // Deterministic JSON stringify (key-sorted) for hashing
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const getClientMeta = (req) => {
    // Optional privacy-safe collection
    const ip = req?.ip || (req?.headers?.['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : undefined);
    const userAgent = req?.headers?.['user-agent'];
    return { ip, userAgent };
};

const sanitizeMetadata = (metadata) => {
    // Allowlist only scalar-ish fields; strip any signature-like content
    const out = {};
    const m = metadata && typeof metadata === 'object' ? metadata : {};

    for (const [k, v] of Object.entries(m)) {
        const key = String(k);
        if (/sig(nature)?/i.test(key)) continue;
        if (key === 'signature' || key === 'rawSignature') continue;

        // Keep only primitives / short strings
        if (v === null || v === undefined) continue;
        if (typeof v === 'string') {
            out[key] = v.length > 200 ? v.slice(0, 200) : v;
        } else if (typeof v === 'number' || typeof v === 'boolean') {
            out[key] = v;
        } else if (Array.isArray(v)) {
            // Keep bounded arrays of primitives
            out[key] = v.slice(0, 20);
        }
    }

    return out;
};

const computeEventHash = ({ previousHash, event }) => {
    const payload = {
        previousHash: previousHash || '',
        action: event.action,
        actorId: event.actorId,
        targetUserId: event.targetUserId,
        walletAddress: event.walletAddress,
        status: event.status,
        metadata: event.metadata,
        createdAt: event.createdAt,
    };

    const secret = process.env.AUDIT_EVENT_HMAC_SECRET || 'dev-audit-secret-change-me';
    const canonical = stableStringify(payload);
    return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
};

const appendAuditEvent = async ({
    action,
    actorId,
    targetUserId,
    walletAddress,
    status,
    metadata = {},
    req,
}) => {
    const { ip, userAgent } = getClientMeta(req || {});

    // Find latest hash (hash-chain). This is append-only; no updates.
    const last = await VerificationEvent.findOne({ eventHash: { $exists: true } })
        .sort({ createdAt: -1 })
        .select({ eventHash: 1 })
        .lean();

    const previousHash = last?.eventHash;

    // Privacy-safe: do not store raw signatures.
    const safeMetadata = sanitizeMetadata(metadata);

    const event = {
        action,
        actorId,
        targetUserId,
        walletAddress: normalizeWallet(walletAddress),
        status,
        ip,
        userAgent,
        metadata: safeMetadata,
        createdAt: new Date(),
        previousHash,
    };

    event.eventHash = computeEventHash({ previousHash, event });

    // Append-only insert
    return VerificationEvent.create(event);
};

module.exports = {
    appendAuditEvent,
};

