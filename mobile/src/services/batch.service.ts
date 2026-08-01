import { api } from "./api";
import type { Batch, BatchStageUpdatePayload } from "../types";

interface BatchResponse {
  data: { batch: Batch };
}

export const batchService = {
  async getBatches(): Promise<Batch[]> {
    const res = await api.get<{ data: Batch[] }>("/batches");
    return res.data;
  },

  async getBatchById(id: string): Promise<Batch> {
    const res = await api.get<{ data: Batch }>(`/batches/${id}`);
    return res.data;
  },

  async createBatch(data: Partial<Batch>): Promise<Batch> {
    const res = await api.post<{ data: Batch }>("/batches", data);
    return res.data;
  },

  async updateStage(
    batchId: string,
    data: BatchStageUpdatePayload,
  ): Promise<Batch> {
    const res = await api.put<BatchResponse>(`/batches/${batchId}`, data);
    return res.data.batch;
  },

  async getBatchByQR(qrData: string): Promise<Batch> {
    const res = await api.get<{ data: Batch }>(
      `/batches/qr/${encodeURIComponent(qrData)}`,
    );
    return res.data;
  },
};
