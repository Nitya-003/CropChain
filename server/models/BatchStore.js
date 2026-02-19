const batches = new Map();
let batchCounter = 1;

// Initialize with sample data
const sampleBatch = {
    batchId: 'CROP-2024-001',
    farmerName: 'Rajesh Kumar',
    farmerAddress: 'Village Rampur, District Meerut, UP',
    cropType: 'rice',
    quantity: 1000,
    harvestDate: '2024-01-15',
    origin: 'Rampur, Meerut',
    certifications: 'Organic, Fair Trade',
    description: 'High-quality Basmati rice grown using traditional methods',
    createdAt: new Date().toISOString(),
    currentStage: 'mandi',
    updates: [
        {
            stage: 'farmer',
            actor: 'Rajesh Kumar',
            location: 'Rampur, Meerut',
            timestamp: '2024-01-15T10:00:00.000Z',
            notes: 'Initial harvest recorded'
        },
        {
            stage: 'mandi',
            actor: 'Punjab Mandi',
            location: 'Ludhiana Market',
            timestamp: '2024-01-16T14:30:00.000Z',
            notes: 'Quality checked and processed'
        }
    ],
    qrCode: 'data:image/png;base64,sample',
    blockchainHash: '0x123456789abcdef'
};

batches.set('CROP-2024-001', sampleBatch);
batchCounter = 2;

module.exports = {
  batches,
  getNextId: () => {
      const id = `CROP-2024-${String(batchCounter).padStart(3, '0')}`;
      batchCounter++;
      return id;
  }
};
