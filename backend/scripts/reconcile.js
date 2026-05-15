require('dotenv').config();
const { ethers } = require('ethers');
const Batch = require('../models/Batch');
const { getContract } = require('../config/blockchain');

const STAGE_NAMES = ['farmer', 'mandi', 'transport', 'retailer'];

function toNumber(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value.toNumber === 'function') return value.toNumber();
    return Number(value);
}

function getStageName(stage) {
    return STAGE_NAMES[stage] || STAGE_NAMES[0];
}

function normalizeBatchId(batchIdBytes32) {
    try {
        return ethers.decodeBytes32String(batchIdBytes32);
    } catch (error) {
        return ethers.hexlify(batchIdBytes32);
    }
}

async function reconcile() {
    console.log('🔄 Starting reconciliation...');

    const contract = getContract();
    if (!contract) {
        console.error('❌ Blockchain contract not available. Check configuration.');
        process.exit(1);
    }

    try {
        const totalBatches = await contract.getTotalBatches();
        const total = toNumber(totalBatches);
        console.log(`📊 Found ${total} batches on blockchain`);

        let synced = 0;
        let skipped = 0;
        let errors = 0;

        for (let index = 0; index < total; index++) {
            try {
                const batchIdBytes32 = await contract.getBatchIdByIndex(index);
                const batchId = normalizeBatchId(batchIdBytes32);
                const onChainBatch = await contract.getBatch(batchIdBytes32);

                if (!onChainBatch?.exists) {
                    skipped++;
                    continue;
                }

                let stage = 0;
                try {
                    const latestUpdate = await contract.getLatestUpdate(batchIdBytes32);
                    stage = toNumber(latestUpdate.stage);
                } catch (error) {
                    stage = 0;
                }

                const stageName = getStageName(stage);

                const updateResult = await Batch.updateOne(
                    { batchId },
                    {
                        $set: {
                            syncStatus: 'synced',
                            currentStage: stageName,
                            isRecalled: Boolean(onChainBatch.isRecalled)
                        }
                    },
                    { upsert: false }
                );

                if (updateResult.matchedCount === 0) {
                    skipped++;
                    console.log(`  - Skipped batch not found locally: ${batchId}`);
                    continue;
                }

                synced++;
                console.log(`  ✓ Synced batch: ${batchId}`);
            } catch (batchError) {
                errors++;
                console.error(`  ✗ Error processing batch at index ${index}:`, batchError.message);
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

if (require.main === module) {
    reconcile()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { reconcile };
