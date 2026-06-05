import { apiClient } from './apiClient';

export const realCropBatchService = {
  createBatch: async (formData: any) => {
    const response = await apiClient.post('/batches', formData);
    return response.data.data.batch;
  },

  getAllBatches: async (params?: any) => {
    const response = await apiClient.get('/batches', { params });
    return response.data.data;
  },

  getBatch: async (batchId: string) => {
    const response = await apiClient.get(`/batches/${batchId}`);
    return response.data.data.batch;
  },

  updateBatch: async (batchId: string, updateData: any) => {
    const response = await apiClient.put(`/batches/${batchId}`, updateData);
    return response.data.data.batch;
  },

  exportBatch: async (batchId: string, format: 'pdf' | 'csv') => {
    const response = await apiClient.get<Blob>(`/batches/${batchId}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
};