const aiService = require('../services/aiService');

describe('Context-Aware Batch Querying Tests', () => {
    describe('Metadata Sanitization', () => {
        it('should correctly sanitize batch metadata, keeping supply chain details and omitting sensitive data', () => {
            const rawBatch = {
                _id: 'mongo-id-123',
                batchId: 'CROP-2024-0001',
                farmerId: 'farmer-uuid-456',
                farmerName: 'John Doe',
                farmerAddress: '123 Farm Road, Sector 4',
                farmerWalletAddress: '0x1234567890abcdef',
                cropType: 'rice',
                quantity: 500,
                harvestDate: new Date('2024-01-15'),
                origin: 'Punjab, India',
                currentStage: 'mandi',
                isRecalled: false,
                syncStatus: 'synced',
                status: 'Active',
                iotData: {
                    currentTemperature: 22,
                    currentHumidity: 55,
                    isSpoiled: false,
                    telemetryHistory: []
                },
                updates: [
                    { stage: 'farmer', actor: 'John Doe', location: 'Punjab', timestamp: new Date('2024-01-15'), notes: 'Harvested' }
                ],
                lifecycle: {
                    currentStage: 'Registered',
                    stageHistory: [
                        { stage: 'Registered', timestamp: new Date('2024-01-15'), updatedBy: 'John Doe', notes: 'Initial registration' }
                    ]
                },
                __v: 0
            };

            const sanitized = aiService.sanitizeBatchMetadata(rawBatch);

            // Assertions on kept fields
            expect(sanitized.batchId).toBe('CROP-2024-0001');
            expect(sanitized.cropType).toBe('rice');
            expect(sanitized.quantity).toBe(500);
            expect(sanitized.origin).toBe('Punjab, India');
            expect(sanitized.currentStage).toBe('mandi');
            expect(sanitized.isRecalled).toBe(false);
            expect(sanitized.status).toBe('Active');
            expect(sanitized.iotData.currentTemperature).toBe(22);
            expect(sanitized.iotData.isSpoiled).toBe(false);
            expect(sanitized.updates[0].stage).toBe('farmer');

            // Assertions on omitted fields
            expect(sanitized._id).toBeUndefined();
            expect(sanitized.farmerId).toBeUndefined();
            expect(sanitized.farmerAddress).toBeUndefined();
            expect(sanitized.farmerWalletAddress).toBeUndefined();
            expect(sanitized.__v).toBeUndefined();
        });
    });

    describe('Transit Statistics Calculation', () => {
        it('should correctly calculate the average transit times in days', () => {
            const date1 = new Date('2024-01-15T00:00:00.000Z');
            const date2 = new Date('2024-01-16T12:00:00.000Z'); // 1.5 days later
            const date3 = new Date('2024-01-18T12:00:00.000Z'); // 2.0 days later

            const batches = [
                {
                    updates: [
                        { stage: 'farmer', timestamp: date1 },
                        { stage: 'mandi', timestamp: date2 },
                        { stage: 'transport', timestamp: date3 }
                    ]
                }
            ];

            const stats = aiService.calculateTransitStats(batches, 'wheat');

            expect(stats.cropType).toBe('wheat');
            expect(stats.sampleSize).toBe(1);
            expect(stats.averageFarmerToMandi).toBe('1.50 days');
            expect(stats.averageMandiToTransport).toBe('2.00 days');
            expect(stats.averageTransportToRetailer).toBe('N/A');
        });
    });

    describe('AI Service Context Flow', () => {
        it('should trigger status updates while performing context querying', async () => {
            const mockBatchService = {
                getBatchByIdOrPartial: jest.fn().mockResolvedValue({
                    batchId: 'CROP-2024-0001',
                    cropType: 'rice',
                    farmerName: 'John Doe',
                    origin: 'Punjab',
                    quantity: 500,
                    harvestDate: new Date(),
                    currentStage: 'farmer',
                    blockchainHash: '0x123',
                    updates: [],
                    lifecycle: { stageHistory: [] },
                    iotData: { isSpoiled: false }
                }),
                searchBatches: jest.fn().mockResolvedValue([]),
                getDashboardStats: jest.fn().mockResolvedValue({ stats: {} })
            };

            const statusUpdates = [];
            const onStatus = (status) => statusUpdates.push(status);

            // We use provider = 'fallback' so we don't hit the external APIs
            const originalProvider = aiService.provider;
            aiService.provider = 'fallback';

            await aiService.chatWithBatchContext(
                'Where is batch #0001?',
                {},
                mockBatchService,
                null,
                onStatus
            );

            expect(mockBatchService.getBatchByIdOrPartial).toHaveBeenCalledWith('0001');
            expect(statusUpdates).toContain('Searching database for batch details...');
            expect(statusUpdates).toContain('Generating response...');

            aiService.provider = originalProvider;
        });
    });
});
