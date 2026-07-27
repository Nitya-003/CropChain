const Batch = require("../models/Batch");
const notificationService = require("./notificationService");
const logger = require("../utils/logger");

const TELEMETRY_HISTORY_LIMIT = 500;
const TELEMETRY_HISTORY_WARNING_THRESHOLD = 450;

const SPOILAGE_THRESHOLDS = {
  rice: { maxTemp: 77, maxHumidity: 70 },
  wheat: { maxTemp: 86, maxHumidity: 65 },
  tomato: { maxTemp: 50, maxHumidity: 85 },
  corn: { maxTemp: 82, maxHumidity: 75 },
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
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  const wasSpoiled = batch.iotData?.isSpoiled;
  const isSpoiled = checkSpoiled(temperature, humidity, batch.cropType);
  const telemetryHistoryLength = batch.iotData?.telemetryHistory?.length || 0;
  const timestamp = new Date();

  if (isSpoiled && !wasSpoiled && batch.farmerId) {
    notificationService
      .createInAppNotification(
        batch.farmerId,
        "Spoilage Alert!",
        `Critical thresholds exceeded for batch ${batch.batchId} (${batch.cropType}). Temp: ${temperature}, Humidity: ${humidity}`,
        "alert",
        { batchId: batch.batchId, temperature, humidity },
      )
      .catch((err) => console.error("Failed to send spoilage alert:", err));
  }

  if (telemetryHistoryLength >= TELEMETRY_HISTORY_WARNING_THRESHOLD) {
    logger.warn(
      "Batch IoT telemetry history near cap; oldest readings will be trimmed on write",
      {
        batchId,
        telemetryHistoryLength,
        telemetryHistoryLimit: TELEMETRY_HISTORY_LIMIT,
      },
    );
  }

  const updatedBatch = await Batch.findOneAndUpdate(
    { batchId },
    {
      $set: {
        "iotData.currentTemperature": temperature,
        "iotData.currentHumidity": humidity,
        "iotData.isSpoiled": isSpoiled,
        "iotData.lastUpdated": timestamp,
      },
      $push: {
        "iotData.telemetryHistory": {
          $each: [{ temperature, humidity, timestamp }],
          $slice: -TELEMETRY_HISTORY_LIMIT,
        },
      },
    },
    { new: true, runValidators: true },
  );

  return updatedBatch || batch;
}

async function getIoTData(batchId) {
  const batch = await Batch.findOne({ batchId }).select({
    batchId: 1,
    iotData: 1,
    cropType: 1,
    status: 1,
  });

  if (!batch) {
    const err = new Error("Batch not found");
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
  TELEMETRY_HISTORY_LIMIT,
  TELEMETRY_HISTORY_WARNING_THRESHOLD,
  getThreshold,
  checkSpoiled,
  recordIoTData,
  getIoTData,
};
