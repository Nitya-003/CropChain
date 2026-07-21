import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL) ||
  `http://localhost:3001`;

let socketInstance: Socket | null = null;
let authToken: string | null = null;

/**
 * Initialize and get the Socket.IO client instance (singleton)
 * @returns {Socket} Socket.IO client instance
 */
export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
      auth: authToken ? { token: authToken } : undefined,
    });

    socketInstance.on("connect", () => {
      console.log(
        "[SOCKET] Connected to WebSocket server:",
        socketInstance?.id,
      );
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[SOCKET] Disconnected from WebSocket server:", reason);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("[SOCKET ERROR] Connection error:", error.message);
    });
  }

  return socketInstance;
};

/**
 * Set the JWT token for WebSocket authentication.
 * If the socket is already connected, it will reconnect with the new token.
 * @param {string} token - JWT token
 */
export const setAuthToken = (token: string | null): void => {
  authToken = token;
  if (socketInstance) {
    socketInstance.auth = { token: token ?? "" };
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    }
  }
};

/**
 * Join a batch-specific room to receive updates for that batch
 * @param {string} batchId - Batch ID to join room for
 */
export const joinBatchRoom = (batchId: string): void => {
  const socket = getSocket();
  socket.emit("join-batch-room", batchId);
  console.log(`[SOCKET] Joined batch room: ${batchId}`);
};

/**
 * Leave a batch-specific room
 * @param {string} batchId - Batch ID to leave room for
 */
export const leaveBatchRoom = (batchId: string): void => {
  const socket = getSocket();
  socket.emit("leave-batch-room", batchId);
  console.log(`[SOCKET] Left batch room: ${batchId}`);
};

/**
 * Listen for batch update events
 * @param {(data: any) => void} callback - Callback function for batch updates
 * @returns {() => void} Cleanup function to remove listener
 */
export const onBatchUpdated = (callback: (data: any) => void): (() => void) => {
  const socket = getSocket();
  socket.on("batch-updated", callback);

  return () => {
    socket.off("batch-updated", callback);
  };
};

/**
 * Listen for global batch stage change events (for dashboards)
 * @param {(data: any) => void} callback - Callback function for stage changes
 * @returns {() => void} Cleanup function to remove listener
 */
export const onBatchStageChanged = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getSocket();
  socket.on("batch-stage-changed", callback);

  return () => {
    socket.off("batch-stage-changed", callback);
  };
};

/**
 * Disconnect from the Socket.IO server
 */
export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log("[SOCKET] Disconnected manually");
  }
};

export const isConnected = (): boolean => {
  return socketInstance?.connected ?? false;
};

export const joinVerificationRoom = (userId: string): void => {
  const socket = getSocket();
  socket.emit("join-verification-room", userId);
  console.log(`[SOCKET] Joined verification room for user: ${userId}`);
};

/**
 * Leave a user verification room
 */
export const leaveVerificationRoom = (userId: string): void => {
  const socket = getSocket();
  socket.emit("leave-verification-room", userId);
  console.log(`[SOCKET] Left verification room for user: ${userId}`);
};

/**
 * Listen for verification status update events
 * @param {(data: any) => void} callback - Callback function for verification updates
 * @returns {() => void} Cleanup function to remove listener
 */
export const onVerificationStatusUpdated = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getSocket();
  socket.on("verification.status.updated", callback);

  return () => {
    socket.off("verification.status.updated", callback);
  };
};

/**
 * Join an auction-specific room
 */
export const joinAuctionRoom = (auctionId: string): void => {
  const socket = getSocket();
  socket.emit("join_auction", auctionId);
  console.log(`[SOCKET] Joined auction room: ${auctionId}`);
};

/**
 * Leave an auction-specific room
 */
export const leaveAuctionRoom = (auctionId: string): void => {
  const socket = getSocket();
  socket.emit("leave_auction", auctionId);
  console.log(`[SOCKET] Left auction room: ${auctionId}`);
};

/**
 * Place a bid in an auction via WebSocket
 */
export const placeBid = (auctionId: string, bidAmount: number): void => {
  const socket = getSocket();
  socket.emit("place_bid", { auctionId, bidAmount });
  console.log(`[SOCKET] Emitted place_bid:`, { auctionId, bidAmount });
};

/**
 * Listen for live bid updates (when someone bids)
 */
export const onAuctionUpdated = (
  callback: (data: any) => void,
): (() => void) => {
  const socket = getSocket();
  socket.on("auction_update", callback);
  return () => {
    socket.off("auction_update", callback);
  };
};

/**
 * Listen for auction end event
 */
export const onAuctionEnded = (callback: (data: any) => void): (() => void) => {
  const socket = getSocket();
  socket.on("auction_ended", callback);
  return () => {
    socket.off("auction_ended", callback);
  };
};

/**
 * Listen for bid errors
 */
export const onBidError = (
  callback: (data: { message: string }) => void,
): (() => void) => {
  const socket = getSocket();
  socket.on("bid_error", callback);
  return () => {
    socket.off("bid_error", callback);
  };
};

/**
 * Listen for new user notifications
 */
export const onNewNotification = (
  callback: (notification: any) => void,
): (() => void) => {
  const socket = getSocket();
  socket.on("new_notification", callback);

  return () => {
    socket.off("new_notification", callback);
  };
};
