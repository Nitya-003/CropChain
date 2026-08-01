process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";

const request = require("supertest");

const mockBatch = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

let mockCurrentUser = { id: "FARM123", name: "Test Farmer", role: "farmer" };

jest.mock("../middleware/auth", () => ({
  protect: jest.fn((req, res, next) => {
    req.user = mockCurrentUser;
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
  checkBatchSafetyStatus: jest.fn((req, res, next) => next()),
}));

// Mock Mongoose
jest.mock("mongoose", () => {
  const Schema = jest.fn().mockImplementation(() => {
    return {
      index: jest.fn(),
      virtual: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
      }),
      set: jest.fn(),
      pre: jest.fn(),
      post: jest.fn(),
      methods: {},
      statics: {},
    };
  });
  Schema.Types = {
    ObjectId: "ObjectId",
    String: "String",
    Number: "Number",
    Date: "Date",
    Boolean: "Boolean",
  };

  const mMongoose = {
    Schema: Schema,
    model: jest.fn((name) => {
      if (name === "Batch") return mockBatch;
      return {
        findOne: jest.fn(),
        create: jest.fn(),
        find: jest.fn(),
        findOneAndUpdate: jest.fn(),
      };
    }),
    connect: jest.fn(),
    startSession: jest.fn().mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
    connection: {
      host: "localhost",
      readyState: 1,
      close: jest.fn(),
    },
  };
  return mMongoose;
});

jest.mock("../models/Batch", () => mockBatch);

const app = require("../server");

describe("Crop Lifecycle API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { id: "FARM123", name: "Test Farmer", role: "farmer" };
  });

  it("should get lifecycle progress and auto-initialize it if not present", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      farmerName: "Test Farmer",
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    const res = await request(app).get("/api/batches/BATCH123/lifecycle");

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentStage).toEqual("Registered");
    expect(res.body.data.completionPercentage).toEqual(17);
    expect(res.body.data.stageHistory[0].stage).toEqual("Registered");
  });

  it("should allow a valid sequential transition from Registered to Growing", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      lifecycle: {
        currentStage: "Registered",
        stageHistory: [
          { stage: "Registered", timestamp: new Date(), updatedBy: "System" },
        ],
      },
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: "Growing", notes: "Growing well" });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentStage).toEqual("Growing");
    expect(res.body.data.completionPercentage).toEqual(33);
  });

  it("should prevent duplicate transitions to the current stage", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      lifecycle: {
        currentStage: "Growing",
        stageHistory: [
          { stage: "Registered", timestamp: new Date(), updatedBy: "System" },
          { stage: "Growing", timestamp: new Date(), updatedBy: "System" },
        ],
      },
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: "Growing" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("already in");
  });

  it("should prevent skipping stages (e.g. Registered -> Quality Checked)", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      lifecycle: {
        currentStage: "Registered",
        stageHistory: [
          { stage: "Registered", timestamp: new Date(), updatedBy: "System" },
        ],
      },
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: "Quality Checked" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Skipping stages is not allowed");
  });

  it("should prevent reverting to previous stages (e.g. Growing -> Registered)", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      lifecycle: {
        currentStage: "Growing",
        stageHistory: [
          { stage: "Registered", timestamp: new Date(), updatedBy: "System" },
          { stage: "Growing", timestamp: new Date(), updatedBy: "System" },
        ],
      },
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: "Registered" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Reverting");
  });

  it("should block update by unauthorized role (e.g. Farmer to Transported)", async () => {
    const testBatch = {
      batchId: "BATCH123",
      farmerId: "FARM123",
      currentStage: "mandi",
      lifecycle: {
        currentStage: "Harvested",
        stageHistory: [
          { stage: "Registered", timestamp: new Date(), updatedBy: "System" },
          { stage: "Growing", timestamp: new Date(), updatedBy: "System" },
          { stage: "Harvested", timestamp: new Date(), updatedBy: "System" },
        ],
      },
      save: jest.fn().mockResolvedValue(true),
    };
    mockBatch.findOne.mockResolvedValue(testBatch);

    // Wait, the next stage from Harvested is Quality Checked (which requires quality inspector or admin)
    // If a transporter tries to update to Quality Checked, or a farmer tries to update to Quality Checked:
    mockCurrentUser = { id: "FARM123", name: "Test Farmer", role: "farmer" };

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: "Quality Checked" });

    expect(res.statusCode).toEqual(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("is not authorized to update");
  });

  it("should reject lifecycle advance to Transported when supply chain is still farmer", async () => {
    const testBatch = {
      batchId: 'BATCH123',
      farmerId: 'FARM123',
      currentStage: 'farmer',
      lifecycle: {
        currentStage: 'Quality Checked',
        stageHistory: [
          { stage: 'Registered', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Growing', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Harvested', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Quality Checked', timestamp: new Date(), updatedBy: 'Inspector' }
        ]
      },
      save: jest.fn().mockResolvedValue(true)
    };
    mockBatch.findOne.mockResolvedValue(testBatch);
    mockCurrentUser = { id: 'FARM123', name: 'Test Transporter', role: 'transporter' };

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: 'Transported' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("supply chain must reach at least");
  });

  it("should reject lifecycle advance to Delivered when supply chain is still transport", async () => {
    const testBatch = {
      batchId: 'BATCH123',
      farmerId: 'FARM123',
      currentStage: 'transport',
      lifecycle: {
        currentStage: 'Transported',
        stageHistory: [
          { stage: 'Registered', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Growing', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Harvested', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Quality Checked', timestamp: new Date(), updatedBy: 'Inspector' },
          { stage: 'Transported', timestamp: new Date(), updatedBy: 'Transporter' }
        ]
      },
      save: jest.fn().mockResolvedValue(true)
    };
    mockBatch.findOne.mockResolvedValue(testBatch);
    mockCurrentUser = { id: 'FARM123', name: 'Test Retailer', role: 'retailer' };

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: 'Delivered' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("supply chain must reach at least");
  });

  it("should allow lifecycle advance to Transported when supply chain is at transport", async () => {
    const testBatch = {
      batchId: 'BATCH123',
      farmerId: 'FARM123',
      currentStage: 'transport',
      lifecycle: {
        currentStage: 'Quality Checked',
        stageHistory: [
          { stage: 'Registered', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Growing', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Harvested', timestamp: new Date(), updatedBy: 'System' },
          { stage: 'Quality Checked', timestamp: new Date(), updatedBy: 'Inspector' }
        ]
      },
      save: jest.fn().mockResolvedValue(true)
    };
    mockBatch.findOne.mockResolvedValue(testBatch);
    mockCurrentUser = { id: 'FARM123', name: 'Test Transporter', role: 'transporter' };

    const res = await request(app)
      .patch("/api/batches/BATCH123/lifecycle")
      .send({ stage: 'Transported' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });
});
