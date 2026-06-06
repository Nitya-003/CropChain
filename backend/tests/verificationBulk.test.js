process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Local mock storage
const mockUsersDb = [
    {
        _id: '60c72b2f9b1d8e2b8c8d8881',
        name: 'John Farmer',
        email: 'john@farmer.com',
        role: 'farmer',
        walletAddress: '0xabc1230000000000000000000000000000000001',
        verification: { isVerified: false },
        save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
    },
    {
        _id: '60c72b2f9b1d8e2b8c8d8882',
        name: 'Alice Mandi',
        email: 'alice@mandi.com',
        role: 'mandi_officer',
        walletAddress: '0xabc1230000000000000000000000000000000002',
        verification: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: 'admin-id',
        },
        save: jest.fn().mockImplementation(function() { return Promise.resolve(this); }),
    },
];

const mockJobsDb = {};

// Mock Models
const mockUser = {
    findById: jest.fn((id) => Promise.resolve(mockUsersDb.find(u => u._id === id || u._id.toString() === id))),
    findOne: jest.fn(({ email }) => Promise.resolve(mockUsersDb.find(u => u.email === email))),
};

const mockBulkJob = {
    create: jest.fn((data) => {
        const jobId = new mongoose.Types.ObjectId().toString();
        const job = {
            _id: jobId,
            status: data.status || 'pending',
            totalRows: data.totalRows || 0,
            processedRows: 0,
            successCount: 0,
            failureCount: 0,
            results: [],
            actorId: data.actorId,
            save: jest.fn().mockImplementation(function() {
                mockJobsDb[this._id.toString()] = this;
                return Promise.resolve(this);
            }),
        };
        mockJobsDb[jobId] = job;
        return Promise.resolve(job);
    }),
    findById: jest.fn((id) => {
        const idStr = id.toString();
        return Promise.resolve(mockJobsDb[idStr] || null);
    }),
};

jest.mock('../models/User', () => mockUser);
jest.mock('../models/BulkVerificationJob', () => mockBulkJob);
jest.mock('../models/VerificationEvent', () => ({
    create: jest.fn().mockResolvedValue({}),
}));
jest.mock('../models/Counter', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
}));

// Mock didService to avoid crypto/blockchain operations
jest.mock('../services/didService', () => ({
    issueCredential: jest.fn().mockResolvedValue({
        success: true,
        message: 'Credential issued successfully',
        credentialHash: '0xcredentialhash',
        isVerified: true,
    }),
    linkWallet: jest.fn().mockResolvedValue({
        success: true,
        message: 'Wallet linked successfully',
        walletAddress: '0xabc1230000000000000000000000000000000001',
    }),
}));

// Mock verificationSecurityService to control challenges and idempotency
const mockSecurityService = {
    CHALLENGE_ACTIONS: {
        LINK_WALLET: 'LINK_WALLET',
        ISSUE_CREDENTIAL: 'ISSUE_CREDENTIAL',
    },
    createFingerprint: jest.fn(({ action, actorId, userId, walletAddress }) => {
        return crypto.createHash('sha256').update(`${action}:${actorId}:${userId}:${walletAddress}`).digest('hex');
    }),
    createChallenge: jest.fn(({ action, actorId, userId, walletAddress }) => {
        return Promise.resolve({
            challengeId: 'mock-challenge-uuid',
            nonce: 'mock-challenge-nonce',
            expiresAt: Date.now() + 180000,
            action,
            actorId,
            userId,
            walletAddress,
        });
    }),
    reserveIdempotencyKey: jest.fn(() => Promise.resolve({ reserved: true })),
    storeCompletedIdempotencyRecord: jest.fn().mockResolvedValue({}),
};
jest.mock('../services/verificationSecurityService', () => mockSecurityService);

// Mock Auth middleware (Admin by default)
const mockAuthUser = { id: 'admin-id', email: 'admin@test.com', role: 'admin' };
let mockIsAdmin = true;

jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = mockAuthUser;
        next();
    }),
    adminOnly: jest.fn((req, res, next) => {
        if (mockIsAdmin) {
            next();
        } else {
            res.status(403).json({ success: false, message: 'Admin role required' });
        }
    }),
    verifiedOnly: jest.fn((req, res, next) => next()),
    authorizeBatchOwner: jest.fn((req, res, next) => next()),
    authorizeRoles: jest.fn(() => (req, res, next) => next()),
    authorizeStageTransition: jest.fn((req, res, next) => next()),
    authorizeBlockchainTransaction: jest.fn((req, res, next) => next()),
    requirePermissions: jest.fn(() => (req, res, next) => next()),
    requireAllPermissions: jest.fn(() => (req, res, next) => next()),
    inspectorOnly: jest.fn((req, res, next) => next()),
    requireMultisigOrAdmin: jest.fn(() => (req, res, next) => next()),
    checkBatchSafetyStatus: jest.fn((req, res, next) => next())
}));

const bulkVerificationService = require('../services/bulkVerificationService');
const didService = require('../services/didService');
const { CHALLENGE_ACTIONS } = require('../services/verificationSecurityService');
const app = require('../server');

describe('Bulk Verification Jobs via CSV Upload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsAdmin = true;
        Object.keys(mockJobsDb).forEach(k => delete mockJobsDb[k]);
        mockSecurityService.reserveIdempotencyKey.mockResolvedValue({ reserved: true });
    });

    describe('CSV Parser Helper Unit Tests', () => {
        test('should parse standard CSV with headers correctly', () => {
            const csv = `userId,walletAddress,action\n60c72b2f9b1d8e2b8c8d8881,0xabc1230000000000000000000000000000000001,ISSUE_CREDENTIAL`;
            const records = bulkVerificationService.parseCSV(csv);
            expect(records).toHaveLength(1);
            expect(records[0].userid).toBe('60c72b2f9b1d8e2b8c8d8881');
            expect(records[0].walletaddress).toBe('0xabc1230000000000000000000000000000000001');
            expect(records[0].action).toBe('ISSUE_CREDENTIAL');
        });

        test('should handle quoted fields with commas and carriage returns correctly', () => {
            const csv = `"userId","walletAddress","action"\r\n"60c72b2f9b1d8e2b8c8d8881","0xabc1230000000000000000000000000000000001","ISSUE_CREDENTIAL"\r\n`;
            const records = bulkVerificationService.parseCSV(csv);
            expect(records).toHaveLength(1);
            expect(records[0].userid).toBe('60c72b2f9b1d8e2b8c8d8881');
            expect(records[0].walletaddress).toBe('0xabc1230000000000000000000000000000000001');
        });

        test('should skip entirely empty lines', () => {
            const csv = `userId,walletAddress\n60c72b2f9b1d8e2b8c8d8881,0xabc1230000000000000000000000000000000001\n\n\n`;
            const records = bulkVerificationService.parseCSV(csv);
            expect(records).toHaveLength(1);
        });
    });

    describe('Job Processing Logic (bulkVerificationService.processJob)', () => {
        test('should successfully initiate challenges for rows without signatures', async () => {
            const job = await mockBulkJob.create({ totalRows: 1, actorId: 'admin-id' });
            const records = [{
                userid: '60c72b2f9b1d8e2b8c8d8881',
                walletaddress: '0xabc1230000000000000000000000000000000001',
                action: 'ISSUE_CREDENTIAL'
            }];

            await bulkVerificationService.processJob(job._id, records, 'admin-id');

            const updatedJob = mockJobsDb[job._id];
            expect(updatedJob.status).toBe('completed');
            expect(updatedJob.successCount).toBe(1);
            expect(updatedJob.failureCount).toBe(0);
            expect(updatedJob.results[0].status).toBe('success');
            expect(updatedJob.results[0].details.challengeId).toBe('mock-challenge-uuid');
            expect(mockSecurityService.createChallenge).toHaveBeenCalled();
        });

        test('should resolve users by email if userId is missing', async () => {
            const job = await mockBulkJob.create({ totalRows: 1, actorId: 'admin-id' });
            const records = [{
                email: 'john@farmer.com',
                walletaddress: '0xabc1230000000000000000000000000000000001',
                action: 'ISSUE_CREDENTIAL'
            }];

            await bulkVerificationService.processJob(job._id, records, 'admin-id');

            const updatedJob = mockJobsDb[job._id];
            expect(updatedJob.successCount).toBe(1);
            expect(updatedJob.results[0].userId).toBe('60c72b2f9b1d8e2b8c8d8881');
        });

        test('should verify directly when signature, nonce, and expiresAt are provided', async () => {
            const job = await mockBulkJob.create({ totalRows: 1, actorId: 'admin-id' });
            const records = [{
                userid: '60c72b2f9b1d8e2b8c8d8881',
                walletaddress: '0xabc1230000000000000000000000000000000001',
                action: 'ISSUE_CREDENTIAL',
                signature: '0xverifierSignature',
                nonce: 'mock-challenge-nonce',
                expiresat: '1717000000',
            }];

            await bulkVerificationService.processJob(job._id, records, 'admin-id');

            const updatedJob = mockJobsDb[job._id];
            expect(updatedJob.successCount).toBe(1);
            expect(updatedJob.results[0].status).toBe('success');
            expect(didService.issueCredential).toHaveBeenCalled();
        });

        test('should handle partial failure and not halt the whole job', async () => {
            const job = await mockBulkJob.create({ totalRows: 2, actorId: 'admin-id' });
            const records = [
                {
                    userid: '60c72b2f9b1d8e2b8c8d8889', // Invalid non-existing user
                    walletaddress: '0xabc1230000000000000000000000000000000001',
                    action: 'ISSUE_CREDENTIAL'
                },
                {
                    userid: '60c72b2f9b1d8e2b8c8d8881',
                    walletaddress: '0xabc1230000000000000000000000000000000001',
                    action: 'ISSUE_CREDENTIAL'
                }
            ];

            await bulkVerificationService.processJob(job._id, records, 'admin-id');

            const updatedJob = mockJobsDb[job._id];
            expect(updatedJob.status).toBe('completed');
            expect(updatedJob.successCount).toBe(1);
            expect(updatedJob.failureCount).toBe(1);
            expect(updatedJob.results[0].status).toBe('failure');
            expect(updatedJob.results[0].error).toContain('User not found');
            expect(updatedJob.results[1].status).toBe('success');
        });

        test('should skip duplicate row processing due to idempotency checks', async () => {
            // Mock reservation to return false (already in progress or completed) on second check
            let reserveCount = 0;
            mockSecurityService.reserveIdempotencyKey.mockImplementation(() => {
                reserveCount++;
                if (reserveCount > 1) {
                    return Promise.resolve({
                        reserved: false,
                        record: { state: 'completed', response: { success: true, message: 'Replayed response' } }
                    });
                }
                return Promise.resolve({ reserved: true });
            });

            const job = await mockBulkJob.create({ totalRows: 2, actorId: 'admin-id' });
            const records = [
                {
                    userid: '60c72b2f9b1d8e2b8c8d8881',
                    walletaddress: '0xabc1230000000000000000000000000000000001',
                    action: 'ISSUE_CREDENTIAL'
                },
                {
                    userid: '60c72b2f9b1d8e2b8c8d8881',
                    walletaddress: '0xabc1230000000000000000000000000000000001',
                    action: 'ISSUE_CREDENTIAL'
                }
            ];

            await bulkVerificationService.processJob(job._id, records, 'admin-id');

            const updatedJob = mockJobsDb[job._id];
            expect(updatedJob.status).toBe('completed');
            expect(updatedJob.successCount).toBe(2); // Skipped/replayed counts as a success row progress
            expect(updatedJob.results[0].status).toBe('success');
            expect(updatedJob.results[1].status).toBe('skipped');
            expect(updatedJob.results[1].details.message).toContain('already processed');
        });
    });

    describe('API Routing and Authorization', () => {
        test('POST /api/verification/bulk/issue-credential should trigger job and return 202 Accepted', async () => {
            const csvData = 'userId,walletAddress,action\n60c72b2f9b1d8e2b8c8d8881,0xabc1230000000000000000000000000000000001,ISSUE_CREDENTIAL';

            const response = await request(app)
                .post('/api/verification/bulk/issue-credential')
                .attach('file', Buffer.from(csvData), 'users.csv')
                .expect(202);

            expect(response.body.success).toBe(true);
            expect(response.body.data.jobId).toBeDefined();
            expect(response.body.data.status).toBe('pending');
            expect(response.body.data.totalRows).toBe(1);
        });

        test('GET /api/verification/bulk/:jobId should retrieve job details', async () => {
            const job = await mockBulkJob.create({ totalRows: 3, actorId: 'admin-id' });
            job.status = 'processing';
            await job.save();

            const response = await request(app)
                .get(`/api/verification/bulk/${job._id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data._id).toBe(job._id.toString());
            expect(response.body.data.status).toBe('processing');
        });

        test('POST and GET endpoints should return 403 if user is not an admin', async () => {
            mockIsAdmin = false;

            await request(app)
                .post('/api/verification/bulk/issue-credential')
                .attach('file', Buffer.from('a,b\n1,2'), 'users.csv')
                .expect(403);

            await request(app)
                .get('/api/verification/bulk/60c72b2f9b1d8e2b8c8d8881')
                .expect(403);
        });
    });
});
