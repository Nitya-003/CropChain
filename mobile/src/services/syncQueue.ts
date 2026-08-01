import NetInfo from "@react-native-community/netinfo";
import { offlineStorage } from "./offlineStorage";
import { batchService } from "./batch.service";
import type { BatchStageUpdatePayload, SyncQueueInput } from "../types";

type SyncStatus = "idle" | "syncing" | "error";

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

const batchStages = new Set(["farmer", "mandi", "transport", "retailer"]);

function isStageUpdatePayload(data: unknown): data is BatchStageUpdatePayload {
  if (!data || typeof data !== "object") return false;
  const payload = data as Partial<BatchStageUpdatePayload>;
  return (
    typeof payload.stage === "string" &&
    batchStages.has(payload.stage) &&
    typeof payload.actor === "string" &&
    payload.actor.trim().length >= 2 &&
    typeof payload.location === "string" &&
    payload.location.trim().length >= 2 &&
    (payload.notes === undefined || typeof payload.notes === "string")
  );
}

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

  async addToQueue(params: SyncQueueInput) {
    await offlineStorage.addToQueue({
      ...params,
      priority: "normal",
    });
    this.notify("idle");

    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify("syncing");

    try {
      const queue = await offlineStorage.getQueue();

      for (const item of queue) {
        try {
          if (item.action === "stage_update") {
            if (!isStageUpdatePayload(item.data)) {
              throw new Error(
                `Invalid stage update payload for queue item ${item.id}`,
              );
            }
            await batchService.updateStage(item.batchId, item.data);
          }
          await offlineStorage.removeFromQueue(item.id);
        } catch (error) {
          console.error(`Failed to sync queue item ${item.id}`, error);
          await offlineStorage.incrementRetry(item.id);
          if (item.retries >= 4) {
            await offlineStorage.removeFromQueue(item.id);
          }
        }
      }
      this.notify("idle");
    } catch {
      this.notify("error");
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
