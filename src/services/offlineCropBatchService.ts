import { offlineStorage } from './offlineStorage';
import { syncManager } from './syncManager';
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
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  pendingId?: string;
}

class OfflineCropBatchService {
  private readonly API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  private async generateQRCode(batchId: string): Promise<string> {
    try {
      return await QRCode.toDataURL(batchId, {
        width: 200,
        margin: 2,
        color: {
          dark: '#22c55e',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      return '';
    }
  }

  private generateTempBatchId(): string {
    return `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async createBatch(data: Record<string, unknown>): Promise<CropBatch> {
    // Check if online
    if (navigator.onLine) {
      try {
        // Try to create batch online
        const response = await fetch(`${this.API_URL}/api/batches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            ...result.batch,
            syncStatus: 'synced',
          };
        }
      } catch (error) {
        console.warn('[OfflineCropBatchService] Online creation failed, falling back to offline mode:', error);
      }
    }

    // Offline mode or online creation failed
    console.log('[OfflineCropBatchService] Creating batch in offline mode');
    
    // Generate temporary batch ID and QR code
    const tempBatchId = this.generateTempBatchId();
    const qrCode = await this.generateQRCode(tempBatchId);

    // Create local batch object
    const batch: CropBatch = {
      batchId: tempBatchId,
      farmerName: String(data.farmerName || ''),
      farmerAddress: String(data.farmerAddress || ''),
      cropType: String(data.cropType || ''),
      quantity: Number(data.quantity || 0),
      harvestDate: String(data.harvestDate || ''),
      origin: String(data.origin || ''),
      certifications: String(data.certifications || ''),
      description: String(data.description || ''),
      createdAt: new Date().toISOString(),
      currentStage: 'farmer',
      updates: [
        {
          stage: 'farmer',
          actor: String(data.farmerName || ''),
          location: String(data.origin || ''),
          timestamp: String(data.harvestDate || ''),
          notes: String(data.description || 'Initial harvest recorded (offline)')
        }
      ],
      qrCode,
      syncStatus: 'pending',
    };

    // Save to IndexedDB
    const pendingId = await offlineStorage.savePendingBatch(data);
    batch.pendingId = pendingId;

    // Trigger sync if online
    if (navigator.onLine) {
      syncManager.triggerSync();
    }

    return batch;
  }

  async updateBatch(batchId: string, updateData: Record<string, unknown>): Promise<CropBatch> {
    // Check if online
    if (navigator.onLine) {
      try {
        // Try to update batch online
        const response = await fetch(`${this.API_URL}/api/batches/${batchId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (response.ok) {
          const result = await response.json();
          return {
            ...result.batch,
            syncStatus: 'synced',
          };
        }
      } catch (error) {
        console.warn('[OfflineCropBatchService] Online update failed, falling back to offline mode:', error);
      }
    }

    // Offline mode or online update failed
    console.log('[OfflineCropBatchService] Updating batch in offline mode');

    // Save update to IndexedDB
    await offlineStorage.savePendingUpdate(batchId, updateData);

    // Prepare the update for immediate UI feedback
    const update = {
      stage: String((updateData as any).stage || ''),
      actor: String((updateData as any).actor || ''),
      location: String((updateData as any).location || ''),
      timestamp: String((updateData as any).timestamp || new Date().toISOString()),
      notes: String((updateData as any).notes || '')
    };

    // Try to load the existing batch; if unavailable (e.g., offline and not cached),
    // create an optimistic batch so the UI can still reflect the pending update.
    let batch: CropBatch;
    try {
      batch = await this.getBatch(batchId);
    } catch (error) {
      console.warn('[OfflineCropBatchService] Could not load existing batch, creating optimistic batch for offline update:', error);
      batch = {
        batchId,
        farmerName: String((updateData as any).farmerName || ''),
        farmerAddress: String((updateData as any).farmerAddress || ''),
        cropType: String((updateData as any).cropType || ''),
        quantity: Number((updateData as any).quantity || 0),
        harvestDate: String((updateData as any).harvestDate || new Date().toISOString()),
        origin: String((updateData as any).origin || ''),
        certifications: (updateData as any).certifications
          ? String((updateData as any).certifications)
          : undefined,
        description: (updateData as any).description
          ? String((updateData as any).description)
          : undefined,
        createdAt: new Date().toISOString(),
        currentStage: String((updateData as any).stage || ''),
        updates: [],
        qrCode: '',
        blockchainHash: undefined,
        syncStatus: 'pending',
        pendingId: undefined
      };
    }

    if (!batch.updates) {
      batch.updates = [];
    }

    batch.updates.push(update);
    batch.currentStage = String((updateData as any).stage || batch.currentStage);
    batch.syncStatus = 'pending';

    // Trigger sync if online
    if (navigator.onLine) {
      syncManager.triggerSync();
    }

    return batch;
  }

  async getBatch(batchId: string): Promise<CropBatch> {
    // Try to fetch from API if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`${this.API_URL}/api/batches/${batchId}`);
        if (response.ok) {
          const result = await response.json();
          return {
            ...result.batch,
            syncStatus: 'synced',
          };
        }
      } catch (error) {
        console.warn('[OfflineCropBatchService] Failed to fetch batch online:', error);
      }
    }

    // Check if it's a pending batch
    const pendingBatches = await offlineStorage.getAllPendingBatches();
    const pendingBatch = pendingBatches.find(b => 
      b.data.batchId === batchId || b.id === batchId
    );

    if (pendingBatch) {
      const qrCode = await this.generateQRCode(batchId);
      const pendingData = pendingBatch.data as Omit<CropBatch, 'qrCode' | 'syncStatus' | 'pendingId'>;
      return {
        batchId: batchId,
        ...pendingData,
        qrCode,
        syncStatus: pendingBatch.status,
        pendingId: pendingBatch.id,
      };
    }

    throw new Error('Batch not found');
  }

  async getDashboardStats(): Promise<Record<string, unknown>> {
    let onlineData = null;

    // Try to fetch from API if online
    if (navigator.onLine) {
      try {
        const response = await fetch(`${this.API_URL}/api/batches`);
        if (response.ok) {
          onlineData = await response.json();
        }
      } catch (error) {
        console.warn('[OfflineCropBatchService] Failed to fetch dashboard stats online:', error);
      }
    }

    // Get pending items
    const pendingBatches = await offlineStorage.getAllPendingBatches();
    const pendingUpdates = await offlineStorage.getAllPendingUpdates();

    // Combine online and offline data
    if (onlineData) {
      return {
        ...onlineData,
        pendingSync: {
          batches: pendingBatches.filter(b => b.status === 'pending').length,
          updates: pendingUpdates.filter(u => u.status === 'pending').length,
        },
      };
    }

    // Offline-only mode
    return {
      stats: {
        totalBatches: pendingBatches.length,
        totalFarmers: new Set(pendingBatches.map(b => b.data.farmerName)).size,
        totalQuantity: pendingBatches.reduce((sum, b) => {
          const data = b.data as Record<string, unknown>;
          const rawQuantity = 'quantity' in data ? data.quantity : 0;
          let quantity = 0;

          if (typeof rawQuantity === 'number') {
            quantity = rawQuantity;
          } else if (typeof rawQuantity === 'string') {
            const parsed = Number(rawQuantity);
            if (!Number.isNaN(parsed)) {
              quantity = parsed;
            }
          }

          return sum + quantity;
        }, 0),
        recentBatches: pendingBatches.length,
      },
      batches: pendingBatches.map(b => ({
        ...b.data,
        batchId: b.id,
        syncStatus: b.status,
        pendingId: b.id,
      })),
      pendingSync: {
        batches: pendingBatches.filter(b => b.status === 'pending').length,
        updates: pendingUpdates.filter(u => u.status === 'pending').length,
      },
    };
  }

  // Get all pending items for UI display
  async getPendingItems(): Promise<{
    batches: Array<Record<string, unknown>>;
    updates: Array<Record<string, unknown>>;
  }> {
    const batches = await offlineStorage.getAllPendingBatches();
    const updates = await offlineStorage.getAllPendingUpdates();

    return {
      batches: batches.map(b => ({
        ...b.data,
        pendingId: b.id,
        syncStatus: b.status,
        timestamp: b.timestamp,
        retryCount: b.retryCount,
        error: b.error,
      })),
      updates: updates.map(u => ({
        ...u.data,
        batchId: u.batchId,
        pendingId: u.id,
        syncStatus: u.status,
        timestamp: u.timestamp,
        retryCount: u.retryCount,
        error: u.error,
      })),
    };
  }
}

export const offlineCropBatchService = new OfflineCropBatchService();