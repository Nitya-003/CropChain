import React, { useState } from 'react';
import { Search, QrCode, Package, Calendar, MapPin, User, FileText, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { realCropBatchService } from '../services/realCropBatchService';
import { useToast } from '../context/ToastContext';
// import Timeline from '../components/Timeline';
import QRScanner from '../components/QRScanner';
import {TrackBatchSkeleton} from '../components/skeletons';

const TrackBatch: React.FC = () => {
  const [batchId, setBatchId] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { t } = useTranslation();
  const toast = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Batch ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
      console.error('Failed to copy:', err);
    }
  };

  const handleSearch = async () => {
    if (!batchId.trim()) return;

    setIsSearching(true);
    setBatch(null);
    try {
      const foundBatch = await realCropBatchService.getBatch(batchId);
      setBatch(foundBatch);
      toast.success(`Batch ${batchId} loaded successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch not found. Please check the ID and try again.';
      toast.error(errorMessage);
      console.error('Batch not found:', error);
      setBatch(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQRScan = (result: string) => {
    setBatchId(result);
    setShowScanner(false);
    toast.info(`QR code scanned! Searching for batch: ${result}`);
    // Auto-search after QR scan
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">{t('batch.trackTitle')}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">{t('batch.trackSubtitle')}</p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder={t('batch.enterBatchIdPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-lg"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center space-x-2"
            >
              <QrCode className="h-5 w-5" />
              <span>{t('batch.scanQR')}</span>
            </button>
            <button
              onClick={handleSearch}
              disabled={isSearching || !batchId.trim()}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${isSearching || !batchId.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 transform hover:scale-105'
                } text-white`}
            >
              {isSearching ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span>{isSearching ? t('batch.tracking') : t('batch.track')}</span>
            </button>
          </div>
        </div>

        {showScanner && (
          <div className="mt-6">
            <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
          </div>
        )}
      </div>

      {isSearching && <TrackBatchSkeleton />}

      {batch && (
        <>
          {batch?.isRecalled && (
            <div className="bg-red-600 text-white p-4 rounded-lg text-center font-bold mb-6 animate-pulse">
              🚨 RECALLED – Do NOT consume this batch
            </div>
          )}

          {/* Batch Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold">Batch #{batch.batchId}</h2>
                  <button
                    onClick={() => copyToClipboard(batch.batchId)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    title={copied ? t('batch.copied') : t('batch.copyBatchId')}
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-green-300" />
                    ) : (
                      <Copy className="h-5 w-5 text-white/80" />
                    )}
                  </button>
                </div>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
                <Package className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
                Crop Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                  <div className="text-3xl mr-4">🌾</div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Crop Type</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white capitalize">{batch.cropType}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                  <div className="text-3xl mr-4">⚖️</div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Quantity</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.quantity} kg</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                  <Calendar className="h-6 w-6 mr-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Harvest Date</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white">{new Date(batch.harvestDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
                <User className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
                Farmer Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl">
                  <div className="text-3xl mr-4">👨‍🌾</div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Farmer Name</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.farmerName}</p>
                  </div>
                </div>
                <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
                  <MapPin className="h-6 w-6 mr-4 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Farm Location</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.origin}</p>
                  </div>
                </div>
                {batch.certifications && (
                  <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/30 rounded-xl">
                    <div className="text-3xl mr-4">🏅</div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Certifications</p>
                      <p className="text-lg font-semibold text-gray-800 dark:text-white">{batch.certifications}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-green-600 dark:text-green-400" />
              Supply Chain Journey
            </h3>
            {/* <Timeline events={batch.updates} /> */}
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

      {batch === null && batchId && !isSearching && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-2xl font-semibold text-red-800 mb-2">{t('batch.batchNotFound')}</h3>
          <p className="text-red-600">No batch found with ID: {batchId}</p>
          <p className="text-red-600 mt-2">{t('batch.tryAgain')}</p>
        </div>
      )}
    </div>
  );
};

export default TrackBatch;