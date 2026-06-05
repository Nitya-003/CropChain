process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock User storage
const inMemoryUsers = [];

class MockUserDoc {
    constructor(data) {
        Object.assign(this, data);
        this._id = data._id || new mongoose.Types.ObjectId().toString();
    }
    async save() {
        const index = inMemoryUsers.findIndex(u => u._id === this._id);
        if (index !== -1) {
            inMemoryUsers[index] = this;
        } else {
            inMemoryUsers.push(this);
        }
        return this;
    }
    toObject() { return this; }
}

const mockUser = {
    findById: jest.fn().mockImplementation((id) => {
        const user = inMemoryUsers.find(u => u._id === id);
        return user ? new MockUserDoc(user) : null;
    }),
    findOne: jest.fn().mockImplementation((query) => {
        // Query can be { email } or { email, _id: { $ne: user._id } }
        const email = query.email;
        const neId = query._id?.$ne;
        const found = inMemoryUsers.find(u => {
            const matchesEmail = u.email === email;
            const matchesNotId = neId ? u._id !== neId : true;
            return matchesEmail && matchesNotId;
        });
        return found ? new MockUserDoc(found) : null;
    }),
    create: jest.fn().mockImplementation(async (data) => {
        const user = new MockUserDoc(data);
        inMemoryUsers.push(user);
        return user;
    })
};

// Mock Mongoose module
jest.mock('mongoose', () => {
    const originalMongoose = jest.requireActual('mongoose');
    const Schema = jest.fn().mockImplementation(() => {
        return {
            index: jest.fn(),
            virtual: jest.fn().mockReturnValue({ get: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() }),
            set: jest.fn(),
            pre: jest.fn(),
            post: jest.fn(),
            methods: {},
            statics: {}
        };
    });
    Schema.Types = {
        ObjectId: 'ObjectId',
        String: 'String',
        Number: 'Number',
        Date: 'Date',
        Boolean: 'Boolean'
    };

    return {
        ...originalMongoose,
        Schema,
        model: jest.fn((name) => {
            if (name === 'User') return mockUser;
            return {
                findOne: jest.fn(),
                create: jest.fn(),
                find: jest.fn()
            };
        }),
        connect: jest.fn(),
        connection: {
            host: 'localhost',
            readyState: 1,
            close: jest.fn()
        }
    };
});

jest.mock('../models/User', () => mockUser);
jest.mock('../models/Counter', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 })
}));

// Mock middleware auth so we can access protected routes
const mockCurrentUserId = new mongoose.Types.ObjectId().toString();
jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = { _id: mockCurrentUserId, email: 'farmer@test.com', role: 'farmer' };
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

describe('User Profile API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        inMemoryUsers.length = 0;
        
        // Add the logged in user to memory
        inMemoryUsers.push({
            _id: mockCurrentUserId,
            name: 'Original Name',
            email: 'farmer@test.com',
            role: 'farmer',
            password: 'hashedpassword123'
        });
    });

    test('should allow user to update name and email', async () => {
        const response = await request(app)
            .put('/api/auth/profile')
            .send({
                name: 'Updated Name',
                email: 'newemail@test.com'
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.name).toBe('Updated Name');
        expect(response.body.data.user.email).toBe('newemail@test.com');
    });

    test('should prevent updating email to one already in use', async () => {
        // Add another user with the target email
        inMemoryUsers.push({
            _id: new mongoose.Types.ObjectId().toString(),
            name: 'Another User',
            email: 'taken@test.com',
            role: 'farmer'
        });

        const response = await request(app)
            .put('/api/auth/profile')
            .send({
                email: 'taken@test.com'
            })
            .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('CONFLICT');
    });

    test('should validate weak/invalid new password', async () => {
        const response = await request(app)
            .put('/api/auth/profile')
            .send({
                password: 'weak'
            })
            .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
    });

    test('should return 400 if no update fields are provided', async () => {
        const response = await request(app)
            .put('/api/auth/profile')
            .send({})
            .expect(400);

        expect(response.body.success).toBe(false);
    });
});
