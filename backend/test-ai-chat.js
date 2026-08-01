// Simple test script to verify AI chat functionality
require("dotenv").config();
const aiService = require("./services/aiService");
const logger = require("./utils/logger");

// Mock batch service for testing
const mockBatchService = {
  async getBatch(batchId) {
    if (batchId === "CROP-2024-0001") {
      return {
        batchId: "CROP-2024-0001",
        farmerName: "Test Farmer",
        cropType: "rice",
        quantity: 1000,
        currentStage: "mandi",
        origin: "Test Village",
        harvestDate: "2024-01-15",
        blockchainHash:
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        updates: [
          {
            stage: "farmer",
            actor: "Test Farmer",
            location: "Test Village",
            timestamp: "2024-01-15",
            notes: "Initial harvest recorded",
          },
          {
            stage: "mandi",
            actor: "Test Mandi",
            location: "Test Mandi Center",
            timestamp: "2024-01-16",
            notes: "Arrived at mandi",
          },
        ],
        lifecycle: {
          currentStage: "Quality Checked",
          stageHistory: [
            {
              stage: "Registered",
              timestamp: "2024-01-15",
              updatedBy: "Test Farmer",
              notes: "Registered",
            },
            {
              stage: "Quality Checked",
              timestamp: "2024-01-16",
              updatedBy: "Quality Inspector",
              notes: "Passed quality checks successfully",
            },
          ],
        },
      };
    }
    return null;
  },

  async getBatchByIdOrPartial(id) {
    const cleanId = id.trim().replace(/^#/, "");
    if (cleanId === "CROP-2024-0001" || cleanId === "0001" || cleanId === "1") {
      return await this.getBatch("CROP-2024-0001");
    }
    return null;
  },

  async searchBatches(filters) {
    const batch = await this.getBatch("CROP-2024-0001");
    if (batch) {
      if (filters.cropType && batch.cropType !== filters.cropType) return [];
      if (filters.farmerName && !batch.farmerName.includes(filters.farmerName))
        return [];
      return [batch];
    }
    return [];
  },

  async getLatestBatch(cropType) {
    const batch = await this.getBatch("CROP-2024-0001");
    if (batch) {
      if (cropType && batch.cropType !== cropType.toLowerCase()) return null;
      return batch;
    }
    return null;
  },

  async getDashboardStats() {
    return {
      stats: {
        totalBatches: 5,
        totalFarmers: 3,
        totalQuantity: 5000,
        recentBatches: 2,
      },
    };
  },
};

async function testAIChat() {
  logger.info("🧪 Testing AI Chat Service...\n");

  const testCases = [
    "Hello, what can you help me with?",
    "How do I track a batch?",
    "What is an immutable record?",
    "Tell me about batch CROP-2024-0001",
    "What are the current system statistics?",
    "Tell me about batch #0001",
    "Did the latest shipment of rice pass its quality checks?",
    "Search for batches of rice",
  ];

  for (const message of testCases) {
    logger.info(`📝 User: ${message}`);

    try {
      const response = await aiService.chat(message, mockBatchService);
      logger.info(`🤖 AI: ${response.message}`);

      if (response.functionCalled) {
        logger.info(`⚡ Function called: ${response.functionCalled}`);
        logger.info(
          `📊 Result: ${JSON.stringify(response.functionResult, null, 2)}`,
        );
      }
    } catch (error) {
      logger.error(`❌ Error: ${error.message}`);
    }

    logger.info("---\n");
  }

  logger.info("✅ AI Chat Service test completed!");
}

// Run the test
if (require.main === module) {
  testAIChat().catch((err) => logger.error(err));
}

module.exports = { testAIChat };
