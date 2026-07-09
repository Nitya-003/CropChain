"use client";
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Search, Package, ArrowRight, Thermometer, AlertTriangle, CheckCircle, Wifi, AlertOctagon, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { realCropBatchService } from '../../services/realCropBatchService';
import Timeline from '../../components/Timeline';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { TrackBatchSkeleton } from '../../components/skeletons';
import { useBatchSocket } from '../../hooks/useBatchSocket';
import { JourneyPreview } from '../../components/journey/JourneyPreview';

const TrackBatchContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorType, setErrorType] = useState<'not-found' | 'error' | null>(null);
  const lastAutoSearchedId = useRef<string | null>(null);

  const { t } = useTranslation();

  // WebSocket connection for real-time updates
  const { isConnected: socketConnected, lastUpdate } = useBatchSocket({
    batchId: batch?.batchId || batch?.id,
    enabled: !!batch,
    onBatchUpdate: (data) => {
      console.log('[TrackBatch] Real-time batch update received:', data);
      if (data.batch) {
        setBatch(data.batch);
      }
    }
  });

  const searchBatch = useCallback(async (id: string) => {
    const trimmedId = id.trim();
    if (!trimmedId) return;

    setIsSearching(true);
    setBatch(null);
    setErrorType(null);

    try {
      const result = await realCropBatchService.getBatch(trimmedId);
      setBatch(result);
    } catch (error: any) {
      console.error('Batch error:', error);
      setBatch(null);
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        setErrorType('not-found');
      } else {
        setErrorType('error');
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const queryBatchId = searchParams.get('id')?.trim();
    if (!queryBatchId || lastAutoSearchedId.current === queryBatchId) return;

    lastAutoSearchedId.current = queryBatchId;
    setBatchId(queryBatchId);
    searchBatch(queryBatchId);
  }, [searchBatch, searchParams]);

  const handleSearch = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    await searchBatch(batchId);
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
          {t('batch.trackDescription', 'Enter your Batch ID to see the real-time supply chain journey.')}
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('batch.enterBatchIdPlaceholder', 'Enter Batch ID (e.g., CROP-2024-001)')}
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
            {isSearching ? t('batch.searching', 'Searching...') : t('batch.track', 'Track')}
            {!isSearching && <ArrowRight className="ml-2 h-5 w-5" />}
          </button>
        </form>
      </div>

      {/* SKELETON LOADING STATE */}
      {isSearching && (
        <TrackBatchSkeleton />
      )}

      {/* Results Section */}
      {batch && (
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Recall / Flagged Warning Banner */}
          {(batch.isRecalled || batch.status === 'Flagged') && (
            <div className="md:col-span-3">
              <div className={`rounded-xl p-6 shadow-lg border-2 flex items-start gap-4 ${batch.isRecalled ? 'bg-red-50 dark:bg-red-900/20 border-red-500' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'}`}>
                <AlertOctagon className={`h-8 w-8 flex-shrink-0 ${batch.isRecalled ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <div>
                  <h3 className={`text-xl font-bold ${batch.isRecalled ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'}`}>
                    {batch.isRecalled ? t('batch.recalledTitle', 'CRITICAL INCIDENT: BATCH RECALLED') : t('batch.flaggedTitle', 'WARNING: BATCH FLAGGED')}
                  </h3>
                  <p className={`mt-2 ${batch.isRecalled ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {batch.isRecalled 
                      ? t('batch.recalledMessage', 'This batch has been officially recalled due to a critical incident (e.g., severe contamination, regulatory non-compliance, or catastrophic spoilage). It must NOT be consumed or distributed.')
                      : t('batch.flaggedMessage', 'This batch has been flagged for review due to an anomaly in the supply chain or environmental data. Proceed with caution.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Left Column: Batch Details Card */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-24">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                  <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('batch.batchId', 'Batch ID')}</p>
                  <p className="font-mono font-bold text-lg text-gray-800 dark:text-white">
                    {batch.batchId || batch.id}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">{t('batch.cropType', 'Crop Type')}</label>
                  <p className="font-semibold text-gray-800 dark:text-white capitalize">{batch.cropType}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{t('actors.farmer', 'Farmer')}</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.farmerName}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{t('batch.quantity', 'Quantity')}</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.quantity} {t('batch.kg', 'kg')}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">{t('batch.origin', 'Origin')}</label>
                  <p className="font-semibold text-gray-800 dark:text-white">{batch.origin}</p>
                </div>
                {batch.spoilageRisk && (
                  <div className="pt-4 border-t border-gray-150 dark:border-gray-700">
                    <label className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                      <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span>{t('batch.spoilageRisk', 'AI Spoilage Risk')}</span>
                    </label>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`font-bold text-sm uppercase tracking-wider ${
                        batch.spoilageRisk.riskLevel === 'High' ? 'text-red-500 animate-pulse' : batch.spoilageRisk.riskLevel === 'Medium' ? 'text-amber-500' : 'text-green-500'
                      }`}>
                        {batch.spoilageRisk.riskLevel}
                      </span>
                      <span className="font-bold text-sm text-gray-800 dark:text-white">
                        {batch.spoilageRisk.riskScore}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: The Visual Timeline */}
          <div className="md:col-span-2 space-y-6">
            <JourneyPreview
              batchId={batch.batchId || batch.id}
              currentStage={batch.currentStage || 'farmer'}
              updates={batch.updates || []}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b pb-4 flex items-center justify-between">
                <span>{t('batch.supplyChainJourney', 'Supply Chain Journey')}</span>
                {socketConnected && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 animate-pulse">
                    <Wifi className="h-5 w-5" />
                    <span className="text-xs font-semibold">{t('batch.live', 'LIVE')}</span>
                  </div>
                )}
              </h2>

              <Timeline
                events={getTimelineEvents(batch)}
                currentStep={batch.currentStage || 0}
              />
              
              {lastUpdate && (
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-right">
                  {t('batch.lastUpdatedAt', 'Last updated:')} {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* IoT Data Display */}
          {batch.currentTemperature !== undefined && (
            <div className="md:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                  <Thermometer className="h-5 w-5 mr-2" />
                  {t('batch.iotSensorData', 'IoT Sensor Data')}
                </h3>
                
                {/* Spoilage Alert */}
                {batch.isSpoiled ? (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800 dark:text-red-200 text-sm">
                          {t('batch.coldChainBreached', 'WARNING: Cold Chain Breached')}
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                          {t('batch.spoiledDescription', 'Crop Spoiled. Temperature exceeded safe limits.')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-200 text-sm">
                          {t('batch.oracleVerified', 'Oracle Verified: Optimal Conditions')}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-green-700 dark:text-green-300 text-sm">{t('journey.temperature', 'Temperature:')}</span>
                            <span className="font-bold text-green-800 dark:text-green-200 text-sm">
                              {batch.currentTemperature ? `${batch.currentTemperature}°F` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700 dark:text-green-300 text-sm">{t('journey.humidity', 'Humidity:')}</span>
                            <span className="font-bold text-green-800 dark:text-green-200 text-sm">
                              {batch.currentHumidity !== undefined ? `${batch.currentHumidity}%` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm text-gray-500">{t('batch.lastReading', 'Last Reading')}</label>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {batch.iotTimestamp ? new Date(batch.iotTimestamp).toLocaleString() : t('batch.noReadings', 'No readings yet')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">{t('batch.sensorStatus', 'Sensor Status')}</label>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {batch.isSpoiled ? (
                        <span className="text-red-600 dark:text-red-400">
                          {t('batch.spoilageDetected', 'Spoilage Detected')}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          {t('batch.fresh', 'Fresh')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code */}
          {batch.qrCode && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center md:col-span-3">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">{t('batch.qrCode', 'QR Code')}</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 inline-block">
                <Image src={batch.qrCode} alt={t('batch.qrCode', 'QR Code')} width={192} height={192} className="mx-auto" />
                <p className="text-gray-600 dark:text-gray-300 mt-4">{t('batch.qrShareDescription', 'Share this QR code for instant batch verification')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result States */}
      {!batch && !isSearching && errorType === 'not-found' && (
        <EmptyState
          title={t('batch.batchNotFound') || "Batch Not Found"}
          description={t('batch.notFoundDescription', 'No batch found with the provided ID. Please check and try again.')}
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
          message={t('batch.fetchError', 'We faced an issue while fetching the batch details. Please try again.')}
          onRetry={() => handleSearch()}
        />
      )}
    </div>
  );
};

const TrackBatch: React.FC = () => (
  <Suspense fallback={null}>
    <TrackBatchContent />
  </Suspense>
);

export default TrackBatch;
