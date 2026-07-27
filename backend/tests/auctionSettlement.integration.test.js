const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const mockCreateInAppNotification = jest.fn();
const mockSendEmail = jest.fn();
const mockSocketEmit = jest.fn();
const mockGlobalEmit = jest.fn();
const mockGetIO = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("../services/notificationService", () => ({
  createInAppNotification: mockCreateInAppNotification,
  sendEmail: mockSendEmail,
}));

jest.mock("../services/socketService", () => ({
  getIO: mockGetIO,
}));

jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: mockLoggerError,
  warn: jest.fn(),
}));

const Auction = require("../models/Auction");
const { settleExpiredAuctions } = require("../jobs/auctionSettlement");

jest.setTimeout(180000);

describe("auction settlement transaction integration", () => {
  let replSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [{ launchTimeout: 60000 }],
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(replSet.getUri(), {
      dbName: "auction-settlement-test",
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    jest.clearAllMocks();
    mockCreateInAppNotification.mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ success: true });
    mockGetIO.mockReturnValue({
      to: jest.fn(() => ({ emit: mockSocketEmit })),
      emit: mockGlobalEmit,
    });
  });

  it("settles one real auction exactly once across concurrent workers", async () => {
    const farmerId = new mongoose.Types.ObjectId();
    const buyerId = new mongoose.Types.ObjectId();
    const batchObjectId = new mongoose.Types.ObjectId();

    await mongoose.connection.collection("users").insertMany([
      {
        _id: farmerId,
        name: "Farmer One",
        email: "farmer@example.com",
        balance: 100,
      },
      {
        _id: buyerId,
        name: "Buyer One",
        email: "buyer@example.com",
        balance: 500,
      },
    ]);

    await mongoose.connection.collection("batches").insertOne({
      _id: batchObjectId,
      batchId: "BATCH-REAL-100",
      currentStage: "farmer",
      updates: [],
    });

    const auction = await Auction.create({
      cropId: batchObjectId,
      batchId: "BATCH-REAL-100",
      farmerId,
      startPrice: 100,
      currentHighestBid: 125,
      highestBidder: buyerId,
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() - 1000),
      status: "active",
    });

    await Promise.all([settleExpiredAuctions(), settleExpiredAuctions()]);

    const [settledAuction, farmer, batch] = await Promise.all([
      Auction.findById(auction._id).lean(),
      mongoose.connection.collection("users").findOne({ _id: farmerId }),
      mongoose.connection.collection("batches").findOne({ _id: batchObjectId }),
    ]);

    expect(settledAuction.status).toBe("ended");
    expect(settledAuction.settledAt).toBeInstanceOf(Date);
    expect(farmer.balance).toBe(225);
    expect(batch.currentStage).toBe("mandi");
    expect(batch.updates).toHaveLength(1);
    expect(batch.updates[0]).toEqual(
      expect.objectContaining({
        stage: "mandi",
        actor: "Buyer One",
      }),
    );

    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(2);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(
      mockSocketEmit.mock.calls.filter(([event]) => event === "auction_ended"),
    ).toHaveLength(1);
    expect(
      mockSocketEmit.mock.calls.filter(([event]) => event === "batch-updated"),
    ).toHaveLength(1);
    expect(
      mockGlobalEmit.mock.calls.filter(
        ([event]) => event === "batch-stage-changed",
      ),
    ).toHaveLength(1);
  });
});
