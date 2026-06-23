const request = require('supertest');

describe('CORS Configuration', () => {
    let app;

    beforeEach(() => {
        jest.resetModules();

        process.env.NODE_ENV = 'test';
        process.env.ALLOWED_ORIGINS = 'http://trusted.com';
        process.env.FRONTEND_URL = 'http://frontend.com';

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        jest.mock('mongoose', () => {
            const mSchema = function() {
                return {
                    index: jest.fn(),
                    pre: jest.fn(),
                    post: jest.fn(),
                    virtual: jest.fn().mockReturnValue({
                        get: jest.fn().mockReturnThis(),
                        set: jest.fn().mockReturnThis()
                    }),
                    methods: {},
                    statics: {}
                };
            };

            // Mock Schema.Types
            mSchema.Types = {
                ObjectId: 'ObjectId',
                String: String,
                Number: Number,
                Boolean: Boolean,
                Date: Date
            };

            const mMongoose = {
                connect: jest.fn(),
                connection: { readyState: 1 },
                startSession: jest.fn(),
                Schema: mSchema,
                model: jest.fn().mockImplementation(() => ({
                    find: jest.fn().mockReturnThis(),
                    findOne: jest.fn().mockReturnThis(),
                    create: jest.fn(),
                    findOneAndUpdate: jest.fn(),
                    sort: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    skip: jest.fn().mockReturnThis()
                })),
                Query: jest.fn()
            };
            return mMongoose;
        });

        app = require('../server');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should allow requests from ALLOWED_ORIGINS', async () => {
        const res = await request(app)
            .get('/api/status')
            .set('Origin', 'http://trusted.com');

        expect(res.status).toBe(200);
        // Default cors() returns * so this will fail if it expects http://trusted.com
        // But for allowed origins, * is also technically allowed, but we want explicit allow.
        // Let's check what it returns.
    });

    test('should allow requests from FRONTEND_URL', async () => {
        const res = await request(app)
            .get('/api/status')
            .set('Origin', 'http://frontend.com');

        expect(res.status).toBe(200);
    });

    test('should reject requests with no origin', async () => {
        const res = await request(app)
            .get('/api/status');

        expect(res.status).not.toBe(200);
    });

    test('should block requests from disallowed origins', async () => {
        const res = await request(app)
            .get('/api/status')
            .set('Origin', 'http://evil.com');

        // Current: 200 (FAIL)
        // Expected after fix: 500/403
        expect(res.status).not.toBe(200);
    });
});
