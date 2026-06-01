import NetInfo from '@react-native-community/netinfo';
import { offlineStorage } from './offlineStorage';
import { batchService } from './batch.service';

type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

class SyncQueueManager {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private unsubscribeNetInfo?: () => void;

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        this.processQueue();
      }
    });
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(status: SyncStatus) {
    this.listeners.forEach((fn) => {
      offlineStorage.getPendingCount().then((count) => fn(status, count));
    });
  }

  async addToQueue(params: { batchId: string; action: string; data: Record<string, any> }) {
    await offlineStorage.addToQueue({
      batchId: params.batchId,
      action: params.action as any,
      data: params.data,
      priority: 'normal',
    });
    this.notify('idle');

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify('syncing');

    try {
      const queue = await offlineStorage.getQueue();

      for (const item of queue) {
        try {
          if (item.action === 'stage_update') {
            await batchService.updateStage(item.batchId, item.data.stage);
          }
          await offlineStorage.removeFromQueue(item.id);
        } catch (error) {
          await offlineStorage.incrementRetry(item.id);
          if (item.retries >= 4) {
            await offlineStorage.removeFromQueue(item.id);
          }
        }
      }
      this.notify('idle');
    } catch {
      this.notify('error');
    } finally {
      this.isSyncing = false;
    }
  }

  async getPendingCount(): Promise<number> {
    return offlineStorage.getPendingCount();
  }

  destroy() {
    this.unsubscribeNetInfo?.();
    this.listeners.clear();
  }
}

export const syncQueue = new SyncQueueManager();
