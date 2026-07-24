"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ClipboardList,
  Sprout,
  CheckCircle2,
  ShieldCheck,
  Truck,
  Store,
  AlertTriangle,
  Clock,
  HelpCircle,
  RefreshCw,
  User,
  Calendar,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBatchSocket } from "../../hooks/useBatchSocket";
import { apiClient } from "../../services/apiClient";

// Stage Configurations
const LIFECYCLE_STAGES = [
  {
    name: "Registered",
    description: "Crop batch registered in the database.",
    expectedDays: 5,
    icon: ClipboardList,
  },
  {
    name: "Growing",
    description: "Crop is in the fields growing.",
    expectedDays: 90,
    icon: Sprout,
  },
  {
    name: "Harvested",
    description: "Harvest has been completed and logged.",
    expectedDays: 3,
    icon: Sprout,
  },
  {
    name: "Quality Checked",
    description: "Batch passed the quality inspection checks.",
    expectedDays: 3,
    icon: ShieldCheck,
  },
  {
    name: "Transported",
    description: "Cold chain transit dispatch is underway.",
    expectedDays: 5,
    icon: Truck,
  },
  {
    name: "Delivered",
    description: "Batch safely received at the retailer destination.",
    expectedDays: 0,
    icon: Store,
  },
];

export interface StageHistoryItem {
  stage: string;
  timestamp: string;
  updatedBy: string;
  notes?: string;
}

export interface LifecycleData {
  currentStage: string;
  stageHistory: StageHistoryItem[];
  completionPercentage: number;
}

interface CropLifecycleTrackerProps {
  batchId: string;
  blockchainHash?: string;
  onRefresh?: () => void;
}

// Relative timestamp helper
const getRelativeTime = (dateString: string) => {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    return `${diffDays} days ago`;
  } catch (error) {
    return "N/A";
  }
};

export const CropLifecycleTracker: React.FC<CropLifecycleTrackerProps> = ({
  batchId,
  blockchainHash,
  onRefresh,
}) => {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Fetch lifecycle data from API
  const fetchLifecycle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/batches/${batchId}/lifecycle`);
      const lifecycleData = response.data?.data;
      if (!lifecycleData || !Array.isArray(lifecycleData.stageHistory)) {
        throw new Error("Invalid response format");
      }
      setData(lifecycleData);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to retrieve lifecycle data.";
      console.error(
        "[CropLifecycleTracker] Failed to retrieve lifecycle data:",
        message,
      );
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchLifecycle();
    }
  }, [batchId]);

  // Listen for real-time WebSocket updates
  useBatchSocket({
    batchId,
    enabled: !!batchId,
    onBatchUpdate: (updatedBatch) => {
      console.log(
        "[CropLifecycleTracker] Real-time batch update received:",
        updatedBatch,
      );
      fetchLifecycle(); // Refresh data to recalculate stats and history
      if (onRefresh) onRefresh();
    },
    onStageChange: (data) => {
      console.log(
        "[CropLifecycleTracker] Real-time stage change received:",
        data,
      );
      fetchLifecycle();
      if (onRefresh) onRefresh();
    },
  });

  // Stage map for quick lookup
  const historyMap = useMemo(() => {
    if (!data) return new Map<string, StageHistoryItem>();
    const map = new Map<string, StageHistoryItem>();
    data.stageHistory.forEach((item) => {
      map.set(item.stage, item);
    });
    return map;
  }, [data]);

  // Delay detection
  const delayInfo = useMemo(() => {
    if (!data) return null;
    const currentStageName = data.currentStage;
    const config = LIFECYCLE_STAGES.find((s) => s.name === currentStageName);
    const historyItem = historyMap.get(currentStageName);

    if (!config || !historyItem || config.expectedDays === 0) return null;

    const stageStart = new Date(historyItem.timestamp);
    const now = new Date();
    const elapsedMs = now.getTime() - stageStart.getTime();
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

    if (elapsedDays > config.expectedDays) {
      return {
        stage: currentStageName,
        elapsedDays,
        limitDays: config.expectedDays,
        message: `${currentStageName} pending for ${elapsedDays} days`,
      };
    }
    return null;
  }, [data, historyMap]);

  // Next stage estimation
  const estimationInfo = useMemo(() => {
    if (!data) return null;
    const currentIndex = LIFECYCLE_STAGES.findIndex(
      (s) => s.name === data.currentStage,
    );
    if (currentIndex === -1 || currentIndex === LIFECYCLE_STAGES.length - 1)
      return null;

    const currentStageItem = historyMap.get(data.currentStage);
    if (!currentStageItem) return null;

    const nextStageConfig = LIFECYCLE_STAGES[currentIndex + 1];
    const currentStageConfig = LIFECYCLE_STAGES[currentIndex];

    // Compute expected completion date based on current stage start time + expectedDays
    const currentStart = new Date(currentStageItem.timestamp);
    const estimatedCompletionDate = new Date(currentStart);
    estimatedCompletionDate.setDate(
      estimatedCompletionDate.getDate() +
        (currentStageConfig.expectedDays || 3),
    );

    return {
      nextStage: nextStageConfig.name,
      estimatedCompletion: estimatedCompletionDate.toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      ),
    };
  }, [data, historyMap]);

  // Dynamic ASCII progress bar generator matching specifications
  const asciiProgressBar = useMemo(() => {
    if (!data) return "░░░░░░░░░░ 0%";
    const pct = data.completionPercentage;
    const totalBars = 15;
    const filledBars = Math.round((pct / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `${"█".repeat(filledBars)}${"░".repeat(emptyBars)} ${pct}%`;
  }, [data]);

  // Loading skeleton state
  if (loading) {
    return (
      <div
        className="journey-glass-card rounded-2xl p-6 animate-pulse space-y-6"
        aria-busy="true"
      >
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex justify-between gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center space-y-2 flex-1"
            >
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="journey-glass-card rounded-2xl p-6 text-center border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-1">
          Failed to Load Lifecycle Progress
        </h3>
        <p className="text-sm mb-4">{error || "Unknown error occurred."}</p>
        <button
          onClick={() => {
            fetchLifecycle();
            if (onRefresh) onRefresh();
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 mx-auto transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  const currentStageIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.name === data.currentStage,
  );

  return (
    <div className="journey-glass-card rounded-3xl p-6 shadow-xl border border-gray-150 dark:border-gray-800 text-left">
      {/* Tracker Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span>Crop Lifecycle Progress Tracker</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Real-time supply chain stages & pedigree checkpoints.
          </p>
        </div>

        <button
          onClick={() => {
            fetchLifecycle();
            if (onRefresh) onRefresh();
          }}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded-xl transition-all"
          aria-label="Refresh Lifecycle data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ASCII and visual Progress Bar */}
      <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-250/50 dark:border-gray-800 p-4 rounded-2xl mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Lifecycle Progress
          </span>
          <span className="font-mono text-sm text-green-600 dark:text-green-400 font-bold">
            {asciiProgressBar}
          </span>
        </div>
        <div
          className="w-full bg-gray-200 dark:bg-gray-850 rounded-full h-3 overflow-hidden relative"
          role="progressbar"
          aria-valuenow={data.completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lifecycle Completion Progress Bar"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${data.completionPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="bg-gradient-to-r from-green-500 to-emerald-400 h-full rounded-full"
          />
        </div>
      </div>

      {/* Desktop Horizontal Progress Tracker */}
      <div className="hidden md:block relative my-10 px-4">
        {/* Connection line background */}
        <div className="absolute top-[20px] left-8 right-8 h-1 bg-gray-250 dark:bg-gray-800 -z-10" />

        {/* Dynamic connection line active */}
        <div
          className="absolute top-[20px] left-8 h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-blue-500 transition-all duration-700 -z-10"
          style={{
            width: `calc(${(currentStageIndex / (LIFECYCLE_STAGES.length - 1)) * 100}% - 2rem)`,
          }}
        />

        <div className="flex justify-between items-start">
          {LIFECYCLE_STAGES.map((config, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isUpcoming = index > currentStageIndex;
            const historyItem = historyMap.get(config.name);
            const IconComponent = config.icon;

            return (
              <div
                key={config.name}
                className="flex flex-col items-center text-center relative w-24 group"
              >
                {/* Node circle */}
                <button
                  onClick={() =>
                    setActiveTooltip(
                      activeTooltip === config.name ? null : config.name,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setActiveTooltip(
                        activeTooltip === config.name ? null : config.name,
                      );
                    }
                  }}
                  className={`h-11 w-11 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                    isCompleted
                      ? "bg-green-500 border-green-500 text-white hover:scale-110 hover:shadow-green-500/20"
                      : isCurrent
                        ? "bg-blue-600 border-blue-600 text-white hover:scale-110 ring-4 ring-blue-600/20 hover:shadow-blue-600/30"
                        : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400"
                  }`}
                  aria-label={`${config.name} stage: ${isCompleted ? "Completed" : isCurrent ? "Current" : "Upcoming"}`}
                >
                  {isCompleted ? (
                    <span className="font-bold text-sm" aria-hidden="true">
                      ✔
                    </span>
                  ) : isCurrent ? (
                    <span
                      className="h-2 w-2 bg-white rounded-full animate-ping"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="text-xs" aria-hidden="true">
                      ○
                    </span>
                  )}
                </button>

                {/* Stage Title */}
                <span
                  className={`text-xs font-bold mt-3 transition-colors ${
                    isCurrent
                      ? "text-blue-600 dark:text-blue-400"
                      : isCompleted
                        ? "text-green-600 dark:text-green-400 font-semibold"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {config.name}
                </span>

                {/* Node info tooltip */}
                <AnimatePresence>
                  {activeTooltip === config.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-2xl z-20 text-left w-64"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent
                          className={`h-5 w-5 ${isCompleted ? "text-green-500" : isCurrent ? "text-blue-500" : "text-gray-400"}`}
                        />
                        <h4 className="font-bold text-gray-850 dark:text-white text-sm">
                          {config.name}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {config.description}
                      </p>

                      {historyItem ? (
                        <div className="space-y-1.5 text-[11px] border-t border-gray-100 dark:border-gray-850 pt-2.5">
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {new Date(historyItem.timestamp).toLocaleString()}{" "}
                              ({getRelativeTime(historyItem.timestamp)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <User className="h-3.5 w-3.5" />
                            <span>Actor: {historyItem.updatedBy}</span>
                          </div>
                          {historyItem.notes && (
                            <p className="text-[11px] text-gray-400 italic bg-gray-50 dark:bg-gray-800/40 p-2 rounded-lg mt-1 border-l-2 border-green-500">
                              "{historyItem.notes}"
                            </p>
                          )}
                          {blockchainHash && isCurrent && (
                            <div className="text-[10px] text-green-600 font-mono mt-1 truncate">
                              Tx: {blockchainHash.substring(0, 12)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          Not completed yet.
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Responsive Vertical Timeline */}
      <div className="block md:hidden space-y-6 pl-4 relative my-8">
        <div className="absolute left-[20px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-800" />

        {LIFECYCLE_STAGES.map((config, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isUpcoming = index > currentStageIndex;
          const historyItem = historyMap.get(config.name);
          const IconComponent = config.icon;

          return (
            <div
              key={config.name}
              className="flex gap-4 items-start relative z-10 text-left"
            >
              {/* Timeline indicator node */}
              <div
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                      ? "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-600/20"
                      : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <span className="font-bold text-xs">✔</span>
                ) : isCurrent ? (
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-ping" />
                ) : (
                  <span className="text-xs">○</span>
                )}
              </div>

              {/* Detail Card for the stage */}
              <div
                className={`flex-grow journey-glass-card rounded-2xl p-4 border border-gray-150/80 dark:border-gray-800 ${
                  isCurrent
                    ? "ring-1 ring-blue-500 border-blue-400 dark:border-blue-700 bg-blue-500/5"
                    : ""
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <IconComponent
                      className={`h-4.5 w-4.5 ${isCompleted ? "text-green-500" : isCurrent ? "text-blue-500" : "text-gray-400"}`}
                    />
                    <h3
                      className={`font-bold text-sm ${isCurrent ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-white"}`}
                    >
                      {config.name}
                    </h3>
                  </div>

                  {isCurrent && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-100/50 dark:bg-blue-900/20 rounded-full border border-blue-200/50">
                      CURRENT
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {config.description}
                </p>

                {historyItem && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-850 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-450" />
                      <span>
                        {new Date(historyItem.timestamp).toLocaleString()} (
                        {getRelativeTime(historyItem.timestamp)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-gray-450" />
                      <span>Actor: {historyItem.updatedBy}</span>
                    </div>
                    {historyItem.notes && (
                      <p className="mt-2 text-[11px] text-gray-500 italic bg-gray-50 dark:bg-gray-850 p-2 rounded-lg border-l-2 border-green-500">
                        "{historyItem.notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State Banner */}
      {data.stageHistory.length <= 1 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 p-4 rounded-2xl flex items-center gap-3 border border-blue-200 dark:border-blue-900 mb-6 text-sm">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <p className="font-semibold">Lifecycle has just started.</p>
        </div>
      )}

      {/* Smart Alerts (Delay and Estimated Next Stage) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {/* Delay alert banner */}
        {delayInfo && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-950 rounded-2xl text-red-800 dark:text-red-400 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5 animate-bounce" />
            <div>
              <span className="font-bold block uppercase text-[10px] tracking-wider text-red-500 mb-0.5">
                ⚠ Delayed Alert
              </span>
              <p className="font-semibold">{delayInfo.message}</p>
              <span className="text-xs text-red-650/80 dark:text-red-400/80">
                Stage exceeded estimated limit of {delayInfo.limitDays} days.
              </span>
            </div>
          </div>
        )}

        {/* Estimated completion banner */}
        {estimationInfo && (
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-950 rounded-2xl text-green-800 dark:text-green-400 text-sm">
            <Clock className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block uppercase text-[10px] tracking-wider text-green-500 mb-0.5">
                Next Expected Stage
              </span>
              <p className="font-semibold">{estimationInfo.nextStage}</p>
              <span className="text-xs text-green-650/80 dark:text-green-400/80">
                Estimated completion: {estimationInfo.estimatedCompletion}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
