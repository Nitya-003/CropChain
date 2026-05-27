jest.mock('../services/didService', () => ({
    linkWallet: jest.fn(),
    issueCredential: jest.fn(),
    revokeCredential: jest.fn(),
    checkVerificationStatus: jest.fn(),
}));

jest.mock('../services/verificationSecurityService', () => ({
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
}));

const didService = require('../services/didService');
const securityService = require('../services/verificationSecurityService');
const { linkWallet, issueCredential, generateLinkWalletChallenge } = require('../controllers/verificationController');

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

describe('verification controller replay protection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns the stored idempotent link-wallet response without reprocessing', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue({
            state: 'completed',
            fingerprint: 'fingerprint',
            statusCode: 200,
            response: {
                success: true,
                message: 'Wallet linked successfully',
                walletAddress: '0xabc0000000000000000000000000000000000000',
            },
        });

        const req = {
            body: {
                walletAddress: '0xabc0000000000000000000000000000000000000',
                signature: '0xdeadbeef',
                nonce: 'nonce-1',
                expiresAt: Date.now() + 60000,
            },
            user: { id: 'user-1' },
            get: jest.fn(() => 'idem-1'),
        };
        const res = createResponse();

        await linkWallet(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Wallet linked successfully',
            walletAddress: '0xabc0000000000000000000000000000000000000',
        });
        expect(didService.linkWallet).not.toHaveBeenCalled();
        expect(securityService.consumeChallenge).not.toHaveBeenCalled();
    });

    test('returns conflict for an in-progress idempotent issue request', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue({
            state: 'pending',
            fingerprint: 'fingerprint',
        });

        const req = {
            body: {
                userId: 'target-user',
                walletAddress: '0xabc0000000000000000000000000000000000000',
                signature: '0xdeadbeef',
                nonce: 'nonce-2',
                expiresAt: Date.now() + 60000,
            },
            user: { id: 'verifier-1' },
            get: jest.fn(() => 'idem-2'),
        };
        const res = createResponse();

        await issueCredential(req, res);

        expect(res.statusCode).toBe(409);
        expect(res.body.code).toBe('CONFLICT');
        expect(didService.issueCredential).not.toHaveBeenCalled();
        expect(securityService.consumeChallenge).not.toHaveBeenCalled();
    });

    test('generates a wallet linking challenge for the authenticated user', async () => {
        securityService.createChallenge.mockResolvedValue({
            nonce: 'nonce-3',
            expiresAt: 123456789,
            action: 'LINK_WALLET',
            actorId: 'user-2',
            userId: 'user-2',
            walletAddress: '0xabc0000000000000000000000000000000000000',
        });

        const req = {
            body: {
                walletAddress: '0xABC0000000000000000000000000000000000000',
            },
            user: { id: 'user-2' },
        };
        const res = createResponse();

        await generateLinkWalletChallenge(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(securityService.createChallenge).toHaveBeenCalledWith({
            action: 'LINK_WALLET',
            actorId: 'user-2',
            userId: 'user-2',
            walletAddress: '0xABC0000000000000000000000000000000000000',
        });
    });
});