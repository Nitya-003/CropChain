import { apiClient } from './apiClient';
import { sanitizeString } from '../lib/sanitize';

export interface BatchData {
  batchId: string;
  farmerName: string;
  farmerAddress: string;
  cropType: string;
  quantity: number;
  harvestDate: string;
  origin: string;
  certifications?: string;
  description?: string;
  createdAt: string;
  currentStage: string;
  updates: Array<{
    stage: string;
    actor: string;
    location: string;
    timestamp: string;
    notes?: string;
  }>;
  qrCode: string;
  blockchainHash?: string;
}

export const realCropBatchService = {
  createBatch: async (formData: any): Promise<BatchData> => {
    const response = await apiClient.post('/batches', formData);
    return response.data.data.batch;
  },

  getAllBatches: async (params?: any) => {
    const response = await apiClient.get('/batches', { params });
    return response.data.data;
  },

  getBatch: async (batchId: string): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get(`/batches/${sanitizedId}`);
    return response.data.data.batch;
  },

  updateBatch: async (batchId: string, updateData: Partial<BatchData>): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.put(`/batches/${sanitizedId}`, updateData);
    return response.data.data.batch;
  },

  exportBatch: async (batchId: string, format: 'pdf' | 'csv') => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get<Blob>(`/batches/${sanitizedId}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
};