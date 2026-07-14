const Batch = require('../models/Batch');
const aiService = require('../services/aiService');
const socketService = require('../services/socketService');
const { runSpoilageRiskAssessment } = require('../jobs/spoilageRiskAgent');

// Mock Batch model
jest.mock('../models/Batch', () => ({
    find: jest.fn()
}));

// Mock aiService
jest.mock('../services/aiService', () => ({
    predictSpoilageRisk: jest.fn(),
    calculateLocalSpoilageRisk: jest.fn()
}));

// Mock socketService
jest.mock('../services/socketService', () => ({
    emitToBatchRoom: jest.fn(),
    emitGlobal: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('Spoilage Risk Prediction Agent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should query active transit batches, analyze risk, save to DB, and emit socket updates', async () => {
        // Arrange
        const mockSave = jest.fn().mockResolvedValue(true);
        const mockBatch = {
            batchId: 'CROP-2026-0001',
            cropType: 'tomato',
            quantity: 500,
            harvestDate: new Date('2026-07-01T00:00:00.000Z'),
            updatedAt: new Date('2026-07-02T00:00:00.000Z'),
            currentStage: 'transport',
            updates: [
                {
                    stage: 'transport',
                    timestamp: new Date('2026-07-02T12:00:00.000Z'),
                    actor: 'Logistics A',
                    notes: 'In transit'
                }
            ],
            iotData: {
                currentTemperature: 65,
                currentHumidity: 88
            },
            save: mockSave,
            toJSON: jest.fn().mockReturnValue({ batchId: 'CROP-2026-0001', cropType: 'tomato' })
        };

        Batch.find.mockResolvedValue([mockBatch]);
        
        const mockRiskResult = {
            riskLevel: 'High',
            riskScore: 85,
            factors: ['High temperature for Tomato', 'Transit duration exceeded']
        };
        aiService.predictSpoilageRisk.mockResolvedValue(mockRiskResult);

        // Act
        await runSpoilageRiskAssessment();

        // Assert
        expect(Batch.find).toHaveBeenCalledWith({
            currentStage: 'transport',
            status: 'Active',
            isRecalled: false
        });
        expect(aiService.predictSpoilageRisk).toHaveBeenCalled();
        expect(mockBatch.spoilageRisk).toBeDefined();
        expect(mockBatch.spoilageRisk.riskLevel).toBe('High');
        expect(mockBatch.spoilageRisk.riskScore).toBe(85);
        expect(mockBatch.spoilageRisk.factors).toEqual(['High temperature for Tomato', 'Transit duration exceeded']);
        expect(mockSave).toHaveBeenCalled();

        expect(socketService.emitToBatchRoom).toHaveBeenCalledWith(
            'CROP-2026-0001',
            'batch-updated',
            expect.objectContaining({
                batchId: 'CROP-2026-0001'
            })
        );
        expect(socketService.emitGlobal).toHaveBeenCalledWith(
            'batch-stage-changed',
            expect.objectContaining({
                batchId: 'CROP-2026-0001'
            })
        );
    });

    it('should handle errors gracefully without throwing', async () => {
        // Arrange
        Batch.find.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(runSpoilageRiskAssessment()).resolves.not.toThrow();
    });
});

describe('AIService - calculateLocalSpoilageRisk fallback', () => {
    const actualAiService = jest.requireActual('../services/aiService');

    it('should assign correct risk for tomato based on transit time and temperature', () => {
        // Low risk
        const batch1 = { cropType: 'tomato', quantity: 100, harvestDate: new Date() };
        const res1 = actualAiService.calculateLocalSpoilageRisk(batch1, 24);
        expect(res1.riskLevel).toBe('Low');
        expect(res1.riskScore).toBe(15);

        // Medium risk
        const res2 = actualAiService.calculateLocalSpoilageRisk(batch1, 48);
        expect(res2.riskLevel).toBe('Medium');
        expect(res2.riskScore).toBe(50);

        // High risk transit
        const res3 = actualAiService.calculateLocalSpoilageRisk(batch1, 80);
        expect(res3.riskLevel).toBe('High');
        expect(res3.riskScore).toBe(85);

        // High risk temperature
        const batch2 = { cropType: 'tomato', quantity: 100, harvestDate: new Date(), iotData: { currentTemperature: 55 } };
        const res4 = actualAiService.calculateLocalSpoilageRisk(batch2, 12);
        expect(res4.riskLevel).toBe('High');
        expect(res4.riskScore).toBe(75);
    });

    it('should assign correct risk for rice based on transit time and humidity', () => {
        // Low risk
        const batch1 = { cropType: 'rice', quantity: 100, harvestDate: new Date() };
        const res1 = actualAiService.calculateLocalSpoilageRisk(batch1, 100);
        expect(res1.riskLevel).toBe('Low');
        expect(res1.riskScore).toBe(10);

        // High risk humidity
        const batch2 = { cropType: 'rice', quantity: 100, harvestDate: new Date(), iotData: { currentHumidity: 80 } };
        const res2 = actualAiService.calculateLocalSpoilageRisk(batch2, 100);
        expect(res2.riskScore).toBe(65);
        expect(res2.riskLevel).toBe('Medium');
    });
});
