import React from 'react';

export const AdminStatsSkeleton: React.FC = () => {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-green-200/40 rounded"></div>
            <div className="h-9 w-20 bg-green-200/30 rounded"></div>
          </div>
          <div className="h-12 w-12 bg-green-200/20 rounded-full"></div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-3 w-3 bg-white/20 rounded"></div>
          <div className="h-4 w-24 bg-white/20 rounded"></div>
        </div>
      </div>
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-indigo-200/40 rounded"></div>
            <div className="h-9 w-20 bg-indigo-200/30 rounded"></div>
          </div>
          <div className="h-12 w-12 bg-indigo-200/20 rounded-full"></div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-3 w-3 bg-white/20 rounded"></div>
          <div className="h-4 w-32 bg-white/20 rounded"></div>
        </div>
      </div>
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-red-200/40 rounded"></div>
            <div className="h-9 w-20 bg-red-200/30 rounded"></div>
          </div>
          <div className="h-12 w-12 bg-red-200/20 rounded-full"></div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-3 w-3 bg-white/20 rounded"></div>
          <div className="h-4 w-20 bg-white/20 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export default AdminStatsSkeleton;
