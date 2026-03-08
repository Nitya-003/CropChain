const Batch = require('../models/Batch');
const socketService = require('./socketService');

function startListener(contract) {

  // ✅ matches your ABI
  contract.on("BatchUpdated", async (batchId, stage, actor) => {
    try {

      const id = batchId.toString();

      await Batch.updateOne(
        { batchId: id },
        {
          currentStage: stage,
          syncStatus: 'synced'
        },
        { upsert: true }
      );

      console.log(`[SYNC] Batch ${id} → ${stage} by ${actor}`);

      // Emit real-time update to all clients watching this batch
      const batchData = await Batch.findOne({ batchId: id }).lean();
      
      if (batchData) {
        socketService.emitToBatchRoom(id, 'batch-updated', {
          batchId: id,
          stage,
          actor,
          timestamp: new Date().toISOString(),
          batch: batchData
        });

        // Also emit global event for dashboards
        socketService.emitGlobal('batch-stage-changed', {
          batchId: id,
          stage,
          actor,
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error('[SYNC ERROR]', err);
    }
  });

}

module.exports = startListener;
