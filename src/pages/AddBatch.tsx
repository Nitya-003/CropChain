import React, { useState } from 'react';
import { Plus, Upload, MapPin, Calendar, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cropBatchService } from '../services/cropBatchService';

const AddBatch: React.FC = () => {
  const { t } = useTranslation();
  
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

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Safety validation (prevents bypassing browser checks)
    if (!formData.cropType.trim()) return;
    if (Number(formData.quantity) <= 0) return;
    if (new Date(formData.harvestDate) > new Date()) return;

    setIsLoading(true);

    try {
      const batch = await cropBatchService.createBatch(formData);
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

  if (success && generatedBatch) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="text-center">
            <div className="bg-green-100 dark:bg-green-900 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <Plus className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              {t('batch.batchCreatedSuccess')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              {t('batch.batchCreatedMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Farmer Name */}
          <input
            type="text"
            name="farmerName"
            value={formData.farmerName}
            onChange={handleChange}
            required
          />

          {/* Crop Type */}
          <select
            name="cropType"
            value={formData.cropType}
            onChange={handleChange}
            required
          >
            <option value="">{t('batch.selectCropType')}</option>
            <option value="rice">{t('batch.crops.rice')}</option>
            <option value="wheat">{t('batch.crops.wheat')}</option>
            <option value="corn">{t('batch.crops.corn')}</option>
            <option value="tomato">{t('batch.crops.tomato')}</option>
          </select>

          {/* Quantity */}
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min={1}
            required
          />

          {/* Harvest Date */}
          <input
            type="date"
            name="harvestDate"
            value={formData.harvestDate}
            onChange={handleChange}
            max={today}
            required
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? t('batch.creatingBatch') : t('batch.createBatch')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddBatch;
