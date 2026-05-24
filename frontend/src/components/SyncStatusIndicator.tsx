import React, { useState, useEffect } from 'react';
import { Cloud, Wifi, WifiOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { syncManager, SyncStatus } from '../services/syncManager';

const SyncStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState({ batches: 0, updates: 0 });
  const [showDetails, setShowDetails] = useState(false);

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
    const counts = await syncManager.getPendingCount();
    setPendingCount(counts);
  };

  const handleRetrySync = async () => {
    if (isOnline) {
      await syncManager.triggerSync();
    }
  };

  const handleRetryFailed = async () => {
    await syncManager.retryFailed();
  };

  const totalPending = pendingCount.batches + pendingCount.updates;

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }

    if (syncStatus === 'syncing') {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    if (syncStatus === 'error') {
      return <AlertCircle className="h-4 w-4" />;
    }

    if (totalPending > 0) {
      return <Cloud className="h-4 w-4" />;
    }

    return <Check className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-gray-500';
    if (syncStatus === 'syncing') return 'bg-blue-500';
    if (syncStatus === 'error') return 'bg-red-500';
    if (totalPending > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync Error';
    if (totalPending > 0) return `${totalPending} Pending`;
    return 'Synced';
  };

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
            ${totalPending > 0 ? 'animate-pulse' : ''}
          `}
          aria-label="Sync status"
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
          {totalPending > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {totalPending}
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
                  Sync Status
                </h3>
                <div className="flex items-center space-x-2">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {isOnline ? 'Online' : 'Offline'}
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
                    <span className="text-gray-600 dark:text-gray-400">Pending Batches:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pendingCount.batches}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Pending Updates:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pendingCount.updates}
                    </span>
                  </div>
                </div>
              )}

              {/* Status Message */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {!isOnline && (
                  <p>You're offline. Changes will sync when connection is restored.</p>
                )}
                {isOnline && totalPending === 0 && (
                  <p>All changes are synced to the blockchain.</p>
                )}
                {isOnline && totalPending > 0 && syncStatus === 'idle' && (
                  <p>Waiting to sync pending changes...</p>
                )}
                {syncStatus === 'syncing' && (
                  <p>Syncing your changes to the blockchain...</p>
                )}
                {syncStatus === 'error' && (
                  <p className="text-red-600 dark:text-red-400">
                    Some items failed to sync. Check your connection and try again.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                {isOnline && totalPending > 0 && syncStatus !== 'syncing' && (
                  <button
                    onClick={handleRetrySync}
                    className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Sync Now
                  </button>
                )}
                {syncStatus === 'error' && (
                  <button
                    onClick={handleRetryFailed}
                    className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Retry Failed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;