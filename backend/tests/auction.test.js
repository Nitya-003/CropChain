process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";

const request = require("supertest");

const mockAuction = jest.fn();
mockAuction.create = jest.fn();
mockAuction.find = jest.fn();
mockAuction.findById = jest.fn();
mockAuction.findOne = jest.fn();
mockAuction.findOneAndUpdate = jest.fn();

const mockBid = {
  find: jest.fn(),
};

const mockBatch = {
  findOne: jest.fn(),
  findById: jest.fn(),
};

const mockUser = {
  findById: jest.fn(),
};

jest.mock("../middleware/auth", () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { id: "FARM123", name: "Test Farmer", role: "farmer" };
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

jest.mock("qrcode", () => ({
  toDataURL: jest
    .fn()
    .mockResolvedValue("data:image/png;base64,mockedQRCodeData"),
}));

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

  return {
    Schema: Schema,
    model: jest.fn((name) => {
      if (name === "Auction") return mockAuction;
      if (name === "Bid") return mockBid;
      if (name === "Batch") return mockBatch;
      if (name === "User") return mockUser;
    }),
    connect: jest.fn(),
    connection: { host: "localhost" },
  };
});

jest.mock("../models/Auction", () => mockAuction);
jest.mock("../models/Bid", () => mockBid);
jest.mock("../models/Batch", () => mockBatch);
jest.mock("../models/User", () => mockUser);

const app = require("../server");

describe("Auctions API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auctions", () => {
    it("should create a new auction successfully", async () => {
      const mockBatchDoc = {
        _id: "batch_obj_id",
        batchId: "CROP-2026-0001",
        farmerId: "FARM123",
        farmerName: "Test Farmer",
        currentStage: "farmer",
        quantity: 1000,
      };

      mockBatch.findOne.mockResolvedValue(mockBatchDoc);
      mockAuction.findOne.mockResolvedValue(null); // No active auction exists

      const saveMock = jest.fn().mockResolvedValue({
        _id: "auction_obj_id",
        batchId: "CROP-2026-0001",
        farmerId: "FARM123",
        startPrice: 500,
        currentHighestBid: 500,
        status: "active",
      });

      mockAuction.prototype.save = saveMock;
      mockAuction.mockImplementation(() => ({
        save: saveMock,
        _id: "auction_obj_id",
        batchId: "CROP-2026-0001",
        farmerId: "FARM123",
        startPrice: 500,
        currentHighestBid: 500,
        status: "active",
      }));

      const res = await request(app).post("/api/auctions").send({
        batchId: "CROP-2026-0001",
        startPrice: 500,
        duration: 5,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auction).toBeDefined();
    });

    it("should fail if batch does not exist", async () => {
      mockBatch.findOne.mockResolvedValue(null);

      const res = await request(app).post("/api/auctions").send({
        batchId: "INVALID_ID",
        startPrice: 500,
        duration: 5,
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auctions", () => {
    it("should retrieve all auctions", async () => {
      mockAuction.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: "auction_1",
              cropId: "batch_obj_id",
              batchId: "CROP-2026-0001",
              farmerId: "FARM123",
              startPrice: 500,
              currentHighestBid: 500,
              status: "active",
            },
          ]),
        }),
      });

      mockBatch.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            cropType: "rice",
            quantity: 1000,
            farmerName: "Test Farmer",
            origin: "Origin A",
          }),
        }),
      });

      mockUser.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            name: "Test Farmer",
          }),
        }),
      });

      const res = await request(app).get("/api/auctions");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auctions).toHaveLength(1);
      expect(res.body.data.auctions[0].batchDetails).toBeDefined();
    });
  });
});
