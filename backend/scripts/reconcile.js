require('dotenv').config();
const { ethers } = require('ethers');
const Batch = require('../models/Batch');
const { getContract } = require('../config/blockchain');

/**
 * Reconciles blockchain data with the database.
 * Uses getTotalBatches(), getBatchIdByIndex(), and getBatch() 
 * to iterate through batches stored in the contract's mapping and allBatchIds array.
 */
async function reconcile() {
  const contract = await getContract();

  // Get total number of batches from the allBatchIds array
  const total = await contract.getTotalBatches();
  console.log(`Found ${total} batches on blockchain`);

  for (let i = 0; i < total; i++) {
    // Get batch ID by index from the allBatchIds array
    const batchIdBytes = await contract.getBatchIdByIndex(i);
    
    // Convert bytes32 to string (hex) for use as batchId
    const batchId = batchIdBytes.toString();
    
    // Get the full batch data from the cropBatches mapping
    const onChain = await contract.getBatch(batchIdBytes);
    
    // Get the latest update to find the current stage
    let currentStage = 0;
    try {
      const latestUpdate = await contract.getLatestUpdate(batchIdBytes);
      currentStage = latestUpdate.stage.toNumber();
    } catch (err) {
      // If no updates exist yet, default to stage 0 (Farmer)
      console.log(`No updates found for batch ${batchId}, defaulting to stage 0`);
    }

    // Map contract stage number to stage name
    const stageNames = ['Farmer', 'Mandi', 'Transport', 'Retailer'];
    const stageName = stageNames[currentStage] || 'Farmer';

    await Batch.updateOne(
      { batchId: batchId },
      {
        stage: stageName,
        syncStatus: 'synced',
        // Also sync other blockchain data
        quantity: onChain.quantity.toNumber(),
        ipfsCID: onChain.ipfsCID,
        isRecalled: onChain.isRecalled,
        blockchainCreator: onChain.creator
      },
      { upsert: true }
    );

    console.log(`Synced batch ${batchId} (stage: ${stageName})`);
  }

// Run if called directly
if (require.main === module) {
    reconcile()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { reconcile };
