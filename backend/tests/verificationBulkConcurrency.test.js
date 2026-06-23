jest.mock('../models/BulkVerificationJob', () => ({
    findById: jest.fn(),
}));

jest.mock('../models/User', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
}));

jest.mock('../services/didService', () => ({
    linkWallet: jest.fn(),
    issueCredential: jest.fn(),
    revokeCredential: jest.fn(),
    checkVerificationStatus: jest.fn(),
}));

jest.mock('../utils/auditLogger', () => ({
    appendAuditEvent: jest.fn().mockResolvedValue({}),
}));

// Mock idempotency reservation to simulate single execution under concurrency.
jest.mock('../services/verificationSecurityService', () => {
    const CHALLENGE_ACTIONS = {
        LINK_WALLET: 'LINK_WALLET',
        ISSUE_CREDENTIAL: 'ISSUE_CREDENTIAL',
    };

    const store = new Map();

    const createFingerprint = () => 'fp';

    const reserveIdempotencyKey = async ({ key, fingerprint, action, actorId }) => {
        const storageKey = JSON.stringify({ action, actorId, key, fingerprint });

        if (!store.has(storageKey)) {
            store.set(storageKey, { state: 'pending' });
            return { reserved: true, key: storageKey, record: store.get(storageKey) };
        }

        const record = store.get(storageKey);
        return { reserved: false, key: storageKey, record: { ...record, state: record.state || 'pending' } };
    };

    const storeCompletedIdempotencyRecord = async ({ key, action, actorId }) => {
        const storageKey = JSON.stringify({ action, actorId, key, fingerprint: 'fp' });
        const current = store.get(storageKey) || { state: 'pending' };
        store.set(storageKey, { ...current, state: 'completed' });
        return store.get(storageKey);
    };


    return {
        CHALLENGE_ACTIONS,
        createFingerprint,
        reserveIdempotencyKey,
        storeCompletedIdempotencyRecord,
        createChallenge: jest.fn(),
    };
});

const BulkVerificationJob = require('../models/BulkVerificationJob');
const User = require('../models/User');
const didService = require('../services/didService');

const { CHALLENGE_ACTIONS } = require('../services/verificationSecurityService');

const { processJob } = require('../services/bulkVerificationService');

const createJob = () => {
    const job = {
        status: 'pending',
        processedRows: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        save: jest.fn(async function save() {
            return this;
        }),
    };

    return job;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Avoid long sleeps/teardown issues in CI.
const SHORT_DELAY_MS = 5;

describe('bulk verification - concurrency + idempotency', () => {
    jest.setTimeout(60000);

    beforeEach(() => {


        jest.clearAllMocks();
        process.env.BULK_JOB_CONCURRENCY = '2';
        process.env.BULK_JOB_PROGRESS_UPDATE_EVERY = '1';

        const job = createJob();
        BulkVerificationJob.findById.mockResolvedValue(job);

        // All rows resolve to the same user.
        User.findById.mockResolvedValue({
            _id: '507f1f77bcf86cd799439011',
            walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            role: 'admin',
            verification: { isVerified: false },
            save: jest.fn(),
        });
        User.findOne.mockResolvedValue(null);

        didService.issueCredential.mockImplementation(async () => {
            // Force overlap to exercise concurrency.
            await delay(50);
            return { success: true };
        });
        didService.linkWallet.mockImplementation(async () => {
            await delay(50);
            return { success: true };
        });
    });

    test('does not double-process duplicate rows under concurrency (idempotency reservation)', async () => {
        const job = await BulkVerificationJob.findById('job-1');

        const adminId = 'admin-1';
        const walletAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

        const records = [
            {
                userid: '507f1f77bcf86cd799439011',
                email: 'a@x.com',
                walletaddress: walletAddress,
                action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
                signature: 'sig',
                nonce: 'n1',
                expiresat: String(Date.now() + 10000),
            },
            {
                userid: '507f1f77bcf86cd799439011',
                email: 'a@x.com',
                walletaddress: walletAddress,
                action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
                signature: 'sig',
                nonce: 'n1',
                expiresat: String(Date.now() + 10000),
            },
            {
                userid: '507f1f77bcf86cd799439011',
                email: 'a@x.com',
                walletaddress: walletAddress,
                action: CHALLENGE_ACTIONS.ISSUE_CREDENTIAL,
                signature: 'sig',
                nonce: 'n1',
                expiresat: String(Date.now() + 10000),
            },
        ];

        await Promise.race([
            processJob('job-1', records, adminId, { dryRun: false }),
            delay(15000).then(() => {
                throw new Error('processJob did not complete in time (possible infinite loop / worker hang)');
            }),
        ]);

        // Results should include all rows.
        expect(job.results).toHaveLength(records.length);

        const statuses = job.results.map((r) => r.status);
        // Should have exactly 1 success (others should be skipped or failed due to idempotency reservation).
        expect(statuses.filter((s) => s === 'success').length).toBe(1);
        // No unexpected double-processing.
        expect(didService.issueCredential.mock.calls.length).toBeLessThanOrEqual(1);

    });
});

