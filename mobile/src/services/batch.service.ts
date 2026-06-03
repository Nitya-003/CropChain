import { api } from './api';
import type { Batch } from '../types';

export const batchService = {
  async getBatches(): Promise<Batch[]> {
    const res = await api.get<{ data: Batch[] }>('/batches');
    return res.data;
  },

  async getBatchById(id: string): Promise<Batch> {
    const res = await api.get<{ data: Batch }>(`/batches/${id}`);
    return res.data;
  },

  async createBatch(data: Partial<Batch>): Promise<Batch> {
    const res = await api.post<{ data: Batch }>('/batches', data);
    return res.data;
  },

  async updateStage(batchId: string, stage: string): Promise<Batch> {
    const res = await api.put<{ data: Batch }>(`/batches/${batchId}/stage`, { stage });
    return res.data;
  },

  async getBatchByQR(qrData: string): Promise<Batch> {
    const res = await api.get<{ data: Batch }>(`/batches/qr/${encodeURIComponent(qrData)}`);
    return res.data;
  },
};
