import React, { useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const [scannedResult, setScannedResult] = useState('');

  // Simulate QR scanning - in a real app, you'd use a camera library
  const simulateScan = () => {
    const sampleBatchIds = [
      'CROP-2024-001',
      'CROP-2024-002', 
      'CROP-2024-003',
      'CROP-2024-004'
    ];
    const randomId = sampleBatchIds[Math.floor(Math.random() * sampleBatchIds.length)];
    setScannedResult(randomId);
    setTimeout(() => {
      onScan(randomId);
    }, 1000);
  };

  return (
    <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">QR Code Scanner</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>
      
      <div className="text-center space-y-6">
        <div className="bg-white rounded-lg p-8 border-2 border-gray-200">
          {scannedResult ? (
            <div className="space-y-4">
              <div className="text-6xl">✅</div>
              <p className="text-green-600 font-semibold">QR Code Scanned!</p>
              <p className="font-mono text-lg bg-green-50 px-4 py-2 rounded border">
                {scannedResult}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Camera className="h-16 w-16 text-gray-400 mx-auto" />
              <p className="text-gray-600">Position QR code within the frame</p>
              <div className="w-48 h-48 mx-auto border-4 border-blue-500 border-dashed rounded-lg flex items-center justify-center">
                <p className="text-blue-600 font-medium">Scan Area</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={simulateScan}
            disabled={!!scannedResult}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
              scannedResult
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105'
            } text-white`}
          >
            <Camera className="h-5 w-5" />
            <span>Simulate Scan</span>
          </button>
          
          <button className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Image</span>
          </button>
        </div>
        
        <p className="text-sm text-gray-500">
          Demo mode: Click "Simulate Scan" to test with sample QR codes
        </p>
      </div>
    </div>
  );
};

export default QRScanner;
