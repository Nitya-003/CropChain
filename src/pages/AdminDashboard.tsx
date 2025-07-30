import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Package, Users, Calendar, BarChart3 } from 'lucide-react';
import { cropBatchService } from '../services/cropBatchService';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalFarmers: 0,
    totalQuantity: 0,
    recentBatches: []
  });
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const dashboardData = await cropBatchService.getDashboardStats();
      setStats(dashboardData.stats);
      setBatches(dashboardData.batches);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStageColor = (stage: string) => {
    const colors = {
      farmer: 'bg-green-100 text-green-800',
      mandi: 'bg-blue-100 text-blue-800',
      transport: 'bg-yellow-100 text-yellow-800',
      retailer: 'bg-purple-100 text-purple-800'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin h-12 w-12 border-4 border-green-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center justify-center">
          <Shield className="h-10 w-10 mr-4 text-green-600" />
          Admin Dashboard
        </h1>
        <p className="text-xl text-gray-600">Monitor and manage the CropChain supply chain network</p>
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

      {/* Recent Batches Table */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
          <Package className="h-6 w-6 mr-3 text-green-600" />
          Recent Batches
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Batch ID</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Farmer</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Crop Type</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Quantity</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Current Stage</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Date Created</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch, index) => (
                <tr key={batch.batchId} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-green-50 transition-colors`}>
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {batch.batchId}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-800">{batch.farmerName}</p>
                      <p className="text-sm text-gray-600">{batch.origin}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="capitalize font-medium text-gray-800">{batch.cropType}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-gray-800">{batch.quantity} kg</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStageColor(batch.currentStage)}`}>
                      {batch.currentStage}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-gray-600">{formatDate(batch.createdAt)}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span className="text-sm text-green-600 font-medium">Active</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Crop Types Distribution</h3>
          <div className="space-y-4">
            {['Rice', 'Wheat', 'Corn', 'Tomato'].map((crop, index) => {
              const percentage = Math.random() * 40 + 10;
              return (
                <div key={crop} className="flex items-center">
                  <span className="w-16 text-sm text-gray-600 capitalize">{crop}</span>
                  <div className="flex-1 mx-4 bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        index === 0 ? 'bg-green-500' : 
                        index === 1 ? 'bg-blue-500' : 
                        index === 2 ? 'bg-yellow-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Monthly Activity</h3>
          <div className="flex items-end justify-between h-48 px-4">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
              const height = Math.random() * 120 + 30;
              return (
                <div key={month} className="flex flex-col items-center">
                  <div 
                    className="bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg w-8 transition-all duration-500 hover:from-green-600 hover:to-green-500"
                    style={{ height: `${height}px` }}
                  ></div>
                  <span className="text-xs text-gray-600 mt-2">{month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
