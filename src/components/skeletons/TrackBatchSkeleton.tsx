import React from 'react';

const TrackBatchSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-24">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-gray-200 dark:bg-gray-700 h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40" />
              </div>
              <div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              </div>
              <div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              </div>
              <div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28" />
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>

            <div className="relative pl-4 space-y-8">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="relative pl-8">
                  {step !== 4 && (
                    <div className="absolute left-[11px] top-8 h-full w-0.5 bg-gray-200 dark:bg-gray-700 border-l-2 border-dotted border-gray-300 dark:border-gray-600" />
                  )}

                  <div className="absolute left-0 top-0 h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5 mt-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-4">
          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mr-2" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-36" />
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-72" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20" />
            <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-28" />
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20" />
            <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-24" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto mb-6" />
        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 inline-block">
          <div className="w-48 h-48 bg-gray-200 dark:bg-gray-600 rounded mx-auto mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
};

export default TrackBatchSkeleton;