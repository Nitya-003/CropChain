import React from 'react';

const TableSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="flex border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map((col) => (
          <div key={col} className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
          </div>
        ))}
      </div>
      
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="flex items-center py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
          </div>
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
          </div>
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
          </div>
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
          <div className="flex-1 mr-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-28"></div>
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TableSkeleton;