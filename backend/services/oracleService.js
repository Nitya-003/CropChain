const { ethers } = require('ethers');
require('dotenv').config();

class OracleService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.oracleWallet = null;
        this.isListening = false;
        this.requestQueue = new Map(); // Track pending requests
    }

    /**
     * Initialize the Oracle service
     */
    async initialize() {
        try {
            console.log('🔮 Initializing Oracle Service...');
            
            // Setup provider (WebSocket for real-time events)
            const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
            this.provider = new ethers.WebSocketProvider(providerUrl);
            
            // Setup oracle wallet
            const privateKey = process.env.ORACLE_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('ORACLE_PRIVATE_KEY not found in environment variables');
            }
            
            this.oracleWallet = new ethers.Wallet(privateKey, this.provider);
            console.log(`🔑 Oracle wallet address: ${this.oracleWallet.address}`);
            
            // Setup contract instance
            const contractAddress = process.env.CONTRACT_ADDRESS;
            if (!contractAddress) {
                throw new Error('CONTRACT_ADDRESS not found in environment variables');
            }
            
            const contractABI = [
                "event IoTDataRequested(bytes32 indexed batchId, address requester)",
                "event IoTDataFulfilled(bytes32 indexed batchId, int256 temperature, int256 humidity, bool isSpoiled)",
                "function fulfillIoTData(bytes32 batchId, int256 temperature, int256 humidity) external",
                "function getBatch(bytes32 batchId) view returns (tuple(address farmer, uint256 quantity, string stage, bool exists, int256 temperature, int256 humidity, bool isSpoiled))"
            ];
            
            this.contract = new ethers.Contract(contractAddress, contractABI, this.oracleWallet);
            
            // Start event listening
            await this.startEventListening();
            
            console.log('✅ Oracle Service initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Oracle Service:', error.message);
            throw error;
        }
    }

    /**
     * Start listening for IoT data request events
     */
    async startEventListening() {
        if (this.isListening) {
            console.log('⚠️ Oracle service is already listening');
            return;
        }

        try {
            console.log('👂 Starting event listening for IoTDataRequested...');
            
            // Listen for IoT data requests
            this.contract.on('IoTDataRequested', (batchId, requester) => {
                this.handleIoTRequest(batchId, requester);
            });
            
            this.isListening = true;
            console.log('✅ Event listening started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start event listening:', error.message);
            throw error;
        }
    }

    /**
     * Handle IoT data request event
     */
    async handleIoTRequest(batchId, requester) {
        try {
            const batchIdStr = ethers.decodeBytes32String(batchId);
            console.log(`📡 IoT Data Requested:`);
            console.log(`   Batch ID: ${batchIdStr}`);
            console.log(`   Requester: ${requester}`);
            console.log(`   Timestamp: ${new Date().toISOString()}`);
            
            // Check if already processing this batch
            if (this.requestQueue.has(batchIdStr)) {
                console.log(`⚠️ Already processing batch ${batchIdStr}, skipping...`);
                return;
            }
            
            // Mark as processing
            this.requestQueue.set(batchIdStr, {
                requestedAt: Date.now(),
                requester,
                status: 'processing'
            });
            
            // Generate mock IoT data with realistic variations
            const iotData = this.generateMockIoTData();
            
            console.log(`🌡️ Generated IoT Data:`);
            console.log(`   Temperature: ${iotData.temperature}°F (${iotData.temperatureRaw})`);
            console.log(`   Humidity: ${iotData.humidity}%`);
            console.log(`   Spoiled: ${iotData.isSpoiled}`);
            
            // Fulfill the request on blockchain
            await this.fulfillIoTData(batchId, iotData);
            
            // Remove from queue
            this.requestQueue.delete(batchIdStr);
            
            console.log(`✅ IoT data fulfilled for batch ${batchIdStr}`);
            
        } catch (error) {
            console.error(`❌ Failed to handle IoT request for batch ${batchId}:`, error.message);
            
            // Remove from queue even on failure
            const batchIdStr = ethers.decodeBytes32String(batchId);
            this.requestQueue.delete(batchIdStr);
        }
    }

    /**
     * Generate realistic mock IoT data
     */
    generateMockIoTData() {
        // Generate temperature between 40°F and 90°F (400-900 in hundredths)
        // Using weighted distribution for more realistic values
        const tempRanges = [
            { min: 450, max: 650, weight: 0.6 },  // 45-65°F (60% - normal range)
            { min: 350, max: 450, weight: 0.2 },  // 35-45°F (20% - cool range)
            { min: 650, max: 750, weight: 0.15 }, // 65-75°F (15% - warm range)
            { min: 750, max: 900, weight: 0.05 }  // 75-90°F (5% - hot range)
        ];
        
        const temperatureRaw = this.weightedRandom(tempRanges);
        const temperature = temperatureRaw / 10; // Convert to Fahrenheit
        
        // Generate humidity between 30% and 80%
        // Correlate with temperature slightly (higher temp = slightly higher humidity)
        const baseHumidity = 45 + (temperatureRaw - 500) * 0.02;
        const humidity = Math.max(30, Math.min(80, Math.round(baseHumidity + Math.random() * 20)));
        
        // Determine if spoiled based on temperature thresholds
        // > 80°F or < 32°F = spoiled
        const isSpoiled = temperature > 80 || temperature < 32;
        
        return {
            temperatureRaw,
            temperature: Math.round(temperature * 10) / 10, // Round to 1 decimal
            humidity,
            isSpoiled,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Weighted random selection based on ranges and weights
     */
    weightedRandom(ranges) {
        const totalWeight = ranges.reduce((sum, range) => sum + range.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const range of ranges) {
            random -= range.weight;
            if (random <= 0) {
                return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            }
        }
        
        // Fallback to first range
        return Math.floor(Math.random() * (ranges[0].max - ranges[0].min + 1)) + ranges[0].min;
    }

    /**
     * Fulfill IoT data on the blockchain
     */
    async fulfillIoTData(batchId, iotData) {
        try {
            console.log(`🔗 Fulfilling IoT data on blockchain...`);
            
            // Convert temperature to hundredths for contract
            const temperatureRaw = Math.round(iotData.temperature * 10);
            
            // Estimate gas and send transaction
            const gasEstimate = await this.contract.fulfillIoTData.estimateGas(
                batchId,
                temperatureRaw,
                iotData.humidity
            );
            
            console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);
            
            const tx = await this.contract.fulfillIoTData(
                batchId,
                temperatureRaw,
                iotData.humidity,
                {
                    gasLimit: Math.floor(gasEstimate * 1.2), // 20% buffer
                    gasPrice: await this.provider.getFeeData()
                }
            );
            
            console.log(`📤 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            console.log(`✅ Transaction confirmed:`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
            
            return receipt;
            
        } catch (error) {
            console.error('❌ Failed to fulfill IoT data:', error.message);
            throw error;
        }
    }

    /**
     * Get current oracle status
     */
    getStatus() {
        return {
            isListening: this.isListening,
            oracleAddress: this.oracleWallet?.address,
            contractAddress: this.contract?.target,
            pendingRequests: this.requestQueue.size,
            providerConnected: this.provider?._ready || false
        };
    }

    /**
     * Stop the oracle service
     */
    async stop() {
        try {
            if (this.contract && this.isListening) {
                this.contract.removeAllListeners('IoTDataRequested');
                this.isListening = false;
                console.log('🛑 Oracle service stopped');
            }
            
            if (this.provider) {
                await this.provider.destroy();
            }
            
        } catch (error) {
            console.error('❌ Error stopping oracle service:', error.message);
        }
    }

    /**
     * Get IoT data for a specific batch (read-only)
     */
    async getBatchIoTData(batchId) {
        try {
            if (!this.contract) {
                throw new Error('Oracle service not initialized');
            }
            
            const batchData = await this.contract.getBatch(batchId);
            
            return {
                batchId: ethers.decodeBytes32String(batchId),
                temperature: batchData.temperature ? batchData.temperature.toNumber() / 10 : null,
                humidity: batchData.humidity ? batchData.humidity.toNumber() : null,
                isSpoiled: batchData.isSpoiled || false,
                exists: batchData.exists || false
            };
            
        } catch (error) {
            console.error(`❌ Failed to get IoT data for batch ${batchId}:`, error.message);
            throw error;
        }
    }
}

// Create singleton instance
const oracleService = new OracleService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Oracle Service...');
    await oracleService.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Oracle Service...');
    await oracleService.stop();
    process.exit(0);
});

module.exports = oracleService;
