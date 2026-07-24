import { apiClient } from "./apiClient";
import { sanitizeString } from "../lib/sanitize";
import { offlineCropBatchService } from "./offlineCropBatchService";
import { offlineStorage } from "./offlineStorage";

const isOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

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
    riskLevel: "Low" | "Medium" | "High";
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
  blockchainHash?: string;
}

export const realCropBatchService = {
  createBatch: async (formData: any): Promise<BatchData> => {
    if (isOnline()) {
      try {
        const response = await apiClient.post("/batches", formData);
        return response.data.data.batch;
      } catch (error) {
        console.warn(
          "[realCropBatchService] Online creation failed, falling back to offline mode:",
          error,
        );
      }
    }
    const batch = await offlineCropBatchService.createBatch(formData);
    return batch as unknown as BatchData;
  },

  getAllBatches: async (params?: any) => {
    const pendingBatches = await offlineStorage.getAllPendingBatches();
    const pendingList = pendingBatches.map((b) => ({
      ...b.data,
      batchId: b.id,
      syncStatus: b.status,
      pendingId: b.id,
      createdAt: b.createdAt || new Date(b.timestamp).toISOString(),
    }));

    if (isOnline()) {
      try {
        const response = await apiClient.get("/batches", { params });
        const data = response.data.data;
        const onlineBatches = data.batches || [];

        // Remove duplicates if any online batch matches a synced pending batch
        const filteredPending = pendingList.filter(
          (pb) => !onlineBatches.some((ob: any) => ob.batchId === pb.batchId),
        );

        return {
          ...data,
          batches: [...filteredPending, ...onlineBatches],
        };
      } catch (error) {
        console.warn(
          "[realCropBatchService] Failed to fetch online batches, returning offline ones:",
          error,
        );
      }
    }

    return {
      batches: pendingList,
    };
  },

  getBatch: async (batchId: string): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    if (isOnline()) {
      try {
        const response = await apiClient.get(`/batches/${sanitizedId}`);
        return response.data.data.batch;
      } catch (error) {
        console.warn(
          "[realCropBatchService] Online getBatch failed, falling back to offline storage:",
          error,
        );
      }
    }
    const batch = await offlineCropBatchService.getBatch(sanitizedId);
    return batch as unknown as BatchData;
  },

  getPublicBatch: async (batchId: string): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    if (isOnline()) {
      try {
        const response = await apiClient.get(`/batches/public/${sanitizedId}`);
        return response.data.data.batch;
      } catch (error) {
        console.warn(
          "[realCropBatchService] Online getPublicBatch failed, falling back to offline storage:",
          error,
        );
      }
    }
    const batch = await offlineCropBatchService.getBatch(sanitizedId);
    return batch as unknown as BatchData;
  },

  updateBatch: async (
    batchId: string,
    updateData: Partial<BatchData> & Partial<UpdateBatchPayload>,
  ): Promise<BatchData> => {
    const sanitizedId = sanitizeString(batchId);
    if (isOnline()) {
      try {
        const response = await apiClient.put(
          `/batches/${sanitizedId}`,
          updateData,
        );
        return response.data.data.batch;
      } catch (error) {
        console.warn(
          "[realCropBatchService] Online update failed, falling back to offline mode:",
          error,
        );
      }
    }
    const batch = await offlineCropBatchService.updateBatch(
      sanitizedId,
      updateData,
    );
    return batch as unknown as BatchData;
  },

  exportBatch: async (batchId: string, format: "pdf" | "csv") => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get<Blob>(
      `/batches/${sanitizedId}/export`,
      {
        params: { format },
        responseType: "blob",
      },
    );
    return response.data;
  },

  // Incident & Approval endpoints
  getPendingApprovals: async (params?: any) => {
    const response = await apiClient.get("/approvals", { params });
    return response.data.data;
  },

  getRequestsNeedingSignature: async () => {
    const response = await apiClient.get("/approvals/pending");
    return response.data.data;
  },

  requestRecall: async (
    batchId: string,
    justification: string,
    evidence: any[] = [],
  ) => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.post(`/approvals/recall/${sanitizedId}`, {
      justification,
      evidence,
    });
    return response.data.data;
  },

  approveRequest: async (
    requestId: string,
    decision: "approved" | "rejected",
    reason: string = "",
  ) => {
    const sanitizedId = sanitizeString(requestId);
    const response = await apiClient.post(`/approvals/${sanitizedId}/sign`, {
      decision,
      reason,
    });
    return response.data.data;
  },

  getApprovalHistory: async (batchId: string) => {
    const sanitizedId = sanitizeString(batchId);
    const response = await apiClient.get(`/approvals/batch/${sanitizedId}`);
    return response.data.data;
  },
};
