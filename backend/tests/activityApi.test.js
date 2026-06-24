process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');

const mockActivity = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn()
};

const mockBatch = {
    find: jest.fn()
};

// Variable must be prefixed with "mock" to be accessible inside jest.mock()
const mockCurrentUser = { id: 'USER123', name: 'Test Farmer', role: 'farmer' };

jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = mockCurrentUser;
        next();
    }),
    adminOnly: jest.fn((req, res, next) => next()),
    authorizeRoles: jest.fn(() => (req, res, next) => next()),
    authorizeBatchOwner: jest.fn((req, res, next) => next()),
    authorizeStageTransition: jest.fn((req, res, next) => next()),
    authorizeBlockchainTransaction: jest.fn((req, res, next) => next()),
    requirePermissions: jest.fn(() => (req, res, next) => next()),
    requireAllPermissions: jest.fn(() => (req, res, next) => next()),
    inspectorOnly: jest.fn((req, res, next) => next()),
    verifiedOnly: jest.fn((req, res, next) => next()),
    requireMultisigOrAdmin: jest.fn(() => (req, res, next) => next()),
    checkBatchSafetyStatus: jest.fn((req, res, next) => next())
}));

jest.mock('mongoose', () => {
    const Schema = jest.fn().mockImplementation(() => ({
        index: jest.fn(),
        virtual: jest.fn().mockReturnValue({
            get: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis()
        }),
        set: jest.fn(),
        pre: jest.fn(),
        post: jest.fn(),
        methods: {},
        statics: {}
    }));
    Schema.Types = {
        ObjectId: 'ObjectId',
        String: 'String',
        Number: 'Number',
        Date: 'Date',
        Boolean: 'Boolean',
        Mixed: 'Mixed'
    };

    return {
        Schema: Schema,
        model: jest.fn((name) => {
            if (name === 'Activity') return mockActivity;
            if (name === 'Batch') return mockBatch;
            return {
                find: jest.fn(),
                create: jest.fn()
            };
        }),
        connect: jest.fn(),
        connection: { readyState: 1 }
    };
});

// Mock logger to avoid winston module issues in isolated jest environment
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

jest.mock('../models/Activity', () => mockActivity);
jest.mock('../models/Batch', () => mockBatch);

const app = require('../server');

describe('Activity API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentUser.id = 'USER123';
        mockCurrentUser.name = 'Test Farmer';
        mockCurrentUser.role = 'farmer';
    });

    it('should deny GET /api/activities for non-admin users', async () => {
        const res = await request(app).get('/api/activities');
        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toBe(false);
    });

    it('should allow GET /api/activities for admin users', async () => {
        mockCurrentUser.id = 'ADMIN123';
        mockCurrentUser.name = 'System Admin';
        mockCurrentUser.role = 'admin';
        
        mockActivity.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                { eventType: 'crop_registered', batchId: 'BATCH001', userRole: 'farmer', description: 'Registered crop' }
            ])
        });
        mockActivity.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/activities');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.activities.length).toBe(1);
    });

    it('should return personalized feed for farmers', async () => {
        mockBatch.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([{ batchId: 'BATCH_MY_CROP' }])
        });

        mockActivity.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                { eventType: 'crop_registered', batchId: 'BATCH_MY_CROP', userRole: 'farmer', description: 'Registered crop' }
            ])
        });
        mockActivity.countDocuments.mockResolvedValue(1);

        const res = await request(app).get('/api/activities/feed');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(mockBatch.find).toHaveBeenCalledWith({ farmerId: 'USER123' });
    });
});
