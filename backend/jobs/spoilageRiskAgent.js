const Batch = require("../models/Batch");
const aiService = require("../services/aiService");
const { emitToBatchRoom, emitGlobal } = require("../services/socketService");
const logger = require("../utils/logger");

const runSpoilageRiskAssessment = async () => {
  try {
    logger.info("Starting background AI spoilage risk assessment agent...");

    // Fetch active batches in 'transport' stage
    const activeTransitBatches = await Batch.find({
      currentStage: "transport",
      status: "Active",
      isRecalled: false,
    });

    logger.info(
      `Found ${activeTransitBatches.length} active transit batches for spoilage risk analysis.`,
    );

    for (const batch of activeTransitBatches) {
      // Find when it entered 'transport' stage
      const transportUpdate = batch.updates.find(
        (u) => u.stage === "transport",
      );
      const transportTime = transportUpdate
        ? transportUpdate.timestamp
        : batch.updatedAt || batch.createdAt;

      const elapsedMs = Date.now() - new Date(transportTime).getTime();
      const transitHours = elapsedMs / (1000 * 60 * 60);

      logger.info(
        `Analyzing batch ${batch.batchId} (${batch.cropType}) - transit time: ${transitHours.toFixed(2)} hours`,
      );

      const riskAssessment = await aiService.predictSpoilageRisk(
        batch,
        transitHours,
      );

      // Update MongoDB model field
      batch.spoilageRisk = {
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        factors: riskAssessment.factors,
        predictedAt: new Date(),
      };

      await batch.save();

      logger.info(
        `Updated batch ${batch.batchId} spoilage risk: ${riskAssessment.riskLevel} (${riskAssessment.riskScore}%)`,
      );

      // Emit update events via WebSocket
      const toJSONBatch = batch.toJSON();
      emitToBatchRoom(batch.batchId, "batch-updated", {
        batchId: batch.batchId,
        batch: toJSONBatch,
      });

      emitGlobal("batch-stage-changed", {
        batchId: batch.batchId,
        batch: toJSONBatch,
      });
    }
    logger.info("Background AI spoilage risk assessment agent run completed.");
  } catch (error) {
    logger.error("Error in background spoilage risk assessment agent:", {
      error: error.message,
      stack: error.stack,
    });
  }
};

const startSpoilageRiskAgent = (intervalMs = 60000) => {
  // Run immediately on startup
  runSpoilageRiskAssessment();
  // Run periodically
  const timer = setInterval(runSpoilageRiskAssessment, intervalMs);
  return timer;
};

module.exports = {
  runSpoilageRiskAssessment,
  startSpoilageRiskAgent,
};
