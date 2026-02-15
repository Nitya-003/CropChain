import * as QRCode from 'qrcode';

interface CropBatch {
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
  syncStatus?: string;
  isRecalled?: boolean;
}

interface BatchStats {
  totalBatches: number;
  totalFarmers: number;
  totalQuantity: number;
  recentBatches: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: string;
  message: string;
}

class RealCropBatchService {
  private API_URL: string;

  constructor() {
    this.API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  }

  /**
   * Create a new batch
   */
  async createBatch(data: any): Promise<CropBatch> {
    try {
      const response = await fetch(`${this.API_URL}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to create batch (${response.status})`);
      }

      const result: ApiResponse<{ batch: CropBatch }> = await response.json();

      if (!result.success || !result.data.batch) {
        throw new Error(result.message || 'Failed to create batch');
      }

      console.log('[RealCropBatchService] Batch created:', result.data.batch.batchId);
      return result.data.batch;
    } catch (error) {
      console.error('[RealCropBatchService] Error creating batch:', error);
      throw error;
    }
  }

  /**
   * Get a single batch by ID
   */
  async getBatch(batchId: string): Promise<CropBatch> {
    try {
      const response = await fetch(`${this.API_URL}/batches/${batchId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Batch with ID ${batchId} not found`);
        }
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch batch (${response.status})`);
      }

      const result: ApiResponse<{ batch: CropBatch }> = await response.json();

      if (!result.success || !result.data.batch) {
        throw new Error(result.message || 'Failed to fetch batch');
      }

      console.log('[RealCropBatchService] Batch retrieved:', batchId);
      return result.data.batch;
    } catch (error) {
      console.error('[RealCropBatchService] Error fetching batch:', error);
      throw error;
    }
  }

  /**
   * Update a batch with new stage/update
   */
  async updateBatch(batchId: string, updateData: any): Promise<CropBatch> {
    try {
      const response = await fetch(`${this.API_URL}/batches/${batchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update batch (${response.status})`);
      }

      const result: ApiResponse<{ batch: CropBatch }> = await response.json();

      if (!result.success || !result.data.batch) {
        throw new Error(result.message || 'Failed to update batch');
      }

      console.log('[RealCropBatchService] Batch updated:', batchId);
      return result.data.batch;
    } catch (error) {
      console.error('[RealCropBatchService] Error updating batch:', error);
      throw error;
    }
  }

  /**
   * Get all batches with stats
   */
  async getAllBatches(): Promise<{ batches: CropBatch[]; stats: BatchStats }> {
    try {
      const response = await fetch(`${this.API_URL}/batches`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch batches (${response.status})`);
      }

      const result: ApiResponse<{ batches: CropBatch[]; stats: BatchStats }> = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch batches');
      }

      console.log('[RealCropBatchService] All batches retrieved. Count:', result.data.batches.length);
      return {
        batches: result.data.batches || [],
        stats: result.data.stats || { totalBatches: 0, totalFarmers: 0, totalQuantity: 0, recentBatches: 0 }
      };
    } catch (error) {
      console.error('[RealCropBatchService] Error fetching all batches:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<BatchStats> {
    try {
      const { stats } = await this.getAllBatches();
      return stats;
    } catch (error) {
      console.error('[RealCropBatchService] Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Recall a batch
   */
  async recallBatch(batchId: string): Promise<CropBatch> {
    try {
      const response = await fetch(`${this.API_URL}/batches/${batchId}/recall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to recall batch (${response.status})`);
      }

      const result: ApiResponse<{ batch: CropBatch }> = await response.json();

      if (!result.success || !result.data.batch) {
        throw new Error(result.message || 'Failed to recall batch');
      }

      console.log('[RealCropBatchService] Batch recalled:', batchId);
      return result.data.batch;
    } catch (error) {
      console.error('[RealCropBatchService] Error recalling batch:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const realCropBatchService = new RealCropBatchService();

// Export class for testing purposes
export default RealCropBatchService;
