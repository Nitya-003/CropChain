import React, { useState } from 'react';
import { Plus, Upload, MapPin, Calendar, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { realCropBatchService } from '../services/realCropBatchService';
import { useToast } from '../context/ToastContext';

const AddBatch: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  
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
      const batch = await realCropBatchService.createBatch(formData);
      setGeneratedBatch(batch);
      setSuccess(true);
      toast.success(`Batch created successfully! ID: ${batch.batchId}`);
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to create batch. Please try again.';
      toast.error(errorMessage);
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
            <div className="bg-green-100 dark:bg-green-900 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <Plus className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
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
              <button
                onClick={handleCreateAnother}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>{t('batch.createAnother')}</span>
              </button>
              <button
                onClick={() => window.location.href = `/track?id=${generatedBatch.batchId}`}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                {t('batch.viewBatch')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
          {t('batch.addTitle')}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          {t('batch.description')}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Farmer Name */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                <User className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                {t('batch.farmerName')}
              </label>
              <input
                type="text"
                name="farmerName"
                value={formData.farmerName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder={t('batch.farmerName')}
                required
                disabled={isLoading}
              />
            </div>

            {/* Farmer Address */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                <MapPin className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                {t('batch.farmerAddress')}
              </label>
              <input
                type="text"
                name="farmerAddress"
                value={formData.farmerAddress}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder={t('batch.farmerAddress')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Crop Type */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                {t('batch.cropType')}
              </label>
              <select
                name="cropType"
                value={formData.cropType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
              >
                <option value="">{t('batch.selectCropType')}</option>
                <option value="rice">{t('batch.crops.rice')}</option>
                <option value="wheat">{t('batch.crops.wheat')}</option>
                <option value="corn">{t('batch.crops.corn')}</option>
                <option value="tomato">{t('batch.crops.tomato')}</option>
                <option value="potato">{t('batch.crops.potato')}</option>
                <option value="onion">{t('batch.crops.onion')}</option>
                <option value="cotton">{t('batch.crops.cotton')}</option>
                <option value="sugarcane">{t('batch.crops.sugarcane')}</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                {t('batch.quantity')} ({t('batch.kg')})
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min={1}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="100"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Harvest Date */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                <Calendar className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                {t('batch.harvestDate')}
              </label>
              <input
                type="date"
                name="harvestDate"
                value={formData.harvestDate}
                onChange={handleChange}
                max={today}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
              />
            </div>

            {/* Origin */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                <MapPin className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                {t('batch.origin')}
              </label>
              <input
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder={t('batch.origin')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Certifications */}
          <div>
            <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              <Upload className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
              {t('batch.certifications')}
            </label>
            <input
              type="text"
              name="certifications"
              value={formData.certifications}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="Organic, Fair Trade, etc."
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              {t('batch.description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder={t('batch.description')}
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 flex items-center space-x-2 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed opacity-70'
                  : 'bg-green-600 hover:bg-green-700 transform hover:scale-105 shadow-lg'
              } text-white`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>{t('batch.creatingBatch')}</span>
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  <span>{t('batch.createBatch')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBatch;
