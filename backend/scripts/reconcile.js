require("dotenv").config();
const { ethers } = require("ethers");
const logger = require("../utils/logger");
const Batch = require("../models/Batch");
const { initialize } = require("../config/blockchain");

const STAGE_NAMES = ["farmer", "mandi", "transport", "retailer"];

function toNumber(value) {
  if (value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
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
  logger.info("🔄 Starting reconciliation...");

  const contract = await initialize();
  if (!contract) {
    logger.error("❌ Blockchain contract not available. Check configuration.");
    process.exit(1);
  }

  try {
    const totalBatches = await contract.getTotalBatches();
    const total = toNumber(totalBatches);
    logger.info(`📊 Found ${total} batches on blockchain`);

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
              syncStatus: "synced",
              currentStage: stageName,
              isRecalled: Boolean(onChainBatch.isRecalled),
            },
          },
          { upsert: false },
        );

        if (updateResult.matchedCount === 0) {
          skipped++;
          logger.info(`  - Skipped batch not found locally: ${batchId}`);
          continue;
        }

        synced++;
        logger.info(`  ✓ Synced batch: ${batchId}`);
      } catch (batchError) {
        errors++;
        logger.error(
          `  ✗ Error processing batch at index ${index}:`,
          { error: batchError.message },
        );
      }
    }

    logger.info(`\n✅ Batch Reconciliation complete:`);
    logger.info(`   - Synced: ${synced}`);
    logger.info(`   - Skipped: ${skipped}`);
    logger.info(`   - Errors: ${errors}`);

    // Reconcile user roles
    await reconcileRoles(contract);
  } catch (error) {
    logger.error("❌ Reconciliation failed:", { error: error.message });
    process.exit(1);
  }
}

async function reconcileRoles(contract) {
  logger.info("\n🔄 Starting role reconciliation...");
  const User = require("../models/User");

  try {
    const users = await User.find({
      walletAddress: { $exists: true, $ne: null },
    });
    logger.info(
      `📊 Found ${users.length} users with linked wallets in database`,
    );

    let roleSynced = 0;
    let roleMismatches = 0;
    let roleErrors = 0;

    for (const user of users) {
      try {
        const walletAddress = user.walletAddress;
        if (!ethers.isAddress(walletAddress)) {
          logger.info(
            `  - Invalid wallet address for user ${user.email}: ${walletAddress}`,
          );
          roleErrors++;
          continue;
        }

        // Check verification and user account status
        const isVerified = user.verification?.isVerified === true;
        const isActive = user.status === "active";
        const shouldHaveRole = isVerified && isActive;
        const expectedRoleName = shouldHaveRole ? user.role : "none";

        // Map to on-chain ActorRole
        const mapping = {
          farmer: 1,
          mandi: 2,
          transporter: 3,
          retailer: 4,
          oracle: 5,
          admin: 6,
          super_admin: 6,
        };
        const expectedOnChainRole = mapping[expectedRoleName] || 0;

        // Query on-chain role
        const currentOnChainRole = Number(await contract.roles(walletAddress));

        if (currentOnChainRole !== expectedOnChainRole) {
          roleMismatches++;
          logger.info(
            `  ⚠ Role mismatch for ${user.email} (${walletAddress}): expected ${expectedRoleName} (${expectedOnChainRole}), got on-chain ${currentOnChainRole}. Syncing...`,
          );

          const tx = await contract.setRole(walletAddress, expectedOnChainRole);
          await tx.wait();

          logger.info(`  ✓ Synced role for ${user.email} on-chain`);
          roleSynced++;
        } else {
          logger.info(
            `  ✓ User ${user.email} (${walletAddress}) in sync: ${expectedRoleName} (${expectedOnChainRole})`,
          );
        }
      } catch (userError) {
        roleErrors++;
        logger.error(
          `  ✗ Error processing user ${user.email}:`,
          { error: userError.message },
        );
      }
    }

    logger.info(`\n✅ Role Reconciliation complete:`);
    logger.info(`   - Synced/Updated: ${roleSynced}`);
    logger.info(`   - Mismatches corrected: ${roleMismatches}`);
    logger.info(`   - Errors/Skipped: ${roleErrors}`);
  } catch (error) {
    logger.error("❌ Role reconciliation failed:", { error: error.message });
  }
}

if (require.main === module) {
  const connectDB = require("../config/db");
  connectDB()
    .then(() => reconcile())
    .then(() => {
      const mongoose = require("mongoose");
      return mongoose.connection.close();
    })
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { reconcile };
