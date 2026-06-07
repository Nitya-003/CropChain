import React from 'react';

interface AdminTableSkeletonProps {
  rows?: number;
}

const AdminTableSkeleton: React.FC<AdminTableSkeletonProps> = ({ rows = 5 }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded"></div>
        <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Batch ID', 'Farmer', 'Crop Type', 'Quantity', 'Stage', 'Tx Value', 'Status'].map((col) => (
                <th key={col} className="text-left py-4 px-6 font-semibold text-gray-500 dark:text-gray-400 text-sm">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </td>
                <td className="py-4 px-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </td>
                <td className="py-4 px-6">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-14"></div>
                </td>
                <td className="py-4 px-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTableSkeleton;
