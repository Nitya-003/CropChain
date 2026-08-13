process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret";
jest.setTimeout(20000);

const request = require("supertest");

// Mock dependencies
jest.mock("../services/spoilageDetectionService", () => ({
  recordIoTData: jest.fn(),
  getIoTData: jest.fn(),
}));

jest.mock("../services/activityService", () => ({
  logActivity: jest.fn(),
}));

// Mock auth middleware to pass through
jest.mock("../middleware/auth", () => ({
  protect: jest.fn((req, res, next) => {
    req.user = { id: "USER123", role: "transporter" };
    next();
  }),
  authorizeStageTransition: jest.fn((req, res, next) => next()),
  requirePermissions: jest.fn(() => (req, res, next) => next()),
  authorizeRoles: jest.fn(() => (req, res, next) => next()),
  adminOnly: jest.fn((req, res, next) => next()),
  verifiedOnly: jest.fn((req, res, next) => next()),
  authorizeBatchOwner: jest.fn((req, res, next) => next()),
  authorizeBlockchainTransaction: jest.fn((req, res, next) => next()),
  requireAllPermissions: jest.fn(() => (req, res, next) => next()),
  inspectorOnly: jest.fn((req, res, next) => next()),
  requireMultisigOrAdmin: jest.fn(() => (req, res, next) => next()),
  checkBatchSafetyStatus: jest.fn((req, res, next) => next()),
  authorizeIoTSubmission: jest.fn((req, res, next) => next()),
}));

// Mock Mongoose Counter
jest.mock("../models/Counter", () => ({
  findOneAndUpdate: jest.fn(),
}));

// Mock Mongoose Batch Model
jest.mock("../models/Batch", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const app = require("../app");
const spoilageDetectionService = require("../services/spoilageDetectionService");
const activityService = require("../services/activityService");

describe("IoT Controller Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/batches/:batchId/iot", () => {
    test("successfully records IoT data and returns 200", async () => {
      const mockBatch = {
        batchId: "BATCH-123",
        cropType: "wheat",
        iotData: {
          currentTemperature: 22,
          currentHumidity: 45,
          isSpoiled: false,
          lastUpdated: new Date().toISOString(),
        },
      };

      spoilageDetectionService.recordIoTData.mockResolvedValue(mockBatch);
      activityService.logActivity.mockResolvedValue(true);

      const response = await request(app)
        .post("/api/batches/BATCH-123/iot")
        .send({
          temperature: 22,
          humidity: 45,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.batchId).toBe("BATCH-123");
      expect(response.body.data.currentTemperature).toBe(22);
      expect(response.body.data.currentHumidity).toBe(45);
      expect(response.body.data.isSpoiled).toBe(false);

      expect(spoilageDetectionService.recordIoTData).toHaveBeenCalledWith(
        "BATCH-123",
        22,
        45
      );
      expect(activityService.logActivity).toHaveBeenCalled();
    });

    test("returns 400 for invalid payload", async () => {
      const response = await request(app)
        .post("/api/batches/BATCH-123/iot")
        .send({
          temperature: "hot", // invalid
          humidity: 45,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Validation failed");
    });
    
    test("returns 404 if batch not found", async () => {
      const notFoundError = new Error("Batch not found");
      notFoundError.statusCode = 404;
      spoilageDetectionService.recordIoTData.mockRejectedValue(notFoundError);

      const response = await request(app)
        .post("/api/batches/MISSING-BATCH/iot")
        .send({
          temperature: 22,
          humidity: 45,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Batch not found");
    });

    test("returns 500 on internal server error", async () => {
      spoilageDetectionService.recordIoTData.mockRejectedValue(new Error("Database failure"));

      const response = await request(app)
        .post("/api/batches/BATCH-123/iot")
        .send({
          temperature: 22,
          humidity: 45,
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to record IoT data");
    });
  });

  describe("GET /api/batches/:batchId/iot", () => {
    test("successfully retrieves IoT data", async () => {
      const mockIoTData = {
        batchId: "BATCH-123",
        cropType: "wheat",
        currentTemperature: 22,
        currentHumidity: 45,
        isSpoiled: false,
        telemetryHistory: []
      };

      spoilageDetectionService.getIoTData.mockResolvedValue(mockIoTData);

      const response = await request(app).get("/api/batches/BATCH-123/iot");

      expect(response.status).toBe(200);
      expect(response.body.data.currentTemperature).toBe(22);
    });

    test("returns 404 if batch not found", async () => {
      const notFoundError = new Error("Batch not found");
      notFoundError.statusCode = 404;
      spoilageDetectionService.getIoTData.mockRejectedValue(notFoundError);

      const response = await request(app).get("/api/batches/MISSING-BATCH/iot");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Batch not found");
    });

    test("returns 500 on internal server error", async () => {
      spoilageDetectionService.getIoTData.mockRejectedValue(new Error("Database failure"));

      const response = await request(app).get("/api/batches/BATCH-123/iot");

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Failed to retrieve IoT data");
    });
  });
});
