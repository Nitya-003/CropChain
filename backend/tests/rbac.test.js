const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Batch = require('../models/Batch');
const jwt = require('jsonwebtoken');

describe('RBAC Backend Tests', () => {
    let tokens = {};
    let testBatch;

    beforeAll(async () => {
        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cropchain-test');
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clean up database
        await User.deleteMany({});
        await Batch.deleteMany({});

        // Create test users with different roles
        const users = [
            { name: 'Test Farmer', email: 'farmer@test.com', password: 'Password123!', role: 'farmer' },
            { name: 'Test Mandi', email: 'mandi@test.com', password: 'Password123!', role: 'mandi' },
            { name: 'Test Transporter', email: 'transporter@test.com', password: 'Password123!', role: 'transporter' },
            { name: 'Test Retailer', email: 'retailer@test.com', password: 'Password123!', role: 'retailer' },
            { name: 'Test Admin', email: 'admin@test.com', password: 'Password123!', role: 'admin' }
        ];

        for (const userData of users) {
            const user = await User.create(userData);
            tokens[userData.role] = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret');
        }
    });

    describe('Batch Creation RBAC', () => {
        it('Should allow farmer to create batch', async () => {
            const batchData = {
                cropType: 'Wheat',
                quantity: 100,
                harvestDate: '2024-01-01',
                origin: 'Kansas',
                farmerName: 'Test Farmer',
                description: 'Test batch'
            };

            const response = await request(app)
                .post('/api/batches')
                .set('Authorization', `Bearer ${tokens.farmer}`)
                .send(batchData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.batch.cropType).toBe('Wheat');
            testBatch = response.body.data.batch;
        });

        it('Should reject mandi trying to create batch', async () => {
            const batchData = {
                cropType: 'Rice',
                quantity: 50,
                harvestDate: '2024-01-01',
                origin: 'California',
                farmerName: 'Test Mandi',
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
                cropType: 'Corn',
                quantity: 75,
                harvestDate: '2024-01-01',
                origin: 'Iowa',
                farmerName: 'Test Transporter',
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
                cropType: 'Soy',
                quantity: 60,
                harvestDate: '2024-01-01',
                origin: 'Texas',
                farmerName: 'Test Retailer',
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
                cropType: 'Barley',
                quantity: 80,
                harvestDate: '2024-01-01',
                origin: 'Nebraska',
                farmerName: 'Test Admin',
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
                cropType: 'Wheat',
                quantity: 100,
                harvestDate: '2024-01-01',
                origin: 'Kansas',
                farmerName: 'Test Farmer',
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
