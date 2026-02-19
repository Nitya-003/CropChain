const Batch = require('../models/Batch');
const { getContract } = require('../config/blockchain'); // adjust if needed

async function reconcile() {
  const contract = await getContract();

  const total = await contract.getBatchCount();

  for (let i = 0; i < total; i++) {
    const onChain = await contract.batches(i);

    await Batch.updateOne(
      { batchId: i },
      {
        stage: onChain.stage,
        syncStatus: 'synced'
      },
      { upsert: true }
    );
  }

  console.log('✅ Reconciliation complete');
}

reconcile();
