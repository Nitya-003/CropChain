import React from 'react';
import { JourneyStageNode, StageUpdate } from './JourneyStageNode';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

interface JourneyTimelineProps {
  updates: StageUpdate[];
  currentStage: string;
  blockchainHash?: string;
  currentTemperature?: number;
  currentHumidity?: number;
  isSpoiled?: boolean;
  onSelectUpdate: (update: StageUpdate, index: number) => void;
  selectedUpdateIndex: number;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  updates,
  blockchainHash,
  currentTemperature,
  currentHumidity,
  isSpoiled,
  onSelectUpdate,
  selectedUpdateIndex
}) => {
  const { t } = useTranslation();

  if (!updates || updates.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          {t('journey.no_updates', 'No journey data available yet.')}
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-8">
      {/* Central Line connecting updates */}
      <div 
        className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-gray-200 dark:bg-gray-800" 
        style={{ zIndex: 0 }}
      />
      
      {/* Active portion of line */}
      <div 
        className="absolute left-[34px] top-6 w-0.5 journey-line-active" 
        style={{ 
          height: updates.length > 1 ? `calc(${(selectedUpdateIndex / (updates.length - 1)) * 100}% - 2px)` : '0%',
          zIndex: 1,
          transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />

      {updates.map((update, index) => {
        // Evaluate completion status
        const isCurrent = index === updates.length - 1;
        const isCompleted = index < updates.length - 1;
        const isSelected = index === selectedUpdateIndex;

        // Associate IoT values with the stages:
        // Let's pass the latest IoT telemetry only to the current/active stage,
        // or if mock history has telemetry we can pass that.
        // For simplicity, we can pass temperature and humidity to the active transport/mandi stage if it matches.
        const showTelemetry = (update.stage === 'transport' || update.stage === 'mandi') && isCurrent;
        
        return (
          <div key={index} className="relative z-10">
            {/* The outer timeline dot node connector */}
            <div 
              className={`absolute left-[-22px] top-6 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                isSelected
                  ? 'bg-blue-500 border-white dark:border-gray-900 scale-125 shadow-md shadow-blue-500/50'
                  : isCurrent
                  ? 'bg-green-500 border-white dark:border-gray-900 scale-110 ring-4 ring-green-500/20'
                  : isCompleted
                  ? 'bg-green-500 border-white dark:border-gray-900'
                  : 'bg-gray-300 border-white dark:border-gray-900 dark:bg-gray-700'
              }`}
            />
            
            <JourneyStageNode
              update={update}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              txHash={index === updates.length - 1 ? blockchainHash : '0x' + Math.random().toString(16).substring(2, 42)}
              temperature={showTelemetry ? currentTemperature : undefined}
              humidity={showTelemetry ? currentHumidity : undefined}
              isSpoiled={showTelemetry ? isSpoiled : undefined}
              onNodeClick={() => onSelectUpdate(update, index)}
            />
          </div>
        );
      })}
    </div>
  );
};
