const { Server } = require('socket.io');

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

    // Set up connection handling
    io.on('connection', (socket) => {
      console.log(`[SOCKET] Client connected: ${socket.id}`);

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

module.exports = {
  initializeSocketIO,
  getIO,
  emitToBatchRoom,
  emitGlobal
};
