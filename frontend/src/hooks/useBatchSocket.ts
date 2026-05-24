import { useEffect, useState, useCallback } from 'react';
import { 
  getSocket, 
  joinBatchRoom, 
  leaveBatchRoom, 
  onBatchUpdated, 
  onBatchStageChanged,
  isConnected 
} from '../services/socketService';

interface UseBatchSocketOptions {
  batchId?: string;           // Optional batch ID to auto-join room
  enabled?: boolean;          // Enable/disable socket connection (default: true)
  onBatchUpdate?: (data: any) => void;  // Callback for batch updates
  onStageChange?: (data: any) => void;  // Callback for stage changes
}

interface UseBatchSocketReturn {
  isConnected: boolean;       // Whether socket is connected
  isConnecting: boolean;      // Whether socket is connecting
  lastUpdate: Date | null;    // Timestamp of last update
  error: Error | null;        // Connection error if any
  refreshConnection: () => void; // Manually refresh connection
}

/**
 * React hook for managing WebSocket connections to batch tracking
 * Provides real-time updates for specific batches or global stage changes
 */
export const useBatchSocket = ({
  batchId,
  enabled = true,
  onBatchUpdate,
  onStageChange
}: UseBatchSocketOptions = {}): UseBatchSocketReturn => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    
    const handleConnect = () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
      console.log('[HOOK] Socket connected');
    };

    const handleDisconnect = () => {
      setConnected(false);
      console.log('[HOOK] Socket disconnected');
    };

    const handleError = (err: Error) => {
      setError(err);
      setConnected(false);
      setConnecting(false);
      console.error('[HOOK] Socket error:', err);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);

    // Set initial connection state
    if (socket.connected) {
      setConnected(true);
    } else {
      setConnecting(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
    };
  }, [enabled]);

  // Join batch room when batchId changes
  useEffect(() => {
    if (!enabled || !batchId || !connected) return;

    joinBatchRoom(batchId);

    return () => {
      leaveBatchRoom(batchId);
    };
  }, [batchId, connected, enabled]);

  // Listen for batch-specific updates
  useEffect(() => {
    if (!enabled || !onBatchUpdate) return;

    const cleanup = onBatchUpdated((data) => {
      setLastUpdate(new Date());
      onBatchUpdate(data);
    });

    return cleanup;
  }, [enabled, onBatchUpdate]);

  // Listen for global stage changes
  useEffect(() => {
    if (!enabled || !onStageChange) return;

    const cleanup = onBatchStageChanged((data) => {
      setLastUpdate(new Date());
      onStageChange(data);
    });

    return cleanup;
  }, [enabled, onStageChange]);

  // Manual refresh function
  const refreshConnection = useCallback(() => {
    if (!enabled) return;
    
    setConnecting(true);
    setError(null);
    
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
  }, [enabled]);

  return {
    isConnected: connected,
    isConnecting: connecting,
    lastUpdate,
    error,
    refreshConnection
  };
};

/**
 * Simple hook to just check socket connection status
 */
export const useSocketStatus = (): { isConnected: boolean } => {
  const [status, setStatus] = useState(isConnected());

  useEffect(() => {
    const socket = getSocket();
    
    const updateStatus = () => {
      setStatus(isConnected());
    };

    socket.on('connect', updateStatus);
    socket.on('disconnect', updateStatus);

    // Initial status
    setStatus(isConnected());

    return () => {
      socket.off('connect', updateStatus);
      socket.off('disconnect', updateStatus);
    };
  }, []);

  return { isConnected: status };
};
