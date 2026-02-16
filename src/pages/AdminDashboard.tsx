import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Package, Users, Calendar, BarChart3 } from 'lucide-react';
import { realCropBatchService } from '../services/realCropBatchService';
import Skeleton from '../components/Skeleton';
import CopyButton from '../components/CopyButton';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalFarmers: 0,
    totalQuantity: 0,
    recentBatches: [] as any[]
  });
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // 🟢 REAL CALL: This now works because we fixed the service file
      const data = await realCropBatchService.getAllBatches();
      
      if (data) {
        setStats(data.stats || { totalBatches: 0, totalFarmers: 0, totalQuantity: 0, recentBatches: [] });
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getStageColor = (stage: string) => {
    const colors: any = {
      farmer: 'bg-green-100 text-green-800',
      mandi: 'bg-blue-100 text-blue-800',
      transport: 'bg-yellow-100 text-yellow-800',
      retailer: 'bg-purple-100 text-purple-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  // 🟢 SKELETON LOADER UI (Issue #96)
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 p-6">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl h-40 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center mb-6">
            <Skeleton className="h-8 w-8 mr-3 rounded" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="space-y-4">
            <div className="flex justify-between pb-4 border-b dark:border-gray-700">
               {[1, 2, 3, 4, 5, 6].map(j => <Skeleton key={j} className="h-4 w-24" />)}
            </div>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex justify-between items-center py-4 border-b dark:border-gray-700 last:border-0">
                 <Skeleton className="h-5 w-20" />
                 <Skeleton className="h-5 w-32" />
                 <Skeleton className="h-5 w-16" />
                 <Skeleton className="h-5 w-16" />
                 <Skeleton className="h-6 w-24 rounded-full" />
                 <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-center">
          <Shield className="h-10 w-10 mr-4 text-green-600 dark:text-green-400" />
          Admin Dashboard
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">Monitor and manage the CropChain supply chain network</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-2">Total Batches</p>
              <p className="text-3xl font-bold">{stats.totalBatches}</p>
            </div>
            <Package className="h-12 w-12 text-green-200" />
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            <span className="text-sm">+12% from last month</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-2">Active Farmers</p>
              <p className="text-3xl font-bold">{stats.totalFarmers}</p>
            </div>
            <Users className="h-12 w-12 text-blue-200" />
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            <span className="text-sm">+8% from last month</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-2">Total Quantity</p>
              <p className="text-3xl font-bold">{stats.totalQuantity.toLocaleString()}</p>
              <p className="text-purple-100 text-xs">kg tracked</p>
            </div>
            <BarChart3 className="h-12 w-12 text-purple-200" />
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            <span className="text-sm">+15% from last month</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm mb-2">This Month</p>
              <p className="text-3xl font-bold">{stats.recentBatches.length}</p>
              <p className="text-yellow-100 text-xs">new batches</p>
            </div>
            <Calendar className="h-12 w-12 text-yellow-200" />
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            <span className="text-sm">Peak season activity</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
          <Package className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
          Recent Batches
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Batch ID</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Farmer</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Crop Type</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Quantity</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Current Stage</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Date Created</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-200">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.length > 0 ? (
                batches.map((batch, index) => (
                  <tr key={batch.batchId || index} className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'} hover:bg-green-50 dark:hover:bg-gray-600 transition-colors`}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-600 dark:text-white px-2 py-1 rounded">
                          {batch.batchId}
                        </span>
                        <CopyButton value={batch.batchId} label="batch id" />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">{batch.farmerName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{batch.origin}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize font-medium text-gray-800 dark:text-white">{batch.cropType}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-gray-800 dark:text-white">{batch.quantity} kg</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStageColor(batch.currentStage)}`}>
                        {batch.currentStage}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-600 dark:text-gray-300">{formatDate(batch.createdAt)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium">Active</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No batches found. Create one to see it here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;