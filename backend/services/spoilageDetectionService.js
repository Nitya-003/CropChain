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

const socketService = require("./socketService");

  if (isSpoiled && !wasSpoiled) {
    if (batch.farmerId) {
      notificationService
        .createInAppNotification(
          batch.farmerId,
          "Spoilage Alert & Automated Dispute Triggered!",
          `Critical cold-chain threshold breached for batch ${batch.batchId} (${batch.cropType}). Temp: ${temperature}°F, Humidity: ${humidity}%. Dispute automatically logged on-chain.`,
          "alert",
          { batchId: batch.batchId, temperature, humidity, disputeTriggered: true },
        )
        .catch((err) => logger.error("Failed to send spoilage alert:", err));
    }

    try {
      if (socketService && typeof socketService.broadcast === "function") {
        socketService.broadcast("iot:telemetry_breach", {
          batchId: batch.batchId,
          cropType: batch.cropType,
          temperature,
          humidity,
          disputeTriggered: true,
          timestamp,
        });
      }
    } catch (err) {
      logger.error("Failed to broadcast WebSocket telemetry breach alert:", err.message);
    }
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

/**
 * Multi-Modal Produce Shelf-Life & Spoilage Decay Calculation Engine
 * Combines IoT thermal cumulative degree-hours (Arrhenius kinetic decay rate k = A * exp(-Ea / RT)),
 * computer vision spot/necrosis ratios, and humidity respiration factors.
 */
function calculateMultiModalShelfLife(params = {}) {
  const cropType = (params.cropType || "general").toLowerCase();
  const currentTempC = parseFloat(params.temperatureC || 25.0);
  const currentHumidity = parseFloat(params.humidity || 75.0);
  const daysInTransit = parseFloat(params.daysInTransit || 2.0);
  const spotRatio = parseFloat(params.spotRatio || 0.02); // Vision leaf/skin necrosis ratio

  // Baseline maximum shelf life in days at optimal cold storage (4°C)
  const BASELINE_DAYS = {
    rice: 365,
    wheat: 300,
    tomato: 14,
    banana: 10,
    mango: 12,
    grapes: 21,
    general: 14,
  };

  const initialMaxDays = BASELINE_DAYS[cropType] || BASELINE_DAYS.general;

  // Arrhenius Temperature Decay Multiplier (Reference T_ref = 4°C = 277.15 K)
  const R = 8.314; // J/(mol*K)
  const Ea = 50000; // Activation energy ~50 kJ/mol for produce degradation
  const T_ref = 277.15;
  const T_actual = currentTempC + 273.15;

  const arrheniusRateMultiplier = Math.exp((Ea / R) * (1 / T_ref - 1 / T_actual));

  // Humidity Respiration Penalty (Optimal 85-90%)
  let humidityMultiplier = 1.0;
  if (currentHumidity < 60) {
    humidityMultiplier = 1.35; // Desiccation loss
  } else if (currentHumidity > 92) {
    humidityMultiplier = 1.45; // Mold & microbial growth risk
  }

  // Vision Necrosis Degradation Multiplier
  const visionNecrosisFactor = 1.0 + spotRatio * 5.0;

  // Total Combined Daily Decay Rate
  const totalDecayRate = arrheniusRateMultiplier * humidityMultiplier * visionNecrosisFactor;

  // Effective days consumed
  const effectiveDaysUsed = daysInTransit * totalDecayRate;
  const remainingDays = Math.max(0, Math.round((initialMaxDays - effectiveDaysUsed) * 10) / 10);

  // Decay Index Percentage (0% = Fresh, 100% = Fully Degraded)
  const decayIndexPct = Math.min(100, Math.round((effectiveDaysUsed / initialMaxDays) * 100));

  return {
    cropType,
    temperatureC: currentTempC,
    humidity: currentHumidity,
    daysInTransit,
    spotRatio,
    initialMaxDays,
    remainingDays,
    decayIndexPct,
    effectiveDecayRate: Math.round(totalDecayRate * 100) / 100,
    isSpoilageRiskHigh: decayIndexPct > 70 || remainingDays < 2,
    suggestedAction:
      decayIndexPct > 70
        ? "⚠️ Immediate express distribution or liquidation required!"
        : "✅ Cold-chain compliant. Standard distribution timeline.",
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
  calculateMultiModalShelfLife,
};
