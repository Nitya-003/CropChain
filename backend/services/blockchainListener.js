const Batch = require('../models/Batch');
const socketService = require('./socketService');
const logger = require('../utils/logger');

function startListener(contract) {

  // ✅ matches your ABI
  contract.on("BatchUpdated", async (batchId, stage, actor) => {
    try {

      const id = batchId.toString();
      const stageMap = ['farmer', 'mandi', 'transport', 'retailer'];
      const stageStr = stageMap[Number(stage)] || 'unknown';
      await Batch.updateOne(
        { batchId: id },
        {
          currentStage: stageStr,
          syncStatus: 'synced'
        },
        { upsert: true }
      );

      logger.info(`[SYNC] Batch ${id} → ${stageStr} by ${actor}`);

      // Emit real-time update to all clients watching this batch
      const batchData = await Batch.findOne({ batchId: id }).lean();
      
      if (batchData) {
        socketService.emitToBatchRoom(id, 'batch-updated', {
          batchId: id,
          stage: stageStr,
          actor,
          timestamp: new Date().toISOString(),
          batch: batchData
        });

        // Also emit global event for dashboards
        socketService.emitGlobal('batch-stage-changed', {
          batchId: id,
          stage: stageStr,
          actor,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      logger.error('[SYNC ERROR]', err);
    }
  });

}

module.exports = startListener;

