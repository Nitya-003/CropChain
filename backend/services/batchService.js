/**
 * BatchService - Handles all batch-related business logic
 * Extracted from server.js to follow Separation of Concerns principle
 */

const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Batch = require('../models/Batch');
const Counter = require('../models/Counter');
const blockchainService = require('./blockchainService');
const blockchainQueue = require('./blockchainQueue');
const notificationService = require('./notificationService');
const { emitToBatchRoom, emitGlobal } = require('./socketService');
const apiResponse = require('../utils/apiResponse');
const { getStageNumber, getStagesString, isValidStage, normalizeStage, isValidTransition, getNextStage } = require('../constants/stages');
const activityService = require('./activityService');
const logger = require('../utils/logger');

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
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const trackingUrl = `${frontendUrl}/track-batch?batchId=${encodeURIComponent(batchId)}`;
            return await QRCode.toDataURL(trackingUrl, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#22c55e',
                    light: '#ffffff'
                }
            });
        } catch (error) {
            logger.error('Failed to generate QR code:', error);
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
                    }],
                    lifecycle: {
                        currentStage: 'Registered',
                        stageHistory: [{
                            stage: 'Registered',
                            timestamp: new Date(),
                            updatedBy: batchData.farmerName || user.name || 'System',
                            notes: 'Lifecycle has just started.'
                        }]
                    }
                }], { session });

                const createdBatch = Array.isArray(batch) ? batch[0] : batch;

                // Commit the transaction
                await session.commitTransaction();
                session.endSession();

                // Try to sync with blockchain (non-blocking)
                this.syncToBlockchain(createdBatch, 'create');

                // Log platform activities
                await activityService.logActivity({
                    userId: user.id || user._id,
                    userRole: user.role,
                    eventType: 'crop_registered',
                    batchId,
                    description: `Crop batch registered: ${batchData.cropType} (${batchData.quantity} kg)`,
                    metadata: {
                        farmerName: batchData.farmerName || user.name,
                        origin: batchData.origin,
                        quantity: batchData.quantity,
                        cropType: batchData.cropType
                    }
                });

                await activityService.logActivity({
                    userId: user.id || user._id,
                    userRole: user.role,
                    eventType: 'harvest_completed',
                    batchId,
                    description: `Harvest completed for ${batchData.cropType} at ${batchData.origin}`,
                    metadata: {
                        harvestDate: batchData.harvestDate,
                        origin: batchData.origin
                    }
                });

                emitToBatchRoom(batchId, 'batch:created', {
                  batchId,
                  farmerName: createdBatch.farmerName,
                  cropType: createdBatch.cropType,
                  quantity: createdBatch.quantity,
                  timestamp: new Date().toISOString()
                });

                logger.info(`[SUCCESS] Batch created: ${batchId} by user ${user.id} (${user.email || 'N/A'})`);

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
                    logger.warn(`[RETRY] Duplicate batch ID detected. Retrying batch creation... (${i + 1}/${attempts})`);
                    continue;
                }

                logger.error('Error creating batch:', error);
                throw error;
            }
        }
        logger.error('Error creating batch: Max retries exceeded', lastError);
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
            logger.error('Error fetching batch:', error);
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

            const previousBatch = await Batch.findOne({ batchId });
            if (!previousBatch) {
                return {
                    success: false,
                    error: 'Batch not found',
                    statusCode: 404
                };
            }

            if (previousBatch.isRecalled) {
                return {
                    success: false,
                    error: 'Cannot update a recalled batch',
                    statusCode: 400
                };
            }

            const previousStage = previousBatch.currentStage;

            if (!isValidTransition(previousStage, normalizedStage)) {
                if (previousStage === normalizedStage) {
                    return {
                        success: false,
                        error: `Batch is already at stage '${previousStage}'`,
                        statusCode: 400
                    };
                }
                return {
                    success: false,
                    error: 'Invalid stage transition',
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

            // Determine activity type and log activity
            let eventType = 'batch_status_updated';
            let description = `Batch stage updated to ${normalizedStage}`;
            if (normalizedStage === 'mandi') {
                eventType = 'ownership_transferred';
                description = `Batch ownership transferred to Mandi at ${updateData.location}`;
            } else if (normalizedStage === 'transport') {
                if (previousStage === 'transport') {
                    eventType = 'shipment_status_updated';
                    description = `Shipment status updated: batch is at ${updateData.location}`;
                } else {
                    eventType = 'shipment_created';
                    description = `Shipment created for transport to ${updateData.location}`;
                }
            } else if (normalizedStage === 'retailer') {
                eventType = 'delivery_confirmed';
                description = `Delivery confirmed. Batch received at Retailer in ${updateData.location}`;
            }

            await activityService.logActivity({
                userId: user.id || user._id,
                userRole: user.role,
                eventType,
                batchId,
                description,
                metadata: {
                    stage: normalizedStage,
                    actor: updateData.actor,
                    location: updateData.location,
                    notes: updateData.notes
                }
            });

            emitToBatchRoom(batchId, 'batch:stageChanged', {
              batchId,
              previousStage,
              newStage: normalizedStage,
              actor: updateData.actor,
              timestamp: new Date().toISOString()
            });

            // Try to sync with blockchain (non-blocking)
            this.syncToBlockchain(batch, 'update');

            logger.info(`[SUCCESS] Batch updated: ${batchId} to stage ${normalizedStage} by ${updateData.actor}`);

            return {
                success: true,
                batch,
                message: 'Batch updated successfully'
            };
        } catch (error) {
            logger.error('Error updating batch:', error);
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

            await activityService.logActivity({
                userId: adminUser.id || adminUser._id,
                userRole: adminUser.role,
                eventType: 'batch_recalled',
                batchId,
                description: `Batch recalled by ${adminUser.role}`,
                metadata: {
                    recalledBy: adminUser.email || adminUser.name
                }
            });

            emitGlobal('batch:recalled', {
              batchId,
              cropType: batch.cropType,
              recalledBy: adminUser.email || adminUser.name,
              recalledAt: new Date().toISOString()
            });

            emitToBatchRoom(batchId, 'batch:recalled', {
              batchId,
              cropType: batch.cropType,
              recalledBy: adminUser.email || adminUser.name,
              recalledAt: new Date().toISOString()
            });

            // Send recall notification
            notificationService.sendRecallNotification(batch, adminUser);

            logger.info(`🚨 RECALL by admin ${adminUser.email || 'unknown'} for batch ${batchId}`);

            return {
                success: true,
                batch,
                message: 'Batch recalled successfully',
                recalledBy: adminUser.email,
                recalledAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error recalling batch:', error);
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
            const [totalBatches, recalledBatches, recentBatches, batchStats] = await Promise.all([
                Batch.countDocuments(),
                Batch.countDocuments({ isRecalled: true }),
                Batch.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
                Batch.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalFarmers: { $addToSet: '$farmerId' },
                            totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } }
                        }
                    }
                ])
            ]);

            const aggregateStats = batchStats[0] || {
                totalFarmers: [],
                totalQuantity: 0
            };

            const stats = {
                totalBatches,
                recalledBatches,
                recentBatches,
                totalFarmers: aggregateStats.totalFarmers.length,
                totalQuantity: aggregateStats.totalQuantity
            };

            return {
                success: true,
                batches: allBatches,
                stats,
                message: 'Batches retrieved successfully'
            };
        } catch (error) {
            logger.error('Error fetching batches:', error);
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
     * Retrieve a batch using direct batch ID, or by partial ID match (regex)
     * @param {string} id - The ID to search for (e.g., CROP-2026-0001, #0001, 1)
     * @returns {Object|null} - Batch document or null
     */
    async getBatchByIdOrPartial(id) {
        if (!id) return null;
        const cleanId = id.trim().replace(/^#/, ''); // Remove leading '#' if present
        
        // 1. Try exact match first
        let batch = await Batch.findOne({ batchId: cleanId });
        if (batch) return batch;

        // 2. Try match with CROP- or BATCH prefix if it's a number
        if (/^\d+$/.test(cleanId)) {
            const query = {
                $or: [
                    { batchId: cleanId },
                    { batchId: new RegExp(cleanId + '$', 'i') },
                    { batchId: new RegExp(cleanId.padStart(4, '0') + '$', 'i') },
                    { batchId: new RegExp(cleanId.padStart(6, '0') + '$', 'i') }
                ]
            };
            batch = await Batch.findOne(query);
            if (batch) return batch;
        }

        // 3. Fallback to case-insensitive regex match on batchId
        const escRegex = (val) => String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        batch = await Batch.findOne({ batchId: { $regex: escRegex(cleanId), $options: 'i' } });
        return batch;
    }

    /**
     * Search batches based on criteria
     * @param {Object} filters - Search filters
     * @returns {Array} - Array of matching batches
     */
    async searchBatches(filters = {}) {
        const query = {};
        const escRegex = (val) => String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        if (filters.cropType) {
            query.cropType = filters.cropType.toLowerCase();
        }
        if (filters.farmerName) {
            query.farmerName = { $regex: escRegex(filters.farmerName), $options: 'i' };
        }
        if (filters.origin) {
            query.origin = { $regex: escRegex(filters.origin), $options: 'i' };
        }
        if (filters.currentStage) {
            query.currentStage = filters.currentStage.toLowerCase();
        }
        if (filters.status) {
            query.status = filters.status;
        }

        return await Batch.find(query).sort({ createdAt: -1 }).limit(10).lean();
    }

    /**
     * Get the most recently created batch, optionally filtered by cropType
     * @param {string} [cropType] - Optional crop type filter
     * @returns {Object|null} - Latest batch or null
     */
    async getLatestBatch(cropType = null) {
        const query = {};
        if (cropType) {
            query.cropType = cropType.toLowerCase();
        }
        return await Batch.findOne(query).sort({ createdAt: -1 });
    }

    /**
     * Sync batch to blockchain using background job queue (BullMQ)
     * @param {Object} batch - Batch document
     * @param {string} action - 'create' or 'update'
     */
    async syncToBlockchain(batch, action) {
        if (!blockchainService.isAvailable()) {
            logger.warn(`[BatchService] Blockchain not available. Skipping queueing for ${batch.batchId}`);
            return;
        }

        try {
            if (action === 'create') {
                const batchData = {
                    batchId: batch.batchId,
                    cropType: batch.cropType,
                    ipfsCID: batch.blockchainHash || '',
                    quantity: batch.quantity,
                    farmerName: batch.farmerName,
                    origin: batch.origin,
                    description: batch.description || ''
                };
                
                await blockchainQueue.addCreateBatchJob(batchData);
                logger.info(`[BatchService] Queued createBatch job for ${batch.batchId}`);
            } else if (action === 'update') {
                const lastUpdate = batch.updates && batch.updates.length > 0 
                    ? batch.updates[batch.updates.length - 1] 
                    : {};
                
                const updateData = {
                    stage: batch.currentStage,
                    actor: lastUpdate.actor || '',
                    location: lastUpdate.location || '',
                    notes: lastUpdate.notes || ''
                };

                await blockchainQueue.addUpdateBatchJob(batch.batchId, updateData);
                logger.info(`[BatchService] Queued updateBatch job for ${batch.batchId}`);
            }
        } catch (error) {
            logger.error(`Failed to queue blockchain job for batch ${batch.batchId}:`, error.message);
        }
    }
}

// Export singleton instance
module.exports = new BatchService();

