"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { Compass, CheckCircle2, ChevronRight, Sprout, Building2, Truck, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface JourneyPreviewProps {
  batchId: string;
  currentStage: string;
  updates: any[];
}

export const JourneyPreview: React.FC<JourneyPreviewProps> = ({
  batchId,
  currentStage
}) => {
  const router = useRouter();
  const { t } = useTranslation();

  const stages = [
    { value: 'farmer', label: t('status.harvested', 'Harvested'), icon: Sprout },
    { value: 'mandi', label: t('status.atMandi', 'At Mandi'), icon: Building2 },
    { value: 'transport', label: t('status.inTransit', 'In Transit'), icon: Truck },
    { value: 'retailer', label: t('status.atRetailer', 'At Retailer'), icon: Store }
  ];

  // Determine active step index
  const currentStepIndex = stages.findIndex(s => s.value === currentStage.toLowerCase());

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800/40 dark:to-gray-700/20 border border-green-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
            <Compass className="h-5 w-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white text-base">
              {t('journey.title', 'Leaf-to-Shelf Journey Map')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('journey.subtitle', 'Complete immutable supply chain history')}
            </p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/batch/${batchId}/journey`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 rounded-xl transition-all duration-200 hover:shadow-md transform hover:scale-[1.02]"
        >
          <span>{t('journey.view_full_journey', 'View Full Journey Map')}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal Mini-Timeline */}
      <div className="relative py-4 px-2">
        {/* Horizontal Line connector */}
        <div className="absolute top-[34px] left-8 right-8 h-0.5 bg-gray-200 dark:bg-gray-850" />
        
        {/* Completed portion of Line */}
        <div 
          className="absolute top-[34px] left-8 h-0.5 bg-green-500 transition-all duration-500" 
          style={{ 
            width: currentStepIndex > 0 ? `calc(${(currentStepIndex / (stages.length - 1)) * 100}% - 3rem)` : '0%' 
          }}
        />

        <div className="grid grid-cols-4 gap-2 text-center relative z-10">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const IconComponent = stage.icon;

            return (
              <div 
                key={stage.value} 
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => router.push(`/batch/${batchId}/journey`)}
              >
                {/* Node icon / indicator */}
                <div 
                  className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCurrent 
                      ? 'border-green-500 bg-white dark:bg-gray-800 text-base shadow-md ring-4 ring-green-500/20 scale-110'
                      : isCompleted
                      ? 'border-green-500 bg-green-500 text-white text-xs'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-400 opacity-60'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : (
                    <IconComponent className="h-4 w-4" />
                  )}
                </div>

                <span 
                  className={`text-[10px] sm:text-xs font-bold mt-2.5 transition-colors ${
                    isCurrent 
                      ? 'text-green-600 dark:text-green-400 font-extrabold'
                      : isCompleted
                      ? 'text-gray-800 dark:text-gray-200'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {stage.label}
                </span>
                
                {isCurrent && (
                  <span className="text-[8px] font-black uppercase text-green-500 mt-0.5 tracking-wider">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
