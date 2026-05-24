import React, { useState } from 'react';
import { Plus, Upload, MapPin, Calendar, User, Shield, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast, { success as toastSuccess, error as toastError } from 'react-hot-toast';
import { realCropBatchService } from '../services/realCropBatchService';
import { useRbac } from '../hooks/useRbac';
import { useNavigate } from 'react-router-dom';

const AddBatch: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions, getRoleDisplayName } = useRbac();

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

  // Get today's date for max date constraint
  const today = new Date().toISOString().split('T')[0];

  // RBAC Protection - Only farmers can create batches
  if (!permissions.canCreateBatch) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Only farmers can create batches. Your current role is: <strong>{getRoleDisplayName()}</strong>
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
                    Role-based Access Control
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    This action requires the <strong>Farmer</strong> role. Please contact an administrator if you believe this is an error.
                  </p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cropType.trim()) return;
    if (Number(formData.quantity) <= 0) return;
    if (new Date(formData.harvestDate) > new Date()) return;

    setIsLoading(true);

    // REAL BACKEND CALL (Ready for Production)
    const createBatchPromise = realCropBatchService.createBatch(formData);

    try {
      const batch = await toast.promise(createBatchPromise, {
        loading: 'Creating batch on blockchain...',
        success: (data) => `Batch created! ID: ${data.batchId}`,
        error: (err) => `Creation failed: ${err.message || 'Unknown error'}`
      });

      setGeneratedBatch(batch);
      setSuccess(true);
      
      setFormData({
        farmerName: '',
        farmerAddress: '',
        cropType: '',
        quantity: '',
        harvestDate: '',
        origin: '',
        certifications: '',
        description: ''
      });

    } catch (error) {
      console.error('Failed to create batch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setGeneratedBatch(null);
  };

  if (success && generatedBatch) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              {t('batch.batchCreatedSuccess')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              {t('batch.batchCreatedMessage')}
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('batch.batchId')}</p>
              <p className="text-2xl font-mono font-bold text-green-600 dark:text-green-400">
                {generatedBatch.batchId}
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <button onClick={handleCreateAnother} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
                {t('batch.createAnother')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.farmerName')}</label>
              <input type="text" name="farmerName" value={formData.farmerName} onChange={handleChange} className="w-full px-4 py-3 border rounded-lg" required />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.farmerAddress')}</label>
              <input type="text" name="farmerAddress" value={formData.farmerAddress} onChange={handleChange} className="w-full px-4 py-3 border rounded-lg" required />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.cropType')}</label>
              <select name="cropType" value={formData.cropType} onChange={handleChange} className="w-full px-4 py-3 border rounded-lg" required>
                <option value="">{t('batch.selectCropType')}</option>
                <option value="rice">Rice</option>
                <option value="wheat">Wheat</option>
                <option value="corn">Corn</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.quantity')}</label>
              <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} min={1} className="w-full px-4 py-3 border rounded-lg" required />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.harvestDate')}</label>
              <input type="date" name="harvestDate" value={formData.harvestDate} onChange={handleChange} max={today} className="w-full px-4 py-3 border rounded-lg" required />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.origin')}</label>
              <input type="text" name="origin" value={formData.origin} onChange={handleChange} className="w-full px-4 py-3 border rounded-lg" required />
            </div>
          </div>

          <div>
             <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('batch.description')}</label>
             <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full px-4 py-3 border rounded-lg" />
          </div>

          <div className="flex justify-center pt-4">
            <button type="submit" disabled={isLoading} className="px-8 py-4 bg-green-600 text-white rounded-lg font-semibold">
              {isLoading ? 'Creating...' : t('batch.createBatch')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBatch;