process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require("supertest");

// Mocks must be defined before requiring app
const mockCounter = {
  findOneAndUpdate: jest.fn()
};

const mockBatch = {
  create: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn()
};

const mockUser = {
    findOne: jest.fn(),
    create: jest.fn()
};

jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = { id: 'FARM123', name: 'Test Farmer', role: 'farmer' };
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

// Mock Mongoose
jest.mock('mongoose', () => {
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

  const mMongoose = {
    Schema: Schema,
    model: jest.fn((name) => {
      if (name === 'Counter') return mockCounter;
      if (name === 'Batch') return mockBatch;
      if (name === 'User') return mockUser;
      return {
          findOne: jest.fn(),
          create: jest.fn(),
          find: jest.fn(),
          findOneAndUpdate: jest.fn()
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
  return mMongoose;
});

jest.mock('../models/Counter', () => mockCounter);
jest.mock('../models/Batch', () => mockBatch);
jest.mock('../models/User', () => mockUser);
jest.mock('../utils/shutdown', () => ({
  gracefulShutdown: jest.fn()
}));

const app = require("../server");
const mongoose = require("mongoose");
const { protect } = require('../middleware/auth');

describe("Batch API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCounter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
    mockBatch.create.mockImplementation((data) => Promise.resolve(data));
    mockBatch.findOne.mockResolvedValue(null); // Default not found
  });

  it("should return 400 if quantity is negative", async () => {
    const res = await request(app).post("/api/batches").send({
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      farmerAddress: "123 Green Lane",
      cropType: "rice",
      quantity: -50, // This is the invalid data 
      harvestDate: "2024-01-01",
      origin: "Test Origin",
    });

    expect(res.statusCode).toEqual(400);
    // Based on middleware/validator.js logic
    // expect(res.body.success).toBe(false);
  });

  it("should create a valid batch", async () => {
    const res = await request(app).post("/api/batches").send({
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      farmerAddress: "123 Green Lane",
      cropType: "rice",
      quantity: 50,
      harvestDate: "2024-01-01",
      origin: "Test Origin",
      description: "Good rice"
    });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.batch).toBeDefined();
    expect(res.body.data.batch).toHaveProperty("batchId");
  });

  it("should return safe public tracking data without authentication", async () => {
    mockBatch.findOne.mockResolvedValue({
      toJSON: () => ({
        _id: 'mongo-internal-id',
        batchId: 'BATCH000001',
        farmerId: 'FARM123',
        farmerName: 'Test Farmer',
        farmerAddress: '123 Private Farm Lane',
        farmerWalletAddress: '0xprivatewallet',
        cropType: 'rice',
        quantity: 50,
        harvestDate: '2024-01-01T00:00:00.000Z',
        origin: 'Test Origin',
        certifications: 'Organic',
        description: 'Good rice',
        createdAt: '2024-01-02T00:00:00.000Z',
        currentStage: 'farmer',
        status: 'Active',
        isRecalled: false,
        qrCode: 'data:image/png;base64,qr',
        blockchainHash: '0xprivatehash',
        syncStatus: 'pending',
        pendingApprovalId: 'approval-1',
        approvalHistory: [{ requestId: 'approval-1' }],
        updates: [{
          _id: 'update-internal-id',
          stage: 'farmer',
          actor: 'Test Farmer',
          location: 'Test Origin',
          timestamp: '2024-01-01T00:00:00.000Z',
          notes: 'Initial harvest recorded'
        }],
        currentTemperature: 72,
        currentHumidity: 65,
        isSpoiled: false,
        iotTimestamp: '2024-01-03T00:00:00.000Z',
        spoilageRisk: {
          riskLevel: 'Low',
          riskScore: 10,
          factors: ['stable temperature'],
          predictedAt: '2024-01-03T00:00:00.000Z'
        }
      })
    });

    const res = await request(app).get('/api/batches/public/BATCH000001');

    expect(res.statusCode).toEqual(200);
    expect(protect).not.toHaveBeenCalled();
    expect(mockBatch.findOne).toHaveBeenCalledWith({ batchId: 'BATCH000001' });
    expect(res.body.data.batch).toMatchObject({
      batchId: 'BATCH000001',
      farmerName: 'Test Farmer',
      cropType: 'rice',
      quantity: 50,
      origin: 'Test Origin',
      currentStage: 'farmer',
      status: 'Active',
      qrCode: 'data:image/png;base64,qr'
    });
    expect(res.body.data.batch).not.toHaveProperty('_id');
    expect(res.body.data.batch).not.toHaveProperty('farmerId');
    expect(res.body.data.batch).not.toHaveProperty('farmerAddress');
    expect(res.body.data.batch).not.toHaveProperty('farmerWalletAddress');
    expect(res.body.data.batch).not.toHaveProperty('blockchainHash');
    expect(res.body.data.batch).not.toHaveProperty('syncStatus');
    expect(res.body.data.batch).not.toHaveProperty('pendingApprovalId');
    expect(res.body.data.batch).not.toHaveProperty('approvalHistory');
    expect(res.body.data.batch.updates[0]).not.toHaveProperty('_id');
    expect(res.body.data.batch.updates[0]).not.toHaveProperty('notes');
  });

  it("should return 404 for a missing public tracking batch", async () => {
    mockBatch.findOne.mockResolvedValue(null);

    const res = await request(app).get('/api/batches/public/MISSING001');

    expect(res.statusCode).toEqual(404);
    expect(protect).not.toHaveBeenCalled();
  });

  it("should return 400 for an invalid public tracking batch ID", async () => {
    const res = await request(app).get('/api/batches/public/%20');

    expect(res.statusCode).toEqual(400);
    expect(mockBatch.findOne).not.toHaveBeenCalled();
    expect(protect).not.toHaveBeenCalled();
  });

  it("should keep the existing batch detail route protected", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'farmer',
      isRecalled: false,
      updates: []
    });

    const res = await request(app).get('/api/batches/BATCH000001');

    expect(res.statusCode).toEqual(200);
    expect(protect).toHaveBeenCalled();
  });

  it("should allow a valid stage transition (farmer -> mandi)", async () => {
    const farmerBatch = {
      batchId: 'BATCH000001',
      currentStage: 'farmer',
      isRecalled: false,
      updates: []
    };
    mockBatch.findOne.mockResolvedValue(farmerBatch);
    mockBatch.findOneAndUpdate.mockResolvedValue({
      ...farmerBatch,
      currentStage: 'mandi',
      updates: [{ stage: 'mandi', actor: 'Mandi Worker', location: 'Mandi Center', timestamp: new Date().toISOString(), notes: 'Arrived at mandi' }]
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'mandi',
      actor: 'Mandi Worker',
      location: 'Mandi Center',
      timestamp: new Date().toISOString(),
      notes: 'Arrived at mandi'
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 400 for skipped stage transition (farmer -> retailer)", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'farmer',
      isRecalled: false
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'retailer',
      actor: 'Test Actor',
      location: 'Test Location',
      timestamp: new Date().toISOString()
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid stage transition');
  });

  it("should return 400 for backwards stage transition (mandi -> farmer)", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'mandi',
      isRecalled: false
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'farmer',
      actor: 'Test Actor',
      location: 'Test Location',
      timestamp: new Date().toISOString()
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid stage transition');
  });

  it("should return 400 for same-stage update", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'farmer',
      isRecalled: false
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'farmer',
      actor: 'Test Actor',
      location: 'Test Location',
      timestamp: new Date().toISOString()
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('already at stage');
  });

  it("should return 400 for updating a recalled batch", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'farmer',
      isRecalled: true
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'mandi',
      actor: 'Test Actor',
      location: 'Test Location',
      timestamp: new Date().toISOString()
    });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('recalled');
  });

  it("should allow transport -> retailer transition", async () => {
    mockBatch.findOne.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'transport',
      isRecalled: false,
      updates: [{ stage: 'farmer' }, { stage: 'mandi' }, { stage: 'transport' }]
    });
    mockBatch.findOneAndUpdate.mockResolvedValue({
      batchId: 'BATCH000001',
      currentStage: 'retailer',
      isRecalled: false
    });

    const res = await request(app).put('/api/batches/BATCH000001').send({
      stage: 'retailer',
      actor: 'Retailer Worker',
      location: 'Retail Store',
      timestamp: new Date().toISOString(),
      notes: 'Received at retail'
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    // Cleanup if needed
  });
});
