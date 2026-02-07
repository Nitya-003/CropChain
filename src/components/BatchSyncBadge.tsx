import React from 'react';
import { Cloud, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface BatchSyncBadgeProps {
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const BatchSyncBadge: React.FC<BatchSyncBadgeProps> = ({ 
  syncStatus = 'synced', 
  size = 'md',
  showLabel = true 
}) => {
  const getIcon = () => {
    switch (syncStatus) {
      case 'pending':
        return <Cloud className={`${getIconSize()}`} />;
      case 'syncing':
        return <RefreshCw className={`${getIconSize()} animate-spin`} />;
      case 'failed':
        return <AlertCircle className={`${getIconSize()}`} />;
      case 'synced':
      default:
        return <Check className={`${getIconSize()}`} />;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'h-3 w-3';
      case 'lg': return 'h-5 w-5';
      case 'md':
      default: return 'h-4 w-4';
    }
  };

  const getBadgeSize = () => {
    switch (size) {
      case 'sm': return 'px-2 py-0.5 text-xs';
      case 'lg': return 'px-4 py-2 text-base';
      case 'md':
      default: return 'px-3 py-1 text-sm';
    }
  };

  const getColor = () => {
    switch (syncStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'syncing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'synced':
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
  };

  const getLabel = () => {
    switch (syncStatus) {
      case 'pending':
        return 'Pending Sync';
      case 'syncing':
        return 'Syncing...';
      case 'failed':
        return 'Sync Failed';
      case 'synced':
      default:
        return 'Synced';
    }
  };

  const getTooltip = () => {
    switch (syncStatus) {
      case 'pending':
        return 'This batch is waiting to be synced to the blockchain';
      case 'syncing':
        return 'Currently syncing to the blockchain';
      case 'failed':
        return 'Failed to sync. Will retry automatically when online';
      case 'synced':
      default:
        return 'Successfully synced to the blockchain';
    }
  };

  return (
    <div
      className={`
        inline-flex items-center space-x-1.5 rounded-full font-medium
        ${getBadgeSize()} ${getColor()}
      `}
      title={getTooltip()}
    >
      {getIcon()}
      {showLabel && <span>{getLabel()}</span>}
    </div>
  );
};

export default BatchSyncBadge;