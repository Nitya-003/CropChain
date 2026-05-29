import { apiClient } from './apiClient';

export const realCropBatchService = {
  createBatch: async (formData: any) => {
    const response = await apiClient.post('/batches', formData);
    return response.data.data.batch;
  },

  getAllBatches: async () => {
    const response = await apiClient.get('/batches');
    return response.data.data;
  },

  getBatch: async (batchId: string) => {
    const response = await apiClient.get(`/batches/${batchId}`);
    return response.data.data.batch;
  },

  updateBatch: async (batchId: string, updateData: any) => {
    const response = await apiClient.put(`/batches/${batchId}`, updateData);
    return response.data.data.batch;
  }
};