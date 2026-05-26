import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Info } from 'lucide-react';
import { StageUpdate } from './JourneyStageNode';
import { useTranslation } from 'react-i18next';

interface JourneyPathMapProps {
  updates: StageUpdate[];
  selectedUpdateIndex: number;
  onSelectUpdate: (update: StageUpdate, index: number) => void;
}

export const JourneyPathMap: React.FC<JourneyPathMapProps> = ({
  updates,
  selectedUpdateIndex,
  onSelectUpdate
}) => {
  const { t } = useTranslation();

  // Width and Height of the coordinate canvas
  const width = 800;
  const height = 400;

  // Deterministically map stages to gorgeous, flowing canvas coords
  // This spaces them left-to-right to build a beautiful transit path
  const getCoordinatesForIndex = (index: number, total: number) => {
    if (total <= 1) {
      return { x: width / 2, y: height / 2 };
    }

    const padding = 100;
    const availableWidth = width - padding * 2;
    const x = padding + (index / (total - 1)) * availableWidth;
    
    // Wave pattern for dynamic zig-zag transit routes
    const yMap = [260, 140, 290, 160];
    const y = yMap[index % yMap.length];

    return { x, y };
  };

  const points = updates.map((update, index) => {
    const coords = getCoordinatesForIndex(index, updates.length);
    return {
      ...coords,
      update,
      index
    };
  });

  // Build the SVG path string (using bezier curves for smooth premium pathing!)
  const getCurvePathString = () => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const curvePath = getCurvePathString();

  return (
    <div className="journey-glass-card rounded-2xl p-6 flex flex-col h-full relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-3">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-lg">
          <Navigation className="h-5 w-5 text-green-600 dark:text-green-400 rotate-45" />
          <span>{t('journey.journey_path', 'Geographic Transit Map')}</span>
        </h3>
        <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Interactive Nodes
        </span>
      </div>

      {/* Abstract Map Canvas */}
      <div className="relative flex-1 bg-gradient-to-br from-green-50/20 to-blue-50/20 dark:from-gray-900/40 dark:to-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl min-h-[300px] overflow-hidden">
        
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#374151_1px,transparent_1px),linear-gradient(to_bottom,#374151_1px,transparent_1px)] bg-[size:40px_40px] opacity-15" />

        {updates.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            No transit data available
          </div>
        ) : (
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="w-full h-full"
            style={{ minHeight: '300px' }}
          >
            {/* SVG Gradients */}
            <defs>
              <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <radialGradient id="glow-gradient">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glowing effect around the active route */}
            {curvePath && (
              <path
                d={curvePath}
                fill="none"
                stroke="url(#route-gradient)"
                strokeWidth="8"
                opacity="0.15"
                className="blur-sm"
              />
            )}

            {/* The actual dynamic curve route connecting checkpoints */}
            {curvePath && (
              <motion.path
                d={curvePath}
                fill="none"
                stroke="url(#route-gradient)"
                strokeWidth="3.5"
                className="journey-svg-path"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            )}

            {/* Coordinates Points & Pins */}
            {points.map((pt, idx) => {
              const isSelected = pt.index === selectedUpdateIndex;
              const isLast = pt.index === points.length - 1;
              
              // Node color categories
              let pinColor = '#10b981'; // Completed / Default
              if (pt.update.stage === 'mandi') pinColor = '#a855f7';
              if (pt.update.stage === 'transport') pinColor = '#f97316';
              if (pt.update.stage === 'retailer') pinColor = '#06b6d4';

              return (
                <g key={idx} className="cursor-pointer">
                  {/* Outer Pulsing Aura if selected or active */}
                  {(isSelected || isLast) && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 26 : 20}
                      fill="url(#glow-gradient)"
                      className="animate-pulse"
                    />
                  )}

                  {/* Node dot pin on the map path */}
                  <motion.circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 10 : 7}
                    fill={pinColor}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="journey-pin-animate"
                    onClick={() => onSelectUpdate(pt.update, pt.index)}
                    whileHover={{ scale: 1.3 }}
                  />

                  {/* Floating Location Card inside SVG */}
                  <foreignObject
                    x={pt.x - 75}
                    y={pt.y - 65}
                    width="150"
                    height="50"
                    className="overflow-visible pointer-events-none"
                  >
                    <div 
                      className={`flex flex-col items-center justify-center text-center p-1.5 rounded-lg border shadow-sm transition-all duration-200 ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-500 text-white scale-105' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate w-full px-1">
                        {pt.update.stage}
                      </span>
                      <span className="text-[9px] font-medium truncate w-full px-1 opacity-90">
                        {pt.update.location}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Selected Location Quick Glance */}
      {updates[selectedUpdateIndex] && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800 text-left text-xs sm:text-sm">
          <div className="flex gap-2 items-center text-gray-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            <span>Checkpoint Details</span>
          </div>
          <div className="text-gray-800 dark:text-gray-200 font-semibold truncate">
            {updates[selectedUpdateIndex].location}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            {updates[selectedUpdateIndex].actor} • {new Date(updates[selectedUpdateIndex].timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
