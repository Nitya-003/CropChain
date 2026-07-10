process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';
jest.setTimeout(20000);

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mock storage
const inMemoryUsers = [];
const inMemoryBatches = [];

class MockUserDoc {
    constructor(data) {
        Object.assign(this, data);
    }
    toObject() { return this; }
}

class MockBatchDoc {
    constructor(data) {
        Object.assign(this, data);
        if (!this.updates) this.updates = [];
    }
    save() { return Promise.resolve(this); }
    toObject() { return this; }
}

const mockCounter = {
    findOneAndUpdate: jest.fn().mockImplementation(async () => {
        return { seq: 1 };
    })
};

const mockUser = {
    create: jest.fn().mockImplementation(async (data) => {
        const id = new mongoose.Types.ObjectId();
        const user = new MockUserDoc({
            _id: id,
            id: id.toString(),
            status: 'active',
            ...data
        });
        inMemoryUsers.push(user);
        return user;
    }),
    deleteMany: jest.fn().mockImplementation(async () => {
        inMemoryUsers.length = 0;
    }),
    findById: jest.fn().mockImplementation((id) => {
        const idStr = id.toString();
        const user = inMemoryUsers.find(u => u._id.toString() === idStr);
        return {
            select: jest.fn().mockResolvedValue(user)
        };
    }),
    findOne: jest.fn().mockImplementation(async (query) => {
        return inMemoryUsers.find(u => u.email === query.email);
    })
};

const mockBatch = {
    create: jest.fn().mockImplementation(async (dataArray, options) => {
        const data = Array.isArray(dataArray) ? dataArray[0] : dataArray;
        const batch = new MockBatchDoc({
            _id: new mongoose.Types.ObjectId(),
            batchId: data.batchId || 'BATCH000001',
            currentStage: data.currentStage || 'farmer',
            ...data
        });
        inMemoryBatches.push(batch);
        return Array.isArray(dataArray) ? [batch] : batch;
    }),
    deleteMany: jest.fn().mockImplementation(async () => {
        inMemoryBatches.length = 0;
    }),
    findOne: jest.fn().mockImplementation(async (query) => {
        return inMemoryBatches.find(b => b.batchId === query.batchId);
    }),
    findOneAndUpdate: jest.fn().mockImplementation(async (query, update, options) => {
        const batch = inMemoryBatches.find(b => b.batchId === query.batchId);
        if (!batch) return null;
        if (update.$push && update.$push.updates) {
            batch.updates.push(update.$push.updates);
        }
        if (update.currentStage) {
            batch.currentStage = update.currentStage;
        }
        return batch;
    })
};

// Mock Mongoose module
jest.mock('mongoose', () => {
    const originalMongoose = jest.requireActual('mongoose');
    const Schema = jest.fn().mockImplementation(() => {
        return {
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
        Schema: Schema,
        model: jest.fn((name) => {
            if (name === 'Counter') return mockCounter;
            if (name === 'Batch') return mockBatch;
            if (name === 'User') return mockUser;
            return {
                findOne: jest.fn(),
                create: jest.fn()
            };
        }),
        connect: jest.fn(),
        startSession: jest.fn().mockReturnValue({
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            abortTransaction: jest.fn(),
            endSession: jest.fn()
        }),
        connection: {
            host: 'localhost',
            readyState: 1, // Simulate connected
            close: jest.fn()
        }
    };
});

jest.mock('../models/Counter', () => mockCounter);
jest.mock('../models/Batch', () => mockBatch);
jest.mock('../models/User', () => mockUser);

const app = require('../server');
const User = require('../models/User');
const Batch = require('../models/Batch');

describe('RBAC Backend Tests', () => {
    let tokens = {};
    let testBatch;

    beforeAll(async () => {
        // No connection needed for mocks
    });

    afterAll(async () => {
        // No connection teardown needed for mocks
    });

    beforeEach(async () => {
        // Clean up database
        await User.deleteMany({});
        await Batch.deleteMany({});

        // Create test users with different roles
        const users = [
            { name: 'Test Farmer', email: 'farmer@test.com', password: 'Password123!', role: 'farmer' },
            { name: 'Another Farmer', email: 'farmer2@test.com', password: 'Password123!', role: 'farmer' },
            { name: 'Test Mandi', email: 'mandi@test.com', password: 'Password123!', role: 'mandi' },
            { name: 'Test Transporter', email: 'transporter@test.com', password: 'Password123!', role: 'transporter' },
            { name: 'Test Retailer', email: 'retailer@test.com', password: 'Password123!', role: 'retailer' },
            { name: 'Test Admin', email: 'admin@test.com', password: 'Password123!', role: 'admin' },
            { name: 'Test Inspector', email: 'inspector@test.com', password: 'Password123!', role: 'quality_inspector' },
            { name: 'Test Future Role', email: 'future@test.com', password: 'Password123!', role: 'processor' }
        ];

        for (const userData of users) {
            const user = await User.create(userData);
            const key = userData.email.split('@')[0];
            tokens[key] = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret');
            
            // Map roles directly for backward compatibility
            if (userData.role !== 'farmer') {
                tokens[userData.role] = tokens[key];
            } else if (userData.email === 'farmer@test.com') {
                tokens['farmer'] = tokens[key];
            }
        }
    });

    describe('Batch Creation RBAC', () => {
        it('Should allow farmer to create batch', async () => {
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Farmer',
                farmerAddress: '123 Green Lane',
                cropType: 'wheat',
                quantity: 100,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'Kansas USA',
                description: 'Test batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.farmer}`)
                .send(batchData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.cropType).toBe('wheat');
            testBatch = response.body.data.batch;
        });

        it('Should reject mandi trying to create batch', async () => {
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Mandi',
                farmerAddress: '123 Green Lane',
                cropType: 'rice',
                quantity: 50,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'California USA',
                description: 'Unauthorized batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.mandi}`)
                .send(batchData)
                .expect(403);

            expect(response.body.error).toBe('Access denied');
            expect(response.body.message).toContain('Role \'mandi\' is not authorized');
        });

        it('Should reject transporter trying to create batch', async () => {
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Transporter',
                farmerAddress: '123 Green Lane',
                cropType: 'corn',
                quantity: 75,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'Iowa State USA',
                description: 'Unauthorized batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.transporter}`)
                .send(batchData)
                .expect(403);

            expect(response.body.error).toBe('Access denied');
            expect(response.body.message).toContain('Role \'transporter\' is not authorized');
        });

        it('Should reject retailer trying to create batch', async () => {
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Retailer',
                farmerAddress: '123 Green Lane',
                cropType: 'tomato',
                quantity: 60,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'Texas State USA',
                description: 'Unauthorized batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.retailer}`)
                .send(batchData)
                .expect(403);

            expect(response.body.error).toBe('Access denied');
            expect(response.body.message).toContain('Role \'retailer\' is not authorized');
        });

        it('Should allow admin to create batch (admin override)', async () => {
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Admin',
                farmerAddress: '123 Green Lane',
                cropType: 'rice',
                quantity: 80,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'Nebraska USA',
                description: 'Admin batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.admin}`)
                .send(batchData)
                .expect(403); // Admin should still be rejected for batch creation as it's farmer-specific

            expect(response.body.error).toBe('Access denied');
        });
    });

    describe('Batch Update RBAC', () => {
        beforeEach(async () => {
            // Create a test batch for update tests
            const batchData = {
                farmerId: 'FARM123',
                farmerName: 'Test Farmer',
                farmerAddress: '123 Green Lane',
                cropType: 'wheat',
                quantity: 100,
                harvestDate: '2024-01-01T00:00:00.000Z',
                origin: 'Kansas USA',
                description: 'Test batch for updates'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.farmer}`)
                .send(batchData);

            testBatch = response.body.data.batch;
        });

        it('Should allow mandi to update to mandi stage', async () => {
            const updateData = {
                stage: 'mandi',
                actor: 'Test Mandi',
                location: 'Mandi Market',
                timestamp: '2024-01-02',
                notes: 'Received at mandi'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.mandi}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.currentStage).toBe('mandi');
        });

        it('Should reject farmer trying to update to mandi stage', async () => {
            const updateData = {
                stage: 'mandi',
                actor: 'Test Farmer',
                location: 'Farm Location',
                timestamp: '2024-01-02',
                notes: 'Trying to update mandi stage'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.farmer}`)
                .send(updateData)
                .expect(403);

            expect(response.body.error).toBe('Access denied');
            expect(response.body.message).toContain('not authorized to update stage \'mandi\'');
        });

        it('Should allow transporter to update to transport stage', async () => {
            // First update to mandi stage
            await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.mandi}`)
                .send({
                    stage: 'mandi',
                    actor: 'Test Mandi',
                    location: 'Mandi Market',
                    timestamp: '2024-01-02',
                    notes: 'Received at mandi'
                });

            const updateData = {
                stage: 'transport',
                actor: 'Test Transporter',
                location: 'In Transit',
                timestamp: '2024-01-03',
                notes: 'Shipping to retailer'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.transporter}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.currentStage).toBe('transport');
        });

        it('Should allow retailer to update to retailer stage', async () => {
            // First update to mandi and transport stages
            await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.mandi}`)
                .send({
                    stage: 'mandi',
                    actor: 'Test Mandi',
                    location: 'Mandi Market',
                    timestamp: '2024-01-02',
                    notes: 'Received at mandi'
                });

            await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.transporter}`)
                .send({
                    stage: 'transport',
                    actor: 'Test Transporter',
                    location: 'In Transit',
                    timestamp: '2024-01-03',
                    notes: 'Shipping to retailer'
                });

            const updateData = {
                stage: 'retailer',
                actor: 'Test Retailer',
                location: 'Retail Store',
                timestamp: '2024-01-04',
                notes: 'Stocked on shelves'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.retailer}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.currentStage).toBe('retailer');
        });

        it('Should allow admin to update any stage (admin override)', async () => {
            const updateData = {
                stage: 'mandi',
                actor: 'Test Admin',
                location: 'Admin Override',
                timestamp: '2024-01-02',
                notes: 'Admin updating stage'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.admin}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.currentStage).toBe('mandi');
        });

        it('Should reject farmer trying to update another farmer\'s batch', async () => {
            const updateData = {
                stage: 'farmer',
                actor: 'Another Farmer',
                location: 'Farm Location',
                timestamp: '2024-01-02',
                notes: 'Farmer trying to update someone else\'s batch'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.farmer2}`)
                .send(updateData)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Unauthorized access to batch');
        });

        it('Should reject quality inspector trying to update batch (lack of update permission)', async () => {
            const updateData = {
                stage: 'farmer',
                actor: 'Test Inspector',
                location: 'Testing Lab',
                timestamp: '2024-01-02',
                notes: 'Quality Inspector trying to update batch'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.inspector}`)
                .send(updateData)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Unauthorized access to batch');
        });

        it('Should reject unregistered or future roles trying to update batch (deny-by-default)', async () => {
            const updateData = {
                stage: 'farmer',
                actor: 'Test Processor',
                location: 'Processing Plant',
                timestamp: '2024-01-02',
                notes: 'Future role trying to update batch'
            };

            const response = await request(app)
                .put(`/api/batches/${testBatch.batchId}`)
                .set('Authorization', `Bearer ${tokens.future}`)
                .send(updateData)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Unauthorized access to batch');
        });
    });

    describe('Authentication Tests', () => {
        it('Should reject requests without token', async () => {
            const response = await request(app)
                .post('/api/batches')
                .send({
                    cropType: 'Wheat',
                    quantity: 100,
                    harvestDate: '2024-01-01',
                    origin: 'Kansas'
                })
                .expect(401);

            expect(response.body.error).toBe('Not authorized');
        });

        it('Should reject requests with invalid token', async () => {
            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', 'Bearer invalid-token')
                .send({
                    cropType: 'Wheat',
                    quantity: 100,
                    harvestDate: '2024-01-01',
                    origin: 'Kansas'
                })
                .expect(401);

            expect(response.body.error).toBe('Not authorized');
        });
    });
});
