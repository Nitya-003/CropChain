import React from 'react';
import { Calendar, MapPin, User, ExternalLink, ShieldCheck, Thermometer, Droplets, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface StageUpdate {
  stage: 'farmer' | 'mandi' | 'transport' | 'retailer';
  actor: string;
  location: string;
  timestamp: string;
  notes?: string;
}

interface JourneyStageNodeProps {
  update: StageUpdate;
  isCurrent: boolean;
  isCompleted: boolean;
  txHash?: string;
  temperature?: number;
  humidity?: number;
  isSpoiled?: boolean;
  onNodeClick?: () => void;
}

export const JourneyStageNode: React.FC<JourneyStageNodeProps> = ({
  update,
  isCurrent,
  isCompleted,
  txHash,
  temperature,
  humidity,
  isSpoiled,
  onNodeClick
}) => {
  const { t } = useTranslation();

  // Color mapping based on stage
  const getStageColorClass = () => {
    if (!isCompleted && !isCurrent) return 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400';
    
    switch (update.stage) {
      case 'farmer':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400';
      case 'mandi':
        return 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400';
      case 'transport':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400';
      case 'retailer':
        return 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400';
      default:
        return 'border-gray-500 bg-gray-50 text-gray-600';
    }
  };

  const getStageHeaderColor = () => {
    if (!isCompleted && !isCurrent) return 'text-gray-400 dark:text-gray-600';
    
    switch (update.stage) {
      case 'farmer': return 'text-green-700 dark:text-green-400';
      case 'mandi': return 'text-purple-700 dark:text-purple-400';
      case 'transport': return 'text-orange-700 dark:text-orange-400';
      case 'retailer': return 'text-cyan-700 dark:text-cyan-400';
    }
  };

  const getStageIcon = () => {
    const iconSize = "h-5 w-5";
    switch (update.stage) {
      case 'farmer':
        return <span className={iconSize}>🌱</span>;
      case 'mandi':
        return <span className={iconSize}>🏢</span>;
      case 'transport':
        return <span className={iconSize}>🚚</span>;
      case 'retailer':
        return <span className={iconSize}>🛒</span>;
    }
  };

  const getStageName = () => {
    switch (update.stage) {
      case 'farmer': return t('status.harvested', 'Harvested');
      case 'mandi': return t('status.atMandi', 'At Mandi (Quality Check)');
      case 'transport': return t('status.inTransit', 'In Transit (Cold Chain)');
      case 'retailer': return t('status.atRetailer', 'At Retailer');
      default: return update.stage;
    }
  };

  // IoT sensor evaluation rules
  const getTempStatus = (temp: number) => {
    if (temp > 80 || temp < 32) return 'danger';
    if (temp > 75 || temp < 36) return 'warning';
    return 'safe';
  };

  const getHumidityStatus = (hum: number) => {
    if (hum > 85 || hum < 30) return 'danger';
    if (hum > 75 || hum < 40) return 'warning';
    return 'safe';
  };

  return (
    <div 
      className={`journey-glass-card rounded-2xl p-6 relative cursor-pointer select-none transition-all duration-300 border-l-4 ${
        isCurrent 
          ? 'ring-2 ring-green-400 dark:ring-green-600 scale-[1.01]' 
          : ''
      }`}
      style={{
        borderLeftColor: !isCompleted && !isCurrent 
          ? '#9ca3af' 
          : update.stage === 'farmer' ? '#22c55e' : update.stage === 'mandi' ? '#a855f7' : update.stage === 'transport' ? '#f97316' : '#06b6d4'
      }}
      onClick={onNodeClick}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${getStageColorClass()} ${
            isCurrent ? 'journey-node-pulse' : ''
          }`}>
            {getStageIcon()}
          </div>
          <div>
            <h3 className={`font-bold text-lg capitalize ${getStageHeaderColor()}`}>
              {getStageName()}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {update.stage}
            </span>
          </div>
        </div>

        {/* Live Status indicator */}
        {isCurrent && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 animate-pulse bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded-full border border-green-200 dark:border-green-900">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            CURRENT
          </span>
        )}
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate"><strong>{t('journey.updated_by', 'Actor')}:</strong> {update.actor}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate"><strong>{t('batch.location', 'Location')}:</strong> {update.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="truncate"><strong>{t('batch.lastUpdated', 'Date')}:</strong> {new Date(update.timestamp).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Update Notes */}
      {update.notes && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border-l-2 border-gray-200 dark:border-gray-700 mb-4">
          "{update.notes}"
        </p>
      )}

      {/* IoT Telemetry Section */}
      {(temperature !== undefined || humidity !== undefined) && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2.5">
            <span className="uppercase tracking-wider">IoT Telemetry Verified</span>
          </div>
          
          {isSpoiled && (
            <div className="mb-3 flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-3 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-xs font-semibold">
                WARNING: Cold Chain Breached. Crop quality compromised due to out-of-bound readings.
              </span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {temperature !== undefined && (
              <span className={`telemetry-badge telemetry-badge-${getTempStatus(temperature)}`}>
                <Thermometer className="h-3.5 w-3.5" />
                <span>{temperature}°F</span>
              </span>
            )}
            {humidity !== undefined && (
              <span className={`telemetry-badge telemetry-badge-${getHumidityStatus(humidity)}`}>
                <Droplets className="h-3.5 w-3.5" />
                <span>{humidity}%</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Blockchain Verification Section */}
      {txHash && (
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-950/20 px-2.5 py-1 rounded-full">
            <ShieldCheck className="h-4 w-4" />
            <span>{t('journey.verified_on_chain', 'Verified on Blockchain')}</span>
          </div>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()} // Prevent card click
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 hover:underline font-mono font-medium transition-colors"
          >
            <span>Tx: {txHash.substring(0, 10)}...</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
