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

  console.log('✅ Reconciliation complete');
}

/**
 * Reconcile blockchain data with MongoDB database
 * Syncs batch data from blockchain to local database
 */
async function reconcile() {
    console.log('🔄 Starting reconciliation...');
    
    const contract = getContract();
    
    if (!contract) {
        console.error('❌ Blockchain contract not available. Check configuration.');
        process.exit(1);
    }
    
    try {
        // Get total number of batches on blockchain
        const totalBatches = await contract.getTotalBatches();
        console.log(`📊 Found ${totalBatches} batches on blockchain`);
        
        let synced = 0;
        let skipped = 0;
        let errors = 0;
        
        // Iterate through all batch IDs on blockchain
        for (let i = 0; i < totalBatches; i++) {
            try {
                // Get batch ID at index
                const batchIdBytes32 = await contract.getBatchIdByIndex(i);
                
                // Convert bytes32 to string (remove padding)
                const batchId = ethers.zeroPadValue(batchIdBytes32, 32).toString();
                
                // Get full batch data
                const onChainBatch = await contract.getBatch(batchIdBytes32);
                
                // Only sync batches that exist on chain
                if (onChainBatch.exists) {
                    // Convert batchId bytes32 to readable string format
                    const readableBatchId = ethers.toUtf8String(batchIdBytes32);
                    
                    // Map blockchain stage (uint8) to string
                    const stageName = getStageName(Number(onChainBatch.quantity) > 0 ? 0 : 0); // Stage is in updates, not CropBatch struct
                    
                    // Update or insert batch in MongoDB
                    await Batch.updateOne(
                        { batchId: readableBatchId },
                        {
                            $set: {
                                // Keep local data but update sync status
                                syncStatus: 'synced',
                                lastSyncedAt: new Date(),
                                onChainData: {
                                    quantity: Number(onChainBatch.quantity),
                                    creator: onChainBatch.creator,
                                    createdAt: new Date(Number(onChainBatch.createdAt) * 1000),
                                    exists: onChainBatch.exists,
                                    isRecalled: onChainBatch.isRecalled
                                }
                            }
                        },
                        { upsert: true }
                    );
                    
                    synced++;
                    console.log(`  ✓ Synced batch: ${readableBatchId}`);
                } else {
                    skipped++;
                }
            } catch (batchError) {
                errors++;
                console.error(`  ✗ Error processing batch at index ${i}:`, batchError.message);
            }
        }
        
        console.log(`\n✅ Reconciliation complete:`);
        console.log(`   - Synced: ${synced}`);
        console.log(`   - Skipped: ${skipped}`);
        console.log(`   - Errors: ${errors}`);
        
    } catch (error) {
        console.error('❌ Reconciliation failed:', error.message);
        process.exit(1);
    }
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
