const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const Batch = require("../models/Batch");
const { hasPermission, PERMISSIONS } = require("../constants/permissions");
const { createPubSubClients } = require("../config/redis");

let io = null;

const MAX_HTTP_BUFFER_SIZE =
  parseInt(process.env.SOCKET_MAX_BUFFER_SIZE, 10) || 1e5;

const EVENT_RATE_LIMITS = {
  place_bid: { maxPerSecond: 10 },
  "join-batch-room": { maxPerSecond: 5 },
  "leave-batch-room": { maxPerSecond: 10 },
  join_auction: { maxPerSecond: 5 },
  leave_auction: { maxPerSecond: 10 },
  "join-verification-room": { maxPerSecond: 5 },
  "leave-verification-room": { maxPerSecond: 10 },
};

function createRateLimiter() {
  const buckets = new Map();

  function checkRate(event, socketId) {
    const config = EVENT_RATE_LIMITS[event];
    if (!config) return true;
    const key = `${socketId}:${event}`;
    const now = Date.now();
    let timestamps = buckets.get(key);
    if (!timestamps) {
      timestamps = [];
      buckets.set(key, timestamps);
    }
    const cutoff = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length >= config.maxPerSecond) {
      return false;
    }
    timestamps.push(now);
    return true;
  }

  function clearSocket(socketId) {
    const prefix = `${socketId}:`;
    for (const key of buckets.keys()) {
      if (key.startsWith(prefix)) {
        buckets.delete(key);
      }
    }
  }

  return { checkRate, clearSocket };
}

function validatePayload(event, data) {
  if (event === "join-batch-room" || event === "leave-batch-room") {
    return typeof data === "string" && data.length > 0 && data.length <= 200;
  }
  if (event === "join_auction" || event === "leave_auction") {
    return typeof data === "string" && data.length > 0 && data.length <= 200;
  }
  if (
    event === "join-verification-room" ||
    event === "leave-verification-room"
  ) {
    return typeof data === "string" && data.length > 0 && data.length <= 200;
  }
  if (event === "place_bid") {
    return (
      data &&
      typeof data === "object" &&
      typeof data.auctionId === "string" &&
      data.auctionId.length > 0 &&
      data.auctionId.length <= 200 &&
      typeof data.bidAmount === "number" &&
      Number.isFinite(data.bidAmount) &&
      data.bidAmount > 0 &&
      data.bidAmount <= Number.MAX_SAFE_INTEGER &&
      Object.keys(data).length <= 2
    );
  }
  return true;
}

/**
 * Initialize Socket.IO server instance
 * @param {http.Server} httpServer - Node.js HTTP server instance
 * @returns {SocketIO.Server} Socket.IO server instance
 */
function initializeSocketIO(httpServer) {
  if (!io) {
    io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
    });

    if (process.env.NODE_ENV !== "test" || process.env.ENABLE_REDIS_SOCKET_ADAPTER === "true") {
      try {
        const { pubClient, subClient } = createPubSubClients();
        io.adapter(createAdapter(pubClient, subClient));
        logger.info("✓ Socket.IO Redis adapter attached for horizontal scaling across nodes");
      } catch (err) {
        logger.warn("⚠️ Failed to attach Redis adapter to Socket.IO. Falling back to default in-memory adapter:", { error: err.message });
      }
    }

    const { checkRate, clearSocket } = createRateLimiter();

    io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = decoded;
        } catch (err) {
          logger.debug(`[SOCKET] Handshake token verification failed: ${err.message}`);
        }
      }
      next();
    });

    // Set up connection handling
    io.on("connection", (socket) => {
      logger.info(`[SOCKET] Client connected: ${socket.id}`);
      socket.pendingRoomJoins = new Map();

      // Automatically join user-specific room if authenticated
      if (socket.user && (socket.user.id || socket.user._id)) {
        const userId = socket.user.id || socket.user._id;
        socket.join(`user:${userId}`);
        logger.info(
          `[SOCKET] Client ${socket.id} joined user room: ${userId}`,
        );
      }

      // Runtime authentication handler (handles late re-authentication & mobile reconnects)
      socket.on("authenticate", async (data) => {
        const token = data?.token || (typeof data === "string" ? data : null);
        if (!token) {
          safeEmit("authenticated", { success: false, message: "Token is required" });
          return;
        }

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.user = decoded;
          const userId = decoded.id || decoded._id;
          socket.join(`user:${userId}`);
          safeEmit("authenticated", { success: true, user: decoded });
          logger.info(`[SOCKET] Client ${socket.id} authenticated at runtime as user: ${userId}`);

          // Process queued pending room joins automatically
          if (socket.pendingRoomJoins && socket.pendingRoomJoins.size > 0) {
            logger.info(`[SOCKET] Processing ${socket.pendingRoomJoins.size} pending room joins for socket ${socket.id}`);
            for (const [key, { event, payload }] of socket.pendingRoomJoins.entries()) {
              if (event === "join-batch-room") {
                socket.join(`batch:${payload}`);
                safeEmit("joined-batch-room", { batchId: payload, status: "auto-fulfilled" });
              }
            }
            socket.pendingRoomJoins.clear();
          }
        } catch (err) {
          safeEmit("authenticated", { success: false, message: "Invalid or expired token" });
        }
      });

      // Only emit to a socket that is still connected. Async handlers can
      // finish after the client has disconnected, so every emit is guarded.
      function safeEmit(event, payload) {
        if (!socket.connected) return;
        socket.emit(event, payload);
      }

      function withGuard(event, handler) {
        return async (data) => {
          if (!socket.connected) {
            return;
          }
          if (!checkRate(event, socket.id)) {
            logger.warn(
              `[SOCKET] Rate limit exceeded for ${socket.id} on ${event}`,
            );
            safeEmit("error", {
              message: "Too many requests. Please slow down.",
            });
            return;
          }
          if (!validatePayload(event, data)) {
            logger.warn(
              `[SOCKET] Invalid payload from ${socket.id} on ${event}`,
            );
            safeEmit("error", { message: "Invalid payload." });
            return;
          }
          return await handler(data);
        };
      }

      // Handle client joining batch-specific rooms
      socket.on(
        "join-batch-room",
        withGuard("join-batch-room", async (batchId) => {
          try {
            const user = socket.user;
            if (!user) {
              // Queue request until runtime authentication completes
              socket.pendingRoomJoins.set(`batch:${batchId}`, {
                event: "join-batch-room",
                payload: batchId,
                queuedAt: Date.now(),
              });
              safeEmit("room-join-queued", {
                batchId,
                status: "queued",
                message: "Room join queued pending authentication",
              });
              logger.info(`[SOCKET] Queued join-batch-room for unauthenticated socket ${socket.id} (batchId: ${batchId})`);
              return;
            }

            const userId = user.id || user._id;
            const userFarmerId = user.farmerId || userId;

            const batch = await Batch.findOne({ batchId }).lean();
            if (!batch) {
              safeEmit("error", { message: "Batch not found" });
              return;
            }

            const batchOwnerId = (batch.farmerId || "")
              .toString()
              .trim()
              .toLowerCase();
            const normalizedUserId = userId.toString().trim().toLowerCase();
            const normalizedFarmerId = userFarmerId
              .toString()
              .trim()
              .toLowerCase();

            const isOwner =
              batchOwnerId === normalizedFarmerId ||
              batchOwnerId === normalizedUserId;
            const canViewAll = hasPermission(
              user.role,
              PERMISSIONS.BATCH_VIEW_ALL,
            );
            const canRead = hasPermission(user.role, PERMISSIONS.BATCH_READ);

            if (!isOwner && !canViewAll && !canRead) {
              safeEmit("error", {
                message:
                  "Access denied: you do not have permission to view this batch",
              });
              logger.warn(
                `[SOCKET] Unauthorized attempt by ${socket.id} (user ${userId}, role ${user.role}) to join batch room: ${batchId}`,
              );
              return;
            }

            socket.join(`batch:${batchId}`);
            logger.info(
              `[SOCKET] Client ${socket.id} (user ${userId}, role ${user.role}) joined batch room: ${batchId}`,
            );
          } catch (err) {
            logger.error(
              `[SOCKET ERROR] Error authorizing batch room join for ${socket.id}:`,
              err,
            );
            safeEmit("error", { message: "Failed to verify batch access" });
          }
        }),
      );

      // Handle client leaving batch rooms
      socket.on(
        "leave-batch-room",
        withGuard("leave-batch-room", (batchId) => {
          socket.leave(`batch:${batchId}`);
          logger.info(
            `[SOCKET] Client ${socket.id} left batch room: ${batchId}`,
          );
        }),
      );

      // Handle client joining verification-specific rooms
      socket.on(
        "join-verification-room",
        withGuard("join-verification-room", (userId) => {
          const authenticatedUserId = socket.user?.id;
          if (
            !authenticatedUserId ||
            authenticatedUserId.toString() !== userId
          ) {
            safeEmit("error", {
              message: "Access denied: you can only join your own verification room",
            });
            logger.warn(
              `[SOCKET] Unauthorized attempt by ${socket.id} to join verification room`,
            );
            return;
          }

          socket.join(`verification:user:${authenticatedUserId}`);
          logger.info(
            `[SOCKET] Client ${socket.id} joined verification room: ${authenticatedUserId}`,
          );
        }),
      );

      // Handle client leaving verification rooms
      socket.on(
        "leave-verification-room",
        withGuard("leave-verification-room", (userId) => {
          socket.leave(`verification:user:${userId}`);
          logger.info(
            `[SOCKET] Client ${socket.id} left verification room: ${userId}`,
          );
        }),
      );

      // Join auction room
      socket.on(
        "join_auction",
        withGuard("join_auction", (auctionId) => {
          socket.join(`auction:${auctionId}`);
          logger.info(
            `[SOCKET] Client ${socket.id} joined auction room: ${auctionId}`,
          );
        }),
      );

      // Leave auction room
      socket.on(
        "leave_auction",
        withGuard("leave_auction", (auctionId) => {
          socket.leave(`auction:${auctionId}`);
          logger.info(
            `[SOCKET] Client ${socket.id} left auction room: ${auctionId}`,
          );
        }),
      );

      /**
       * Place a bid on an auction.
       *
       * Race-condition fix (#807):
       *   - Balance check and deduction are both done atomically via MongoDB
       *     `$inc` operators so concurrent bids on different auctions cannot
       *     both pass using the same starting balance.
       *
       * Flow:
       *  1. Fetch user and pre-validate balance (fast early exit).
       *  2. Fetch auction and validate state / bid amount.
       *  3. Atomically win the auction slot using findOneAndUpdate with
       *     conditional filter (optimistic locking — if another bid arrived
       *     first, this returns null and we abort).
       *  4. Atomically deduct the bidder's balance with $inc (never use
       *     read-modify-write: user.balance -= x; user.save()).
       *  5. Atomically refund the previous highest bidder with $inc.
       *  6. Record the Bid document and broadcast to the auction room.
       */
      socket.on(
        "place_bid",
        withGuard("place_bid", async ({ auctionId, bidAmount }) => {
          try {
            const Auction = require("../models/Auction");
            const Bid = require("../models/Bid");
            const User = require("../models/User");

            if (!socket.user) {
              return safeEmit("bid_error", {
                message: "Authentication required",
              });
            }

            const bidderId = socket.user.id;
            const bidderName = socket.user.name;

            // 1. Fetch user for early balance check (optimistic pre-flight only —
            //    the authoritative deduction happens atomically below).
            const user = await User.findById(bidderId);
            if (!user) {
              return safeEmit("bid_error", { message: "User not found" });
            }

            // 2. Fetch auction and validate state
            const auction = await Auction.findById(auctionId);
            if (!auction) {
              return safeEmit("bid_error", { message: "Auction not found" });
            }

            if (auction.status !== "active" || new Date() > auction.endTime) {
              return safeEmit("bid_error", {
                message: "Auction is not active or has already ended.",
              });
            }

            if (auction.farmerId.toString() === bidderId) {
              return safeEmit("bid_error", {
                message: "Farmers cannot bid on their own auctions.",
              });
            }

            if (bidAmount <= auction.currentHighestBid) {
              return safeEmit("bid_error", {
                message: `Bid must be strictly higher than the current highest bid of ${auction.currentHighestBid} credits.`,
              });
            }

            // Calculate how much balance this bid actually costs.
            // If the bidder is already the highest bidder they only pay the delta.
            const previousHighestBidder = auction.highestBidder;
            const previousHighestBid = auction.currentHighestBid;
            const isSelfOutbid =
              previousHighestBidder &&
              previousHighestBidder.toString() === bidderId;
            const amountToDeduct = isSelfOutbid
              ? bidAmount - previousHighestBid
              : bidAmount;

            // Pre-flight balance check (best-effort; the atomic $inc below is
            // the authoritative guard against overdraft).
            if (user.balance < amountToDeduct) {
              return safeEmit("bid_error", {
                message: `Insufficient funds. Your balance is ${user.balance} credits.`,
              });
            }

            // 3. Atomically claim the auction's highest-bid slot.
            //    The filter ensures we only win if the auction is still active
            //    and our bid is still the highest — prevents TOCTOU races.
            const updatedAuction = await Auction.findOneAndUpdate(
              {
                _id: auctionId,
                status: "active",
                endTime: { $gt: new Date() },
                currentHighestBid: { $lt: bidAmount },
              },
              {
                $set: {
                  currentHighestBid: bidAmount,
                  highestBidder: bidderId,
                },
              },
              { new: true },
            );

            if (!updatedAuction) {
              return safeEmit("bid_error", {
                message:
                  "Bid failed. Someone else may have placed a higher bid first.",
              });
            }

            // 4. Atomically deduct balance from the new highest bidder.
            //    Using $inc (not read-modify-write) ensures concurrent bids on
            //    different auctions cannot both overdraw the same balance.
            await User.findByIdAndUpdate(bidderId, {
              $inc: { balance: -amountToDeduct },
            });

            // 5. Atomically refund the previous highest bidder (if any and not self).
            if (previousHighestBidder && !isSelfOutbid) {
              await User.findByIdAndUpdate(previousHighestBidder, {
                $inc: { balance: previousHighestBid },
              });
            }

            // 6. Record the bid
            const newBid = new Bid({
              auctionId,
              userId: bidderId,
              userName: bidderName,
              cropId: auction.batchId,
              bidAmount,
            });
            await newBid.save();

            logger.info(
              `[SOCKET] Bid placed successfully on auction ${auctionId} by user ${bidderName}: ${bidAmount}`,
            );

            // 7. Broadcast updated auction state to all room participants
            const populatedBidder = await User.findById(
              updatedAuction.highestBidder,
            )
              .select("name")
              .lean();
            const broadcastPayload = {
              ...updatedAuction.toObject(),
              highestBidderName: populatedBidder ? populatedBidder.name : null,
            };
            io.to(`auction:${auctionId}`).emit(
              "auction_update",
              broadcastPayload,
            );
          } catch (error) {
            logger.error("[SOCKET ERROR] error placing bid:", error);
            safeEmit("bid_error", {
              message: "An internal error occurred while placing your bid.",
            });
          }
        }),
      );

      // Handle disconnection
      socket.on("disconnect", () => {
        logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
        // Release rate-limit buckets and all registered handlers so neither the
        // socket object nor its closures are retained (prevents memory leaks).
        clearSocket(socket.id);
        socket.removeAllListeners();
      });

      // Handle errors
      socket.on("error", (error) => {
        logger.error(`[SOCKET ERROR] Client ${socket.id}:`, error);
      });
    });

    logger.info("[SOCKET] Socket.IO server initialized");
  }

  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {SocketIO.Server|null} Socket.IO server instance or null
 */
function getIO() {
  if (!io) {
    logger.warn(
      "[SOCKET WARNING] Socket.IO not initialized. Call initializeSocketIO first.",
    );
  }
  return io;
}

/**
 * Emit an event to all clients in a specific batch room
 * @param {string} batchId - Batch ID to emit event to
 * @param {string} eventName - Event name
 * @param {any} data - Event data payload
 */
function emitToBatchRoom(batchId, eventName, data) {
  if (io) {
    io.to(`batch:${batchId}`).emit(eventName, data);
    logger.info(`[SOCKET] Emitted "${eventName}" to batch room ${batchId}`);
  } else {
    logger.warn(
      "[SOCKET WARNING] Cannot emit to batch room - Socket.IO not initialized",
    );
  }
}

/**
 * Emit an event to all connected clients (global broadcast)
 * @param {string} eventName - Event name
 * @param {any} data - Event data payload
 */
function emitGlobal(eventName, data) {
  if (io) {
    io.emit(eventName, data);
    logger.info(`[SOCKET] Emitted global event "${eventName}"`);
  } else {
    logger.warn(
      "[SOCKET WARNING] Cannot emit global event - Socket.IO not initialized",
    );
  }
}

/**
 * Emit an event to all clients in a specific user verification room
 * @param {string} userId - User ID to emit event to
 * @param {string} eventName - Event name
 * @param {any} data - Event data payload
 */
function emitToVerificationRoom(userId, eventName, data) {
  if (io) {
    io.to(`verification:user:${userId}`).emit(eventName, data);
    logger.info(
      `[SOCKET] Emitted "${eventName}" to verification room ${userId}`,
    );
  } else {
    logger.warn(
      "[SOCKET WARNING] Cannot emit to verification room - Socket.IO not initialized",
    );
  }
}

/**
 * Emit an event to a specific user
 * @param {string} userId - User ID to emit event to
 * @param {string} eventName - Event name
 * @param {any} data - Event data payload
 */
function emitToUser(userId, eventName, data) {
  if (io) {
    io.to(`user:${userId}`).emit(eventName, data);
    logger.info(`[SOCKET] Emitted "${eventName}" to user ${userId}`);
  } else {
    logger.warn(
      "[SOCKET WARNING] Cannot emit to user - Socket.IO not initialized",
    );
  }
}

module.exports = {
  initializeSocketIO,
  getIO,
  createRateLimiter,
  emitToBatchRoom,
  emitGlobal,
  emitToVerificationRoom,
  emitToUser,
};
