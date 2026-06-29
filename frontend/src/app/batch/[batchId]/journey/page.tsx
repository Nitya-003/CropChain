"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Compass, ShieldCheck, AlertTriangle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { realCropBatchService } from '../../../../services/realCropBatchService';
import { tokenService } from '../../../../services/token.service';
import { API_URL } from '../../../../services/apiClient';
import { JourneyTimeline } from '../../../../components/journey/JourneyTimeline';
import { JourneyPathMap } from '../../../../components/journey/JourneyPathMap';
import { JourneyEnvironmentChart } from '../../../../components/journey/JourneyEnvironmentChart';
import { TrackBatchSkeleton } from '../../../../components/skeletons';
import { CropLifecycleTracker } from '../../../../components/journey/CropLifecycleTracker';
import '../../../../styles/JourneyMap.css';

const JourneyMap: React.FC = () => {
  const params = useParams();
  const batchId = params?.batchId as string;
  const router = useRouter();
  const { t } = useTranslation();
  
  const [batch, setBatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUpdateIndex, setSelectedUpdateIndex] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchBatchDetails = async () => {
      if (!batchId) return;
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await realCropBatchService.getBatch(batchId);
        
        // getBatch returns BatchData directly; no need to unwrap
        const unpackedBatch = result;
        
        if (!unpackedBatch) {
          throw new Error('Invalid batch data received');
        }
        
        setBatch(unpackedBatch);
        
        // Default select the latest/current update in the timeline
        if (unpackedBatch.updates && unpackedBatch.updates.length > 0) {
          setSelectedUpdateIndex(unpackedBatch.updates.length - 1);
        }
      } catch (err: any) {
        console.error('Failed to fetch batch journey data:', err);
        setError(err.message || 'Failed to load journey map details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchDetails();
  }, [batchId]);

  const handleSelectUpdate = (update: any, index: number) => {
    setSelectedUpdateIndex(index);
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setIsExporting(true);
    try {
      const blob = await realCropBatchService.exportBatch(batchId, format);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch-${batchId}-journey.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to export ${format}:`, err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-64" />
        </div>
        <TrackBatchSkeleton />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl mt-12">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Failed to Load Journey Map
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {error || 'The requested batch could not be found or has no journey logs recorded.'}
        </p>
        <button
          onClick={() => router.push('/track-batch')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center gap-2 mx-auto"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Tracking</span>
        </button>
      </div>
    );
  }

  const updates = batch.updates || [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8"
    >
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 dark:border-gray-800 pb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/track-batch')}
            className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-400 rounded-2xl shadow-sm text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-all hover:scale-105"
            title="Back to tracking search"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <Compass className="h-8 w-8 text-green-600 dark:text-green-400 animate-spin-slow" />
              <span>{t('journey.title', 'Leaf-to-Shelf Journey Map')}</span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Batch ID: <strong className="font-mono text-gray-700 dark:text-gray-300">{batch.batchId || batchId}</strong></span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span className="capitalize">{batch.cropType}</span>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <span>{batch.quantity} kg</span>
            </p>
          </div>
        </div>

        {/* Actions & Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-all hover:scale-105"
            title="Download as PDF"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'Exporting...' : 'PDF Report'}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-all hover:scale-105"
            title="Download as CSV"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'Exporting...' : 'CSV Export'}</span>
          </button>
          {batch.isSpoiled ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 text-xs font-bold shadow-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Spoilage Breached</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900 text-xs font-bold shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>Oracle Secured</span>
            </div>
          )}
          
          <span className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono px-3 py-1.5 rounded-full uppercase tracking-wider font-semibold">
            {batch.syncStatus || 'synced'}
          </span>
        </div>
      </div>

      {/* Crop Lifecycle Progress Tracker */}
      <CropLifecycleTracker batchId={batchId} blockchainHash={batch.blockchainHash} />

      {/* Main Responsive Grid Panel */}
      <div className="journey-grid-container">
        
        {/* Left Side Column: Vertical Interactive Timeline */}
        <div className="flex flex-col space-y-4">
          <div className="journey-glass-card rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-100 dark:border-gray-800 pb-4 flex items-center gap-2">
              <span>Supply Chain Progress Logs</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
                {updates.length} events
              </span>
            </h2>
            
            <JourneyTimeline
              updates={updates}
              currentStage={batch.currentStage || 'farmer'}
              blockchainHash={batch.blockchainHash}
              currentTemperature={batch.currentTemperature}
              currentHumidity={batch.currentHumidity}
              isSpoiled={batch.isSpoiled}
              onSelectUpdate={handleSelectUpdate}
              selectedUpdateIndex={selectedUpdateIndex}
            />
          </div>
        </div>

        {/* Right Side Column: Map & Sparklines */}
        <div className="flex flex-col space-y-6">
          
          {/* Geographic SVG-based Map */}
          <div className="h-[380px]">
            <JourneyPathMap
              updates={updates}
              selectedUpdateIndex={selectedUpdateIndex}
              onSelectUpdate={handleSelectUpdate}
            />
          </div>

          {/* IoT Telemetry Environment Sparkline Chart */}
          <div>
            <JourneyEnvironmentChart
              batchId={batch.batchId || batchId || ''}
              currentTemperature={batch.currentTemperature}
              currentHumidity={batch.currentHumidity}
              isSpoiled={batch.isSpoiled}
              updatesCount={updates.length}
            />
          </div>

          {/* Verification Audit Summary Card */}
          <div className="journey-glass-card rounded-2xl p-6 text-left">
            <h3 className="font-bold text-gray-800 dark:text-white mb-3 text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Pedigree Verification summary</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This crop batch is fully registered on the blockchain network. Every stage change, transporter geo-checkpoint location, and cold-chain temperature logger value has been cryptographically signed and stored immutably.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-150 dark:border-gray-800">
                <span className="text-gray-400 dark:text-gray-500 block mb-0.5 font-bold uppercase text-[9px] tracking-wider">Harvest Origin</span>
                <span className="text-gray-800 dark:text-gray-200 font-semibold truncate block">{batch.origin}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-150 dark:border-gray-800">
                <span className="text-gray-400 dark:text-gray-500 block mb-0.5 font-bold uppercase text-[9px] tracking-wider">Harvest Date</span>
                <span className="text-gray-800 dark:text-gray-200 font-semibold truncate block">
                  {batch.harvestDate ? new Date(batch.harvestDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
};

export default JourneyMap;
