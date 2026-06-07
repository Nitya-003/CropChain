import React from 'react';

const VerificationStatsSkeleton: React.FC<{ color: 'orange' | 'green'; label: string }> = ({ color, label }) => {
  const bgClass = color === 'orange' ? 'from-orange-500 to-orange-600' : 'from-green-500 to-green-600';
  const iconBgClass = color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-green-100 dark:bg-green-900/50';
  const iconTextClass = color === 'orange' ? 'text-orange-500' : 'text-green-500';

  return (
    <div className={`bg-gradient-to-br ${bgClass} rounded-xl p-6 text-white shadow-lg animate-pulse`}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-white/20 rounded"></div>
          <div className="h-9 w-12 bg-white/20 rounded"></div>
        </div>
        <div className={`h-12 w-12 ${iconBgClass} rounded-full flex items-center justify-center`}>
          <div className={`h-6 w-6 ${iconTextClass} opacity-50`}></div>
        </div>
      </div>
    </div>
  );
};

const VerificationTableSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {['User', 'Role', 'Wallet', 'Status', 'Actions'].map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="px-2 py-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-12"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const VerificationDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-64"></div>
        </div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-80"></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <VerificationStatsSkeleton color="orange" label="Unverified Users" />
        <VerificationStatsSkeleton color="green" label="Verified Users" />
      </div>

      {/* Tabs */}
      <div className="flex gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
        ))}
      </div>

      {/* Table */}
      <VerificationTableSkeleton />
    </div>
  );
};

export default VerificationDashboardSkeleton;
