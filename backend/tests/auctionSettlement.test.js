const mockStartSession = jest.fn();
const mockAuctionFindOneAndUpdate = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const mockBatchFindOneAndUpdate = jest.fn();
const mockCreateInAppNotification = jest.fn();
const mockSendEmail = jest.fn();
const mockGetIO = jest.fn();
const mockSocketEmit = jest.fn();
const mockGlobalEmit = jest.fn();

jest.mock("mongoose", () => ({
  startSession: mockStartSession,
}));

jest.mock("../models/Auction", () => ({
  findOneAndUpdate: mockAuctionFindOneAndUpdate,
}));

jest.mock("../models/User", () => ({
  findById: mockUserFindById,
  findOneAndUpdate: mockUserFindOneAndUpdate,
}));

jest.mock("../models/Batch", () => ({
  findOneAndUpdate: mockBatchFindOneAndUpdate,
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

const clone = (value) => structuredClone(value);

const replaceContents = (target, source) => {
  target.splice(0, target.length, ...clone(source));
};

describe("settleExpiredAuctions", () => {
  let auctions;
  let users;
  let batches;
  let failBatchIds;
  let sessions;

  const makeAuction = (overrides = {}) => ({
    _id: "auction-1",
    cropId: "batch-1",
    batchId: "BATCH-100",
    farmerId: "farmer-1",
    highestBidder: "buyer-1",
    currentHighestBid: 125,
    status: "active",
    endTime: new Date(Date.now() - 1000),
    settledAt: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auctions = [makeAuction()];
    users = [
      {
        _id: "farmer-1",
        name: "Farmer One",
        email: "farmer@example.com",
        balance: 100,
      },
      {
        _id: "buyer-1",
        name: "Buyer One",
        email: "buyer@example.com",
        balance: 500,
      },
    ];
    batches = [
      {
        _id: "batch-1",
        batchId: "BATCH-100",
        currentStage: "farmer",
        updates: [],
      },
    ];
    failBatchIds = new Set();
    sessions = [];

    mockStartSession.mockImplementation(async () => {
      const snapshot = {
        auctions: clone(auctions),
        users: clone(users),
        batches: clone(batches),
      };
      const session = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        dirty: false,
        withTransaction: jest.fn().mockImplementation(async (callback) => {
          try {
            const result = await callback();
            await session.commitTransaction();
            return result;
          } catch (error) {
            await session.abortTransaction();
            throw error;
          }
        }),
        abortTransaction: jest.fn().mockImplementation(async () => {
          if (session.dirty) {
            replaceContents(auctions, snapshot.auctions);
            replaceContents(users, snapshot.users);
            replaceContents(batches, snapshot.batches);
          }
        }),
        endSession: jest.fn(),
      };
      sessions.push(session);
      return session;
    });

    mockAuctionFindOneAndUpdate.mockImplementation(
      async (filter, update, options) => {
        let auction;
        if (filter.status === "active") {
          auction = auctions.find(
            (candidate) =>
              candidate.status === "active" &&
              candidate.endTime <= filter.endTime.$lte &&
              !(filter._id && filter._id.$nin.includes(candidate._id)),
          );
        } else {
          auction = auctions.find(
            (candidate) =>
              candidate._id === filter._id &&
              candidate.status === filter.status,
          );
        }
        if (!auction) return null;

        options.session.dirty = true;
        Object.assign(auction, update.$set || {});
        for (const field of Object.keys(update.$unset || {})) {
          auction[field] = null;
        }
        return clone(auction);
      },
    );

    mockUserFindById.mockImplementation(async (id) => {
      const user = users.find((candidate) => candidate._id === id);
      return user ? clone(user) : null;
    });

    mockUserFindOneAndUpdate.mockImplementation(
      async (filter, update, options) => {
        const user = users.find((candidate) => candidate._id === filter._id);
        if (!user) return null;
        options.session.dirty = true;
        user.balance += update.$inc.balance;
        return clone(user);
      },
    );

    mockBatchFindOneAndUpdate.mockImplementation(
      async (filter, update, options) => {
        if (failBatchIds.has(filter._id)) {
          throw new Error("Simulated batch update failure");
        }
        const batch = batches.find((candidate) => candidate._id === filter._id);
        if (!batch) return null;
        options.session.dirty = true;
        batch.currentStage = update.$set.currentStage;
        batch.updates.push(clone(update.$push.updates));
        return clone(batch);
      },
    );

    mockCreateInAppNotification.mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ success: true });
    mockGetIO.mockReturnValue({
      to: jest.fn(() => ({ emit: mockSocketEmit })),
      emit: mockGlobalEmit,
    });
  });

  it("settles an expired auction atomically", async () => {
    await settleExpiredAuctions();

    expect(auctions[0].status).toBe("ended");
    expect(Number.isNaN(new Date(auctions[0].settledAt).getTime())).toBe(false);
    expect(users.find((user) => user._id === "farmer-1").balance).toBe(225);
    expect(batches[0].currentStage).toBe("mandi");
    expect(batches[0].updates).toHaveLength(1);
    expect(batches[0].updates[0]).toEqual(
      expect.objectContaining({
        stage: "mandi",
        actor: "Buyer One",
      }),
    );
    expect(sessions[0].commitTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(2);
  });

  it("allows only one concurrent execution to settle an auction", async () => {
    await Promise.all([settleExpiredAuctions(), settleExpiredAuctions()]);

    expect(users.find((user) => user._id === "farmer-1").balance).toBe(225);
    expect(batches[0].updates).toHaveLength(1);
    expect(auctions[0].status).toBe("ended");
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(2);
    expect(
      mockSocketEmit.mock.calls.filter(([event]) => event === "auction_ended"),
    ).toHaveLength(1);
  });

  it("does not repeat database or external side effects after settlement", async () => {
    await settleExpiredAuctions();
    const notificationCount = mockCreateInAppNotification.mock.calls.length;
    const socketCount = mockSocketEmit.mock.calls.length;

    await settleExpiredAuctions();

    expect(users.find((user) => user._id === "farmer-1").balance).toBe(225);
    expect(batches[0].updates).toHaveLength(1);
    expect(mockCreateInAppNotification).toHaveBeenCalledTimes(
      notificationCount,
    );
    expect(mockSocketEmit).toHaveBeenCalledTimes(socketCount);
  });

  it("rolls back all database changes and leaves the auction retryable", async () => {
    failBatchIds.add("batch-1");

    await settleExpiredAuctions();

    expect(users.find((user) => user._id === "farmer-1").balance).toBe(100);
    expect(batches[0].currentStage).toBe("farmer");
    expect(batches[0].updates).toHaveLength(0);
    expect(auctions[0].status).toBe("active");
    expect(auctions[0].settledAt).toBeNull();
    expect(sessions[0].abortTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateInAppNotification).not.toHaveBeenCalled();
    expect(mockSocketEmit).not.toHaveBeenCalled();
  });

  it("ends an auction without bids without crediting or updating a batch", async () => {
    auctions[0].highestBidder = null;

    await settleExpiredAuctions();

    expect(auctions[0].status).toBe("ended");
    expect(users.find((user) => user._id === "farmer-1").balance).toBe(100);
    expect(batches[0].currentStage).toBe("farmer");
    expect(batches[0].updates).toHaveLength(0);
    expect(mockUserFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockCreateInAppNotification).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(
      mockSocketEmit.mock.calls.filter(([event]) => event === "auction_ended"),
    ).toHaveLength(1);
  });

  it("continues with another expired auction after one settlement fails", async () => {
    auctions.push(
      makeAuction({
        _id: "auction-2",
        cropId: "batch-2",
        batchId: "BATCH-200",
        farmerId: "farmer-2",
        highestBidder: "buyer-2",
        currentHighestBid: 75,
      }),
    );
    users.push(
      {
        _id: "farmer-2",
        name: "Farmer Two",
        email: "farmer2@example.com",
        balance: 50,
      },
      {
        _id: "buyer-2",
        name: "Buyer Two",
        email: "buyer2@example.com",
        balance: 300,
      },
    );
    batches.push({
      _id: "batch-2",
      batchId: "BATCH-200",
      currentStage: "farmer",
      updates: [],
    });
    failBatchIds.add("batch-1");

    await settleExpiredAuctions();

    expect(auctions.find((auction) => auction._id === "auction-1").status).toBe(
      "active",
    );
    expect(users.find((user) => user._id === "farmer-1").balance).toBe(100);
    expect(auctions.find((auction) => auction._id === "auction-2").status).toBe(
      "ended",
    );
    expect(users.find((user) => user._id === "farmer-2").balance).toBe(125);
    expect(
      batches.find((batch) => batch._id === "batch-2").updates,
    ).toHaveLength(1);
  });
});
