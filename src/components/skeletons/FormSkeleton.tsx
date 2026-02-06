import React from 'react';

const FormSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 animate-pulse">
      <div className="space-y-6">
        <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-8"></div>
        
        <div className="space-y-4">
          <div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          </div>
          
          <div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          </div>
          
          <div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-2"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
            </div>
          </div>
          
          <div>
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-28 mb-2"></div>
            <div className="h-24 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
          </div>
        </div>
        
        <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
      </div>
    </div>
  );
};

export default FormSkeleton;