import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface CropChainDB extends DBSchema {
  pendingBatches: {
    key: string;
    value: PendingBatch;
    indexes: { 'by-timestamp': number; 'by-status': string };
  };
  pendingUpdates: {
    key: string;
    value: PendingUpdate;
    indexes: { 'by-timestamp': number; 'by-batchId': string; 'by-status': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number; 'by-priority': number };
  };
}

export interface PendingBatch {
  id: string;
  data: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  error?: string;
  createdAt: string;
}

export interface PendingUpdate {
  id: string;
  batchId: string;
  data: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  error?: string;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'batch' | 'update';
  referenceId: string;
  timestamp: number;
  priority: number;
  attempts: number;
}

class OfflineStorageService {
  private db: IDBPDatabase<CropChainDB> | null = null;
  private readonly DB_NAME = 'cropchain-offline';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<CropChainDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Pending batches store
        if (!db.objectStoreNames.contains('pendingBatches')) {
          const batchStore = db.createObjectStore('pendingBatches', { keyPath: 'id' });
          batchStore.createIndex('by-timestamp', 'timestamp');
          batchStore.createIndex('by-status', 'status');
        }

        // Pending updates store
        if (!db.objectStoreNames.contains('pendingUpdates')) {
          const updateStore = db.createObjectStore('pendingUpdates', { keyPath: 'id' });
          updateStore.createIndex('by-timestamp', 'timestamp');
          updateStore.createIndex('by-batchId', 'batchId');
          updateStore.createIndex('by-status', 'status');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          queueStore.createIndex('by-timestamp', 'timestamp');
          queueStore.createIndex('by-priority', 'priority');
        }
      },
    });
  }

  // Pending Batches
  async savePendingBatch(data: Record<string, unknown>): Promise<string> {
    await this.init();
    const id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingBatch: PendingBatch = {
      id,
      data,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await this.db!.put('pendingBatches', pendingBatch);
    await this.addToSyncQueue('batch', id, 1);
    
    return id;
  }

  async getPendingBatch(id: string): Promise<PendingBatch | undefined> {
    await this.init();
    return this.db!.get('pendingBatches', id);
  }

  async getAllPendingBatches(): Promise<PendingBatch[]> {
    await this.init();
    return this.db!.getAll('pendingBatches');
  }

  async updateBatchStatus(
    id: string,
    status: PendingBatch['status'],
    error?: string
  ): Promise<void> {
    await this.init();
    const batch = await this.db!.get('pendingBatches', id);
    if (batch) {
      batch.status = status;
      batch.retryCount = status === 'failed' ? batch.retryCount + 1 : batch.retryCount;
      if (error) batch.error = error;
      await this.db!.put('pendingBatches', batch);
    }
  }

  async deletePendingBatch(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('pendingBatches', id);
  }

  // Pending Updates
  async savePendingUpdate(batchId: string, data: Record<string, unknown>): Promise<string> {
    await this.init();
    const id = `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingUpdate: PendingUpdate = {
      id,
      batchId,
      data,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await this.db!.put('pendingUpdates', pendingUpdate);
    await this.addToSyncQueue('update', id, 2);
    
    return id;
  }

  async getPendingUpdate(id: string): Promise<PendingUpdate | undefined> {
    await this.init();
    return this.db!.get('pendingUpdates', id);
  }

  async getAllPendingUpdates(): Promise<PendingUpdate[]> {
    await this.init();
    return this.db!.getAll('pendingUpdates');
  }

  async getPendingUpdatesByBatchId(batchId: string): Promise<PendingUpdate[]> {
    await this.init();
    return this.db!.getAllFromIndex('pendingUpdates', 'by-batchId', batchId);
  }

  async updateUpdateStatus(
    id: string,
    status: PendingUpdate['status'],
    error?: string
  ): Promise<void> {
    await this.init();
    const update = await this.db!.get('pendingUpdates', id);
    if (update) {
      update.status = status;
      update.retryCount = status === 'failed' ? update.retryCount + 1 : update.retryCount;
      if (error) update.error = error;
      await this.db!.put('pendingUpdates', update);
    }
  }

  async deletePendingUpdate(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('pendingUpdates', id);
  }

  // Sync Queue
  private async addToSyncQueue(
    type: 'batch' | 'update',
    referenceId: string,
    priority: number
  ): Promise<void> {
    await this.init();
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: SyncQueueItem = {
      id,
      type,
      referenceId,
      timestamp: Date.now(),
      priority,
      attempts: 0,
    };

    await this.db!.put('syncQueue', queueItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    const items = await this.db!.getAll('syncQueue');
    // Sort by priority (lower number = higher priority) and timestamp
    return items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.timestamp - b.timestamp;
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('syncQueue', id);
  }

  async incrementQueueAttempts(id: string): Promise<void> {
    await this.init();
    const item = await this.db!.get('syncQueue', id);
    if (item) {
      item.attempts++;
      await this.db!.put('syncQueue', item);
    }
  }

  // Utility methods
  async getPendingCount(): Promise<{ batches: number; updates: number }> {
    await this.init();
    const batches = await this.db!.getAllFromIndex('pendingBatches', 'by-status', 'pending');
    const updates = await this.db!.getAllFromIndex('pendingUpdates', 'by-status', 'pending');
    
    return {
      batches: batches.length,
      updates: updates.length,
    };
  }

  async clearSyncedItems(): Promise<void> {
    await this.init();
    
    // Clear synced batches
    const syncedBatches = await this.db!.getAllFromIndex('pendingBatches', 'by-status', 'synced');
    for (const batch of syncedBatches) {
      await this.db!.delete('pendingBatches', batch.id);
    }

    // Clear synced updates
    const syncedUpdates = await this.db!.getAllFromIndex('pendingUpdates', 'by-status', 'synced');
    for (const update of syncedUpdates) {
      await this.db!.delete('pendingUpdates', update.id);
    }
  }

  async clearAll(): Promise<void> {
    await this.init();
    await this.db!.clear('pendingBatches');
    await this.db!.clear('pendingUpdates');
    await this.db!.clear('syncQueue');
  }
}

export const offlineStorage = new OfflineStorageService();