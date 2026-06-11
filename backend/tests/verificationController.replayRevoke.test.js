jest.mock('../services/didService', () => ({
    linkWallet: jest.fn(),
    issueCredential: jest.fn(),
    revokeCredential: jest.fn(),
    checkVerificationStatus: jest.fn(),
}));

jest.mock('../utils/verificationControllerHelpers', () => ({
    handleZodValidation: jest.fn(),
    handleServerError: jest.fn((res) => res),
    requireIdempotencyKey: jest.fn(),
    handleVerificationWithIdempotency: jest.fn(),
}));

jest.mock('../utils/verificationIdempotency', () => ({
    handleIdempotencyOnly: jest.fn(),
    requireIdempotencyKey: jest.fn(),
}));

const didService = require('../services/didService');
const controllerHelpers = require('../utils/verificationControllerHelpers');
const { handleIdempotencyOnly } = require('../utils/verificationIdempotency');

const { revokeCredential } = require('../controllers/verificationController');

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
        get: jest.fn(),
    };

    return response;
};

describe('verification controller replay protection - revokeCredential', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requires Idempotency-Key header and calls idempotency helper', async () => {
        controllerHelpers.requireIdempotencyKey.mockReturnValue('idem-1');
        handleIdempotencyOnly.mockImplementation(async ({ execute }) => execute());
        didService.revokeCredential.mockResolvedValue({ success: true, message: 'Credential revoked successfully' });

        const req = {
            body: { userId: 'target-user', reason: 'test-reason' },
            user: { id: 'admin-1' },
            get: jest.fn(() => 'idem-1'),
        };
        const res = createResponse();

        await revokeCredential(req, res);

        expect(controllerHelpers.requireIdempotencyKey).toHaveBeenCalled();
        expect(handleIdempotencyOnly).toHaveBeenCalled();
        expect(didService.revokeCredential).toHaveBeenCalledWith('target-user', 'admin-1', 'test-reason');
        expect(res.body.success).toBe(true);
    });
});

