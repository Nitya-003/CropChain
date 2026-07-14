const { ethers } = require('ethers');
require('dotenv').config();
const logger = require('../utils/logger');

class OracleService {
    constructor() {
        this.contract = null;
        this.provider = null;
        this.oracleWallet = null;
        this.isListening = false;
        this.requestQueue = new Map(); // Track pending requests
        this._reconnecting = false;
        this._contractABI = [
            "event IoTDataRequested(bytes32 indexed batchId, address requester)",
            "event IoTDataFulfilled(bytes32 indexed batchId, int256 temperature, int256 humidity, bool isSpoiled)",
            "function fulfillIoTData(bytes32 batchId, int256 temperature, int256 humidity) external",
            "function getBatch(bytes32 batchId) view returns (tuple(address farmer, uint256 quantity, string stage, bool exists, int256 temperature, int256 humidity, bool isSpoiled))"
        ];
    }

    /**
     * Initialize the Oracle service
     */
    async initialize() {
        try {
            logger.info('🔮 Initializing Oracle Service...');
            
            // Setup oracle wallet and check environment variables first
            const privateKey = process.env.ORACLE_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('ORACLE_PRIVATE_KEY not found in environment variables');
            }

            const contractAddress = process.env.CONTRACT_ADDRESS;
            if (!contractAddress) {
                throw new Error('CONTRACT_ADDRESS not found in environment variables');
            }
            
            // Setup provider (WebSocket for real-time events)
            const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
            this.provider = await this._createProvider(providerUrl);
            
            this.oracleWallet = new ethers.Wallet(privateKey, this.provider);
            logger.info(`🔑 Oracle wallet address: ${this.oracleWallet.address}`);
            
            this.contract = new ethers.Contract(contractAddress, this._contractABI, this.oracleWallet);
            
            // Start event listening
            await this.startEventListening();
            
            logger.info('✅ Oracle Service initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('❌ Failed to initialize Oracle Service:', error.message);
            throw error;
        }
    }

    /**
     * Create a WebSocket provider with automatic reconnection listeners
     */
    async _createProvider(url) {
        const provider = new ethers.WebSocketProvider(url);

        const ws = provider._websocket;
        if (ws) {
            ws.addEventListener('close', () => {
                console.log('⚠️ Oracle WebSocket disconnected. Initiating reconnection...');
                this._scheduleReconnect();
            });
            ws.addEventListener('error', (err) => {
                console.error('⚠️ Oracle WebSocket error:', err.message || err);
            });
        }

        await provider.ready;
        return provider;
    }

    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    async _scheduleReconnect() {
        if (this._reconnecting) return;
        this._reconnecting = true;
        this.isListening = false;

        const maxAttempts = 10;
        const baseDelay = 1000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`🔄 Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms...`);

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // Clean up old listeners and connection
                if (this.contract) {
                    this.contract.removeAllListeners('IoTDataRequested');
                }
                if (this.provider) {
                    try { await this.provider.destroy(); } catch {}
                }

                // Create new provider
                const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
                this.provider = await this._createProvider(providerUrl);

                // Reconnect wallet and contract to the new provider
                const privateKey = process.env.ORACLE_PRIVATE_KEY;
                this.oracleWallet = new ethers.Wallet(privateKey, this.provider);
                const contractAddress = process.env.CONTRACT_ADDRESS;
                this.contract = new ethers.Contract(contractAddress, this._contractABI, this.oracleWallet);

                // Re-register event listeners
                await this.startEventListening();

                console.log('✅ Oracle reconnected successfully');
                this._reconnecting = false;
                return;
            } catch (error) {
                console.error(`❌ Reconnection attempt ${attempt} failed:`, error.message);
            }
        }

        console.error('❌ All reconnection attempts exhausted. Oracle is offline.');
        this._reconnecting = false;
    }

    /**
     * Start listening for IoT data request events
     */
    async startEventListening() {
        if (this.isListening) {
            logger.info('⚠️ Oracle service is already listening');
            return;
        }

        try {
            logger.info('👂 Starting event listening for IoTDataRequested...');
            
            // Listen for IoT data requests
            this.contract.on('IoTDataRequested', (batchId, requester) => {
                this.handleIoTRequest(batchId, requester);
            });
            
            this.isListening = true;
            logger.info('✅ Event listening started successfully');
            
        } catch (error) {
            logger.error('❌ Failed to start event listening:', error.message);
            throw error;
        }
    }

    /**
     * Handle IoT data request event
     */
    async handleIoTRequest(batchId, requester) {
        // NEVER generate mock data in production — only real IoT data should be written
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Mock IoT data generation is disabled in production. Real IoT sensor integration required.');
        }

        try {
            const batchIdStr = ethers.decodeBytes32String(batchId);
            logger.info(`📡 IoT Data Requested:`);
            logger.info(`   Batch ID: ${batchIdStr}`);
            logger.info(`   Requester: ${requester}`);
            logger.info(`   Timestamp: ${new Date().toISOString()}`);
            
            // Check if already processing this batch
            if (this.requestQueue.has(batchIdStr)) {
                logger.info(`⚠️ Already processing batch ${batchIdStr}, skipping...`);
                return;
            }
            
            // Mark as processing
            this.requestQueue.set(batchIdStr, {
                requestedAt: Date.now(),
                requester,
                status: 'processing'
            });
            
            logger.info(`❌ No real IoT sensor integration configured. Cannot fulfill IoT data request for batch ${batchIdStr}.`);
            this.requestQueue.delete(batchIdStr);
            
        } catch (error) {
            logger.error(`❌ Failed to handle IoT request for batch ${batchId}:`, error.message);
            
            // Remove from queue even on failure
            const batchIdStr = ethers.decodeBytes32String(batchId);
            this.requestQueue.delete(batchIdStr);
        }
    }

    /**
     * Fulfill IoT data on the blockchain
     */
    async fulfillIoTData(batchId, iotData) {
        try {
            logger.info(`🔗 Fulfilling IoT data on blockchain...`);
            
            // Convert temperature to hundredths for contract
            const temperatureRaw = Math.round(iotData.temperature * 10);
            
            // Estimate gas and send transaction
            const gasEstimate = await this.contract.fulfillIoTData.estimateGas(
                batchId,
                temperatureRaw,
                iotData.humidity
            );
            
            logger.info(`⛽ Gas estimate: ${gasEstimate.toString()}`);
            
            const tx = await this.contract.fulfillIoTData(
                batchId,
                temperatureRaw,
                iotData.humidity,
                {
                    gasLimit: Math.floor(gasEstimate * 1.2), // 20% buffer
                    gasPrice: await this.provider.getFeeData()
                }
            );
            
            logger.info(`📤 Transaction sent: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            logger.info(`✅ Transaction confirmed:`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas Used: ${receipt.gasUsed.toString()}`);
            
            return receipt;
            
        } catch (error) {
            logger.error('❌ Failed to fulfill IoT data:', error.message);
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
            providerConnected: this.provider?._ready || false,
            reconnecting: this._reconnecting
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
                logger.info('🛑 Oracle service stopped');
            }
            
            if (this.provider) {
                await this.provider.destroy();
            }
            
        } catch (error) {
            logger.error('❌ Error stopping oracle service:', error.message);
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
            logger.error(`❌ Failed to get IoT data for batch ${batchId}:`, error.message);
            throw error;
        }
    }
}

// Create singleton instance
const oracleService = new OracleService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('\n🛑 Shutting down Oracle Service...');
    await oracleService.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('\n🛑 Shutting down Oracle Service...');
    await oracleService.stop();
    process.exit(0);
});

module.exports = oracleService;


