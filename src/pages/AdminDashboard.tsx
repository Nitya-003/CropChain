import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, Package, Users, Calendar, BarChart3 } from 'lucide-react';
import ToggleSwitch from '../components/ToggleSwitch';
import { useAuth } from '../context/AuthContext';
import { StatsCardSkeleton, TableSkeleton, ChartSkeleton } from '../components/skeletons';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
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
  const [isError, setIsError] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Track status for each batch (default: true/active)
  const [batchStatus, setBatchStatus] = useState<Record<string, boolean>>({});

  // Initialize batchStatus when batches load
  useEffect(() => {
    if (batches.length > 0) {
      const statusMap: Record<string, boolean> = {};
      batches.forEach(batch => {
        // If batch has a status property, use it; otherwise default to true (active)
        statusMap[batch.batchId] = batch.status !== undefined ? batch.status : true;
      });
      setBatchStatus(statusMap);
    }
  }, [batches]);

  const handleStatusToggle = (batchId: string, checked: boolean) => {
    setBatchStatus(prev => ({ ...prev, [batchId]: checked }));
    // Optionally: send update to backend here
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await realCropBatchService.getAllBatches();

      if (data) {
        setStats(data.stats || { totalBatches: 0, totalFarmers: 0, totalQuantity: 0, recentBatches: [] });
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center">
          <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded w-64 mx-auto mb-4"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-96 mx-auto"></div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center mb-6">
            <div className="h-6 w-6 bg-gray-300 dark:bg-gray-700 rounded mr-3"></div>
            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
          </div>
          <TableSkeleton />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <ChartSkeleton />
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 animate-pulse">
            <div className="h-7 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-4"></div>
            <div className="flex items-end justify-between h-48 px-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="flex flex-col items-center">
                  <div className="bg-gray-300 dark:bg-gray-600 rounded-t-lg w-8 transition-all duration-500 h-20"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-8 mt-2"></div>
                </div>
              ))}
            </div>
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

      {/* Stats Overview */}
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
              <p className="text-3xl font-bold">{stats.recentBatches}</p>
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

      {/* Recent Batches Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
          <Package className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
          Recent Batches
        </h2>

        {isError && (
          <div className="p-8">
            <ErrorState
              title="Failed to load batches"
              message="We couldn't load the batch data. Please try again later."
              onRetry={loadDashboardData}
            />
          </div>
        )}

        {!isError && !isLoading && batches.length === 0 && (
          <div className="p-8">
            <EmptyState
              title="No batches found"
              description="There are no active batches in the system yet."
              icon={Package}
              actionLabel="Create Batch"
              onAction={() => navigate('/add-batch')}
            />
          </div>
        )}

        {!isError && !isLoading && batches.length > 0 && (
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
                {batches.map((batch, index) => (
                  <tr key={batch.batchId} className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'} hover:bg-green-50 dark:hover:bg-gray-600 transition-colors`}>
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
                      {user && user.role === 'admin' ? (
                        <ToggleSwitch
                          checked={!!batchStatus[batch.batchId]}
                          onChange={checked => handleStatusToggle(batch.batchId, checked)}
                          onLabel="Active"
                          offLabel="Flagged / Inactive"
                        />
                      ) : (
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${batchStatus[batch.batchId] ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className={`text-sm font-medium ${batchStatus[batch.batchId] ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{batchStatus[batch.batchId] ? 'Active' : 'Flagged / Inactive'}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Crop Types Distribution</h3>
          <div className="space-y-4">
            {['Rice', 'Wheat', 'Corn', 'Tomato'].map((crop, index) => {
              const percentage = Math.random() * 40 + 10;
              return (
                <div key={crop} className="flex items-center">
                  <span className="w-16 text-sm text-gray-600 dark:text-gray-300 capitalize">{crop}</span>
                  <div className="flex-1 mx-4 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${index === 0 ? 'bg-green-500' :
                        index === 1 ? 'bg-blue-500' :
                          index === 2 ? 'bg-yellow-500' : 'bg-purple-500'
                        }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Monthly Activity</h3>
          <div className="flex items-end justify-between h-48 px-4">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => {
              const height = Math.random() * 120 + 30;
              return (
                <div key={month} className="flex flex-col items-center">
                  <div
                    className="bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg w-8 transition-all duration-500 hover:from-green-600 hover:to-green-500"
                    style={{ height: `${height}px` }}
                  ></div>
                  <span className="text-xs text-gray-600 dark:text-gray-300 mt-2">{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div >
    </div >
  );
};

export default AdminDashboard;
