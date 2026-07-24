import { offlineStorage, PendingBatch, PendingUpdate } from "./offlineStorage";
import { apiClient } from "./apiClient";
import toast from "react-hot-toast";

export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncEvent {
  type: "batch" | "update";
  id: string;
  status: "success" | "error";
  error?: string;
}

class SyncManager {
  private syncInProgress = false;
  private syncListeners: Array<(event: SyncEvent) => void> = [];
  private statusListeners: Array<(status: SyncStatus) => void> = [];
  private currentStatus: SyncStatus = "idle";
  private _isOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_RETRY_DELAY_MS = 2000;
  private readonly MAX_RETRY_DELAY_MS = 60000;
  private retryTimeoutId: any = null;
  private currentRetryAttempt = 0;

  constructor() {
    if (typeof window !== "undefined") {
      // Listen for online/offline events
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());

      // Listen for messages from the service worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data && event.data.type === "SW_ONLINE_SYNC") {
            console.log(
              "[SyncManager] Received SW_ONLINE_SYNC message from service worker",
            );
            void this.triggerSync().catch((error) => {
              console.error("[SyncManager] SW triggered sync failed:", error);
            });
          }
        });
      }

      // Initialize online state
      this._isOnline = navigator.onLine;

      // Check for pending items immediately if online with proper error handling
      if (this._isOnline) {
        void this.checkAndSync().catch((error) => {
          console.error("[SyncManager] Initial sync check failed:", error);
        });
      }
    }
  }

  private handleOnline(): void {
    console.log(
      "[SyncManager] Connection restored, updating online state and starting sync...",
    );
    this._isOnline = true;

    // Show notification that connection is restored
    toast("Connection restored. Syncing your data...", {
      duration: 2000,
      position: "top-right",
    });

    // Trigger sync with proper error handling
    void this.triggerSync().catch((error) => {
      console.error(
        "[SyncManager] Failed to trigger sync on connection restore:",
        error,
      );
      toast.error("Failed to start sync after connection restore.", {
        duration: 3000,
        position: "top-right",
      });
    });
  }

  private handleOffline(): void {
    console.log("[SyncManager] Connection lost, updating online state");
    this._isOnline = false;
    this.updateStatus("idle");
    // Clear any pending retry timeout when going offline
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.currentRetryAttempt = 0;
  }

  private async checkAndSync(): Promise<void> {
    const counts = await offlineStorage.getPendingCount();
    if (counts.batches > 0 || counts.updates > 0) {
      console.log(
        `[SyncManager] Found ${counts.batches} batches and ${counts.updates} updates to sync`,
      );
      await this.triggerSync();
    }
  }

  async triggerSync(): Promise<void> {
    if (this.syncInProgress) {
      console.log("[SyncManager] Sync already in progress");
      return;
    }

    if (!this._isOnline) {
      console.log("[SyncManager] Cannot sync while offline");
      return;
    }

    // Clear any existing retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.syncInProgress = true;
    this.updateStatus("syncing");

    try {
      await this.syncPendingItems();
      this.updateStatus("idle");
      // Reset retry attempt on successful sync
      this.currentRetryAttempt = 0;

      // Show success notification for background sync completion
      const counts = await offlineStorage.getPendingCount();
      if (counts.batches === 0 && counts.updates === 0) {
        toast.success("All data synced successfully!", {
          duration: 3000,
          position: "top-right",
        });
      }
    } catch (error) {
      console.error("[SyncManager] Sync failed:", error);
      this.updateStatus("error");

      // Implement exponential backoff retry logic
      this.scheduleRetryWithBackoff();
    } finally {
      this.syncInProgress = false;
    }
  }

  private scheduleRetryWithBackoff(): void {
    if (this.currentRetryAttempt >= this.MAX_RETRIES) {
      console.log("[SyncManager] Max retries reached, giving up");
      this.updateStatus("idle");

      // Show permanent failure notification to user
      toast.error(
        "Sync failed after multiple attempts. Please check your connection and try again.",
        {
          duration: 5000,
          position: "top-right",
        },
      );
      return;
    }

    const delay = Math.min(
      this.INITIAL_RETRY_DELAY_MS * Math.pow(2, this.currentRetryAttempt),
      this.MAX_RETRY_DELAY_MS,
    );

    this.currentRetryAttempt++;
    console.log(
      `[SyncManager] Scheduling retry attempt ${this.currentRetryAttempt} in ${delay}ms`,
    );

    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      void this.triggerSync();
    }, delay);
  }

  private async syncPendingItems(): Promise<void> {
    const queue = await offlineStorage.getSyncQueue();

    for (const item of queue) {
      try {
        if (item.type === "batch") {
          await this.syncBatch(item.referenceId);
        } else {
          await this.syncUpdate(item.referenceId);
        }

        // Remove from queue after successful sync
        await offlineStorage.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(
          `[SyncManager] Failed to sync ${item.type} ${item.referenceId}:`,
          error,
        );

        // Increment attempts
        await offlineStorage.incrementQueueAttempts(item.id);
        const updatedAttempts = item.attempts + 1;

        // If max retries reached, mark as failed
        if (updatedAttempts >= this.MAX_RETRIES) {
          if (item.type === "batch") {
            await offlineStorage.updateBatchStatus(
              item.referenceId,
              "failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          } else {
            await offlineStorage.updateUpdateStatus(
              item.referenceId,
              "failed",
              error instanceof Error ? error.message : "Unknown error",
            );
          }

          await offlineStorage.removeFromSyncQueue(item.id);

          this.notifyListeners({
            type: item.type,
            id: item.referenceId,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    // Clean up synced items
    await offlineStorage.clearSyncedItems();
  }

  private async syncBatch(id: string): Promise<void> {
    const pendingBatch = await offlineStorage.getPendingBatch(id);
    if (!pendingBatch || pendingBatch.status === "synced") {
      return;
    }

    // Update status to syncing
    await offlineStorage.updateBatchStatus(id, "syncing");

    try {
      await apiClient.post("/batches", pendingBatch.data);

      await offlineStorage.updateBatchStatus(id, "synced");

      this.notifyListeners({
        type: "batch",
        id,
        status: "success",
      });

      console.log(`[SyncManager] Successfully synced batch ${id}`);
    } catch (error) {
      await offlineStorage.updateBatchStatus(id, "pending");
      throw error;
    }
  }

  private async syncUpdate(id: string): Promise<void> {
    const pendingUpdate = await offlineStorage.getPendingUpdate(id);
    if (!pendingUpdate || pendingUpdate.status === "synced") {
      return;
    }

    // Update status to syncing
    await offlineStorage.updateUpdateStatus(id, "syncing");

    try {
      await apiClient.put(
        `/batches/${pendingUpdate.batchId}`,
        pendingUpdate.data,
      );

      await offlineStorage.updateUpdateStatus(id, "synced");

      this.notifyListeners({
        type: "update",
        id,
        status: "success",
      });

      console.log(`[SyncManager] Successfully synced update ${id}`);
    } catch (error) {
      await offlineStorage.updateUpdateStatus(id, "pending");
      throw error;
    }
  }

  // Event listeners
  onSync(callback: (event: SyncEvent) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter((cb) => cb !== callback);
    };
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(callback);
    // Immediately call with current status
    callback(this.currentStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(
        (cb) => cb !== callback,
      );
    };
  }

  private notifyListeners(event: SyncEvent): void {
    this.syncListeners.forEach((callback) => callback(event));
  }

  private updateStatus(status: SyncStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((callback) => callback(status));
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
    return this._isOnline;
  }

  getStatus(): SyncStatus {
    return this.currentStatus;
  }

  async retryFailed(): Promise<void> {
    try {
      // Reset failed items to pending and reset retry counter
      const batches = await offlineStorage.getAllPendingBatches();
      for (const batch of batches) {
        if (batch.status === "failed") {
          await offlineStorage.updateBatchStatus(batch.id, "pending");
          await offlineStorage.addToSyncQueue("batch", batch.id, 1);
        }
      }

      const updates = await offlineStorage.getAllPendingUpdates();
      for (const update of updates) {
        if (update.status === "failed") {
          await offlineStorage.updateUpdateStatus(update.id, "pending");
          await offlineStorage.addToSyncQueue("update", update.id, 2);
        }
      }

      // Reset retry attempt counter for fresh start
      this.currentRetryAttempt = 0;

      // Show notification that retry is starting
      toast("Retrying failed sync operations...", {
        duration: 2000,
        position: "top-right",
      });

      // Trigger sync
      await this.triggerSync();
    } catch (error) {
      console.error("[SyncManager] Failed to retry failed items:", error);
      toast.error(
        "Failed to retry sync operations. Please try again manually.",
        {
          duration: 4000,
          position: "top-right",
        },
      );
    }
  } // end retryFailed

  /**
   * Conflict resolution: permanently discard a pending update that is in
   * 'conflict' status so it is no longer retried.
   */
  async discardPendingUpdate(pendingId: string): Promise<void> {
    try {
      await offlineStorage.updateUpdateStatus(
        pendingId,
        "failed",
        "Discarded by user during conflict resolution",
      );
      await offlineStorage.removeFromSyncQueue(pendingId);
      this.notifyListeners({
        type: "update",
        id: pendingId,
        status: "error",
        error: "Discarded",
      });
      toast("Local change discarded.", {
        duration: 2000,
        position: "top-right",
      });
    } catch (error) {
      console.error("[SyncManager] Failed to discard pending update:", error);
      throw error;
    }
  }

  /**
   * Conflict resolution: replace the stored payload of a conflicted pending
   * update with the user-edited one, reset its status to 'pending', and
   * re-enqueue it for syncing.
   */
  async resubmitWithResolution(
    pendingId: string,
    resolvedData: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Patch the stored payload
      await offlineStorage.updatePendingUpdateData(pendingId, resolvedData);
      // Reset status so it gets picked up on next sync
      await offlineStorage.updateUpdateStatus(pendingId, "pending");
      // Re-enqueue (priority 1 so it goes to the front)
      await offlineStorage.addToSyncQueue("update", pendingId, 1);
      toast("Change resubmitted — syncing now...", {
        duration: 2000,
        position: "top-right",
      });
      await this.triggerSync();
    } catch (error) {
      console.error("[SyncManager] Failed to resubmit resolved update:", error);
      throw error;
    }
  }
} // end SyncManager

export const syncManager = new SyncManager();
