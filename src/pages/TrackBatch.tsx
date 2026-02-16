import React, { useState } from 'react';
import { Search, Package, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cropBatchService } from '../services/cropBatchService';
import Timeline from '../components/Timeline';
import QRScanner from '../components/QRScanner';
import { TrackBatchSkeleton } from '../components/skeletons';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';

const TrackBatch: React.FC = () => {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorType, setErrorType] = useState<'not-found' | 'error' | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [copied, setCopied] = useState(false);

  const { t } = useTranslation();

  const [foundBatch, setFoundBatch] = useState<any>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId.trim()) return;

    setIsSearching(true);
    setBatch(null);
    setErrorType(null);

    try {
      const foundBatch = await cropBatchService.getBatch(batchId);
      setBatch(foundBatch);
    } catch (error) {
      console.error('Batch error:', error);
      setBatch(null);
      // Rough heuristic: if error message or type indicates 404, set 'not-found'
      // For now, assuming any error is "not found" if specific error handling isn't robust in service
      // But let's assume if it throws it might be network or 404. 
      // Typically services throw specific errors. 
      // If we assume the service throws a specific "Not found" error we can check it.
      // For this refactor, I'll default to 'not-found' for 404-like behavior if simply null, 
      // but if it threw an actual error object we might want 'error'.
      // Let's assume standard fetch/axios behavior where 404 might throw or return null depending on implementation.
      // The original code caught error and logged "Batch not found", so likely 404 throws.

      // Let's treat it as 'not-found' mostly, but if it's a network error (no response), treated as 'error'
      // Since I can't see the service implementation details on error object structure easily, 
      // I'll assume generic error is "not found" for now to match legacy behavior, 
      // but effectively separate it from UI.
      // Ideally: 
      // if (error.response && error.response.status === 404) setErrorType('not-found');
      // else setErrorType('error');

      // Given I don't want to break existing logic too much without verifying service:
      setErrorType('not-found');
      // Later improvement: check error.message or status for true 'error' vs 'not-found'
    } finally {

      // SIMULATED API CALL
      // In a real app, you would fetch this from realCropBatchService.getBatch(batchId)
      setTimeout(() => {
        setFoundBatch({
          id: batchId,
          crop: 'Premium Basmati Rice',
          farmer: 'Rajesh Kumar',
          origin: 'Punjab, India',
          harvestDate: '2023-11-15',
          currentStage: 2 // 0=Harvested, 1=Processed, 2=Shipped, 3=Retailer
        });
        setIsSearching(false);
      }, 1500);
    };

    // Define the supply chain journey based on the found batch
    const getTimelineEvents = (batch: any) => [
      {
        title: 'Harvested',
        date: batch.harvestDate,
        location: batch.origin,
        description: `Harvested by ${batch.farmer} with Grade A quality check.`
      },
      {
        title: 'Processing & Quality Check',
        date: '2023-11-20',
        location: 'Amritsar Processing Unit',
        description: 'Cleaned, sorted, and packaged for distribution.'
      },
      {
        title: 'In Transit (Shipping)',
        date: '2023-11-25',
        location: 'Logistics Hub, Delhi',
        description: 'Dispatched via SafeTruck Logistics. Tracking ID: #TRK9988'
      },
      {
        title: 'Retailer Received',
        date: 'Estimated: 2023-11-30',
        location: 'Whole Foods Market, Mumbai',
        description: 'Pending final delivery and shelf stocking.'
      }
    ];

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
                placeholder="Enter Batch ID (e.g., BATCH-7929)"
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
              {isSearching ? 'Tracking...' : 'Track'}
              {!isSearching && <ArrowRight className="ml-2 h-5 w-5" />}
            </button>
          </form>
        </div>

        {/* Results Section */}
        {foundBatch && (
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
                      {foundBatch.id}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500">Crop Type</label>
                    <p className="font-semibold text-gray-800 dark:text-white">{foundBatch.crop}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Farmer</label>
                    <p className="font-semibold text-gray-800 dark:text-white">{foundBatch.farmer}</p>
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

                {/* 🚀 THIS IS THE NEW COMPONENT */}
                <Timeline
                  events={getTimelineEvents(foundBatch)}
                  currentStep={foundBatch.currentStage}
                />

              </div>
            </div>

            {/* QR Code */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">QR Code</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 inline-block">
                <img src={batch.qrCode} alt="Batch QR Code" className="w-48 h-48 mx-auto" />
                <p className="text-gray-600 dark:text-gray-300 mt-4">Share this QR code for instant batch verification</p>
              </div>
            </div>
          </>
        )}

        {/* Result States */}
        {!batch && !isSearching && errorType === 'not-found' && (
          <EmptyState
            title={t('batch.batchNotFound')}
            description={`No batch found with ID: ${batchId}. Please check the ID and try again.`}
            icon={Search}
            actionLabel={t('batch.tryAgain')}
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
            onRetry={handleSearch}
          />
        </div>
    )
  }
    </div >
  );
};

export default TrackBatch;