export interface User {
  id: string;
  name: string;
  email: string;
  role: "farmer" | "mandi" | "transporter" | "retailer" | "admin" | "";
  walletAddress?: string;
}

export type BatchStage = "farmer" | "mandi" | "transport" | "retailer";

export interface Batch {
  id: string;
  crop: string;
  stage: BatchStage;
  farmer: string;
  location: string;
  weight: string;
  price: string;
  timestamp: string;
  status: "active" | "pending" | "completed" | "recalled";
  verification?: {
    isVerified: boolean;
    verifiedAt?: string;
  };
}

export interface BatchStageUpdatePayload {
  stage: BatchStage;
  actor: string;
  location: string;
  notes?: string;
}

interface SyncQueueItemBase {
  id: string;
  batchId: string;
  createdAt: number;
  retries: number;
  priority: "high" | "normal" | "low";
}

export type SyncQueueItem = SyncQueueItemBase &
  (
    | { action: "stage_update"; data: BatchStageUpdatePayload }
    | { action: "create_batch" | "verify"; data: Record<string, unknown> }
  );

export type SyncQueueInput =
  | { batchId: string; action: "stage_update"; data: BatchStageUpdatePayload }
  | {
      batchId: string;
      action: "create_batch" | "verify";
      data: Record<string, unknown>;
    };

export type ToastType = "success" | "error" | "info" | "warning";
