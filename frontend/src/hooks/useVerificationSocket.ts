import { useEffect, useState, useCallback } from 'react';
import { 
  getSocket, 
  joinVerificationRoom, 
  leaveVerificationRoom, 
  onVerificationStatusUpdated,
  isConnected 
} from '../services/socketService';

interface UseVerificationSocketOptions {
  userId?: string;             // Optional user ID to auto-join room
  userIds?: string[];          // Optional array of user IDs to auto-join rooms (useful for dashboards)
  enabled?: boolean;            // Enable/disable socket connection (default: true)
  onVerificationUpdate?: (data: any) => void;  // Callback for verification updates
}

interface UseVerificationSocketReturn {
  isConnected: boolean;         // Whether socket is connected
  isConnecting: boolean;        // Whether socket is connecting
  lastUpdate: Date | null;      // Timestamp of last update
  error: Error | null;          // Connection error if any
  refreshConnection: () => void; // Manually refresh connection
}

/**
 * React hook for managing WebSocket connections to verification tracking
 * Provides real-time updates for user-specific KYC/verification state transitions
 */
export const useVerificationSocket = ({
  userId,
  userIds,
  enabled = true,
  onVerificationUpdate
}: UseVerificationSocketOptions = {}): UseVerificationSocketReturn => {
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
      console.log('[HOOK] Verification Socket connected');
    };

    const handleDisconnect = () => {
      setConnected(false);
      console.log('[HOOK] Verification Socket disconnected');
    };

    const handleError = (err: Error) => {
      setError(err);
      setConnected(false);
      setConnecting(false);
      console.error('[HOOK] Verification Socket error:', err);
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

  // Join verification rooms when IDs or connection state changes
  useEffect(() => {
    if (!enabled || !connected) return;

    if (userId) {
      joinVerificationRoom(userId);
    }
    if (userIds && userIds.length > 0) {
      userIds.forEach(id => joinVerificationRoom(id));
    }

    return () => {
      if (userId) {
        leaveVerificationRoom(userId);
      }
      if (userIds && userIds.length > 0) {
        userIds.forEach(id => leaveVerificationRoom(id));
      }
    };
  }, [userId, userIds, connected, enabled]);

  // Listen for verification updates
  useEffect(() => {
    if (!enabled || !onVerificationUpdate) return;

    const cleanup = onVerificationStatusUpdated((data) => {
      setLastUpdate(new Date());
      onVerificationUpdate(data);
    });

    return cleanup;
  }, [enabled, onVerificationUpdate]);

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
