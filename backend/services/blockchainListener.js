const { ethers } = require("ethers");
const Batch = require("../models/Batch");
const socketService = require("./socketService");
const logger = require("../utils/logger");
const { STAGE_ORDER } = require("../constants/stages");

function startListener(contract) {
  // ✅ matches your ABI
  contract.on("BatchUpdated", async (batchId, stage, actor) => {
    try {
      // The emitted batchId is the on-chain bytes32 (0x…64 hex), but the DB
      // stores the human-readable business ID (CROP-2026-0001). Decode it back
      // so the update matches the real batch document.
      const id = ethers.decodeBytes32String(batchId);
      const stageStr = STAGE_ORDER[Number(stage)] || "unknown";

      // No upsert: if the batch is unknown to the DB, log and skip instead of
      // inserting a malformed document with only batchId/currentStage/syncStatus.
      const result = await Batch.updateOne(
        { batchId: id },
        {
          currentStage: stageStr,
          syncStatus: "synced",
        },
      );

      if (result.matchedCount === 0) {
        logger.warn(`[SYNC] Batch ${id} not found in DB; skipping update`);
        return;
      }

      logger.info(`[SYNC] Batch ${id} → ${stageStr} by ${actor}`);

      // Emit real-time update to all clients watching this batch
      const batchData = await Batch.findOne({ batchId: id }).lean();

      if (batchData) {
        socketService.emitToBatchRoom(id, "batch-updated", {
          batchId: id,
          stage: stageStr,
          actor,
          timestamp: new Date().toISOString(),
          batch: batchData,
        });

        // Also emit global event for dashboards
        socketService.emitGlobal("batch-stage-changed", {
          batchId: id,
          stage: stageStr,
          actor,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.error("[SYNC ERROR]", err);
    }
  });
}

module.exports = startListener;
