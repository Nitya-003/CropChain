import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, Wifi, WifiOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { syncManager, SyncStatus } from '../services/syncManager';
import { ConflictResolutionModal } from './ConflictResolutionModal';

const SyncStatusIndicator: React.FC = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState({ batches: 0, updates: 0 });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Conflict states
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync status changes
    const unsubscribeStatus = syncManager.onStatusChange((status) => {
      setSyncStatus(status);
    });

    // Listen for sync events
    const unsubscribeSync = syncManager.onSync(() => {
      updatePendingCount();
    });

    // Update pending count periodically
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeStatus();
      unsubscribeSync();
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = async () => {
    try {
      const counts = await syncManager.getPendingCount();
      setPendingCount(counts);

      // Fetch conflict updates
      const pendingUpdates = await syncManager.getAllPendingUpdates();
      const conflictItems = pendingUpdates.filter((u) => u.status === 'conflict');
      setConflicts(conflictItems);
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleRetrySync = async () => {
    try {
      if (isOnline) {
        await syncManager.triggerSync();
      }
    } catch (err) {
      console.error('Failed to trigger sync:', err);
    }
  };

  const handleRetryFailed = async () => {
    try {
      await syncManager.retryFailed();
    } catch (err) {
      console.error('Failed to retry sync:', err);
    }
  };

  const handleResolveConflict = (conflictItem: any) => {
    setSelectedConflict(conflictItem);
    setShowConflictModal(true);
    setShowDetails(false);
  };

  const totalPending = pendingCount.batches + pendingCount.updates;

  // ── Status helpers ───────────────────────────────────────────────────────

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />;

    if (conflicts.length > 0)
      return <AlertCircle className="h-4 w-4 text-orange-200" />;

    if (syncStatus === 'syncing')
      return <RefreshCw className="h-4 w-4 animate-spin" />;

    if (syncStatus === 'error') return <AlertCircle className="h-4 w-4" />;

    if (totalPending > 0) return <Cloud className="h-4 w-4" />;

    return <Check className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-500';
    if (conflicts.length > 0)
      return 'bg-orange-600 dark:bg-orange-700 animate-pulse';
    if (syncStatus === 'syncing') return 'bg-blue-500';
    if (syncStatus === 'error') return 'bg-red-500';
    if (totalPending > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return t('offline.youAreOffline', 'Offline');
    if (conflicts.length > 0)
      return t('sync.conflicts', { count: conflicts.length, defaultValue: '{{count}} Conflict' });
    if (syncStatus === 'syncing') return t('sync.syncing');
    if (syncStatus === 'error') return t('sync.syncFailed', 'Sync Error');
    if (totalPending > 0) return t('sync.pendingSync', { count: totalPending });
    return t('sync.synced');
  };

  // Pulse the badge when there is anything actionable
  const shouldPulse = totalPending > 0 || conflicts.length > 0;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        {/* Status Badge */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-full shadow-lg
            ${getStatusColor()} text-white
            hover:opacity-90 transition-all duration-200
            ${shouldPulse && conflicts.length === 0 ? 'animate-pulse' : ''}
          `}
          aria-label="Sync status"
        >
          {isInitialLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            getStatusIcon()
          )}
          <span className="text-sm font-medium">
            {isInitialLoading ? t('common.loading', 'Loading...') : getStatusText()}
          </span>
          {!isInitialLoading && (totalPending > 0 || conflicts.length > 0) && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {totalPending + conflicts.length}
            </span>
          )}
        </button>

        {/* Details Dropdown */}
        {showDetails && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('sync.syncStatus', 'Sync Status')}
                </h3>
                <div className="flex items-center space-x-2">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isOnline
                      ? t('sync.online', 'Online')
                      : t('offline.youAreOffline', 'Offline')}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Pending Items */}
              {totalPending > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('sync.pendingBatches', 'Pending Batches:')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pendingCount.batches}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('sync.pendingUpdates', 'Pending Updates:')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pendingCount.updates}
                    </span>
                  </div>
                </div>
              )}

              {/* Status Message */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {!isOnline && (
                  <p>{t('sync.offlineMessage', "You're offline. Changes will sync when connection is restored.")}</p>
                )}
                {isOnline && totalPending === 0 && conflicts.length === 0 && (
                  <p>{t('sync.allSyncedMessage', 'All changes are synced to the blockchain.')}</p>
                )}
                {isOnline && totalPending > 0 && syncStatus === 'idle' && (
                  <p>{t('sync.waitingMessage', 'Waiting to sync pending changes...')}</p>
                )}
                {syncStatus === 'syncing' && (
                  <p>{t('sync.syncingMessage', 'Syncing your changes to the blockchain...')}</p>
                )}
                {syncStatus === 'error' && conflicts.length === 0 && (
                  <p className="text-red-600 dark:text-red-400">
                    {t('sync.errorMessage', 'Some items failed to sync. Check your connection and try again.')}
                  </p>
                )}
              </div>

              {/* Conflicts List */}
              {conflicts.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-2 space-y-2">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    ⚠️ {t('sync.conflictsHeading', 'Sync Conflicts')} ({conflicts.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-2">
                    {conflicts.map((conflict) => (
                      <div
                        key={conflict.pendingId || conflict.id}
                        className="text-xs p-2 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 rounded-lg flex justify-between items-center"
                      >
                        <div className="flex-1 pr-2 overflow-hidden">
                          <p className="font-bold text-gray-800 dark:text-gray-200 truncate">
                            {conflict.batchId}
                          </p>
                          <p className="text-gray-500 text-[10px] truncate">
                            Stage:{' '}
                            <span className="uppercase">
                              {conflict.data?.stage || conflict.stage}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => handleResolveConflict(conflict)}
                          className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-[10px] rounded transition-colors"
                        >
                          {t('sync.resolve', 'Resolve')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                {isOnline && totalPending > 0 && syncStatus !== 'syncing' && (
                  <button
                    onClick={handleRetrySync}
                    className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    {t('sync.syncNow', 'Sync Now')}
                  </button>
                )}
                {syncStatus === 'error' && (
                  <button
                    onClick={handleRetryFailed}
                    className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {t('sync.retry', 'Retry Failed')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conflict Resolution Modal */}
      {selectedConflict && (
        <ConflictResolutionModal
          open={showConflictModal}
          onOpenChange={setShowConflictModal}
          conflict={{
            id: selectedConflict.pendingId || selectedConflict.id,
            batchId: selectedConflict.batchId,
            data: selectedConflict.data,
            conflictDetails: selectedConflict.conflictDetails,
          }}
          onResolve={updatePendingCount}
        />
      )}
    </div>
  );
};

export default SyncStatusIndicator;