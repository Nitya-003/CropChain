process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock models
const mockUser = {
    findById: jest.fn(),
    save: jest.fn(),
};

const mockVerificationEvent = {
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
    }),
};

jest.mock('../models/User', () => mockUser);
jest.mock('../models/VerificationEvent', () => mockVerificationEvent);

// Mock Redis connection
jest.mock('../config/redis', () => ({
    getRedisConnection: () => ({
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
    }),
}));

// Mock blockchainService
jest.mock('../services/blockchainService', () => ({
    syncUserRole: jest.fn().mockResolvedValue({}),
}));

// Mock verificationSecurityService at module level to override destructured imports
const mockSecurityService = {
    CHALLENGE_ACTIONS: {
        LINK_WALLET: 'LINK_WALLET',
        ISSUE_CREDENTIAL: 'ISSUE_CREDENTIAL',
    },
    createChallenge: jest.fn(),
    consumeChallenge: jest.fn(),
    createFingerprint: jest.fn(() => 'fingerprint'),
    deleteIdempotencyRecord: jest.fn(),
    getIdempotencyRecord: jest.fn(),
    reserveIdempotencyKey: jest.fn(),
    storeCompletedIdempotencyRecord: jest.fn(),
    buildVerificationMessage: jest.fn(() => 'CropChain verification request\nAction: LINK_WALLET'),
};
jest.mock('../services/verificationSecurityService', () => mockSecurityService);

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
        next();
    }),
    adminOnly: jest.fn((req, res, next) => next()),
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

const securityService = require('../services/verificationSecurityService');
const didService = require('../services/didService');
const { handleVerificationWithIdempotency } = require('../utils/verificationControllerHelpers');
const app = require('../server');

const createResponse = () => {
    const response = {
        statusCode: 200,
        body: null,
        status: jest.fn(function status(code) {
            this.statusCode = code;
            return this;
        }),
        json: jest.fn(function json(payload) {
            this.body = payload;
            return this;
        }),
    };
    return response;
};

describe('Verification Audit Trail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Challenge Creation Event', () => {
        test('should create a challenge_created event on createChallenge', async () => {
            // Setup securityService mock implementation for this test
            securityService.createChallenge.mockImplementation(async ({ action, actorId, userId, walletAddress }) => {
                const nonce = 'nonce-123';
                const expiresAt = Date.now() + 180000;
                
                await mockVerificationEvent.create({
                    action: 'challenge_created',
                    actorId,
                    userId,
                    walletAddress,
                    status: 'success',
                    metadata: {
                        challengeAction: action,
                        nonce,
                        expiresAt,
                    },
                });

                return { nonce, expiresAt, action, actorId, userId, walletAddress };
            });

            const challenge = await securityService.createChallenge({
                action: 'LINK_WALLET',
                actorId: 'user-1',
                userId: 'user-1',
                walletAddress: '0xabc0000000000000000000000000000000000000',
            });

            expect(challenge.nonce).toBeDefined();
            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'challenge_created',
                    actorId: 'user-1',
                    userId: 'user-1',
                    walletAddress: '0xabc0000000000000000000000000000000000000',
                    status: 'success',
                    metadata: expect.objectContaining({
                        challengeAction: 'LINK_WALLET',
                        nonce: challenge.nonce,
                    }),
                })
            );
        });
    });

    describe('Wallet Linking Events', () => {
        test('should create signature_validated and credential_linked events on linkWallet success', async () => {
            const mockUserDoc = {
                _id: 'user-1',
                save: jest.fn().mockResolvedValue(true),
            };
            mockUser.findById.mockResolvedValue(mockUserDoc);
            
            // Mock signature verification check to be true
            jest.spyOn(didService, 'verifySignature').mockReturnValue(true);

            const challenge = {
                action: 'LINK_WALLET',
                nonce: 'nonce-123',
                expiresAt: Date.now() + 60000,
            };

            await didService.linkWallet('user-1', '0xabc0000000000000000000000000000000000000', '0xsig', challenge);

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'signature_validated',
                    actorId: 'user-1',
                    userId: 'user-1',
                    walletAddress: '0xabc0000000000000000000000000000000000000',
                    status: 'success',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'credential_linked',
                    actorId: 'user-1',
                    userId: 'user-1',
                    walletAddress: '0xabc0000000000000000000000000000000000000',
                    status: 'success',
                })
            );
        });

        test('should create signature_validated and credential_linked failure events on linkWallet invalid signature', async () => {
            const mockUserDoc = {
                _id: 'user-1',
                save: jest.fn().mockResolvedValue(true),
            };
            mockUser.findById.mockResolvedValue(mockUserDoc);
            jest.spyOn(didService, 'verifySignature').mockReturnValue(false);

            const challenge = {
                action: 'LINK_WALLET',
                nonce: 'nonce-123',
                expiresAt: Date.now() + 60000,
            };

            await expect(
                didService.linkWallet('user-1', '0xabc0000000000000000000000000000000000000', '0xsig', challenge)
            ).rejects.toThrow('Invalid signature');

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'signature_validated',
                    status: 'failure',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'credential_linked',
                    status: 'failure',
                })
            );
        });
    });

    describe('Credential Issuance Events', () => {
        test('should log signature_validated, credential_issued, and verification_status_changed on issueCredential success', async () => {
            const mockFarmerDoc = {
                _id: 'farmer-1',
                walletAddress: '0xfarmer',
                role: 'farmer',
                verification: { isVerified: false },
                save: jest.fn().mockResolvedValue(true),
            };
            const mockVerifierDoc = {
                _id: 'verifier-1',
                role: 'admin',
                walletAddress: '0xverifier',
            };

            mockUser.findById.mockImplementation((id) => {
                if (id === 'farmer-1') return mockFarmerDoc;
                if (id === 'verifier-1') return mockVerifierDoc;
                return null;
            });

            jest.spyOn(didService, 'verifySignature').mockReturnValue(true);

            const challenge = {
                action: 'ISSUE_CREDENTIAL',
                nonce: 'nonce-iss',
                expiresAt: Date.now() + 60000,
            };

            await didService.issueCredential('farmer-1', 'verifier-1', '0xsig', '0xfarmer', challenge);

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'signature_validated',
                    actorId: 'verifier-1',
                    userId: 'farmer-1',
                    status: 'success',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'credential_issued',
                    actorId: 'verifier-1',
                    userId: 'farmer-1',
                    status: 'success',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_status_changed',
                    actorId: 'verifier-1',
                    userId: 'farmer-1',
                    status: 'success',
                    metadata: expect.objectContaining({
                        isVerified: true,
                    }),
                })
            );
        });
    });

    describe('Credential Revocation Events', () => {
        test('should log credential_revoked and verification_status_changed on revokeCredential success', async () => {
            const mockFarmerDoc = {
                _id: 'farmer-1',
                role: 'farmer',
                walletAddress: '0xfarmer',
                verification: { isVerified: true },
                save: jest.fn().mockResolvedValue(true),
            };
            const mockAdminDoc = {
                _id: 'admin-1',
                role: 'admin',
            };

            mockUser.findById.mockImplementation((id) => {
                if (id === 'farmer-1') return mockFarmerDoc;
                if (id === 'admin-1') return mockAdminDoc;
                return null;
            });

            await didService.revokeCredential('farmer-1', 'admin-1', 'Test reason');

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'credential_revoked',
                    actorId: 'admin-1',
                    userId: 'farmer-1',
                    status: 'success',
                    metadata: expect.objectContaining({
                        reason: 'Test reason',
                    }),
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_status_changed',
                    actorId: 'admin-1',
                    userId: 'farmer-1',
                    status: 'success',
                    metadata: expect.objectContaining({
                        isVerified: false,
                        reason: 'Test reason',
                    }),
                })
            );
        });
    });

    describe('Idempotency Helper Audit Events', () => {
        test('should log verification_attempt and verification_success events around successful execute', async () => {
            const res = createResponse();
            const execute = jest.fn().mockResolvedValue({ success: true });

            securityService.getIdempotencyRecord.mockResolvedValue(null);
            securityService.consumeChallenge.mockResolvedValue({
                nonce: 'nonce-key',
                expiresAt: 9999999999999,
                action: 'LINK_WALLET',
                actorId: 'farmer-1',
                userId: 'farmer-1',
                walletAddress: '0xfarmer',
            });
            securityService.reserveIdempotencyKey.mockResolvedValue({
                reserved: true,
                record: { state: 'pending', fingerprint: 'fingerprint' }
            });
            securityService.storeCompletedIdempotencyRecord.mockResolvedValue({});

            await handleVerificationWithIdempotency({
                res,
                action: 'LINK_WALLET',
                actorId: 'farmer-1',
                userId: 'farmer-1',
                walletAddress: '0xfarmer',
                idempotencyKey: 'idem-key',
                nonce: 'nonce-key',
                expiresAt: 9999999999999,
                execute,
            });

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_attempt',
                    idempotencyKey: 'idem-key',
                    status: 'attempt',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_success',
                    idempotencyKey: 'idem-key',
                    status: 'success',
                })
            );
        });

        test('should log verification_attempt and verification_failure events on execute exception', async () => {
            const res = createResponse();
            const execute = jest.fn().mockRejectedValue(new Error('Blockchain transaction timeout'));

            securityService.getIdempotencyRecord.mockResolvedValue(null);
            securityService.consumeChallenge.mockResolvedValue({
                nonce: 'nonce-key',
                expiresAt: 9999999999999,
                action: 'LINK_WALLET',
                actorId: 'farmer-1',
                userId: 'farmer-1',
                walletAddress: '0xfarmer',
            });
            securityService.reserveIdempotencyKey.mockResolvedValue({
                reserved: true,
                record: { state: 'pending', fingerprint: 'fingerprint' }
            });
            securityService.deleteIdempotencyRecord.mockResolvedValue({});

            await expect(
                handleVerificationWithIdempotency({
                    res,
                    action: 'LINK_WALLET',
                    actorId: 'farmer-1',
                    userId: 'farmer-1',
                    walletAddress: '0xfarmer',
                    idempotencyKey: 'idem-key',
                    nonce: 'nonce-key',
                    expiresAt: 9999999999999,
                    execute,
                })
            ).rejects.toThrow('Blockchain transaction timeout');

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_attempt',
                    idempotencyKey: 'idem-key',
                    status: 'attempt',
                })
            );

            expect(mockVerificationEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'verification_failure',
                    idempotencyKey: 'idem-key',
                    status: 'failure',
                    metadata: expect.objectContaining({
                        error: 'Blockchain transaction timeout',
                    }),
                })
            );
        });
    });

    describe('Admin API Endpoints for Audit Events', () => {
        test('should retrieve audit events paginated and filtered for admin requests', async () => {
            const mockEventsList = [
                { action: 'credential_issued', userId: 'farmer-1', status: 'success', createdAt: new Date() },
                { action: 'signature_validated', userId: 'farmer-1', status: 'success', createdAt: new Date() },
            ];

            mockVerificationEvent.countDocuments.mockResolvedValue(2);
            mockVerificationEvent.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockEventsList),
            });

            const targetUserId = new mongoose.Types.ObjectId().toString();

            const response = await request(app)
                .get(`/api/verification/events?userId=${targetUserId}&action=credential_issued&page=1&limit=5`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.count).toBe(2);
            expect(response.body.data.events).toHaveLength(2);
            expect(mockVerificationEvent.countDocuments).toHaveBeenCalledWith({
                userId: targetUserId,
                action: 'credential_issued',
            });
        });

        test('should reject events endpoint queries with invalid userId format', async () => {
            await request(app)
                .get('/api/verification/events?userId=invalid-format')
                .expect(400);
        });
    });
});
