import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Batch, SyncQueueItem } from '../types';

const KEYS = {
  BATCHES: '@cropchain/batches',
  QUEUE: '@cropchain/sync_queue',
  USER: '@cropchain/user',
  PENDING_COUNT: '@cropchain/pending_count',
};

export const offlineStorage = {
  async saveBatches(batches: Batch[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.BATCHES, JSON.stringify(batches));
  },

  async getBatches(): Promise<Batch[]> {
    const data = await AsyncStorage.getItem(KEYS.BATCHES);
    return data ? JSON.parse(data) : [];
  },

  async saveBatch(batch: Batch): Promise<void> {
    const batches = await this.getBatches();
    const index = batches.findIndex((b) => b.id === batch.id);
    if (index >= 0) batches[index] = batch;
    else batches.unshift(batch);
    await this.saveBatches(batches);
  },

  async getBatch(id: string): Promise<Batch | undefined> {
    const batches = await this.getBatches();
    return batches.find((b) => b.id === id);
  },

  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },

  async getQueue(): Promise<SyncQueueItem[]> {
    const data = await AsyncStorage.getItem(KEYS.QUEUE);
    return data ? JSON.parse(data) : [];
  },

  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
    const queue = await this.getQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
      retries: 0,
    };
    queue.push(newItem);
    queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
  },

  async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(filtered));
  },

  async incrementRetry(id: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find((i) => i.id === id);
    if (item) {
      item.retries++;
      await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
    }
  },

  async clearSynced(): Promise<void> {
    const queue = await this.getQueue();
    const failed = queue.filter((item) => item.retries >= 5);
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(failed));
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
