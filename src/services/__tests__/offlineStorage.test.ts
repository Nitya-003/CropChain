import { offlineStorage } from '../offlineStorage';

describe('OfflineStorage', () => {
  beforeEach(async () => {
    await offlineStorage.init();
    await offlineStorage.clearAll();
  });

  describe('Pending Batches', () => {
    it('should save and retrieve pending batch', async () => {
      const testData = {
        farmerName: 'Test Farmer',
        cropType: 'rice',
        quantity: 1000,
      };

      const id = await offlineStorage.savePendingBatch(testData);
      expect(id).toBeTruthy();

      const batch = await offlineStorage.getPendingBatch(id);
      expect(batch).toBeDefined();
      expect(batch?.data).toEqual(testData);
      expect(batch?.status).toBe('pending');
    });

    it('should update batch status', async () => {
      const testData = { farmerName: 'Test' };
      const id = await offlineStorage.savePendingBatch(testData);

      await offlineStorage.updateBatchStatus(id, 'syncing');
      let batch = await offlineStorage.getPendingBatch(id);
      expect(batch?.status).toBe('syncing');

      await offlineStorage.updateBatchStatus(id, 'synced');
      batch = await offlineStorage.getPendingBatch(id);
      expect(batch?.status).toBe('synced');
    });

    it('should get all pending batches', async () => {
      await offlineStorage.savePendingBatch({ test: 1 });
      await offlineStorage.savePendingBatch({ test: 2 });
      await offlineStorage.savePendingBatch({ test: 3 });

      const batches = await offlineStorage.getAllPendingBatches();
      expect(batches).toHaveLength(3);
    });

    it('should delete pending batch', async () => {
      const id = await offlineStorage.savePendingBatch({ test: 1 });
      await offlineStorage.deletePendingBatch(id);

      const batch = await offlineStorage.getPendingBatch(id);
      expect(batch).toBeUndefined();
    });
  });

  describe('Pending Updates', () => {
    it('should save and retrieve pending update', async () => {
      const testData = {
        stage: 'mandi',
        actor: 'Test Actor',
        location: 'Test Location',
      };

      const id = await offlineStorage.savePendingUpdate('BATCH-001', testData);
      expect(id).toBeTruthy();

      const update = await offlineStorage.getPendingUpdate(id);
      expect(update).toBeDefined();
      expect(update?.batchId).toBe('BATCH-001');
      expect(update?.data).toEqual(testData);
      expect(update?.status).toBe('pending');
    });

    it('should get updates by batch ID', async () => {
      await offlineStorage.savePendingUpdate('BATCH-001', { test: 1 });
      await offlineStorage.savePendingUpdate('BATCH-001', { test: 2 });
      await offlineStorage.savePendingUpdate('BATCH-002', { test: 3 });

      const updates = await offlineStorage.getPendingUpdatesByBatchId('BATCH-001');
      expect(updates).toHaveLength(2);
    });
  });

  describe('Sync Queue', () => {
    it('should add items to sync queue', async () => {
      await offlineStorage.savePendingBatch({ test: 1 });
      await offlineStorage.savePendingUpdate('BATCH-001', { test: 2 });

      const queue = await offlineStorage.getSyncQueue();
      expect(queue.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort queue by priority', async () => {
      // Batches have priority 1, updates have priority 2
      await offlineStorage.savePendingUpdate('BATCH-001', { test: 1 });
      await offlineStorage.savePendingBatch({ test: 2 });

      const queue = await offlineStorage.getSyncQueue();
      expect(queue[0].type).toBe('batch'); // Higher priority
    });
  });

  describe('Utility Methods', () => {
    it('should get pending count', async () => {
      await offlineStorage.savePendingBatch({ test: 1 });
      await offlineStorage.savePendingBatch({ test: 2 });
      await offlineStorage.savePendingUpdate('BATCH-001', { test: 3 });

      const counts = await offlineStorage.getPendingCount();
      expect(counts.batches).toBe(2);
      expect(counts.updates).toBe(1);
    });

    it('should clear synced items', async () => {
      const id1 = await offlineStorage.savePendingBatch({ test: 1 });
      const id2 = await offlineStorage.savePendingBatch({ test: 2 });

      await offlineStorage.updateBatchStatus(id1, 'synced');

      await offlineStorage.clearSyncedItems();

      const batch1 = await offlineStorage.getPendingBatch(id1);
      const batch2 = await offlineStorage.getPendingBatch(id2);

      expect(batch1).toBeUndefined();
      expect(batch2).toBeDefined();
    });
  });
});