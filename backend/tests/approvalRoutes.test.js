process.env.NODE_ENV = "test";

const express = require("express");
const request = require("supertest");

const mockMultisigService = {
  getStatistics: jest.fn(),
  getRequestDetails: jest.fn(),
};

jest.mock("../services/multisigService", () => mockMultisigService);
jest.mock("../services/activityService", () => ({ logActivity: jest.fn() }));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../middleware/auth", () => ({
  protect: jest.fn((req, res, next) => {
    const role = req.get("x-test-role");
    if (!role) {
      return res.status(401).json({ error: "Not authorized" });
    }
    req.user = { _id: "user-1", role };
    next();
  }),
  adminOnly: jest.fn((req, res, next) => {
    if (req.user && ["admin", "super_admin"].includes(req.user.role)) {
      return next();
    }
    return res
      .status(403)
      .json({ error: "Access denied", message: "Admin access required" });
  }),
  inspectorOnly: jest.fn((req, res, next) => next()),
  requirePermissions: jest.fn(() => (req, res, next) => next()),
}));

const approvalRoutes = require("../routes/approvalRoutes");

const app = express();
app.use(express.json());
app.use("/api/approvals", approvalRoutes);

describe("Approval routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/approvals/stats", () => {
    it.each(["admin", "super_admin"])(
      "returns statistics for an authenticated %s",
      async (role) => {
        const statistics = { pending: 3, approved: 8, rejected: 2 };
        mockMultisigService.getStatistics.mockResolvedValue(statistics);

        const response = await request(app)
          .get("/api/approvals/stats")
          .set("x-test-role", role)
          .expect(200);

        expect(mockMultisigService.getStatistics).toHaveBeenCalledTimes(1);
        expect(mockMultisigService.getRequestDetails).not.toHaveBeenCalled();
        expect(response.body).toEqual({ success: true, data: statistics });
      },
    );

    it("rejects an unauthenticated request", async () => {
      await request(app).get("/api/approvals/stats").expect(401);

      expect(mockMultisigService.getStatistics).not.toHaveBeenCalled();
      expect(mockMultisigService.getRequestDetails).not.toHaveBeenCalled();
    });

    it("rejects an authenticated non-admin request", async () => {
      await request(app)
        .get("/api/approvals/stats")
        .set("x-test-role", "farmer")
        .expect(403);

      expect(mockMultisigService.getStatistics).not.toHaveBeenCalled();
      expect(mockMultisigService.getRequestDetails).not.toHaveBeenCalled();
    });
  });

  it("GET /api/approvals/:requestId still returns request details", async () => {
    const approval = {
      requestId: "request-123",
      initiatedBy: { _id: "user-1" },
    };
    mockMultisigService.getRequestDetails.mockResolvedValue(approval);

    const response = await request(app)
      .get("/api/approvals/request-123")
      .set("x-test-role", "farmer")
      .expect(200);

    expect(mockMultisigService.getRequestDetails).toHaveBeenCalledWith(
      "request-123",
    );
    expect(mockMultisigService.getStatistics).not.toHaveBeenCalled();
    expect(response.body).toEqual({ success: true, data: approval });
  });
});
