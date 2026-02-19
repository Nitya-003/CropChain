const Batch = require('../models/Batch');

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

    } catch (err) {
      console.error('[SYNC ERROR]', err);
    }
  });

}

module.exports = startListener;
