process.env.NODE_ENV = "test";

const mockBatch = {
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
};

jest.mock("../models/Batch", () => mockBatch);
jest.mock("../models/Counter", () => ({
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../services/blockchainService", () => ({}));
jest.mock("../services/blockchainQueue", () => ({}));
jest.mock("../services/notificationService", () => ({}));
jest.mock("../services/socketService", () => ({
  emitToBatchRoom: jest.fn(),
  emitGlobal: jest.fn(),
}));
jest.mock("../services/activityService", () => ({}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const batchService = require("../services/batchService");

describe("BatchService statistics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts unique farmers with aggregation instead of the limited result set", async () => {
    const queryChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          batchId: "BATCH001",
          farmerId: "FARM1",
          farmerName: "Farmer One",
          quantity: 10,
        },
        {
          batchId: "BATCH002",
          farmerId: "FARM1",
          farmerName: "Farmer One",
          quantity: 20,
        },
      ]),
    };

    mockBatch.find.mockReturnValue(queryChain);
    mockBatch.countDocuments
      .mockResolvedValueOnce(125)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(12);
    mockBatch.aggregate.mockResolvedValue([
      {
        _id: null,
        totalFarmers: ["FARM1", "FARM2", "FARM3", "FARM4", "FARM5"],
        totalQuantity: 500,
      },
    ]);

    const result = await batchService.getAllBatches(2);

    expect(mockBatch.aggregate).toHaveBeenCalledWith([
      {
        $group: {
          _id: null,
          totalFarmers: { $addToSet: "$farmerId" },
          totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
        },
      },
    ]);
    expect(result.stats.totalBatches).toBe(125);
    expect(result.stats.totalFarmers).toBe(5);
    expect(result.stats.totalQuantity).toBe(500);
  });
});
