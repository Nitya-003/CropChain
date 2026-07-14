import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { syncQueue } from '../services/syncQueue';
import type { SyncQueueInput } from '../types';

interface SyncContextType {
  status: 'idle' | 'syncing' | 'error';
  pendingCount: number;
  addToQueue: (params: SyncQueueInput) => Promise<void>;
  processNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    syncQueue.getPendingCount().then(setPendingCount);
    const unsubscribe = syncQueue.subscribe((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });
    return unsubscribe;
  }, []);

  const addToQueue = useCallback(async (params: SyncQueueInput) => {
    await syncQueue.addToQueue(params);
  }, []);

  const processNow = useCallback(async () => {
    await syncQueue.processQueue();
  }, []);

  return (
    <SyncContext.Provider value={{ status, pendingCount, addToQueue, processNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}
