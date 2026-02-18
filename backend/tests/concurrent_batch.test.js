process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const crypto = require('crypto');

// Mock Mongoose models
const mockCounter = {
  findOneAndUpdate: jest.fn()
};

const mockBatch = {
  create: jest.fn(),
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn()
};

// Mock other models that might be loaded
const mockUser = {
    findOne: jest.fn(),
    create: jest.fn()
};

// Mock Mongoose
jest.mock('mongoose', () => {
  const Schema = jest.fn();
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
          find: jest.fn()
      };
    }),
    connect: jest.fn(),
    connection: {
      host: 'localhost'
    }
  };
  return mMongoose;
});

// Also mock the models directly if they are required before mocking mongoose
jest.mock('../models/Counter', () => mockCounter);
jest.mock('../models/Batch', () => mockBatch);

// We need to require server.js AFTER mocking mongoose
const app = require('../server');

describe('Issue #100 Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Race Condition Fix', () => {
    it('should use atomic counter for batch ID generation', async () => {
      // Setup mock return values for sequential calls
      mockCounter.findOneAndUpdate
        .mockResolvedValueOnce({ seq: 1 })
        .mockResolvedValueOnce({ seq: 2 })
        .mockResolvedValueOnce({ seq: 3 });

      // Mock Batch.create to resolve successfully
      mockBatch.create.mockImplementation((data) => Promise.resolve(data));

      const createBatchData = {
        farmerId: 'farmer123',
        farmerName: 'John Doe',
        farmerAddress: '123 Farm Lane, Village',
        cropType: 'rice',
        quantity: 100,
        harvestDate: new Date().toISOString(),
        origin: 'Farm Location A',
        certifications: 'Organic',
        description: 'First harvest of the season'
      };

      // Send 3 concurrent requests
      const reqs = [
        request(app).post('/api/batches').send(createBatchData),
        request(app).post('/api/batches').send(createBatchData),
        request(app).post('/api/batches').send(createBatchData)
      ];

      const responses = await Promise.all(reqs);

      // Verify all succeeded
      responses.forEach(res => {
        if (res.status !== 201) {
            console.error('Request failed:', res.body);
        }
        expect(res.status).toBe(201);
      });

      // Verify atomic counter was called 3 times
      expect(mockCounter.findOneAndUpdate).toHaveBeenCalledTimes(3);

      // Verify the arguments to findOneAndUpdate
      // This confirms we are using the atomic operation
      expect(mockCounter.findOneAndUpdate).toHaveBeenCalledWith(
        { name: 'batchId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      // Verify batch IDs generated in the mocked create calls
      const createCalls = mockBatch.create.mock.calls;
      expect(createCalls.length).toBe(3);

      const batchIds = createCalls.map(call => call[0].batchId);
      expect(batchIds).toContain('CROP-2024-001');
      expect(batchIds).toContain('CROP-2024-002');
      expect(batchIds).toContain('CROP-2024-003');
    });
  });

  describe('Secure Hash Fix', () => {
    it('should generate a valid SHA-256 hash', async () => {
      mockCounter.findOneAndUpdate.mockResolvedValue({ seq: 10 });
      mockBatch.create.mockImplementation((data) => Promise.resolve(data));

      const createBatchData = {
        farmerId: 'farmer123',
        farmerName: 'John Doe',
        farmerAddress: '123 Farm Lane, Village',
        cropType: 'rice',
        quantity: 100,
        harvestDate: new Date().toISOString(),
        origin: 'Farm Location A',
        certifications: 'Organic',
        description: 'First harvest of the season'
      };

      const res = await request(app).post('/api/batches').send(createBatchData);

      expect(res.status).toBe(201);

      const createCall = mockBatch.create.mock.calls[0][0];
      expect(createCall.blockchainHash).toBeDefined();

      // SHA-256 hash is 64 hex characters. '0x' prefix makes it 66.
      expect(createCall.blockchainHash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });
});
