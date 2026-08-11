const { ethers } = require("ethers");

const mockBatch = { updateOne: jest.fn(), findOne: jest.fn() };

jest.mock("../models/Batch", () => mockBatch);
jest.mock("../services/socketService", () => ({
  emitToBatchRoom: jest.fn(),
  emitGlobal: jest.fn(),
}));
jest.mock("../utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const socketService = require("../services/socketService");
const startListener = require("../services/blockchainListener");

const captureHandler = () => {
  const listeners = {};
  const handler = {
    on: (event, fn) => {
      listeners[event] = fn;
      return handler;
    },
  };
  startListener(handler);
  return listeners;
};

describe("Blockchain listener: BatchUpdated sync", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates the real batch using the decoded business ID, without upsert", async () => {
    const businessId = "CROP-2026-0001";
    const onChainId = ethers.encodeBytes32String(businessId);
    const listeners = captureHandler();

    mockBatch.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockBatch.findOne.mockImplementation(() => ({
      lean: async () => ({ batchId: businessId, currentStage: "mandi" }),
    }));

    await listeners.BatchUpdated(onChainId, 1, "0xabc");

    expect(mockBatch.updateOne).toHaveBeenCalledWith(
      { batchId: businessId },
      { currentStage: "mandi", syncStatus: "synced" },
    );
    expect(mockBatch.updateOne.mock.calls[0][2]).toBeUndefined();
    expect(socketService.emitToBatchRoom).toHaveBeenCalledWith(
      businessId,
      "batch-updated",
      expect.objectContaining({ batchId: businessId, stage: "mandi" }),
    );
    expect(socketService.emitGlobal).toHaveBeenCalled();
  });

  it("does not insert a malformed doc and skips broadcasts when batch is unknown", async () => {
    const listeners = captureHandler();
    mockBatch.updateOne.mockResolvedValue({ matchedCount: 0 });

    await listeners.BatchUpdated(
      ethers.encodeBytes32String("CROP-2026-9999"),
      2,
      "0xabc",
    );

    expect(mockBatch.updateOne.mock.calls[0][2]).toBeUndefined();
    expect(mockBatch.findOne).not.toHaveBeenCalled();
    expect(socketService.emitToBatchRoom).not.toHaveBeenCalled();
    expect(socketService.emitGlobal).not.toHaveBeenCalled();
  });
});
