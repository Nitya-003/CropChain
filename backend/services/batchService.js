/**
 * BatchService - Handles all batch-related business logic
 * Extracted from server.js to follow Separation of Concerns principle
 */

const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Batch = require('../models/Batch');
const Counter = require('../models/Counter');
const blockchainService = require('./blockchainService');
const notificationService = require('./notificationService');
const apiResponse = require('../utils/apiResponse');

class BatchService {
    /**
     * Generate a unique batch ID with transaction safety
     * @param {mongoose.ClientSession} session - MongoDB session for transaction
     * @returns {string} - Generated batch ID
     */
    async generateBatchId(session = null) {
        const currentYear = new Date().getFullYear();
        const options = { new: true, upsert: true };
        
        if (session) {
            options.session = session;
        }

        const counter = await Counter.findOneAndUpdate(
            { name: 'batchId' },
            { $inc: { seq: 1 } },
            options
        );

        return `CROP-${currentYear}-${String(counter.seq).padStart(4, '0')}`;
    }

    /**
     * Generate QR code for a batch
     * @param {string} batchId - Batch identifier
     * @returns {string} - QR code as data URL
     */
    async generateQRCode(batchId) {
        try {
            return await QRCode.toDataURL(batchId, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#22c55e',
                    light: '#ffffff'
                }
            });
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            return '';
        }
    }

    /**
     * Create a new batch with MongoDB transaction
     * @param {Object} batchData - Validated batch data from request
     * @param {Object} user - Authenticated user object
     * @returns {Object} - Result with created batch or error
     */
    async createBatch(batchData, user) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Generate batch ID within transaction for atomicity
            const batchId = await this.generateBatchId(session);
            const qrCode = await this.generateQRCode(batchId);

            const blockchainHash = blockchainService.simulateHash(batchData);

            const batch = await Batch.create([{
                batchId,
                farmerId: user.farmerId || user.id,
                farmerName: batchData.farmerName || user.name,
                farmerAddress: batchData.farmerAddress || user.address || '',
                cropType: batchData.cropType,
                quantity: batchData.quantity,
                harvestDate: batchData.harvestDate,
                origin: batchData.origin,
                certifications: batchData.certifications,
                description: batchData.description,
                currentStage: 'farmer',
                isRecalled: false,
                qrCode,
                blockchainHash,
                syncStatus: 'pending',
                updates: [{
                    stage: 'farmer',
                    actor: batchData.farmerName || user.name,
                    location: batchData.origin,
                    timestamp: batchData.harvestDate,
                    notes: batchData.description || 'Initial harvest recorded'
                }]
            }], { session });

            // Commit the transaction
            await session.commitTransaction();
            session.endSession();

            // Try to sync with blockchain (non-blocking)
            this.syncToBlockchain(batch[0], 'create');

            console.log(`[SUCCESS] Batch created: ${batchId} by user ${user.id} (${user.email})`);

            return {
                success: true,
                batch: batch[0],
                message: 'Batch created successfully'
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();

            console.error('Error creating batch:', error);
            throw error;
        }
    }

    /**
     * Get a batch by ID
     * @param {string} batchId - Batch identifier
     * @returns {Object} - Result with batch or error
     */
    async getBatch(batchId) {
        try {
            const batch = await Batch.findOne({ batchId });

            if (!batch) {
                return {
                    success: false,
                    error: 'Batch not found',
                    statusCode: 404
                };
            }

            // Alert if batch is recalled
            if (batch.isRecalled) {
                notificationService.alertRecall(batchId);
            }

            return {
                success: true,
                batch,
                message: 'Batch retrieved successfully'
            };
        } catch (error) {
            console.error('Error fetching batch:', error);
            throw error;
        }
    }

    /**
     * Update a batch's stage
     * @param {string} batchId - Batch identifier
     * @param {Object} updateData - Update data (stage, actor, location, timestamp, notes)
     * @param {Object} user - Authenticated user
     * @returns {Object} - Result with updated batch or error
     */
    async updateBatch(batchId, updateData, user) {
        try {
            // Normalize stage to lowercase
            const normalizedStage = updateData.stage.toLowerCase();

            const blockchainHash = blockchainService.simulateHash(updateData);

            const batch = await Batch.findOneAndUpdate(
                { batchId },
                {
                    $push: {
                        updates: {
                            stage: normalizedStage,
                            actor: updateData.actor,
                            location: updateData.location,
                            timestamp: updateData.timestamp,
                            notes: updateData.notes
                        }
                    },
                    currentStage: normalizedStage,
                    blockchainHash,
                    syncStatus: 'pending'
                },
                { new: true }
            );

            if (!batch) {
                return {
                    success: false,
                    error: 'Batch not found',
                    statusCode: 404
                };
            }

            // Try to sync with blockchain (non-blocking)
            this.syncToBlockchain(batch, 'update');

            console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${normalizedStage} by ${updateData.actor}`);

            return {
                success: true,
                batch,
                message: 'Batch updated successfully'
            };
        } catch (error) {
            console.error('Error updating batch:', error);
            throw error;
        }
    }

    /**
     * Recall a batch (admin only)
     * @param {string} batchId - Batch identifier
     * @param {Object} adminUser - Admin user who initiated recall
     * @returns {Object} - Result with recalled batch or error
     */
    async recallBatch(batchId, adminUser) {
        try {
            const batch = await Batch.findOne({ batchId });

            if (!batch) {
                return {
                    success: false,
                    error: 'Batch not found',
                    statusCode: 404
                };
            }

            if (batch.isRecalled) {
                return {
                    success: false,
                    error: 'Batch already recalled',
                    statusCode: 400
                };
            }

            batch.isRecalled = true;
            await batch.save();

            // Send recall notification
            notificationService.sendRecallNotification(batch, adminUser);

            console.log(`🚨 RECALL by admin ${adminUser.email || 'unknown'} for batch ${batchId}`);

            return {
                success: true,
                batch,
                message: 'Batch recalled successfully',
                recalledBy: adminUser.email,
                recalledAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error recalling batch:', error);
            throw error;
        }
    }

    /**
     * Get all batches with statistics
     * @returns {Object} - Result with batches and stats
     */
    async getAllBatches() {
        try {
            const allBatches = await Batch.find().sort({ createdAt: -1 });

            const stats = this.calculateStats(allBatches);

            return {
                success: true,
                batches: allBatches,
                stats,
                message: 'Batches retrieved successfully'
            };
        } catch (error) {
            console.error('Error fetching batches:', error);
            throw error;
        }
    }

    /**
     * Calculate statistics from batch collection
     * @param {Array} batches - Array of batch documents
     * @returns {Object} - Calculated statistics
     */
    calculateStats(batches) {
        const uniqueFarmers = new Set(batches.map(b => b.farmerName)).size;
        const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);

        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        return {
            totalBatches: batches.length,
            totalFarmers: uniqueFarmers,
            totalQuantity,
            recentBatches: batches.filter(batch => new Date(batch.createdAt) > monthAgo).length
        };
    }

    /**
     * Get dashboard statistics (for AI service)
     * @returns {Object} - Dashboard statistics
     */
    async getDashboardStats() {
        const allBatches = await Batch.find();
        const stats = this.calculateStats(allBatches);

        return { stats };
    }

    /**
     * Sync batch to blockchain (non-blocking)
     * @param {Object} batch - Batch document
     * @param {string} action - 'create' or 'update'
     */
    async syncToBlockchain(batch, action) {
        if (!blockchainService.isAvailable()) {
            return;
        }

        try {
            if (action === 'create') {
                await blockchainService.createBatchOnChain(
                    batch.batchId,
                    batch.cropType,
                    batch.blockchainHash || '',
                    batch.quantity,
                    batch.farmerName,
                    batch.origin,
                    batch.description || ''
                );
            } else if (action === 'update') {
                const stageMap = { 'farmer': 0, 'processor': 1, 'distributor': 2, 'retailer': 3, 'consumer': 4 };
                const stageNum = stageMap[batch.currentStage] || 0;
                const lastUpdate = batch.updates[batch.updates.length - 1];

                await blockchainService.updateBatchOnChain(
                    batch.batchId,
                    stageNum,
                    lastUpdate?.actor || '',
                    lastUpdate?.location || '',
                    lastUpdate?.notes || ''
                );
            }
        } catch (error) {
            console.error(`Blockchain sync failed for batch ${batch.batchId}:`, error.message);
        }
    }
}

// Export singleton instance
module.exports = new BatchService();
