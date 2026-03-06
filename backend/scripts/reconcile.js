require('dotenv').config();
const { ethers } = require('ethers');
const Batch = require('../models/Batch');
const { getContract } = require('../config/blockchain');

// Stage enum mapping from CropChain.sol
const STAGE_NAMES = ['Farmer', 'Mandi', 'Transport', 'Retailer'];

/**
 * Convert uint8 stage to human-readable string
 * @param {number} stage - Stage enum value (uint8)
 * @returns {string} Stage name
 */
function getStageName(stage) {
    if (stage >= 0 && stage < STAGE_NAMES.length) {
        return STAGE_NAMES[stage];
    }
    return 'Unknown';
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
