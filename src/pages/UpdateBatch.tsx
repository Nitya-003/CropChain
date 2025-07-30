import React, { useState } from 'react';
import { RefreshCw, Search, Package, Clock, User, MapPin } from 'lucide-react';
import { cropBatchService } from '../services/cropBatchService';
import Timeline from '../components/Timeline';

const UpdateBatch: React.FC = () => {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [updateData, setUpdateData] = useState({
    actor: '',
    stage: '',
    location: '',
    notes: '',
    timestamp: new Date().toISOString().split('T')[0]
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const stages = [
    { value: 'farmer', label: 'Farmer' },
    { value: 'mandi', label: 'Mandi (Market)' },
    { value: 'transport', label: 'Transport' },
    { value: 'retailer', label: 'Retailer' }
  ];

  const handleSearch = async () => {
    if (!batchId.trim()) return;
    
    setIsSearching(true);
    try {
      const foundBatch = await cropBatchService.getBatch(batchId);
      setBatch(foundBatch);
    } catch (error) {
      console.error('Batch not found:', error);
      setBatch(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;

    setIsUpdating(true);
    try {
      const updatedBatch = await cropBatchService.updateBatch(batch.batchId, updateData);
      setBatch(updatedBatch);
      setUpdateData({
        actor: '',
        stage: '',
        location: '',
        notes: '',
        timestamp: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Failed to update batch:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setUpdateData({
      ...updateData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Update Crop Batch</h1>
        <p className="text-xl text-gray-600">Add supply chain updates to existing batches</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
          <Search className="h-6 w-6 mr-3 text-green-600" />
          Find Batch
        </h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter Batch ID (e.g., CROP-2024-001)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !batchId.trim()}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${
              isSearching || !batchId.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
            } text-white`}
          >
            {isSearching ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </div>
      </div>

      {batch && (
        <>
          {/* Batch Info */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <Package className="h-6 w-6 mr-3 text-green-600" />
              Batch Information
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Crop Type</p>
                <p className="text-lg font-semibold text-gray-800 capitalize">{batch.cropType}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Quantity</p>
                <p className="text-lg font-semibold text-gray-800">{batch.quantity} kg</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Farmer</p>
                <p className="text-lg font-semibold text-gray-800">{batch.farmerName}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <Clock className="h-6 w-6 mr-3 text-green-600" />
              Supply Chain Timeline
            </h2>
            <Timeline events={batch.updates} />
          </div>

          {/* Update Form */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <RefreshCw className="h-6 w-6 mr-3 text-green-600" />
              Add New Update
            </h2>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <User className="h-4 w-4 mr-2 text-green-600" />
                    Actor Name
                  </label>
                  <input
                    type="text"
                    name="actor"
                    value={updateData.actor}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Your name or company"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    Stage
                  </label>
                  <select
                    name="stage"
                    value={updateData.stage}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select stage</option>
                    {stages.map(stage => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <MapPin className="h-4 w-4 mr-2 text-green-600" />
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={updateData.location}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Current location"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Clock className="h-4 w-4 mr-2 text-green-600" />
                    Date
                  </label>
                  <input
                    type="date"
                    name="timestamp"
                    value={updateData.timestamp}
                    onChange={handleUpdateChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={updateData.notes}
                  onChange={handleUpdateChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Additional information about this update..."
                />
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center space-x-2 ${
                    isUpdating
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 transform hover:scale-105 shadow-lg'
                  } text-white`}
                >
                  {isUpdating ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Adding Update...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>Add Update</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default UpdateBatch;
