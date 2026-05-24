import React from 'react';

export const BatchInfoSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
      <div className="flex items-center mb-6">
        <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded mr-3"></div>
        <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-48"></div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-2"></div>
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BatchInfoSkeleton;