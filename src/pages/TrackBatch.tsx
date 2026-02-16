import React, { useState } from 'react';
import { Search, Package, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { realCropBatchService } from '../services/realCropBatchService';
import Timeline from '../components/Timeline';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import Skeleton from '../components/Skeleton';

const TrackBatch: React.FC = () => {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorType, setErrorType] = useState<'not-found' | 'error' | null>(null);

  const { t } = useTranslation();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!batchId.trim()) return;

    setIsSearching(true);
    setBatch(null);
    setErrorType(null);

    try {
      const result = await realCropBatchService.getBatch(batchId);
      setBatch(result);
    } catch (error: any) {
      console.error('Batch error:', error);
      setBatch(null);
      if (error.message.includes('not found') || error.message.includes('404')) {
        setErrorType('not-found');
      } else {
        setErrorType('error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const getTimelineEvents = (batchData: any) => {
    if (!batchData || !batchData.updates) return [];

    return batchData.updates.map((update: any) => ({
      title: update.stage.charAt(0).toUpperCase() + update.stage.slice(1),
      date: update.timestamp,
      location: update.location || 'Unknown Location',
      description: update.notes || `Processed by ${update.actor}`
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          {t('nav.trackBatch') || 'Track Your Shipment'}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Enter your Batch ID to see the real-time supply chain journey.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Enter Batch ID (e.g., CROP-2024-001)"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center"
          >
            {isSearching ? 'Searching...' : 'Track'}
            {!isSearching && <ArrowRight className="ml-2 h-5 w-5" />}
          </button>
        </form>
      </div>

      {/* 🟢 SKELETON LOADING STATE */}
      {isSearching && (
        <div className="grid md:grid-cols-3 gap-8 animate-pulse">
          {/* Left Column Skeleton */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>

          {/* Right Column Skeleton (Timeline) */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <Skeleton className="h-6 w-48 mb-8" />
              <div className="space-y-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="w-full space-y-2">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-16 w-full rounded-lg mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {batch && (
        <div className="grid md:grid-cols-3 gap-8">

          {/* Left Column: Batch Details Card */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-24">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Batch ID</p>
                  <p className="font-mono font-bold text-lg text-gray-800 dark:text-white">
                    {batch.batchId || batch.id}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Crop Type</label>
                  <p className="font-semibold text-gray-800 dark:text-white capitalize">{batch.cropType}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Farmer</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.farmerName}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Quantity</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.quantity} kg</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Origin</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.origin}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: The Visual Timeline */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b pb-4">
                Supply Chain Journey
              </h2>

              <Timeline
                events={getTimelineEvents(batch)}
                currentStep={batch.currentStage || 0}
              />
            </div>
          </div>

          {/* QR Code */}
          {batch.qrCode && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center md:col-span-3">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">QR Code</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 inline-block">
                <img src={batch.qrCode} alt="Batch QR Code" className="w-48 h-48 mx-auto" />
                <p className="text-gray-600 dark:text-gray-300 mt-4">Share this QR code for instant batch verification</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result States */}
      {!batch && !isSearching && errorType === 'not-found' && (
        <EmptyState
          title={t('batch.batchNotFound') || "Batch Not Found"}
          description={`No batch found with ID: ${batchId}. Please check the ID and try again.`}
          icon={Search}
          actionLabel={t('batch.tryAgain') || "Try Again"}
          onAction={() => {
            setBatchId('');
            setErrorType(null);
          }}
          className="bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/30"
        />
      )}

      {!batch && !isSearching && errorType === 'error' && (
        <ErrorState
          message="We faced an issue while fetching the batch details. Please try again."
          onRetry={() => handleSearch()}
        />
      )}
    </div>
  );
};

export default TrackBatch;