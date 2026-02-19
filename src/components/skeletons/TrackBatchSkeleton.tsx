import React from 'react';

const TrackBatchSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-white/20 rounded w-48"></div>
            <div className="h-6 bg-white/20 rounded w-64"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-white/20 rounded w-32"></div>
            <div className="h-5 bg-white/20 rounded w-24"></div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
          <div className="flex items-center mb-6">
            <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded mr-3"></div>
            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-full mr-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-full mr-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-28"></div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded mr-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
          <div className="flex items-center mb-6">
            <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded mr-3"></div>
            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-full mr-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded mr-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-28"></div>
                <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-36"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center animate-pulse">
        <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-32 mx-auto mb-6"></div>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 inline-block">
          <div className="w-48 h-48 bg-gray-300 dark:bg-gray-600 rounded mx-auto mb-4"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-64 mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

export default TrackBatchSkeleton;