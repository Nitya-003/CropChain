/**
 * BlockchainService - Handles all blockchain-related operations
 * Extracted from server.js to follow Separation of Concerns principle
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const blockchainConfig = require('../config/blockchain');

class BlockchainService {
    constructor() {
        this.contract = null;
        this.isInitialized = false;
        this.initialize();
    }

    /**
     * Initialize blockchain connection
     */
    initialize() {
        try {
            this.contract = blockchainConfig.getContract();
            this.isInitialized = this.contract !== null;
            
            if (this.isInitialized) {
                console.log('✓ BlockchainService initialized');
            } else {
                console.log('ℹ️  BlockchainService running in demo mode (no contract)');
            }
        } catch (error) {
            console.error('Failed to initialize BlockchainService:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Validate required environment variables
     * @throws Error if required variables are missing
     */
    validateEnvironment() {
        const hasUrl = process.env.INFURA_URL || process.env.SEPOLIA_URL;
        const hasPrivateKey = process.env.PRIVATE_KEY || process.env.ETH_PRIVATE_KEY;
        const hasContract = process.env.CONTRACT_ADDRESS;

        const missing = [];
        if (!hasUrl) missing.push('INFURA_URL / SEPOLIA_URL');
        if (!hasContract) missing.push('CONTRACT_ADDRESS');
        if (!hasPrivateKey) missing.push('PRIVATE_KEY / ETH_PRIVATE_KEY');

        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }

        const pk = process.env.PRIVATE_KEY || process.env.ETH_PRIVATE_KEY;
        const formattedPk = pk.startsWith('0x') ? pk : '0x' + pk;
        if (!/^0x[a-fA-F0-9]{64}$/.test(formattedPk)) {
            throw new Error('Invalid PRIVATE_KEY format');
        }
    }

    /**
     * Simulate a blockchain hash for demo/offline mode
     * @param {Object} data - Data to hash
     * @returns {string} - Simulated blockchain hash
     */
    simulateHash(data) {
        return '0x' + crypto
            .createHash('sha256')
            .update(JSON.stringify(data) + Date.now().toString())
            .digest('hex');
    }

    /**
     * Create a batch on the blockchain
     * @param {string} batchId - Batch identifier
     * @param {string} cropType - Type of crop
     * @param {string} ipfsCID - IPFS Content Identifier
     * @param {number} quantity - Quantity of crop
     * @param {string} actorName - Name of the actor
     * @param {string} location - Location
     * @param {string} notes - Additional notes
     * @returns {Object} - Transaction result
     */
    async createBatchOnChain(batchId, cropType, ipfsCID, quantity, actorName, location, notes) {
        if (!this.isInitialized || !this.contract) {
            return {
                success: false,
                demo: true,
                message: 'Blockchain not configured, using local storage only',
                hash: this.simulateHash({ batchId, cropType, ipfsCID, quantity })
            };
        }

        try {
            const batchIdBytes32 = ethers.id(batchId);
            const cropTypeHash = ethers.id(cropType);

            const tx = await this.contract.createBatch(
                batchIdBytes32,
                cropTypeHash,
                ipfsCID,
                quantity,
                actorName,
                location,
                notes
            );

            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                batchId,
                message: 'Batch created on blockchain'
            };
        } catch (error) {
            console.error('Error creating batch on blockchain:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create batch on blockchain'
            };
        }
    }

    /**
     * Update a batch stage on the blockchain
     * @param {string} batchId - Batch identifier
     * @param {number} stage - Stage number (0-5)
     * @param {string} actorName - Name of the actor
     * @param {string} location - Location
     * @param {string} notes - Additional notes
     * @returns {Object} - Transaction result
     */
    async updateBatchOnChain(batchId, stage, actorName, location, notes) {
        if (!this.isInitialized || !this.contract) {
            return {
                success: false,
                demo: true,
                message: 'Blockchain not configured, using local storage only',
                hash: this.simulateHash({ batchId, stage, actorName, location })
            };
        }

        try {
            const batchIdBytes32 = ethers.id(batchId);

            const tx = await this.contract.updateBatch(
                batchIdBytes32,
                stage,
                actorName,
                location,
                notes
            );

            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                batchId,
                message: 'Batch updated on blockchain'
            };
        } catch (error) {
            console.error('Error updating batch on blockchain:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update batch on blockchain'
            };
        }
    }

    /**
     * Get batch information from blockchain
     * @param {string} batchId - Batch identifier
     * @returns {Object} - Batch data from blockchain
     */
    async getBatchFromChain(batchId) {
        if (!this.isInitialized || !this.contract) {
            return {
                success: false,
                demo: true,
                message: 'Blockchain not configured'
            };
        }

        try {
            const batchIdBytes32 = ethers.id(batchId);
            const batch = await this.contract.getBatch(batchIdBytes32);

            return {
                success: true,
                batch: {
                    batchId: batch.batchId,
                    cropTypeHash: batch.cropTypeHash,
                    ipfsCID: batch.ipfsCID,
                    quantity: batch.quantity,
                    createdAt: batch.createdAt,
                    creator: batch.creator,
                    exists: batch.exists,
                    isRecalled: batch.isRecalled
                }
            };
        } catch (error) {
            console.error('Error fetching batch from blockchain:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to fetch batch from blockchain'
            };
        }
    }

    /**
     * Check if blockchain service is available
     * @returns {boolean}
     */
    isAvailable() {
        return this.isInitialized && this.contract !== null;
    }

    /**
     * Synchronize a user's role to the blockchain
     * @param {string} walletAddress - The user's wallet address
     * @param {string} roleName - The user's backend role
     * @returns {Promise<Object>} - Transaction result
     */
    async syncUserRole(walletAddress, roleName) {
        if (!this.isInitialized || !this.contract) {
            return {
                success: false,
                demo: true,
                message: 'Blockchain not configured, role sync skipped',
                simulated: true
            };
        }

        if (!walletAddress || !ethers.isAddress(walletAddress)) {
            console.error('[BlockchainService] Invalid wallet address for role sync:', walletAddress);
            return {
                success: false,
                error: 'Invalid wallet address',
                message: 'Invalid wallet address'
            };
        }

        try {
            const onChainRole = this.mapRoleToOnChain(roleName);
            
            console.log(`[BlockchainService] Syncing role for ${walletAddress}: ${roleName} (mapped to on-chain: ${onChainRole})`);
            
            // Check current on-chain role first to avoid redundant transactions
            const currentOnChainRole = Number(await this.contract.roles(walletAddress));
            if (currentOnChainRole === onChainRole) {
                console.log(`[BlockchainService] Role for ${walletAddress} is already synced on-chain (${currentOnChainRole})`);
                return {
                    success: true,
                    alreadySynced: true,
                    message: 'Role already in sync'
                };
            }

            const tx = await this.contract.setRole(walletAddress, onChainRole);
            const receipt = await tx.wait();

            console.log(`[BlockchainService] Role synced on-chain for ${walletAddress}. Tx: ${receipt.hash}`);

            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                message: 'Role synced on blockchain'
            };
        } catch (error) {
            console.error('[BlockchainService] Error syncing user role on-chain:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to sync user role on blockchain'
            };
        }
    }

    /**
     * Helper to map backend role string to on-chain ActorRole enum
     */
    mapRoleToOnChain(roleName) {
        const mapping = {
            'farmer': 1,
            'mandi': 2,
            'transporter': 3,
            'retailer': 4,
            'oracle': 5,
            'admin': 6,
            'super_admin': 6
        };
        return mapping[roleName] || 0; // ActorRole.None
    }

    /**
     * Get contract instance for external use (e.g., event listeners)
     * @returns {ethers.Contract|null}
     */
    getContract() {
        return this.contract;
    }
}

// Export singleton instance
module.exports = new BlockchainService();
