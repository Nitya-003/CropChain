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
const { getStageNumber, getStagesString, isValidStage, normalizeStage, isValidTransition, getNextStage } = require('../constants/stages');

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
    async createBatch(batchData, user, attempts = 3) {
        let lastError;
        for (let i = 0; i < attempts; i++) {
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

                const createdBatch = Array.isArray(batch) ? batch[0] : batch;

                // Commit the transaction
                await session.commitTransaction();
                session.endSession();

                // Try to sync with blockchain (non-blocking)
                this.syncToBlockchain(createdBatch, 'create');

                console.log(`[SUCCESS] Batch created: ${batchId} by user ${user.id} (${user.email || 'N/A'})`);

                return {
                    success: true,
                    batch: createdBatch,
                    message: 'Batch created successfully'
                };
            } catch (error) {
                await session.abortTransaction();
                session.endSession();

                lastError = error;
                // If duplicate key error, retry up to the limit
                if (error.code === 11000 && i < attempts - 1) {
                    console.warn(`[RETRY] Duplicate batch ID detected. Retrying batch creation... (${i + 1}/${attempts})`);
                    continue;
                }

                console.error('Error creating batch:', error);
                throw error;
            }
        }
        console.error('Error creating batch: Max retries exceeded', lastError);
        throw lastError;
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
            const normalizedStage = normalizeStage(updateData.stage);

            if (!isValidStage(normalizedStage)) {
                throw new Error(`Invalid stage: ${updateData.stage}. Must be one of: ${getStagesString()}`);
            }

            // Fetch current batch to validate transition
            const currentBatch = await Batch.findOne({ batchId });

            if (!currentBatch) {
                return {
                    success: false,
                    error: 'Batch not found',
                    statusCode: 404
                };
            }

            if (currentBatch.isRecalled) {
                return {
                    success: false,
                    error: 'Cannot update a recalled batch',
                    statusCode: 400
                };
            }

            if (normalizedStage === currentBatch.currentStage) {
                return {
                    success: false,
                    error: `Batch is already at stage "${normalizedStage}". No transition needed.`,
                    statusCode: 400
                };
            }

            if (!isValidTransition(currentBatch.currentStage, normalizedStage)) {
                const nextStage = getNextStage(currentBatch.currentStage);
                return {
                    success: false,
                    error: `Invalid stage transition: cannot move from "${currentBatch.currentStage}" to "${normalizedStage}".${nextStage ? ` Valid next stage: "${nextStage}".` : ''}`,
                    statusCode: 400
                };
            }

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
    async getAllBatches(limit = 100) {
        try {
            // Fetch only the most recent batches — avoids OOM on large datasets
            const allBatches = await Batch.find().sort({ createdAt: -1 }).limit(limit).lean();

            // Compute stats efficiently without loading full dataset
            const [totalBatches, recalledBatches, recentBatches] = await Promise.all([
                Batch.countDocuments(),
                Batch.countDocuments({ isRecalled: true }),
                Batch.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
            ]);

            const stats = {
                totalBatches,
                recalledBatches,
                recentBatches,
                totalFarmers: new Set(allBatches.map(b => b.farmerName)).size,
                totalQuantity: allBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)
            };

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
    /**
     * Get dashboard statistics (for AI service)
     * Uses MongoDB aggregation to avoid loading entire collection into memory.
     * @returns {Object} - Dashboard statistics
     */
    async getDashboardStats() {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        const stats = await Batch.aggregate([
            {
                $group: {
                    _id: null,
                    totalBatches: { $sum: 1 },
                    totalFarmers: { $addToSet: '$farmerName' },
                    totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } },
                    recentBatches: {
                        $sum: {
                            $cond: [{ $gte: ['$createdAt', monthAgo] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalBatches: 0,
            totalFarmers: [],
            totalQuantity: 0,
            recentBatches: 0
        };

        return {
            stats: {
                totalBatches: result.totalBatches,
                totalFarmers: result.totalFarmers.length,
                totalQuantity: result.totalQuantity,
                recentBatches: result.recentBatches
            }
        };
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
                const stageNum = getStageNumber(batch.currentStage);
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
