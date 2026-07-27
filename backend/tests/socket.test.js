process.env.JWT_SECRET = "test_secret_key_for_jwt";

const jwt = require("jsonwebtoken");

const mockAuction = {
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockUser = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const mockBidSave = jest.fn();
const mockBid = jest.fn().mockImplementation(() => ({
  save: mockBidSave,
}));

jest.mock("../models/Auction", () => mockAuction);
jest.mock("../models/User", () => mockUser);
jest.mock("../models/Bid", () => mockBid);

jest.mock("socket.io", () => {
  const useCallback = jest.fn();
  const onCallback = jest.fn();
  const toFn = jest.fn(() => ({
    emit: jest.fn(),
  }));
  const emitFn = jest.fn();

  const mockIo = {
    use: useCallback,
    on: onCallback,
    to: toFn,
    emit: emitFn,
  };

  const Server = jest.fn(() => mockIo);
  Server.mockIo = mockIo;
  Server.useCallback = useCallback;
  Server.onCallback = onCallback;
  Server.toFn = toFn;
  Server.emitFn = emitFn;

  return { Server };
});

describe("Socket.IO Service", () => {
  let socketService;
  let mockSocket;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    socketService = require("../services/socketService");
    mockSocket = {
      handshake: {
        auth: {},
        headers: {},
      },
      user: undefined,
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe("Auth Middleware", () => {
    test("should reject connection without token", () => {
      const { Server } = require("socket.io");
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      expect(useCallback).toHaveBeenCalled();

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Authentication required"),
      );
    });

    test("should accept connection with valid token in auth", () => {
      const { Server } = require("socket.io");
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const validToken = jwt.sign(
        { id: "user-1", email: "test@test.com", role: "farmer" },
        process.env.JWT_SECRET,
      );

      mockSocket.handshake.auth.token = validToken;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe("user-1");
      expect(mockSocket.user.email).toBe("test@test.com");
      expect(mockSocket.user.role).toBe("farmer");
    });

    test("should accept connection with valid token in Authorization header", () => {
      const { Server } = require("socket.io");
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const validToken = jwt.sign(
        { id: "user-2", email: "admin@test.com", role: "admin" },
        process.env.JWT_SECRET,
      );

      mockSocket.handshake.headers.authorization = `Bearer ${validToken}`;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user.id).toBe("user-2");
    });

    test("should reject connection with invalid token", () => {
      const { Server } = require("socket.io");
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      mockSocket.handshake.auth.token = "invalid-token";

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error("Invalid token"));
    });

    test("should reject connection with expired token", () => {
      const { Server } = require("socket.io");
      const useCallback = Server.useCallback;

      socketService.initializeSocketIO({});

      const expiredToken = jwt.sign(
        { id: "user-3", exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET,
      );

      mockSocket.handshake.auth.token = expiredToken;

      const middleware = useCallback.mock.calls[0][0];
      middleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error("Invalid token"));
    });
  });

  describe("Event Emission", () => {
    let mockIo;

    beforeEach(() => {
      const { Server } = require("socket.io");
      socketService.initializeSocketIO({});
      mockIo = Server.mockIo;
    });

    test("emitToBatchRoom should emit to the correct room", () => {
      const eventData = { batchId: "BATCH001", cropType: "Rice" };

      socketService.emitToBatchRoom("BATCH001", "batch:created", eventData);

      expect(mockIo.to).toHaveBeenCalledWith("batch:BATCH001");
    });

    test("emitToVerificationRoom should emit to the correct user room", () => {
      const eventData = { status: "verified" };

      socketService.emitToVerificationRoom(
        "user-a",
        "verification:updated",
        eventData,
      );

      expect(mockIo.to).toHaveBeenCalledWith("verification:user:user-a");
    });
  });

  describe("Verification Room Authorization", () => {
    let joinVerificationRoomHandler;

    beforeEach(() => {
      const { Server } = require("socket.io");
      socketService.initializeSocketIO({});

      const connectionHandler = Server.onCallback.mock.calls.find(
        ([eventName]) => eventName === "connection",
      )[1];
      mockSocket.user = { id: "user-a", role: "farmer" };
      connectionHandler(mockSocket);
      joinVerificationRoomHandler = mockSocket.on.mock.calls.find(
        ([eventName]) => eventName === "join-verification-room",
      )[1];
    });

    test("allows a user to join their own verification room", async () => {
      await joinVerificationRoomHandler("user-a");

      expect(mockSocket.join).toHaveBeenCalledWith("verification:user:user-a");
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        "error",
        expect.any(Object),
      );
    });

    test("denies a user from joining another user's verification room", async () => {
      await joinVerificationRoomHandler("user-b");

      expect(mockSocket.join).not.toHaveBeenCalledWith("verification:user:user-b");
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Access denied: you can only join your own verification room",
      });
    });
  });

  describe("Auction Bidding", () => {
    let mockIo;
    let placeBidHandler;

    beforeEach(() => {
      const { Server } = require("socket.io");
      socketService.initializeSocketIO({});
      mockIo = Server.mockIo;

      const connectionHandler = Server.onCallback.mock.calls.find(
        ([eventName]) => eventName === "connection",
      )[1];
      mockSocket.user = { id: "user-a", name: "User A" };
      connectionHandler(mockSocket);
      placeBidHandler = mockSocket.on.mock.calls.find(
        ([eventName]) => eventName === "place_bid",
      )[1];

      mockAuction.findById.mockReset();
      mockAuction.findOneAndUpdate.mockReset();
      mockUser.findById.mockReset();
      mockUser.findByIdAndUpdate.mockReset();
      mockBid.mockClear();
      mockBidSave.mockReset();
      mockBidSave.mockResolvedValue({});
    });

    test("charges only the bid difference when the highest bidder raises their own bid", async () => {
      const balances = { "user-a": 1000 };
      const auctionState = {
        _id: "auction-1",
        farmerId: { toString: () => "farmer-1" },
        batchId: "BATCH001",
        status: "active",
        endTime: new Date(Date.now() + 60000),
        currentHighestBid: 0,
        highestBidder: null,
      };

      let findUserCallCount = 0;
      mockUser.findById.mockImplementation((userId) => {
        findUserCallCount += 1;
        if (userId === "user-a" && findUserCallCount % 2 === 1) {
          return Promise.resolve({
            _id: "user-a",
            name: "User A",
            balance: balances["user-a"],
          });
        }

        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ name: "User A" }),
          }),
        };
      });
      mockUser.findByIdAndUpdate.mockImplementation((userId, update) => {
        balances[userId] += update.$inc.balance;
        return Promise.resolve({ _id: userId, balance: balances[userId] });
      });
      mockAuction.findById.mockImplementation(() =>
        Promise.resolve({
          ...auctionState,
          highestBidder: auctionState.highestBidder
            ? { toString: () => auctionState.highestBidder }
            : null,
        }),
      );
      mockAuction.findOneAndUpdate.mockImplementation((_query, update) => {
        auctionState.currentHighestBid = update.$set.currentHighestBid;
        auctionState.highestBidder = update.$set.highestBidder;

        return Promise.resolve({
          ...auctionState,
          toObject: () => ({ ...auctionState }),
        });
      });

      await placeBidHandler({ auctionId: "auction-1", bidAmount: 100 });
      await placeBidHandler({ auctionId: "auction-1", bidAmount: 150 });

      expect(balances["user-a"]).toBe(850);
      expect(auctionState.currentHighestBid).toBe(150);
      expect(auctionState.highestBidder).toBe("user-a");
      expect(mockUser.findByIdAndUpdate).toHaveBeenNthCalledWith(1, "user-a", {
        $inc: { balance: -100 },
      });
      expect(mockUser.findByIdAndUpdate).toHaveBeenNthCalledWith(2, "user-a", {
        $inc: { balance: -50 },
      });
      expect(mockAuction.findOneAndUpdate).toHaveBeenLastCalledWith(
        expect.any(Object),
        { $set: { currentHighestBid: 150, highestBidder: "user-a" } },
        { new: true },
      );
      expect(mockBid).toHaveBeenCalledWith(
        expect.objectContaining({
          auctionId: "auction-1",
          userId: "user-a",
          bidAmount: 150,
        }),
      );
      expect(mockIo.to).toHaveBeenCalledWith("auction:auction-1");
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        "bid_error",
        expect.any(Object),
      );
    });

    test("refunds the previous highest bidder and charges the full bid for a normal outbid", async () => {
      mockSocket.user = { id: "user-b", name: "User B" };
      let findUserCallCount2 = 0;
      mockUser.findById.mockImplementation((userId) => {
        findUserCallCount2 += 1;
        if (findUserCallCount2 === 1) {
          return Promise.resolve({
            _id: "user-b",
            name: "User B",
            balance: 1000,
          });
        }
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ name: "User B" }),
          }),
        };
      });
      mockUser.findByIdAndUpdate.mockImplementation((userId, update) => {
        return Promise.resolve({});
      });

      mockAuction.findById.mockResolvedValue({
        _id: "auction-1",
        farmerId: { toString: () => "farmer-1" },
        batchId: "BATCH001",
        status: "active",
        endTime: new Date(Date.now() + 60000),
        currentHighestBid: 100,
        highestBidder: { toString: () => "user-a" },
      });

      mockAuction.findOneAndUpdate.mockResolvedValue({
        _id: "auction-1",
        currentHighestBid: 150,
        highestBidder: "user-b",
        toObject: () => ({
          _id: "auction-1",
          currentHighestBid: 150,
          highestBidder: "user-b",
        }),
      });

      await placeBidHandler({ auctionId: "auction-1", bidAmount: 150 });

      expect(mockUser.findByIdAndUpdate).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        {
          $inc: { balance: 100 },
        },
      );
      expect(mockUser.findByIdAndUpdate).toHaveBeenNthCalledWith(2, "user-b", {
        $inc: { balance: -150 },
      });
      expect(mockAuction.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        { $set: { currentHighestBid: 150, highestBidder: "user-b" } },
        { new: true },
      );
      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        "bid_error",
        expect.any(Object),
      );
    });
  });
});
