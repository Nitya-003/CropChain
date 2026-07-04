const mockAuctionFind = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();
const mockBatchFindById = jest.fn();
const mockCreateInAppNotification = jest.fn();
const mockSendEmail = jest.fn();
const mockGetIO = jest.fn();

jest.mock("../models/Auction", () => ({
  find: mockAuctionFind,
}));

jest.mock("../models/User", () => ({
  findById: mockUserFindById,
  findByIdAndUpdate: mockUserFindByIdAndUpdate,
}));

jest.mock("../models/Batch", () => ({
  findById: mockBatchFindById,
}));

jest.mock("../services/socketService", () => ({
  getIO: mockGetIO,
}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock("../services/notificationService", () => ({
  createInAppNotification: mockCreateInAppNotification,
  sendEmail: mockSendEmail,
}));

const { settleExpiredAuctions } = require("../jobs/auctionSettlement");

describe("settleExpiredAuctions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks the auction as ended and notifies the winner and farmer when a bid exists", async () => {
    const auction = {
      _id: "auction-1",
      batchId: "BATCH-100",
      farmerId: "farmer-1",
      highestBidder: "buyer-1",
      currentHighestBid: 125,
      status: "active",
      endTime: new Date(Date.now() - 1000),
      save: jest.fn().mockResolvedValue(true),
    };

    mockAuctionFind.mockResolvedValue([auction]);
    mockUserFindById
      .mockResolvedValueOnce({
        _id: "farmer-1",
        name: "Farmer One",
        email: "farmer@example.com",
      })
      .mockResolvedValueOnce({
        _id: "buyer-1",
        name: "Buyer One",
        email: "buyer@example.com",
      });
    mockUserFindByIdAndUpdate.mockResolvedValue({});
    mockBatchFindById.mockResolvedValue({
      _id: "batch-1",
      batchId: "BATCH-100",
      currentStage: "farmer",
      updates: [],
      save: jest.fn().mockResolvedValue(true),
    });
    mockGetIO.mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    });

    await settleExpiredAuctions();

    expect(auction.status).toBe("ended");
    expect(auction.save).toHaveBeenCalled();
    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith("farmer-1", {
      $inc: { balance: 125 },
    });
    expect(mockCreateInAppNotification).toHaveBeenCalledWith(
      "buyer-1",
      "Auction Won",
      expect.stringContaining("won the auction"),
      "auction",
      expect.objectContaining({ auctionId: "auction-1" }),
    );
    expect(mockCreateInAppNotification).toHaveBeenCalledWith(
      "farmer-1",
      "Auction Sold",
      expect.stringContaining("sold for 125 credits"),
      "auction",
      expect.objectContaining({ auctionId: "auction-1", finalPrice: 125 }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("does not try to notify when no highest bidder exists", async () => {
    const auction = {
      _id: "auction-2",
      batchId: "BATCH-101",
      farmerId: "farmer-2",
      highestBidder: null,
      currentHighestBid: 100,
      status: "active",
      endTime: new Date(Date.now() - 1000),
      save: jest.fn().mockResolvedValue(true),
    };

    mockAuctionFind.mockResolvedValue([auction]);
    mockUserFindById.mockResolvedValue({
      _id: "farmer-2",
      name: "Farmer Two",
      email: "farmer2@example.com",
    });
    mockBatchFindById.mockResolvedValue({
      _id: "batch-2",
      batchId: "BATCH-101",
      currentStage: "farmer",
      updates: [],
      save: jest.fn().mockResolvedValue(true),
    });
    mockGetIO.mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    });

    await settleExpiredAuctions();

    expect(auction.status).toBe("ended");
    expect(mockCreateInAppNotification).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
