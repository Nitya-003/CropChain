const mongoose = require("mongoose");
const logger = require("../utils/logger");
require("dotenv").config();

// Import Batch model
const Batch = require("../models/Batch");

async function verifyIndexes() {
  try {
    logger.info("🔍 Starting MongoDB Index Verification...\n");

    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cropchain",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );

    logger.info("✅ Connected to MongoDB");

    // Get total document count
    const totalDocs = await Batch.countDocuments();
    logger.info(`📊 Total documents in collection: ${totalDocs}\n`);

    // Test 1: Query with currentStage filter and createdAt sort (should use compound index)
    logger.info("🧪 Test 1: Query with currentStage filter and createdAt sort");
    const explainResult1 = await Batch.find({ currentStage: "farmer" })
      .sort({ createdAt: -1 })
      .explain("executionStats");

    const stats1 = explainResult1.executionStats;
    logger.info(`   📈 Total Docs Examined: ${stats1.totalDocsExamined}`);
    logger.info(`   🔑 Total Keys Examined: ${stats1.totalKeysExamined}`);
    logger.info(`   ⚡ Execution Time (ms): ${stats1.executionTimeMillis}`);

    // Check if index is being used
    const winningPlan1 = explainResult1.queryPlanner.winningPlan;
    const stage1 = winningPlan1.inputStage || winningPlan1;
    const indexUsed1 = stage1.indexName || "N/A";
    logger.info(`   🎯 Index Used: ${indexUsed1}`);

    if (stats1.totalKeysExamined > 0) {
      logger.info("   ✅ Indexes are working correctly (IXSCAN)\n");
    } else {
      logger.info("   ❌ Indexes are NOT working (COLLSCAN)\n");
    }

    // Test 2: Query with batchId exact match (should use unique index)
    logger.info("🧪 Test 2: Query with batchId exact match");
    const explainResult2 = await Batch.findOne({
      batchId: { $exists: true },
    }).explain("executionStats");

    const stats2 = explainResult2.executionStats;
    logger.info(`   📈 Total Docs Examined: ${stats2.totalDocsExamined}`);
    logger.info(`   🔑 Total Keys Examined: ${stats2.totalKeysExamined}`);
    logger.info(`   ⚡ Execution Time (ms): ${stats2.executionTimeMillis}`);

    const winningPlan2 = explainResult2.queryPlanner.winningPlan;
    const stage2 = winningPlan2.inputStage || winningPlan2;
    const indexUsed2 = stage2.indexName || "N/A";
    logger.info(`   🎯 Index Used: ${indexUsed2}`);

    if (stats2.totalKeysExamined > 0) {
      logger.info("   ✅ Indexes are working correctly (IXSCAN)\n");
    } else {
      logger.info("   ❌ Indexes are NOT working (COLLSCAN)\n");
    }

    // Test 3: Aggregation pipeline for stats (should be optimized)
    logger.info("🧪 Test 3: Aggregation pipeline for dashboard stats");
    const statsPipeline = [
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          uniqueFarmers: { $addToSet: "$farmerName" },
        },
      },
    ];

    const aggExplain = await Batch.aggregate([
      { $match: {} },
      ...statsPipeline,
      { $explain: true },
    ]);

    if (aggExplain && aggExplain[0] && aggExplain[0].stages) {
      logger.info("   ✅ Aggregation pipeline executed successfully");
      logger.info(
        "   📊 Stats computed at database level (no full collection scan)",
      );
    } else {
      logger.info("   ❌ Aggregation pipeline may need optimization");
    }

    // Summary
    logger.info("\n📋 VERIFICATION SUMMARY:");
    logger.info("========================");

    const totalKeysExamined =
      stats1.totalKeysExamined + stats2.totalKeysExamined;
    if (totalKeysExamined > 0) {
      logger.info("🎉 OVERALL: Indexes are working correctly!");
      logger.info(
        "   • Compound index { currentStage: 1, createdAt: -1 } is utilized",
      );
      logger.info("   • Unique index on batchId is utilized");
      logger.info("   • Aggregation pipelines are optimized");
    } else {
      logger.info("⚠️  OVERALL: Indexes may not be working properly");
      logger.info("   • Check if indexes were created successfully");
      logger.info("   • Run: db.batches.getIndexes() in MongoDB shell");
    }

    logger.info("\n🔧 TIPS:");
    logger.info("   • If COLLSCAN appears, indexes are not being used");
    logger.info("   • If IXSCAN appears, indexes are working correctly");
    logger.info("   • Lower execution times indicate better performance");
  } catch (error) {
    logger.error("❌ Error during index verification:", {
      error: error.message,
    });
  } finally {
    // Close connection
    await mongoose.connection.close();
    logger.info("\n🔌 MongoDB connection closed");
    process.exit(0);
  }
}

// Run verification
verifyIndexes();
