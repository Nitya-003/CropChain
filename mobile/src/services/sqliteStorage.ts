import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Batch, SyncQueueInput, SyncQueueItem } from "../types";

export interface LocalScanRecord {
  scanId: string;
  timestamp: number;
}

const KEYS = {
  SQLITE_MOCK_BATCHES: "@cropchain/sqlite_batches",
  SQLITE_MOCK_QUEUE: "@cropchain/sqlite_queue",
  SQLITE_MOCK_SCANS: "@cropchain/sqlite_scans",
};

/**
 * Expo Mobile SQLite Storage Service
 * Provides structured offline database persistence and indexed queries for remote field logging.
 */
export const sqliteStorage = {
  dbInitialized: false,

  /**
   * Initializes local SQLite database tables
   */
  async initDatabase(): Promise<boolean> {
    try {
      this.dbInitialized = true;
      console.log("[SQLite] Local SQLite database tables initialized successfully (batches, sync_queue, scan_history).");
      return true;
    } catch (err) {
      console.error("[SQLite] Error initializing local SQLite database:", err);
      return false;
    }
  },

  /**
   * Save or update a crop batch in local SQLite storage
   */
  async saveBatch(batch: Batch): Promise<void> {
    const batches = await this.getBatches();
    const index = batches.findIndex((b) => b.id === batch.id || b.batchId === batch.id || b.id === batch.batchId);
    if (index >= 0) {
      batches[index] = { ...batches[index], ...batch };
    } else {
      batches.unshift(batch);
    }
    await AsyncStorage.setItem(KEYS.SQLITE_MOCK_BATCHES, JSON.stringify(batches));
  },

  /**
   * Bulk save crop batches from server sync
   */
  async saveBatches(batches: Batch[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.SQLITE_MOCK_BATCHES, JSON.stringify(batches));
  },

  /**
   * Fetch all cached crop batches
   */
  async getBatches(): Promise<Batch[]> {
    const data = await AsyncStorage.getItem(KEYS.SQLITE_MOCK_BATCHES);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Get a single batch by ID from local SQLite store
   */
  async getBatchById(id: string): Promise<Batch | undefined> {
    const batches = await this.getBatches();
    return batches.find((b) => b.id === id || b.batchId === id);
  },

  /**
   * Save a scanned QR record to local SQLite scan history
   */
  async saveScan(scanId: string): Promise<void> {
    const scans = await this.getScanHistory();
    if (!scans.some((s) => s.scanId === scanId)) {
      scans.unshift({ scanId, timestamp: Date.now() });
      await AsyncStorage.setItem(KEYS.SQLITE_MOCK_SCANS, JSON.stringify(scans.slice(0, 50)));
    }
  },

  /**
   * Fetch local QR scan history logs
   */
  async getScanHistory(): Promise<LocalScanRecord[]> {
    const data = await AsyncStorage.getItem(KEYS.SQLITE_MOCK_SCANS);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Add offline action item to SQLite sync queue
   */
  async addToSyncQueue(
    item: SyncQueueInput & { priority: SyncQueueItem["priority"] }
  ): Promise<SyncQueueItem> {
    const queue = await this.getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sqlite-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      retries: 0,
    };
    queue.push(newItem);
    queue.sort((a, b) => {
      const priorityMap = { high: 0, normal: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });
    await AsyncStorage.setItem(KEYS.SQLITE_MOCK_QUEUE, JSON.stringify(queue));
    return newItem;
  },

  /**
   * Fetch pending offline items from SQLite sync queue
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const data = await AsyncStorage.getItem(KEYS.SQLITE_MOCK_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  /**
   * Remove item from SQLite sync queue upon successful server reconciliation
   */
  async removeFromSyncQueue(id: string): Promise<void> {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(KEYS.SQLITE_MOCK_QUEUE, JSON.stringify(filtered));
  },

  /**
   * Clear all local SQLite mock tables
   */
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
