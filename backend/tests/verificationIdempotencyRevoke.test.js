jest.mock('../services/verificationSecurityService', () => ({
    getIdempotencyRecord: jest.fn(),
    reserveIdempotencyKey: jest.fn(),
    storeCompletedIdempotencyRecord: jest.fn(),
    deleteIdempotencyRecord: jest.fn(),
}));

const securityService = require('../services/verificationSecurityService');
const {
    handleIdempotencyOnly,
    requireIdempotencyKey,
} = require('../utils/verificationIdempotencyRevoke');

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

describe('verification idempotency revoke helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('replays a completed idempotency record without reprocessing when fingerprint matches', async () => {
        const crypto = require('crypto');
        const expectedFingerprint = crypto.createHash('sha256').update(JSON.stringify({
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules'
        })).digest('hex');

        securityService.getIdempotencyRecord.mockResolvedValue({
            fingerprint: expectedFingerprint,
            state: 'completed',
            statusCode: 200,
            response: {
                success: true,
                message: 'Credential revoked successfully',
            },
        });

        const res = createResponse();
        const execute = jest.fn();

        await handleIdempotencyOnly({
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules',
            idempotencyKey: 'idem-1',
            execute,
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Credential revoked successfully',
        });
        expect(execute).not.toHaveBeenCalled();
        expect(securityService.reserveIdempotencyKey).not.toHaveBeenCalled();
    });

    test('rejects replay and returns conflict when reason is different (fingerprint mismatch)', async () => {
        const crypto = require('crypto');
        const previousFingerprint = crypto.createHash('sha256').update(JSON.stringify({
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules'
        })).digest('hex');

        securityService.getIdempotencyRecord.mockResolvedValue({
            fingerprint: previousFingerprint,
            state: 'completed',
            statusCode: 200,
            response: {
                success: true,
                message: 'Credential revoked successfully',
            },
        });

        const res = createResponse();
        const execute = jest.fn();

        await handleIdempotencyOnly({
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'different reason',
            idempotencyKey: 'idem-1',
            execute,
        });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('Idempotency-Key was already used for a different request');
        expect(execute).not.toHaveBeenCalled();
    });

    test('executes and stores the completed idempotency result', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.reserveIdempotencyKey.mockResolvedValue({
            reserved: true,
            record: {
                state: 'pending',
            },
        });

        const execute = jest.fn().mockResolvedValue({
            success: true,
            message: 'Credential revoked successfully',
        });
        const res = createResponse();

        await handleIdempotencyOnly({
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules',
            idempotencyKey: 'idem-2',
            execute,
        });

        expect(execute).toHaveBeenCalled();
        expect(securityService.storeCompletedIdempotencyRecord).toHaveBeenCalledWith({
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            key: 'idem-2',
            fingerprint: expect.any(String),
            response: {
                success: true,
                message: 'Credential revoked successfully',
            },
            statusCode: 200,
        });
        expect(res.body).toEqual({
            success: true,
            message: 'Credential revoked successfully',
        });
    });

    test('deletes the idempotency record when execution fails', async () => {
        securityService.getIdempotencyRecord.mockResolvedValue(null);
        securityService.reserveIdempotencyKey.mockResolvedValue({
            reserved: true,
            record: {
                state: 'pending',
            },
        });

        const execute = jest.fn().mockRejectedValue(new Error('database error'));
        const res = createResponse();

        await expect(handleIdempotencyOnly({
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules',
            idempotencyKey: 'idem-3',
            execute,
        })).rejects.toThrow('database error');

        expect(securityService.deleteIdempotencyRecord).toHaveBeenCalledWith({
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            key: 'idem-3',
        });
    });

    test('rejects request with conflict if key is already in progress', async () => {
        const crypto = require('crypto');
        const expectedFingerprint = crypto.createHash('sha256').update(JSON.stringify({
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules'
        })).digest('hex');

        securityService.getIdempotencyRecord.mockResolvedValue({
            fingerprint: expectedFingerprint,
            state: 'pending',
        });

        const res = createResponse();
        const execute = jest.fn();

        await handleIdempotencyOnly({
            res,
            action: 'CREDENTIAL_REVOKE',
            actorId: 'admin-1',
            userId: 'user-1',
            reason: 'violating rules',
            idempotencyKey: 'idem-4',
            execute,
        });

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toContain('Request with this Idempotency-Key is already in progress');
        expect(execute).not.toHaveBeenCalled();
    });

    test('requires Idempotency-Key header', () => {
        const req = {
            get: jest.fn().mockReturnValue(''),
        };
        const res = createResponse();

        const result = requireIdempotencyKey(req, res);
        expect(result).toBeNull();
        expect(res.statusCode).toBe(400);
    });
});
