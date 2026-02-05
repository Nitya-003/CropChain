import React from 'react';

const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
      <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-4"></div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center">
            <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded mr-4"></div>
            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full mr-4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartSkeleton;