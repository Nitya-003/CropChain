const Batch = require('../models/Batch');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const {
  TELEMETRY_HISTORY_LIMIT,
  TELEMETRY_HISTORY_WARNING_THRESHOLD,
  recordIoTData
} = require('../services/spoilageDetectionService');

jest.mock('../models/Batch', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock('../services/notificationService', () => ({
  createInAppNotification: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  warn: jest.fn()
}));

describe('spoilageDetectionService.recordIoTData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.createInAppNotification.mockResolvedValue();
  });

  test('caps telemetryHistory with MongoDB $push and $slice', async () => {
    const existingBatch = {
      batchId: 'CROP-2026-0001',
      cropType: 'rice',
      farmerId: 'FARMER-1',
      iotData: {
        isSpoiled: false,
        telemetryHistory: Array.from({ length: TELEMETRY_HISTORY_LIMIT }, (_, index) => ({
          temperature: 70,
          humidity: 60,
          timestamp: new Date(Date.now() - index)
        }))
      }
    };
    const updatedBatch = {
      ...existingBatch,
      iotData: {
        currentTemperature: 74,
        currentHumidity: 62,
        isSpoiled: false,
        telemetryHistory: existingBatch.iotData.telemetryHistory.slice(1)
      }
    };

    Batch.findOne.mockResolvedValue(existingBatch);
    Batch.findOneAndUpdate.mockResolvedValue(updatedBatch);

    const result = await recordIoTData('CROP-2026-0001', 74, 62);

    expect(result).toBe(updatedBatch);
    expect(Batch.findOneAndUpdate).toHaveBeenCalledWith(
      { batchId: 'CROP-2026-0001' },
      expect.objectContaining({
        $set: expect.objectContaining({
          'iotData.currentTemperature': 74,
          'iotData.currentHumidity': 62,
          'iotData.isSpoiled': false,
          'iotData.lastUpdated': expect.any(Date)
        }),
        $push: {
          'iotData.telemetryHistory': {
            $each: [
              {
                temperature: 74,
                humidity: 62,
                timestamp: expect.any(Date)
              }
            ],
            $slice: -TELEMETRY_HISTORY_LIMIT
          }
        }
      }),
      { new: true, runValidators: true }
    );
  });

  test('logs a warning when telemetry history is approaching the cap', async () => {
    const existingBatch = {
      batchId: 'CROP-2026-0002',
      cropType: 'wheat',
      iotData: {
        isSpoiled: false,
        telemetryHistory: Array.from({ length: TELEMETRY_HISTORY_WARNING_THRESHOLD })
      }
    };

    Batch.findOne.mockResolvedValue(existingBatch);
    Batch.findOneAndUpdate.mockResolvedValue(existingBatch);

    await recordIoTData('CROP-2026-0002', 72, 61);

    expect(logger.warn).toHaveBeenCalledWith(
      'Batch IoT telemetry history near cap; oldest readings will be trimmed on write',
      {
        batchId: 'CROP-2026-0002',
        telemetryHistoryLength: TELEMETRY_HISTORY_WARNING_THRESHOLD,
        telemetryHistoryLimit: TELEMETRY_HISTORY_LIMIT
      }
    );
  });

  test('throws a 404 error when the batch does not exist', async () => {
    Batch.findOne.mockResolvedValue(null);

    await expect(recordIoTData('MISSING', 72, 61)).rejects.toMatchObject({
      message: 'Batch not found',
      statusCode: 404
    });
    expect(Batch.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
