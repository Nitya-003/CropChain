import { offlineStorage, PendingBatch, PendingUpdate } from './offlineStorage';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncEvent {
  type: 'batch' | 'update';
  id: string;
  status: 'success' | 'error';
  error?: string;
}

class SyncManager {
  private syncInProgress = false;
  private syncListeners: Array<(event: SyncEvent) => void> = [];
  private statusListeners: Array<(status: SyncStatus) => void> = [];
  private currentStatus: SyncStatus = 'idle';
  private readonly MAX_RETRIES = 3;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Check if we're online on initialization
    if (navigator.onLine) {
      this.scheduleSyncCheck();
    }
  }

  private handleOnline(): void {
    console.log('[SyncManager] Connection restored, starting sync...');
    this.triggerSync();
  }

  private handleOffline(): void {
    console.log('[SyncManager] Connection lost');
    this.updateStatus('idle');
  }

  private scheduleSyncCheck(): void {
    // Check for pending items every 30 seconds when online
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        void this.checkAndSync().catch(error => {
          console.error('[SyncManager] Periodic sync check failed:', error);
        });
      }
    }, 30000);
  }

  private async checkAndSync(): Promise<void> {
    const counts = await offlineStorage.getPendingCount();
    if (counts.batches > 0 || counts.updates > 0) {
      console.log(`[SyncManager] Found ${counts.batches} batches and ${counts.updates} updates to sync`);
      await this.triggerSync();
    }
  }

  async triggerSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[SyncManager] Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('[SyncManager] Cannot sync while offline');
      return;
    }

    this.syncInProgress = true;
    this.updateStatus('syncing');

    try {
      await this.syncPendingItems();
      this.updateStatus('idle');
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      this.updateStatus('error');
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncPendingItems(): Promise<void> {
    const queue = await offlineStorage.getSyncQueue();
    
    for (const item of queue) {
      try {
        if (item.type === 'batch') {
          await this.syncBatch(item.referenceId);
        } else {
          await this.syncUpdate(item.referenceId);
        }
        
        // Remove from queue after successful sync
        await offlineStorage.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`[SyncManager] Failed to sync ${item.type} ${item.referenceId}:`, error);
        
        // Increment attempts
        await offlineStorage.incrementQueueAttempts(item.id);
        const updatedAttempts = item.attempts + 1;
        
        // If max retries reached, mark as failed
        if (updatedAttempts >= this.MAX_RETRIES) {
          if (item.type === 'batch') {
            await offlineStorage.updateBatchStatus(
              item.referenceId,
              'failed',
              error instanceof Error ? error.message : 'Unknown error'
            );
          } else {
            await offlineStorage.updateUpdateStatus(
              item.referenceId,
              'failed',
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
          
          await offlineStorage.removeFromSyncQueue(item.id);
          
          this.notifyListeners({
            type: item.type,
            id: item.referenceId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Clean up synced items
    await offlineStorage.clearSyncedItems();
  }

  private async syncBatch(id: string): Promise<void> {
    const pendingBatch = await offlineStorage.getPendingBatch(id);
    if (!pendingBatch || pendingBatch.status === 'synced') {
      return;
    }

    // Update status to syncing
    await offlineStorage.updateBatchStatus(id, 'syncing');

    try {
      // Call the backend API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingBatch.data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
      // Mark as synced
      await offlineStorage.updateBatchStatus(id, 'synced');
      
      // Notify listeners
      this.notifyListeners({
        type: 'batch',
        id,
        status: 'success',
      });

      console.log(`[SyncManager] Successfully synced batch ${id}`);
    } catch (error) {
      await offlineStorage.updateBatchStatus(id, 'pending');
      throw error;
    }
  }

  private async syncUpdate(id: string): Promise<void> {
    const pendingUpdate = await offlineStorage.getPendingUpdate(id);
    if (!pendingUpdate || pendingUpdate.status === 'synced') {
      return;
    }

    // Update status to syncing
    await offlineStorage.updateUpdateStatus(id, 'syncing');

    try {
      // Call the backend API
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/batches/${pendingUpdate.batchId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pendingUpdate.data),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
      // Mark as synced
      await offlineStorage.updateUpdateStatus(id, 'synced');
      
      // Notify listeners
      this.notifyListeners({
        type: 'update',
        id,
        status: 'success',
      });

      console.log(`[SyncManager] Successfully synced update ${id}`);
    } catch (error) {
      await offlineStorage.updateUpdateStatus(id, 'pending');
      throw error;
    }
  }

  // Event listeners
  onSync(callback: (event: SyncEvent) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    // Immediately call with current status
    callback(this.currentStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: SyncEvent): void {
    this.syncListeners.forEach(callback => callback(event));
  }

  private updateStatus(status: SyncStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach(callback => callback(status));
  }

  // Public methods
  async getPendingCount(): Promise<{ batches: number; updates: number }> {
    return offlineStorage.getPendingCount();
  }

  async getAllPendingBatches(): Promise<PendingBatch[]> {
    return offlineStorage.getAllPendingBatches();
  }

  async getAllPendingUpdates(): Promise<PendingUpdate[]> {
    return offlineStorage.getAllPendingUpdates();
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  getStatus(): SyncStatus {
    return this.currentStatus;
  }

  async retryFailed(): Promise<void> {
    // Reset failed items to pending
    const batches = await offlineStorage.getAllPendingBatches();
    for (const batch of batches) {
      if (batch.status === 'failed') {
        await offlineStorage.updateBatchStatus(batch.id, 'pending');
        await offlineStorage.addToSyncQueue('batch', batch.id, 1);
      }
    }

    const updates = await offlineStorage.getAllPendingUpdates();
    for (const update of updates) {
      if (update.status === 'failed') {
        await offlineStorage.updateUpdateStatus(update.id, 'pending');
        await offlineStorage.addToSyncQueue('update', update.id, 2);
      }
    }

    // Trigger sync
    await this.triggerSync();
  }
}

export const syncManager = new SyncManager();