jest.mock('../services/verificationSecurityService', () => ({
    createFingerprint: jest.fn(() => 'fingerprint'),
    getIdempotencyRecord: jest.fn(),
    consumeChallenge: jest.fn(),
    reserveIdempotencyKey: jest.fn(),
    storeCompletedIdempotencyRecord: jest.fn(),
    deleteIdempotencyRecord: jest.fn(),
}));

jest.mock('../models/VerificationEvent', () => ({
    create: jest.fn().mockResolvedValue({}),
}));

const securityService = require('../services/verificationSecurityService');
const {
    handleVerificationWithIdempotency,
} = require('../utils/verificationIdempotency');

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

describe('verification idempotency helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('replays a completed idempotency record without reprocessing', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue({
            fingerprint: 'fingerprint',
            state: 'completed',
            statusCode: 200,
            response: {
                success: true,
                message: 'Wallet linked successfully',
            },
        });

        const res = createResponse();

        await handleVerificationWithIdempotency({
            res,
            action: 'LINK_WALLET',
            actorId: 'user-1',
            userId: 'user-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
            signature: '0xdeadbeef',
            nonce: 'nonce-1',
            expiresAt: Date.now() + 60000,
            idempotencyKey: 'idem-1',
            execute: jest.fn(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Wallet linked successfully',
        });
        expect(securityService.consumeChallenge).not.toHaveBeenCalled();
        expect(securityService.reserveIdempotencyKey).not.toHaveBeenCalled();
    });

    test('executes and stores the completed idempotency result', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.consumeChallenge.mockResolvedValue({
            nonce: 'nonce-2',
            expiresAt: 9999999999999,
            action: 'ISSUE_CREDENTIAL',
            actorId: 'verifier-1',
            userId: 'target-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
        });
        securityService.reserveIdempotencyKey.mockResolvedValue({
            reserved: true,
            record: {
                state: 'pending',
                fingerprint: 'fingerprint',
            },
        });

        const execute = jest.fn().mockResolvedValue({
            success: true,
            message: 'Credential issued successfully',
        });
        const res = createResponse();

        await handleVerificationWithIdempotency({
            res,
            action: 'ISSUE_CREDENTIAL',
            actorId: 'verifier-1',
            userId: 'target-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
            signature: '0xdeadbeef',
            nonce: 'nonce-2',
            expiresAt: 9999999999999,
            idempotencyKey: 'idem-2',
            execute,
        });

        expect(execute).toHaveBeenCalledWith(expect.objectContaining({
            nonce: 'nonce-2',
            expiresAt: 9999999999999,
        }));
        expect(securityService.storeCompletedIdempotencyRecord).toHaveBeenCalledWith({
            action: 'ISSUE_CREDENTIAL',
            actorId: 'verifier-1',
            key: 'idem-2',
            fingerprint: 'fingerprint',
            response: {
                success: true,
                message: 'Credential issued successfully',
            },
            statusCode: 200,
        });
        expect(res.body).toEqual({
            success: true,
            message: 'Credential issued successfully',
        });
    });

    test('deletes the idempotency record when execution fails', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.consumeChallenge.mockResolvedValue({
            nonce: 'nonce-3',
            expiresAt: 9999999999999,
            action: 'LINK_WALLET',
            actorId: 'user-3',
            userId: 'user-3',
            walletAddress: '0xabc0000000000000000000000000000000000000',
        });
        securityService.reserveIdempotencyKey.mockResolvedValue({
            reserved: true,
            record: {
                state: 'pending',
                fingerprint: 'fingerprint',
            },
        });

        const execute = jest.fn().mockRejectedValue(new Error('boom'));
        const res = createResponse();

        await expect(handleVerificationWithIdempotency({
            res,
            action: 'LINK_WALLET',
            actorId: 'user-3',
            userId: 'user-3',
            walletAddress: '0xabc0000000000000000000000000000000000000',
            signature: '0xdeadbeef',
            nonce: 'nonce-3',
            expiresAt: 9999999999999,
            idempotencyKey: 'idem-3',
            execute,
        })).rejects.toThrow('boom');

        expect(securityService.deleteIdempotencyRecord).toHaveBeenCalledWith({
            action: 'LINK_WALLET',
            actorId: 'user-3',
            key: 'idem-3',
        });
    });

    test('rejects replay with same signature but different/missing challenge', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.consumeChallenge.mockResolvedValue(null);

        const execute = jest.fn();
        const res = createResponse();

        await handleVerificationWithIdempotency({
            res,
            action: 'LINK_WALLET',
            actorId: 'user-1',
            userId: 'user-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
            signature: '0xdeadbeef',
            nonce: 'different-nonce',
            expiresAt: Date.now() + 60000,
            idempotencyKey: 'idem-1',
            execute,
        });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('Nonce is missing, expired, or already used');
        expect(execute).not.toHaveBeenCalled();
    });

    test('rejects cross-action reuse of challenge', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.consumeChallenge.mockResolvedValue({
            nonce: 'nonce-1',
            expiresAt: 123456789,
            action: 'ISSUE_CREDENTIAL',
            actorId: 'user-1',
            userId: 'user-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
        });

        const execute = jest.fn();
        const res = createResponse();

        await handleVerificationWithIdempotency({
            res,
            action: 'LINK_WALLET',
            actorId: 'user-1',
            userId: 'user-1',
            walletAddress: '0xabc0000000000000000000000000000000000000',
            signature: '0xdeadbeef',
            nonce: 'nonce-1',
            expiresAt: 123456789,
            idempotencyKey: 'idem-1',
            execute,
        });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('Challenge action mismatch');
        expect(execute).not.toHaveBeenCalled();
    });
});