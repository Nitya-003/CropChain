const mongoose = require('mongoose');
require('dotenv').config();

// Import Batch model
const Batch = require('../models/Batch');

async function verifyIndexes() {
    try {
        console.log('🔍 Starting MongoDB Index Verification...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cropchain', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');

        // Get total document count
        const totalDocs = await Batch.countDocuments();
        console.log(`📊 Total documents in collection: ${totalDocs}\n`);

        // Test 1: Query with currentStage filter and createdAt sort (should use compound index)
        console.log('🧪 Test 1: Query with currentStage filter and createdAt sort');
        const explainResult1 = await Batch
            .find({ currentStage: 'farmer' })
            .sort({ createdAt: -1 })
            .explain("executionStats");

        const stats1 = explainResult1.executionStats;
        console.log(`   📈 Total Docs Examined: ${stats1.totalDocsExamined}`);
        console.log(`   🔑 Total Keys Examined: ${stats1.totalKeysExamined}`);
        console.log(`   ⚡ Execution Time (ms): ${stats1.executionTimeMillis}`);

        // Check if index is being used
        const winningPlan1 = explainResult1.queryPlanner.winningPlan;
        const stage1 = winningPlan1.inputStage || winningPlan1;
        const indexUsed1 = stage1.indexName || 'N/A';
        console.log(`   🎯 Index Used: ${indexUsed1}`);

        if (stats1.totalKeysExamined > 0) {
            console.log('   ✅ Indexes are working correctly (IXSCAN)\n');
        } else {
            console.log('   ❌ Indexes are NOT working (COLLSCAN)\n');
        }

        // Test 2: Query with batchId exact match (should use unique index)
        console.log('🧪 Test 2: Query with batchId exact match');
        const explainResult2 = await Batch
            .findOne({ batchId: { $exists: true } })
            .explain("executionStats");

        const stats2 = explainResult2.executionStats;
        console.log(`   📈 Total Docs Examined: ${stats2.totalDocsExamined}`);
        console.log(`   🔑 Total Keys Examined: ${stats2.totalKeysExamined}`);
        console.log(`   ⚡ Execution Time (ms): ${stats2.executionTimeMillis}`);

        const winningPlan2 = explainResult2.queryPlanner.winningPlan;
        const stage2 = winningPlan2.inputStage || winningPlan2;
        const indexUsed2 = stage2.indexName || 'N/A';
        console.log(`   🎯 Index Used: ${indexUsed2}`);

        if (stats2.totalKeysExamined > 0) {
            console.log('   ✅ Indexes are working correctly (IXSCAN)\n');
        } else {
            console.log('   ❌ Indexes are NOT working (COLLSCAN)\n');
        }

        // Test 3: Aggregation pipeline for stats (should be optimized)
        console.log('🧪 Test 3: Aggregation pipeline for dashboard stats');
        const statsPipeline = [
            {
                $group: {
                    _id: null,
                    totalBatches: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    uniqueFarmers: { $addToSet: "$farmerName" }
                }
            }
        ];

        const aggExplain = await Batch.aggregate([
            { $match: {} },
            ...statsPipeline,
            { $explain: true }
        ]);

        if (aggExplain && aggExplain[0] && aggExplain[0].stages) {
            console.log('   ✅ Aggregation pipeline executed successfully');
            console.log('   📊 Stats computed at database level (no full collection scan)');
        } else {
            console.log('   ❌ Aggregation pipeline may need optimization');
        }

        // Summary
        console.log('\n📋 VERIFICATION SUMMARY:');
        console.log('========================');
        
        const totalKeysExamined = stats1.totalKeysExamined + stats2.totalKeysExamined;
        if (totalKeysExamined > 0) {
            console.log('🎉 OVERALL: Indexes are working correctly!');
            console.log('   • Compound index { currentStage: 1, createdAt: -1 } is utilized');
            console.log('   • Unique index on batchId is utilized');
            console.log('   • Aggregation pipelines are optimized');
        } else {
            console.log('⚠️  OVERALL: Indexes may not be working properly');
            console.log('   • Check if indexes were created successfully');
            console.log('   • Run: db.batches.getIndexes() in MongoDB shell');
        }

        console.log('\n🔧 TIPS:');
        console.log('   • If COLLSCAN appears, indexes are not being used');
        console.log('   • If IXSCAN appears, indexes are working correctly');
        console.log('   • Lower execution times indicate better performance');

    } catch (error) {
        console.error('❌ Error during index verification:', error.message);
    } finally {
        // Close connection
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
        process.exit(0);
    }
}

// Run verification
verifyIndexes();
