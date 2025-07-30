import React, { useState } from 'react';
import { Search, QrCode, Package, Calendar, MapPin, User, FileText } from 'lucide-react';
import { cropBatchService } from '../services/cropBatchService';
import Timeline from '../components/Timeline';
import QRScanner from '../components/QRScanner';

const TrackBatch: React.FC = () => {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

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

  const handleQRScan = (result: string) => {
    setBatchId(result);
    setShowScanner(false);
    // Auto-search after QR scan
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Track Crop Batch</h1>
        <p className="text-xl text-gray-600">Scan QR code or enter Batch ID to view complete supply chain history</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter Batch ID (e.g., CROP-2024-001)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-lg"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2"
            >
              <QrCode className="h-5 w-5" />
              <span>Scan QR</span>
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching || !batchId.trim()}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${
                isSearching || !batchId.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 transform hover:scale-105'
              } text-white`}
            >
              {isSearching ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span>{isSearching ? 'Tracking...' : 'Track'}</span>
            </button>
          </div>
        </div>

        {showScanner && (
          <div className="mt-6">
            <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
          </div>
        )}
      </div>

      {batch && (
        <>
          {/* Batch Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Batch #{batch.batchId}</h2>
                <p className="text-green-100 text-lg">Complete supply chain transparency</p>
              </div>
              <div className="text-right">
                <p className="text-green-100 text-sm">Blockchain Verified</p>
                <div className="flex items-center mt-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-sm">Live Tracking</span>
                </div>
              </div>
            </div>
          </div>

          {/* Batch Details */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <Package className="h-6 w-6 mr-3 text-green-600" />
                Crop Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-green-50 rounded-xl">
                  <div className="text-3xl mr-4">🌾</div>
                  <div>
                    <p className="text-sm text-gray-600">Crop Type</p>
                    <p className="text-lg font-semibold text-gray-800 capitalize">{batch.cropType}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-3xl mr-4">⚖️</div>
                  <div>
                    <p className="text-sm text-gray-600">Quantity</p>
                    <p className="text-lg font-semibold text-gray-800">{batch.quantity} kg</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-purple-50 rounded-xl">
                  <Calendar className="h-6 w-6 mr-4 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Harvest Date</p>
                    <p className="text-lg font-semibold text-gray-800">{new Date(batch.harvestDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <User className="h-6 w-6 mr-3 text-green-600" />
                Farmer Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-yellow-50 rounded-xl">
                  <div className="text-3xl mr-4">👨‍🌾</div>
                  <div>
                    <p className="text-sm text-gray-600">Farmer Name</p>
                    <p className="text-lg font-semibold text-gray-800">{batch.farmerName}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-orange-50 rounded-xl">
                  <MapPin className="h-6 w-6 mr-4 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Farm Location</p>
                    <p className="text-lg font-semibold text-gray-800">{batch.origin}</p>
                  </div>
                </div>
                {batch.certifications && (
                  <div className="flex items-center p-4 bg-green-50 rounded-xl">
                    <div className="text-3xl mr-4">🏅</div>
                    <div>
                      <p className="text-sm text-gray-600">Certifications</p>
                      <p className="text-lg font-semibold text-gray-800">{batch.certifications}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-green-600" />
              Supply Chain Journey
            </h3>
            <Timeline events={batch.updates} />
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6">QR Code</h3>
            <div className="bg-gray-50 rounded-xl p-6 inline-block">
              <img src={batch.qrCode} alt="Batch QR Code" className="w-48 h-48 mx-auto" />
              <p className="text-gray-600 mt-4">Share this QR code for instant batch verification</p>
            </div>
          </div>
        </>
      )}

      {batch === null && batchId && !isSearching && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-2xl font-semibold text-red-800 mb-2">Batch Not Found</h3>
          <p className="text-red-600">No batch found with ID: {batchId}</p>
          <p className="text-red-600 mt-2">Please check the ID and try again.</p>
        </div>
      )}
    </div>
  );
};

export default TrackBatch;
