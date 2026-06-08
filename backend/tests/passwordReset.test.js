process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Mock User schema & logic
const inMemoryUsers = [];

class MockUserDoc {
    constructor(data) {
        Object.assign(this, data);
    }
    async save() {
        // If password is updated, normally hashed by bcrypt.
        // We'll mimic this update on save.
        const index = inMemoryUsers.findIndex(u => u._id.toString() === this._id.toString());
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
    findOne: jest.fn().mockImplementation(async (query) => {
        if (query.email) {
            return inMemoryUsers.find(u => u.email === query.email);
        }
        if (query.resetPasswordToken) {
            const now = Date.now();
            return inMemoryUsers.find(u => 
                u.resetPasswordToken === query.resetPasswordToken && 
                u.resetPasswordExpire > now
            );
        }
        return null;
    }),
    create: jest.fn().mockImplementation(async (data) => {
        const id = new mongoose.Types.ObjectId();
        const user = new MockUserDoc({
            _id: id,
            ...data
        });
        inMemoryUsers.push(user);
        return user;
    }),
    deleteMany: jest.fn().mockImplementation(async () => {
        inMemoryUsers.length = 0;
    })
};

// Mock other models & mongoose to avoid DB connection issues
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

// Mock Notification Service
const mockNotificationService = {
    sendEmail: jest.fn().mockResolvedValue({ success: true })
};
jest.mock('../services/notificationService', () => mockNotificationService);

const app = require('../server');

describe('Password Reset Endpoints', () => {
    let testUser;

    beforeEach(async () => {
        jest.clearAllMocks();
        inMemoryUsers.length = 0;

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('Password123!', salt);

        testUser = await mockUser.create({
            name: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            role: 'farmer'
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        test('should send a password reset email if user exists', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('password reset link');
            expect(mockNotificationService.sendEmail).toHaveBeenCalled();

            // Verify token was saved in db
            const updatedUser = inMemoryUsers.find(u => u.email === 'test@example.com');
            expect(updatedUser.resetPasswordToken).toBeDefined();
            expect(updatedUser.resetPasswordExpire).toBeDefined();
            expect(updatedUser.resetPasswordExpire).toBeGreaterThan(Date.now());
        });

        test('should return generic message if email does not match any user', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'nonexistent@example.com' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('If an account exists');
        });

        test('should return 400 if email is missing', async () => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/reset-password/:token', () => {
        let resetToken;
        let hashedToken;

        beforeEach(() => {
            resetToken = 'abcdef1234567890';
            hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            
            testUser.resetPasswordToken = hashedToken;
            testUser.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
        });

        test('should reset password with valid token and strong new password', async () => {
            const response = await request(app)
                .post(`/api/auth/reset-password/${resetToken}`)
                .send({ password: 'NewPassword123!' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('successful');

            // Verify password was changed and tokens were cleared
            const updatedUser = inMemoryUsers.find(u => u.email === 'test@example.com');
            expect(updatedUser.resetPasswordToken).toBeUndefined();
            expect(updatedUser.resetPasswordExpire).toBeUndefined();
            
            const passwordMatch = await bcrypt.compare('NewPassword123!', updatedUser.password);
            expect(passwordMatch).toBe(true);
        });

        test('should return 400 if token is invalid or expired', async () => {
            const response = await request(app)
                .post('/api/auth/reset-password/invalidtoken')
                .send({ password: 'NewPassword123!' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });

        test('should return 400 if password does not meet strength requirements', async () => {
            const response = await request(app)
                .post(`/api/auth/reset-password/${resetToken}`)
                .send({ password: 'weak' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be');
        });
    });
});
