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

        console.log(`\n✅ Batch Reconciliation complete:`);
        console.log(`   - Synced: ${synced}`);
        console.log(`   - Skipped: ${skipped}`);
        console.log(`   - Errors: ${errors}`);

        // Reconcile user roles
        await reconcileRoles(contract);

    } catch (error) {
        console.error('❌ Reconciliation failed:', error.message);
        process.exit(1);
    }
}

async function reconcileRoles(contract) {
    console.log('\n🔄 Starting role reconciliation...');
    const User = require('../models/User');

    try {
        const users = await User.find({ walletAddress: { $exists: true, $ne: null } });
        console.log(`📊 Found ${users.length} users with linked wallets in database`);

        let roleSynced = 0;
        let roleMismatches = 0;
        let roleErrors = 0;

        for (const user of users) {
            try {
                const walletAddress = user.walletAddress;
                if (!ethers.isAddress(walletAddress)) {
                    console.log(`  - Invalid wallet address for user ${user.email}: ${walletAddress}`);
                    roleErrors++;
                    continue;
                }

                // Check verification and user account status
                const isVerified = user.verification?.isVerified === true;
                const isActive = user.status === 'active';
                const shouldHaveRole = isVerified && isActive;
                const expectedRoleName = shouldHaveRole ? user.role : 'none';

                // Map to on-chain ActorRole
                const mapping = {
                    'farmer': 1,
                    'mandi': 2,
                    'transporter': 3,
                    'retailer': 4,
                    'oracle': 5,
                    'admin': 6,
                    'super_admin': 6
                };
                const expectedOnChainRole = mapping[expectedRoleName] || 0;

                // Query on-chain role
                const currentOnChainRole = Number(await contract.roles(walletAddress));

                if (currentOnChainRole !== expectedOnChainRole) {
                    roleMismatches++;
                    console.log(`  ⚠ Role mismatch for ${user.email} (${walletAddress}): expected ${expectedRoleName} (${expectedOnChainRole}), got on-chain ${currentOnChainRole}. Syncing...`);
                    
                    const tx = await contract.setRole(walletAddress, expectedOnChainRole);
                    await tx.wait();
                    
                    console.log(`  ✓ Synced role for ${user.email} on-chain`);
                    roleSynced++;
                } else {
                    console.log(`  ✓ User ${user.email} (${walletAddress}) in sync: ${expectedRoleName} (${expectedOnChainRole})`);
                }
            } catch (userError) {
                roleErrors++;
                console.error(`  ✗ Error processing user ${user.email}:`, userError.message);
            }
        }

        console.log(`\n✅ Role Reconciliation complete:`);
        console.log(`   - Synced/Updated: ${roleSynced}`);
        console.log(`   - Mismatches corrected: ${roleMismatches}`);
        console.log(`   - Errors/Skipped: ${roleErrors}`);
    } catch (error) {
        console.error('❌ Role reconciliation failed:', error.message);
    }
}

if (require.main === module) {
    const connectDB = require('../config/db');
    connectDB()
        .then(() => reconcile())
        .then(() => {
            const mongoose = require('mongoose');
            return mongoose.connection.close();
        })
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { reconcile };
