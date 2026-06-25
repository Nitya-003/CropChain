"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, AlertTriangle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { realCropBatchService } from '../../services/realCropBatchService';
import { useRbac } from '../../hooks/useRbac';
import { sanitizeObject } from '../../lib/sanitize';
import DocumentUpload from '../../components/DocumentUpload';

const AddBatchContent: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { permissions, getRoleDisplayName } = useRbac();

  const cropTypeQuery = searchParams.get('cropType') || '';

  const [formData, setFormData] = useState({
    farmerName: '',
    farmerAddress: '',
    cropType: '',
    quantity: '',
    harvestDate: '',
    origin: '',
    certifications: '',
    description: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Set crop type from query param if available
  useEffect(() => {
    if (cropTypeQuery) {
      setFormData(prev => ({ ...prev, cropType: cropTypeQuery.toLowerCase() }));
    }
  }, [cropTypeQuery]);

  const today = new Date().toISOString().split('T')[0];

  // Validate a single field
  const validateField = useCallback((name: string, value: string): string | undefined => {
    switch (name) {
      case 'farmerName':
        if (!value.trim()) return 'Farmer name is required';
        break;
      case 'farmerAddress':
        if (!value.trim()) return 'Farmer address is required';
        break;
      case 'cropType':
        if (!value.trim()) return 'Please select a crop type';
        break;
      case 'quantity':
        if (!value || Number(value) <= 0) return 'Quantity must be greater than 0';
        break;
      case 'harvestDate':
        if (!value) return 'Harvest date is required';
        else if (new Date(value) > new Date()) return 'Harvest date cannot be in the future';
        break;
      case 'origin':
        if (!value.trim()) return 'Origin is required';
        break;
    }
    return undefined;
  }, []);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const fields = ['farmerName', 'farmerAddress', 'cropType', 'quantity', 'harvestDate', 'origin'];
    for (const name of fields) {
      const error = validateField(name, formData[name] || '');
      if (error) errors[name] = error;
    }
    setFieldErrors(errors);

    // Mark all fields as touched
    Object.keys(formData).forEach(key => {
      formData[key] = formData[key];
    });

    return Object.keys(errors).length === 0;
  }, [formData, validateField]);

  // Validate on blur
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (error) {
        next[name] = error;
      } else {
        delete next[name];
      }
      return next;
    });
  }, [validateField]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const sanitizedData = sanitizeObject(formData);
    const createBatchPromise = realCropBatchService.createBatch(sanitizedData);

    try {
      const batch = await toast.promise(createBatchPromise, {
        loading: 'Creating batch on blockchain...',
        success: (data) => `Batch created! ID: ${data.batchId}`,
        error: (err) => `Creation failed: ${err.message || 'Unknown error'}`
      });
      setGeneratedBatch(batch);
      setSuccess(true);
      setFormData({ farmerName: '', farmerAddress: '', cropType: '', quantity: '', harvestDate: '', origin: '', certifications: '', description: '' });
      setFieldErrors({});
    } catch (error) {
      console.error('Failed to create batch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setGeneratedBatch(null);
    setFieldErrors({});
  };

  const inputClassName = (fieldName: string) =>
    `w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${fieldErrors[fieldName] ? 'border-red-500 dark:border-red-400 pr-10' : 'border-gray-300 dark:border-gray-600'}`;

  // RBAC Protection - Only farmers can create batches
  if (!permissions.canCreateBatch) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Only farmers can create batches. Your current role is: <strong>{getRoleDisplayName()}</strong>
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">Role-based Access Control</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    This action requires the <strong>Farmer</strong> role. Please contact an administrator if you believe this is an error.
                  </p>
                </div>
              </div>
            </div>
            <button onClick={() => router.push('/')} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">Return to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (success && generatedBatch) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">{t('batch.batchCreatedSuccess')}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">{t('batch.batchCreatedMessage')}</p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('batch.batchId')}</p>
              <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400">{generatedBatch.batchId}</p>
            </div>
            <div className="mb-8 text-left">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{t('batch.uploadDocuments')}</h3>
              </div>
              <DocumentUpload batchId={generatedBatch.batchId} onUploadComplete={() => {}} />
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={handleCreateAnother} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">{t('batch.createAnother')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6 relative">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Farmer Name</label>
              <div className="relative">
                <input type="text" name="farmerName" value={formData.farmerName} onChange={handleChange} onBlur={handleBlur} className={inputClassName('farmerName')} placeholder="Farmer name" />
                {fieldErrors.farmerName && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {fieldErrors.farmerName && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.farmerName}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Farmer Address</label>
              <div className="relative">
                <input type="text" name="farmerAddress" value={formData.farmerAddress} onChange={handleChange} onBlur={handleBlur} className={inputClassName('farmerAddress')} placeholder="Farm address" />
                {fieldErrors.farmerAddress && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {fieldErrors.farmerAddress && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.farmerAddress}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Crop Type</label>
              <div className="relative">
                <select name="cropType" value={formData.cropType} onChange={handleChange} onBlur={handleBlur} className={inputClassName('cropType')}>
                  <option value="">Select crop type</option>
                  {['rice', 'wheat', 'corn', 'tomato'].map(crop => <option key={crop} value={crop}>{crop.charAt(0).toUpperCase() + crop.slice(1)}</option>)}
                </select>
              </div>
              {fieldErrors.cropType && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.cropType}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Quantity (kg)</label>
              <div className="relative">
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} onBlur={handleBlur} className={inputClassName('quantity')} placeholder="1000" />
                {fieldErrors.quantity && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {fieldErrors.quantity && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.quantity}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Harvest Date</label>
              <div className="relative">
                <input type="date" name="harvestDate" value={formData.harvestDate} onChange={handleChange} onBlur={handleBlur} max={today} className={inputClassName('harvestDate')} />
                {fieldErrors.harvestDate && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {fieldErrors.harvestDate && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.harvestDate}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Origin / Farm Location</label>
              <div className="relative">
                <input type="text" name="origin" value={formData.origin} onChange={handleChange} onBlur={handleBlur} className={inputClassName('origin')} placeholder="Village, District, State" />
                {fieldErrors.origin && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              </div>
              {fieldErrors.origin && <p className="mt-1 text-xs text-red-500 flex items-center gap-1">{fieldErrors.origin}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} onBlur={handleBlur} rows={3} className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" placeholder="Optional notes about this batch" />
          </div>

          <div className="flex justify-center pt-4">
            <button type="submit" disabled={isLoading} className="px-8 py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-green-650 text-white rounded-lg font-semibold shadow-md transition-colors">
              {isLoading ? 'Creating...' : 'Create Batch'}
            </button>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 rounded-xl flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Submitting to blockchain...</p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default function AddBatch() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    }>
      <AddBatchContent />
    </Suspense>
  );
}
