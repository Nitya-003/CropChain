export interface User {
  id: string;
  name: string;
  email: string;
  role: 'farmer' | 'mandi' | 'transporter' | 'retailer' | 'admin' | '';
  walletAddress?: string;
}

export interface Batch {
  id: string;
  crop: string;
  stage: 'farmer' | 'mandi' | 'transport' | 'retailer';
  farmer: string;
  location: string;
  weight: string;
  price: string;
  timestamp: string;
  status: 'active' | 'pending' | 'completed' | 'recalled';
  verification?: {
    isVerified: boolean;
    verifiedAt?: string;
  };
}

export interface SyncQueueItem {
  id: string;
  batchId: string;
  action: 'stage_update' | 'create_batch' | 'verify';
  data: Record<string, any>;
  createdAt: number;
  retries: number;
  priority: 'high' | 'normal' | 'low';
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';
