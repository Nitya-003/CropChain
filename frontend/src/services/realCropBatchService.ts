import { apiClient } from './apiClient';
import { sanitizeString } from '../lib/sanitize';

export interface DocumentData {
  docId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedBy?: string;
  uploadedAt: string;
  description?: string;
}

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
  documents?: DocumentData[];
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
  },

  uploadDocument: async (batchId: string, file: File, description?: string): Promise<DocumentData> => {
    const sanitizedId = sanitizeString(batchId);
    const formData = new FormData();
    formData.append('document', file);
    if (description) formData.append('description', description);
    const response = await apiClient.post(`/batches/${sanitizedId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.document;
  },

  deleteDocument: async (batchId: string, docId: string): Promise<void> => {
    const sanitizedId = sanitizeString(batchId);
    await apiClient.delete(`/batches/${sanitizedId}/documents/${docId}`);
  }
};