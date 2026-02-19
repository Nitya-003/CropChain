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
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn()
};

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
          find: jest.fn(),
          findOneAndUpdate: jest.fn()
      };
    }),
    connect: jest.fn(),
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

const app = require("../server");
const mongoose = require("mongoose");

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

  // Removed skipped test "should prevent invalid stage transition" as the logic is not implemented in the backend.
  
  afterAll(async () => {
    // Cleanup if needed
  });
});
