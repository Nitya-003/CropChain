"use client";
import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, Image as ImageIcon } from 'lucide-react';
import { realCropBatchService } from '../services/realCropBatchService';
import toast from 'react-hot-toast';

interface DocumentUploadProps {
  batchId: string;
  onUploadComplete: () => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

export default function DocumentUpload({ batchId, onUploadComplete }: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, and PDF files are allowed';
    }
    if (file.size > MAX_SIZE) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      await realCropBatchService.uploadDocument(batchId, selectedFile, description);
      toast.success('Document uploaded successfully');
      setSelectedFile(null);
      setPreview(null);
      setDescription('');
      onUploadComplete();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelected = () => {
    setSelectedFile(null);
    setPreview(null);
    setDescription('');
  };

  return (
    <div className="space-y-4">
      {!selectedFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
          }`}
        >
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleInputChange}
            className="hidden"
            id="document-upload-input"
          />
          <label htmlFor="document-upload-input" className="cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-green-600 dark:text-green-400">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              JPEG, PNG, or PDF (max 10MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {preview ? (
                <img src={preview} alt="Preview" className="h-16 w-16 object-cover rounded border" />
              ) : (
                <div className="h-16 w-16 flex items-center justify-center rounded border bg-gray-100 dark:bg-gray-700">
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={clearSelected} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description (optional)"
            className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Document
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
