const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initialize Socket.IO server instance
 * @param {http.Server} httpServer - Node.js HTTP server instance
 * @returns {SocketIO.Server} Socket.IO server instance
 */
function initializeSocketIO(httpServer) {
  if (!io) {
    io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication required'));
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });

    // Set up connection handling
    io.on('connection', (socket) => {
      console.log(`[SOCKET] Client connected: ${socket.id}`);

      // Automatically join user-specific room if authenticated
      if (socket.user && socket.user.id) {
        socket.join(`user:${socket.user.id}`);
        console.log(`[SOCKET] Client ${socket.id} joined user room: ${socket.user.id}`);
      }

      // Handle client joining batch-specific rooms
      socket.on('join-batch-room', (batchId) => {
        socket.join(`batch:${batchId}`);
        console.log(`[SOCKET] Client ${socket.id} joined batch room: ${batchId}`);
      });

      // Handle client leaving batch rooms
      socket.on('leave-batch-room', (batchId) => {
        socket.leave(`batch:${batchId}`);
        console.log(`[SOCKET] Client ${socket.id} left batch room: ${batchId}`);
      });

      // Handle client joining verification-specific rooms
      socket.on('join-verification-room', (userId) => {
        socket.join(`verification:user:${userId}`);
        console.log(`[SOCKET] Client ${socket.id} joined verification room: ${userId}`);
      });

      // Handle client leaving verification rooms
      socket.on('leave-verification-room', (userId) => {
        socket.leave(`verification:user:${userId}`);
        console.log(`[SOCKET] Client ${socket.id} left verification room: ${userId}`);
      });

      // Join auction room
      socket.on('join_auction', (auctionId) => {
        socket.join(`auction:${auctionId}`);
        console.log(`[SOCKET] Client ${socket.id} joined auction room: ${auctionId}`);
      });

      // Leave auction room
      socket.on('leave_auction', (auctionId) => {
        socket.leave(`auction:${auctionId}`);
        console.log(`[SOCKET] Client ${socket.id} left auction room: ${auctionId}`);
      });

      // Place bid
      socket.on('place_bid', async ({ auctionId, bidAmount }) => {
        try {
          const Auction = require('../models/Auction');
          const Bid = require('../models/Bid');
          const User = require('../models/User');

          if (!socket.user) {
            return socket.emit('bid_error', { message: 'Authentication required' });
          }

          const bidderId = socket.user.id;
          const bidderName = socket.user.name;

          // 1. Fetch user to verify balance
          const user = await User.findById(bidderId);
          if (!user) {
            return socket.emit('bid_error', { message: 'User not found' });
          }

          if (user.balance < bidAmount) {
            return socket.emit('bid_error', { message: `Insufficient funds. Your balance is ${user.balance} credits.` });
          }

          // 2. Fetch auction to verify state
          const auction = await Auction.findById(auctionId);
          if (!auction) {
            return socket.emit('bid_error', { message: 'Auction not found' });
          }

          if (auction.status !== 'active' || new Date() > auction.endTime) {
            return socket.emit('bid_error', { message: 'Auction is not active or has already ended.' });
          }

          if (auction.farmerId.toString() === bidderId) {
            return socket.emit('bid_error', { message: 'Farmers cannot bid on their own auctions.' });
          }

          if (bidAmount <= auction.currentHighestBid) {
            return socket.emit('bid_error', { message: `Bid must be strictly higher than the current highest bid of ${auction.currentHighestBid} credits.` });
          }

          // 3. Atomically update highest bid in database to prevent race conditions
          // Optimistic locking approach using conditions
          const previousHighestBidder = auction.highestBidder;
          const previousHighestBid = auction.currentHighestBid;

          const updatedAuction = await Auction.findOneAndUpdate(
            {
              _id: auctionId,
              status: 'active',
              endTime: { $gt: new Date() },
              currentHighestBid: { $lt: bidAmount }
            },
            {
              $set: {
                currentHighestBid: bidAmount,
                highestBidder: bidderId
              }
            },
            { new: true }
          );

          if (!updatedAuction) {
            return socket.emit('bid_error', { message: 'Bid failed. Someone else may have placed a higher bid first.' });
          }

          // 4. Refund previous highest bidder (if any) and deduct new highest bidder's balance
          if (previousHighestBidder) {
            await User.findByIdAndUpdate(previousHighestBidder, {
              $inc: { balance: previousHighestBid }
            });
          }

          user.balance -= bidAmount;
          await user.save();

          // 5. Create new Bid record
          const newBid = new Bid({
            auctionId,
            userId: bidderId,
            userName: bidderName,
            cropId: auction.batchId,
            bidAmount
          });
          await newBid.save();

          console.log(`[SOCKET] Bid placed successfully on auction ${auctionId} by user ${bidderName}: ${bidAmount}`);

          // 6. Broadcast auction_update to room
          const populatedBidder = await User.findById(updatedAuction.highestBidder).select('name').lean();
          const broadcastPayload = {
            ...updatedAuction.toObject(),
            highestBidderName: populatedBidder ? populatedBidder.name : null
          };
          io.to(`auction:${auctionId}`).emit('auction_update', broadcastPayload);

        } catch (error) {
          console.error('[SOCKET ERROR] error placing bid:', error);
          socket.emit('bid_error', { message: 'An internal error occurred while placing your bid.' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[SOCKET ERROR] Client ${socket.id}:`, error);
      });
    });

    console.log('[SOCKET] Socket.IO server initialized');
  }

  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {SocketIO.Server|null} Socket.IO server instance or null
 */
function getIO() {
  if (!io) {
    console.warn('[SOCKET WARNING] Socket.IO not initialized. Call initializeSocketIO first.');
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
    console.log(`[SOCKET] Emitted "${eventName}" to batch room ${batchId}`);
  } else {
    console.warn('[SOCKET WARNING] Cannot emit to batch room - Socket.IO not initialized');
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
    console.log(`[SOCKET] Emitted global event "${eventName}"`);
  } else {
    console.warn('[SOCKET WARNING] Cannot emit global event - Socket.IO not initialized');
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
    console.log(`[SOCKET] Emitted "${eventName}" to verification room ${userId}`);
  } else {
    console.warn('[SOCKET WARNING] Cannot emit to verification room - Socket.IO not initialized');
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
    console.log(`[SOCKET] Emitted "${eventName}" to user ${userId}`);
  } else {
    console.warn('[SOCKET WARNING] Cannot emit to user - Socket.IO not initialized');
  }
}

module.exports = {
  initializeSocketIO,
  getIO,
  emitToBatchRoom,
  emitGlobal,
  emitToVerificationRoom,
  emitToUser
};
