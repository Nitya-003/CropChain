import React, { useState } from 'react';
import { Search, Package, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Timeline from '../components/Timeline'; // <--- Import our new component

const TrackBatch: React.FC = () => {
  const { t } = useTranslation();
  const [batchId, setBatchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundBatch, setFoundBatch] = useState<any>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId.trim()) return;

    setIsSearching(true);
    
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
        </div>
      )}
    </div>
  );
};

export default TrackBatch;