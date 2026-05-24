import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://localhost:3001`;

let socketInstance: Socket | null = null;

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
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET] Connected to WebSocket server:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected from WebSocket server:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[SOCKET ERROR] Connection error:', error.message);
    });
  }

  return socketInstance;
};

/**
 * Join a batch-specific room to receive updates for that batch
 * @param {string} batchId - Batch ID to join room for
 */
export const joinBatchRoom = (batchId: string): void => {
  const socket = getSocket();
  socket.emit('join-batch-room', batchId);
  console.log(`[SOCKET] Joined batch room: ${batchId}`);
};

/**
 * Leave a batch-specific room
 * @param {string} batchId - Batch ID to leave room for
 */
export const leaveBatchRoom = (batchId: string): void => {
  const socket = getSocket();
  socket.emit('leave-batch-room', batchId);
  console.log(`[SOCKET] Left batch room: ${batchId}`);
};

/**
 * Listen for batch update events
 * @param {(data: any) => void} callback - Callback function for batch updates
 * @returns {() => void} Cleanup function to remove listener
 */
export const onBatchUpdated = (callback: (data: any) => void): (() => void) => {
  const socket = getSocket();
  socket.on('batch-updated', callback);
  
  // Return cleanup function
  return () => {
    socket.off('batch-updated', callback);
  };
};

/**
 * Listen for global batch stage change events (for dashboards)
 * @param {(data: any) => void} callback - Callback function for stage changes
 * @returns {() => void} Cleanup function to remove listener
 */
export const onBatchStageChanged = (callback: (data: any) => void): (() => void) => {
  const socket = getSocket();
  socket.on('batch-stage-changed', callback);
  
  // Return cleanup function
  return () => {
    socket.off('batch-stage-changed', callback);
  };
};

/**
 * Disconnect from the Socket.IO server
 */
export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log('[SOCKET] Disconnected manually');
  }
};

// Export connection status helper
export const isConnected = (): boolean => {
  return socketInstance?.connected ?? false;
};
