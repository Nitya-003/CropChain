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
}

class CropBatchService {
  private batches: Map<string, CropBatch> = new Map();
  private batchCounter = 1;

  constructor() {
    // Initialize with some sample data
    if (import.meta.env.DEV) {
      this.initializeSampleData();
    }
  }

  private async initializeSampleData() {
    const sampleBatches = [
      {
        farmerName: 'Rajesh Kumar',
        farmerAddress: 'Village Rampur, District Meerut, UP',
        cropType: 'rice',
        quantity: '1000',
        harvestDate: '2024-01-15',
        origin: 'Rampur, Meerut',
        certifications: 'Organic, Fair Trade',
        description: 'High-quality Basmati rice grown using traditional methods'
      },
      {
        farmerName: 'Priya Sharma',
        farmerAddress: 'Village Khetri, District Alwar, RJ',
        cropType: 'wheat',
        quantity: '750',
        harvestDate: '2024-01-10',
        origin: 'Khetri, Alwar',
        certifications: 'Organic',
        description: 'Premium wheat variety with high protein content'
      },
      {
        farmerName: 'Suresh Patil',
        farmerAddress: 'Village Shirdi, District Ahmednagar, MH',
        cropType: 'tomato',
        quantity: '500',
        harvestDate: '2024-01-20',
        origin: 'Shirdi, Ahmednagar',
        certifications: '',
        description: 'Fresh tomatoes grown in greenhouse conditions'
      }
    ];

    for (const batch of sampleBatches) {
      await this.createBatch(batch);
      // Add some updates to make the timeline interesting
      const batchId = `CROP-2024-${String(this.batchCounter - 1).padStart(3, '0')}`;
      await this.updateBatch(batchId, {
        actor: 'Meerut Mandi',
        stage: 'mandi',
        location: 'Meerut Agricultural Market',
        notes: 'Quality inspection completed. Grade A produce.',
        timestamp: '2024-01-16'
      });
      
      if (Math.random() > 0.5) {
        await this.updateBatch(batchId, {
          actor: 'Express Logistics',
          stage: 'transport',
          location: 'Delhi Highway',
          notes: 'In transit to retail distribution center.',
          timestamp: '2024-01-17'
        });
      }
    }
  }

  private generateBatchId(): string {
    const id = `CROP-2024-${String(this.batchCounter).padStart(3, '0')}`;
    this.batchCounter++;
    return id;
  }

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

  private simulateBlockchainHash(): string {
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  async createBatch(data: any): Promise<CropBatch> {
    const batchId = this.generateBatchId();
    const qrCode = await this.generateQRCode(batchId);
    
    const batch: CropBatch = {
      batchId,
      farmerName: data.farmerName,
      farmerAddress: data.farmerAddress,
      cropType: data.cropType,
      quantity: parseInt(data.quantity),
      harvestDate: data.harvestDate,
      origin: data.origin,
      certifications: data.certifications,
      description: data.description,
      createdAt: new Date().toISOString(),
      currentStage: 'farmer',
      updates: [
        {
          stage: 'farmer',
          actor: data.farmerName,
          location: data.origin,
          timestamp: data.harvestDate,
          notes: data.description || 'Initial harvest recorded'
        }
      ],
      qrCode,
      blockchainHash: this.simulateBlockchainHash()
    };

    this.batches.set(batchId, batch);
    
    // Simulate blockchain transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return batch;
  }

  async getBatch(batchId: string): Promise<CropBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return batch;
  }

  async updateBatch(batchId: string, updateData: any): Promise<CropBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    const update = {
      stage: updateData.stage,
      actor: updateData.actor,
      location: updateData.location,
      timestamp: updateData.timestamp,
      notes: updateData.notes
    };

    batch.updates.push(update);
    batch.currentStage = updateData.stage;
    batch.blockchainHash = this.simulateBlockchainHash();

    this.batches.set(batchId, batch);
    
    // Simulate blockchain transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return batch;
  }

  async getDashboardStats(): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const batchesArray = Array.from(this.batches.values());
    const uniqueFarmers = new Set(batchesArray.map(b => b.farmerName)).size;
    const totalQuantity = batchesArray.reduce((sum, batch) => sum + batch.quantity, 0);
    const recentBatches = batchesArray
      .filter(batch => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 30);
        return new Date(batch.createdAt) > weekAgo;
      });

    return {
      stats: {
        totalBatches: batchesArray.length,
        totalFarmers: uniqueFarmers,
        totalQuantity,
        recentBatches
      },
      batches: batchesArray.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    };
  }
}

export const cropBatchService = new CropBatchService();
