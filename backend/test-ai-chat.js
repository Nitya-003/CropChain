// Simple test script to verify AI chat functionality
require('dotenv').config();
const aiService = require('./services/aiService');

// Mock batch service for testing
const mockBatchService = {
  async getBatch(batchId) {
    if (batchId === 'CROP-2024-001') {
      return {
        batchId: 'CROP-2024-001',
        farmerName: 'Test Farmer',
        cropType: 'rice',
        quantity: 1000,
        currentStage: 'mandi',
        origin: 'Test Village',
        harvestDate: '2024-01-15',
        updates: [
          { stage: 'farmer', actor: 'Test Farmer', timestamp: '2024-01-15' },
          { stage: 'mandi', actor: 'Test Mandi', timestamp: '2024-01-16' }
        ]
      };
    }
    return null;
  },

  async getDashboardStats() {
    return {
      stats: {
        totalBatches: 5,
        totalFarmers: 3,
        totalQuantity: 5000,
        recentBatches: 2
      }
    };
  }
};

async function testAIChat() {
  console.log('🧪 Testing AI Chat Service...\n');

  const testCases = [
    'Hello, what can you help me with?',
    'How do I track a batch?',
    'What is an immutable record?',
    'Tell me about batch CROP-2024-001',
    'What are the current system statistics?'
  ];

  for (const message of testCases) {
    console.log(`📝 User: ${message}`);
    
    try {
      const response = await aiService.chat(message, mockBatchService);
      console.log(`🤖 AI: ${response.message}`);
      
      if (response.functionCalled) {
        console.log(`⚡ Function called: ${response.functionCalled}`);
        console.log(`📊 Result: ${JSON.stringify(response.functionResult, null, 2)}`);
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }

  console.log('✅ AI Chat Service test completed!');
}

// Run the test
if (require.main === module) {
  testAIChat().catch(console.error);
}

module.exports = { testAIChat };