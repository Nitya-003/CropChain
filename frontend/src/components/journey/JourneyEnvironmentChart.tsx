import React from "react";
import { motion } from "framer-motion";
import {
  Thermometer,
  Droplets,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface JourneyEnvironmentChartProps {
  batchId: string;
  currentTemperature?: number;
  currentHumidity?: number;
  isSpoiled?: boolean;
  updatesCount: number;
}

export const JourneyEnvironmentChart: React.FC<
  JourneyEnvironmentChartProps
> = ({
  batchId,
  currentTemperature = 55, // default fallback
  currentHumidity = 50, // default fallback
  isSpoiled = false,
  updatesCount,
}) => {
  const { t } = useTranslation();

  // Helper to generate deterministic coordinates using batchId as seed
  // This simulates beautiful continuous sensor logs matching the crop history!
  const getDeterministicLogs = (
    seed: string,
    count: number,
    currentVal: number,
    rangeMax: boolean,
  ) => {
    const logs: number[] = [];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }

    const baseValue = rangeMax ? 60 : 45; // base humidity vs base temp

    for (let i = 0; i < count; i++) {
      const pseudoRandom = Math.sin(hash + i) * 10;
      let val = baseValue + (pseudoRandom % 12);

      // If batch is spoiled, make it breach limits in the past
      if (isSpoiled && i === Math.floor(count / 2)) {
        val = rangeMax ? 92 : 86; // spoil temp spike
      }

      logs.push(val);
    }

    // Ensure the last item exactly matches the current value
    logs[logs.length - 1] = currentVal;
    return logs;
  };

  const pointCount = Math.max(8, updatesCount * 2);
  const tempLogs = getDeterministicLogs(
    batchId,
    pointCount,
    currentTemperature,
    false,
  );
  const humLogs = getDeterministicLogs(
    batchId + "hum",
    pointCount,
    currentHumidity,
    true,
  );

  // SVG dimensions for chart sparklines
  const width = 450;
  const height = 110;
  const padding = 15;

  const buildPath = (data: number[], minVal: number, maxVal: number) => {
    if (data.length < 2) return "";

    const xStep = (width - padding * 2) / (data.length - 1);
    const valueRange = maxVal - minVal;

    return data
      .map((val, idx) => {
        const x = padding + idx * xStep;
        // Invert Y axis for SVG rendering
        const y =
          height -
          padding -
          ((val - minVal) / valueRange) * (height - padding * 2);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const tempMin = 20;
  const tempMax = 100;
  const humMin = 20;
  const humMax = 100;

  const tempPath = buildPath(tempLogs, tempMin, tempMax);
  const humPath = buildPath(humLogs, humMin, humMax);

  return (
    <div className="journey-glass-card rounded-2xl p-6 flex flex-col h-full relative overflow-hidden text-left">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-3 flex-wrap gap-2">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-lg">
          <Thermometer className="h-5 w-5 text-orange-500" />
          <span>
            {t("journey.environment_chart", "Environmental Telemetry")}
          </span>
        </h3>

        {isSpoiled ? (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            OUT OF BOUNDS
          </span>
        ) : (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            STABLE LIMITS
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Temperature Sparkline */}
        <div className="flex flex-col bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-850 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5 text-orange-500" />
              {t("journey.temperature", "Temperature")}
            </span>
            <span
              className={`text-lg font-black ${isSpoiled ? "text-red-500" : "text-gray-800 dark:text-white"}`}
            >
              {currentTemperature}°F
            </span>
          </div>

          <div className="flex-1 relative min-h-[90px]">
            {/* Safe boundaries guidelines */}
            <div
              className="absolute left-0 right-0 top-[20%] border-t border-dashed border-red-500/20 opacity-80"
              title="Spoilage Upper Boundary (80°F)"
            >
              <span className="absolute right-1 -top-2.5 text-[8px] font-bold text-red-400">
                80°F Limit
              </span>
            </div>
            <div
              className="absolute left-0 right-0 bottom-[20%] border-b border-dashed border-blue-500/20 opacity-80"
              title="Spoilage Lower Boundary (32°F)"
            >
              <span className="absolute right-1 -bottom-2 text-[8px] font-bold text-blue-400">
                32°F Limit
              </span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <defs>
                <linearGradient
                  id="temp-grad"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {tempPath && (
                <>
                  <path
                    d={`${tempPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
                    fill="url(#temp-grad)"
                  />
                  <motion.path
                    d={tempPath}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                  {/* Current point indicator */}
                  <circle
                    cx={width - padding}
                    cy={
                      height -
                      padding -
                      ((currentTemperature - tempMin) / (tempMax - tempMin)) *
                        (height - padding * 2)
                    }
                    r="4"
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </svg>
          </div>
          <span className="text-[9px] text-gray-400 mt-2 block text-center">
            Oracle Threshold Boundary Safeguard: 32°F - 80°F
          </span>
        </div>

        {/* Humidity Sparkline */}
        <div className="flex flex-col bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-850 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-blue-500" />
              {t("journey.humidity", "Humidity")}
            </span>
            <span className="text-lg font-black text-gray-800 dark:text-white">
              {currentHumidity}%
            </span>
          </div>

          <div className="flex-1 relative min-h-[90px]">
            {/* Guidelines */}
            <div className="absolute left-0 right-0 top-[15%] border-t border-dashed border-red-500/10 opacity-80">
              <span className="absolute right-1 -top-2.5 text-[8px] font-bold text-red-400/65">
                85% Max Limit
              </span>
            </div>
            <div className="absolute left-0 right-0 bottom-[15%] border-b border-dashed border-blue-500/10 opacity-80">
              <span className="absolute right-1 -bottom-2 text-[8px] font-bold text-blue-400/65">
                30% Min Limit
              </span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
              <defs>
                <linearGradient id="hum-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {humPath && (
                <>
                  <path
                    d={`${humPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
                    fill="url(#hum-grad)"
                  />
                  <motion.path
                    d={humPath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1 }}
                  />
                  <circle
                    cx={width - padding}
                    cy={
                      height -
                      padding -
                      ((currentHumidity - humMin) / (humMax - humMin)) *
                        (height - padding * 2)
                    }
                    r="4"
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </svg>
          </div>
          <span className="text-[9px] text-gray-400 mt-2 block text-center">
            Standard Environmental Moisture Safety Range: 30% - 85%
          </span>
        </div>
      </div>
    </div>
  );
};
