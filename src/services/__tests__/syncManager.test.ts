import { syncManager } from '../syncManager';
import { offlineStorage } from '../offlineStorage';
import toast from 'react-hot-toast';

// Mock the offlineStorage
jest.mock('../offlineStorage', () => ({
  offlineStorage: {
    getPendingCount: jest.fn(),
    getAllPendingBatches: jest.fn(),
    getAllPendingUpdates: jest.fn(),
    getSyncQueue: jest.fn(),
    removeFromSyncQueue: jest.fn(),
    incrementQueueAttempts: jest.fn(),
    updateBatchStatus: jest.fn(),
    updateUpdateStatus: jest.fn(),
    clearSyncedItems: jest.fn(),
    addToSyncQueue: jest.fn(),
    getPendingBatch: jest.fn(),
    getPendingUpdate: jest.fn(),
  },
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('SyncManager - Complete Implementation Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('Phase 1: Event-Driven Architecture', () => {
    test('should listen to online/offline events', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      // Re-initialize syncManager to test constructor
      const newSyncManager = new (syncManager as any).constructor();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
    });

    test('should trigger sync immediately when coming online', async () => {
      const triggerSyncSpy = jest.spyOn(syncManager as any, 'triggerSync');
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      
      // Simulate coming online
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);
      
      expect(mockToast).toHaveBeenCalledWith('Connection restored. Syncing your data...', {
        duration: 2000,
        position: 'top-right',
      });
      
      // Wait for async triggerSync
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(triggerSyncSpy).toHaveBeenCalled();
    });

    test('should clear retry timeout when going offline', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Simulate going offline
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect((syncManager as any).currentRetryAttempt).toBe(0);
      
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Phase 2: Exponential Backoff', () => {
    test('should implement exponential backoff correctly', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Mock sync failure to trigger backoff
      (syncManager as any).currentRetryAttempt = 0;
      
      // Trigger backoff
      (syncManager as any).scheduleRetryWithBackoff();
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000); // 2^0 * 2000 = 2000
      
      // Second attempt
      (syncManager as any).scheduleRetryWithBackoff();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000); // 2^1 * 2000 = 4000
      
      // Third attempt
      (syncManager as any).scheduleRetryWithBackoff();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 8000); // 2^2 * 2000 = 8000
      
      setTimeoutSpy.mockRestore();
    });

    test('should cap delay at MAX_RETRY_DELAY_MS', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      // Set high retry attempt to test capping
      (syncManager as any).currentRetryAttempt = 10;
      (syncManager as any).scheduleRetryWithBackoff();
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000); // MAX_RETRY_DELAY_MS
      
      setTimeoutSpy.mockRestore();
    });

    test('should stop retrying after MAX_RETRIES', () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      
      (syncManager as any).currentRetryAttempt = 5; // MAX_RETRIES
      (syncManager as any).scheduleRetryWithBackoff();
      
      expect(mockToast).toHaveBeenCalledWith(
        'Sync failed after multiple attempts. Please check your connection and try again.',
        {
          duration: 5000,
          position: 'top-right',
        }
      );
    });
  });

  describe('Phase 3: Promise Rejection Handling & User Notifications', () => {
    test('should handle constructor errors gracefully', async () => {
      const mockGetPendingCount = (offlineStorage.getPendingCount as jest.Mock).mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Re-initialize to test constructor error handling
      const newSyncManager = new (syncManager as any).constructor();
      
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(consoleSpy).toHaveBeenCalledWith('[SyncManager] Initial sync check failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
      mockGetPendingCount.mockRestore();
    });

    test('should show success notification when all data synced', async () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      const mockGetPendingCount = (offlineStorage.getPendingCount as jest.Mock).mockResolvedValue({ batches: 0, updates: 0 });
      const mockSyncPendingItems = jest.spyOn(syncManager as any, 'syncPendingItems').mockResolvedValue(undefined);
      
      await syncManager.triggerSync();
      
      expect(mockToast.success).toHaveBeenCalledWith('All data synced successfully!', {
        duration: 3000,
        position: 'top-right',
      });
      
      mockSyncPendingItems.mockRestore();
      mockGetPendingCount.mockRestore();
    });

    test('should handle retryFailed errors with user notification', async () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      const mockGetAllPendingBatches = (offlineStorage.getAllPendingBatches as jest.Mock).mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await syncManager.retryFailed();
      
      expect(consoleSpy).toHaveBeenCalledWith('[SyncManager] Failed to retry failed items:', expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith('Failed to retry sync operations. Please try again manually.', {
        duration: 4000,
        position: 'top-right',
      });
      
      consoleSpy.mockRestore();
      mockGetAllPendingBatches.mockRestore();
    });

    test('should handle online event sync trigger errors', async () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      const mockTriggerSync = jest.spyOn(syncManager, 'triggerSync').mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate coming online
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(consoleSpy).toHaveBeenCalledWith('[SyncManager] Failed to trigger sync on connection restore:', expect.any(Error));
      expect(mockToast.error).toHaveBeenCalledWith('Failed to start sync after connection restore.', {
        duration: 3000,
        position: 'top-right',
      });
      
      consoleSpy.mockRestore();
      mockTriggerSync.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete offline-to-online sync flow', async () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      const mockGetPendingCount = (offlineStorage.getPendingCount as jest.Mock)
        .mockResolvedValueOnce({ batches: 2, updates: 1 }) // Initial check
        .mockResolvedValueOnce({ batches: 0, updates: 0 }); // After sync
      const mockSyncPendingItems = jest.spyOn(syncManager as any, 'syncPendingItems').mockResolvedValue(undefined);
      
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);
      
      // Come online
      Object.defineProperty(navigator, 'onLine', { value: true });
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should show connection restored notification
      expect(mockToast).toHaveBeenCalledWith('Connection restored. Syncing your data...', expect.any(Object));
      
      // Should show success notification after sync
      expect(mockToast.success).toHaveBeenCalledWith('All data synced successfully!', expect.any(Object));
      
      mockSyncPendingItems.mockRestore();
      mockGetPendingCount.mockRestore();
    });

    test('should handle sync failure with exponential backoff', async () => {
      const mockToast = toast as jest.MockedFunction<typeof toast>;
      const mockSyncPendingItems = jest.spyOn(syncManager as any, 'syncPendingItems').mockRejectedValue(new Error('Server error'));
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        return setTimeout(callback, 10); // Speed up test
      });
      
      await syncManager.triggerSync();
      
      // Should trigger first retry
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
      
      // Simulate max retries
      (syncManager as any).currentRetryAttempt = 5;
      (syncManager as any).scheduleRetryWithBackoff();
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'Sync failed after multiple attempts. Please check your connection and try again.',
        expect.any(Object)
      );
      
      mockSyncPendingItems.mockRestore();
      setTimeoutSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('should not sync when already in progress', async () => {
      (syncManager as any).syncInProgress = true;
      const mockSyncPendingItems = jest.spyOn(syncManager as any, 'syncPendingItems');
      
      await syncManager.triggerSync();
      
      expect(mockSyncPendingItems).not.toHaveBeenCalled();
      
      (syncManager as any).syncInProgress = false;
      mockSyncPendingItems.mockRestore();
    });

    test('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      const mockSyncPendingItems = jest.spyOn(syncManager as any, 'syncPendingItems');
      
      await syncManager.triggerSync();
      
      expect(mockSyncPendingItems).not.toHaveBeenCalled();
      
      Object.defineProperty(navigator, 'onLine', { value: true });
      mockSyncPendingItems.mockRestore();
    });

    test('should clear existing timeout before starting new sync', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      (syncManager as any).retryTimeoutId = 123;
      
      await syncManager.triggerSync();
      
      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
      expect((syncManager as any).retryTimeoutId).toBeNull();
      
      clearTimeoutSpy.mockRestore();
    });
  });
});
