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
  isSpoiled?: boolean;
  currentTemperature?: number;
  currentHumidity?: number;
  iotTimestamp?: string;
  spoilageRisk?: {
    riskLevel: 'Low' | 'Medium' | 'High';
    riskScore: number;
    factors: string[];
    predictedAt: string;
  };
}

// Matches the flat shape expected by the backend's updateBatchSchema
export interface UpdateBatchPayload {
  stage: string;
  actor: string;
  location: string;
  timestamp: string;
  notes?: string;
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

  getPublicBatch: async (batchId: string): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get(`/batches/public/${sanitizedId}`);
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

  // Incident & Approval endpoints
  getPendingApprovals: async (params?: any) => {
    const response = await apiClient.get('/approvals', { params });
    return response.data.data;
  },

  getRequestsNeedingSignature: async () => {
    const response = await apiClient.get('/approvals/pending');
    return response.data.data;
  },

  requestRecall: async (batchId: string, justification: string, evidence: any[] = []) => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.post(`/approvals/recall/${sanitizedId}`, { justification, evidence });
    return response.data.data;
  },

  approveRequest: async (requestId: string, decision: 'approved' | 'rejected', reason: string = '') => {
    const sanitizedId = sanitizeString(requestId);
    const response = await apiClient.post(`/approvals/${sanitizedId}/sign`, { decision, reason });
    return response.data.data;
  },

  getApprovalHistory: async (batchId: string) => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get(`/approvals/batch/${sanitizedId}`);
    return response.data.data;
  }
};
