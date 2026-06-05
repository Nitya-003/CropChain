process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock User storage
const mockUsersDb = [
    {
        _id: 'user-id-1',
        name: 'John Farmer',
        email: 'john@farmer.com',
        role: 'farmer',
        walletAddress: '0xabc1230000000000000000000000000000000001',
        createdAt: new Date('2026-06-01T10:00:00Z'),
        verification: { isVerified: false },
    },
    {
        _id: 'user-id-2',
        name: 'Alice Mandi',
        email: 'alice@mandi.com',
        role: 'mandi_officer',
        walletAddress: '0xabc1230000000000000000000000000000000002',
        createdAt: new Date('2026-06-02T10:00:00Z'),
        verification: {
            isVerified: true,
            verifiedAt: new Date('2026-06-03T12:00:00Z'),
            verifiedBy: 'admin-id',
        },
    },
    {
        _id: 'user-id-3',
        name: 'Bob Farmer',
        email: 'bob@farmer.com',
        role: 'farmer',
        walletAddress: '0xabc1230000000000000000000000000000000003',
        createdAt: new Date('2026-06-04T10:00:00Z'),
        verification: { isVerified: false },
    },
];

// Mock Mongoose Query Chain & Model
const mockCursor = {
    next: jest.fn(),
};

const mockQuery = {
    lean: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    cursor: jest.fn().mockReturnValue(mockCursor),
};

const mockUser = {
    countDocuments: jest.fn(),
    find: jest.fn().mockReturnValue(mockQuery),
};

jest.mock('../models/User', () => mockUser);

// Mock other models
jest.mock('../models/Counter', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
}));
jest.mock('../models/VerificationEvent', () => ({
    create: jest.fn().mockResolvedValue({}),
}));

// Mock auth middleware (Admin user authenticated)
jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = { id: 'admin-id', email: 'admin@test.com', role: 'admin' };
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

const app = require('../server');

describe('Verification Advanced Filtering, Sorting & CSV Export', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/verification/unverified', () => {
        test('should apply search, role, and date range filters correctly', async () => {
            const filteredUsers = [mockUsersDb[0]]; // John Farmer (unverified)
            mockUser.countDocuments.mockResolvedValue(1);
            mockQuery.limit.mockResolvedValue(filteredUsers);

            const response = await request(app)
                .get('/api/verification/unverified?search=John&role=farmer&fromDate=2026-06-01&toDate=2026-06-03&sortBy=name&sortOrder=asc&page=1&limit=5')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.count).toBe(1);
            expect(response.body.data.users).toHaveLength(1);
            expect(response.body.data.users[0].name).toBe('John Farmer');

            // Verify Mongo Filters
            expect(mockUser.countDocuments).toHaveBeenCalledWith(
                expect.objectContaining({
                    'verification.isVerified': { $ne: true },
                    role: 'farmer',
                    $or: [
                        { name: expect.objectContaining({ $regex: 'John' }) },
                        { email: expect.objectContaining({ $regex: 'John' }) },
                    ],
                    createdAt: {
                        $gte: new Date('2026-06-01'),
                        $lte: new Date('2026-06-03'),
                    },
                })
            );

            // Verify Sort
            expect(mockQuery.sort).toHaveBeenCalledWith({ name: 1 });
        });

        test('should handle pagination boundaries correctly', async () => {
            mockUser.countDocuments.mockResolvedValue(10);
            mockQuery.limit.mockResolvedValue([]);

            await request(app)
                .get('/api/verification/unverified?page=3&limit=4')
                .expect(200);

            expect(mockQuery.skip).toHaveBeenCalledWith(8);
            expect(mockQuery.limit).toHaveBeenCalledWith(4);
        });
    });

    describe('GET /api/verification/verified', () => {
        test('should query verified users with populated verifier information', async () => {
            const verifiedUsers = [mockUsersDb[1]]; // Alice Mandi (verified)
            mockUser.countDocuments.mockResolvedValue(1);
            mockQuery.limit.mockResolvedValue(verifiedUsers);

            const response = await request(app)
                .get('/api/verification/verified?search=Alice&page=1&limit=2')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.users[0].name).toBe('Alice Mandi');
            expect(mockQuery.populate).toHaveBeenCalledWith('verification.verifiedBy', 'name email');
        });
    });

    describe('CSV Exports', () => {
        test('should stream unverified users CSV export and format fields correctly', async () => {
            const unverifiedUsers = [mockUsersDb[0], mockUsersDb[2]];
            let cursorIndex = 0;
            mockCursor.next.mockImplementation(async () => {
                if (cursorIndex < unverifiedUsers.length) {
                    return unverifiedUsers[cursorIndex++];
                }
                return null;
            });

            const response = await request(app)
                .get('/api/verification/unverified/export?search=Farmer')
                .expect('Content-Type', /text\/csv/)
                .expect('Content-Disposition', /attachment; filename="unverified_users.csv"/)
                .expect(200);

            const csvLines = response.text.split('\n').filter(Boolean);
            expect(csvLines[0]).toBe('Name,Email,Role,Wallet Address,Created At');
            expect(csvLines[1]).toContain('John Farmer,john@farmer.com,farmer,0xabc1230000000000000000000000000000000001');
            expect(csvLines[2]).toContain('Bob Farmer,bob@farmer.com,farmer,0xabc1230000000000000000000000000000000003');
        });

        test('should stream verified users CSV export including verified by email', async () => {
            const verifiedUsers = [
                {
                    name: 'Alice Mandi',
                    email: 'alice@mandi.com',
                    role: 'mandi_officer',
                    walletAddress: '0xabc1230000000000000000000000000000000002',
                    verification: {
                        verifiedAt: new Date('2026-06-03T12:00:00Z'),
                        verifiedBy: { email: 'verifier@admin.com' },
                    },
                },
            ];

            let cursorIndex = 0;
            mockCursor.next.mockImplementation(async () => {
                if (cursorIndex < verifiedUsers.length) {
                    return verifiedUsers[cursorIndex++];
                }
                return null;
            });

            const response = await request(app)
                .get('/api/verification/verified/export')
                .expect('Content-Type', /text\/csv/)
                .expect('Content-Disposition', /attachment; filename="verified_users.csv"/)
                .expect(200);

            const csvLines = response.text.split('\n').filter(Boolean);
            expect(csvLines[0]).toBe('Name,Email,Role,Wallet Address,Verified At,Verified By Email');
            expect(csvLines[1]).toContain('Alice Mandi,alice@mandi.com,mandi_officer,0xabc1230000000000000000000000000000000002,2026-06-03T12:00:00.000Z,verifier@admin.com');
        });
    });
});
