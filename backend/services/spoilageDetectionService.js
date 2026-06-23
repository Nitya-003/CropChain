const Batch = require('../models/Batch');

const SPOILAGE_THRESHOLDS = {
  rice:      { maxTemp: 77, maxHumidity: 70 },
  wheat:     { maxTemp: 86, maxHumidity: 65 },
  tomato:    { maxTemp: 50, maxHumidity: 85 },
  corn:      { maxTemp: 82, maxHumidity: 75 },
};

const DEFAULT_THRESHOLD = { maxTemp: 85, maxHumidity: 80 };

function getThreshold(cropType) {
  return SPOILAGE_THRESHOLDS[cropType] || DEFAULT_THRESHOLD;
}

function checkSpoiled(temperature, humidity, cropType) {
  const { maxTemp, maxHumidity } = getThreshold(cropType);
  if (temperature == null || humidity == null) return false;
  return temperature > maxTemp || humidity > maxHumidity;
}

async function recordIoTData(batchId, temperature, humidity) {
  const batch = await Batch.findOne({ batchId });
  if (!batch) {
    const err = new Error('Batch not found');
    err.statusCode = 404;
    throw err;
  }

  const isSpoiled = checkSpoiled(temperature, humidity, batch.cropType);

  batch.iotData = {
    currentTemperature: temperature,
    currentHumidity: humidity,
    isSpoiled,
    lastUpdated: new Date(),
    telemetryHistory: [
      ...((batch.iotData && batch.iotData.telemetryHistory) || []),
      { temperature, humidity, timestamp: new Date() }
    ]
  };

  await batch.save();
  return batch;
}

async function getIoTData(batchId) {
  const batch = await Batch.findOne({ batchId }).select({
    batchId: 1,
    iotData: 1,
    cropType: 1,
    status: 1,
  });

  if (!batch) {
    const err = new Error('Batch not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    batchId: batch.batchId,
    cropType: batch.cropType,
    currentTemperature: batch.iotData?.currentTemperature ?? null,
    currentHumidity: batch.iotData?.currentHumidity ?? null,
    isSpoiled: batch.iotData?.isSpoiled ?? false,
    lastUpdated: batch.iotData?.lastUpdated ?? null,
    telemetryHistory: (batch.iotData?.telemetryHistory || []).slice(-100),
    status: batch.status,
  };
}

module.exports = {
  SPOILAGE_THRESHOLDS,
  getThreshold,
  checkSpoiled,
  recordIoTData,
  getIoTData,
};
