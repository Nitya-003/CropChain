const Batch = require('../models/Batch');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');
const apiResponse = require('../utils/apiResponse');
const { isAdminRole } = require('../constants/permissions');
const STAGES = require('../constants/stages');
const logger = require('../utils/logger');
const { emitToBatchRoom } = require('../services/socketService');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSafeSearchFilter = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return null;
    }

    return { $regex: escapeRegex(trimmedValue), $options: 'i' };
};

/**
 * Generate a unique batch ID using MongoDB counter
 */
const generateBatchId = async (session) => {
    const counter = await Counter.findOneAndUpdate(
        { name: 'batchId' },
        { $inc: { seq: 1 } },
        { new: true, session, upsert: true }
    );
    return `BATCH${counter.seq.toString().padStart(6, '0')}`;
};

/**
 * Generate QR code data for a batch
 */
const generateQRCode = async (batchId) => {
    // In production, this would generate actual QR code
    // For now, return the batch ID as data URI placeholder
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="20">${batchId}</text></svg>`;
};

/**
 * Create a new batch
 * @route POST /api/batches
 * @access Private (Farmer only)
 */
exports.createBatch = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const validatedData = req.body;

        // Generate batch ID within transaction for atomicity
        const batchId = await generateBatchId(session);
        const qrCode = await generateQRCode(batchId);

        const batch = await Batch.create([{
            batchId,
            farmerId: req.user.farmerId || req.user.id,
            farmerName: validatedData.farmerName || req.user.name,
            farmerWalletAddress: (req.user.walletAddress || '').toLowerCase(),
            farmerAddress: validatedData.farmerAddress || req.user.address || '',
            cropType: validatedData.cropType,
            quantity: validatedData.quantity,
            harvestDate: validatedData.harvestDate,
            origin: validatedData.origin,
            certifications: validatedData.certifications,
            description: validatedData.description,
            currentStage: "farmer",
            isRecalled: false,
            qrCode,
            blockchainHash: simulateBlockchainHash(validatedData),
            syncStatus: 'pending',
            crossChain: {
                status: 'not_required'
            },
            updates: [{
                stage: "farmer",
                actor: validatedData.farmerName || req.user.name,
                location: validatedData.origin,
                timestamp: validatedData.harvestDate,
                notes: validatedData.description || "Initial harvest recorded"
            }]
        }], { session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        logger.info('Batch created', { batchId, userId: req.user.id, ip: req.ip });

        const response = apiResponse.successResponse(
            { batch: batch[0] },
            'Batch created successfully',
            201
        );
        res.status(201).json(response);
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();

        logger.error('Error creating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to create batch',
            'BATCH_CREATION_ERROR',
            500
        );
        res.status(500).json(response);
    }
};

/**
 * Get a single batch by batchId
 * @route GET /api/batches/:batchId
 * @access Public
 */
exports.getBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findOne({ batchId }).lean();

        if (!batch) {
            logger.warn('Batch not found', { batchId, ip: req.ip });
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(404).json(response);
        }

        if (batch.isRecalled) {
            logger.warn('Recalled batch viewed', { batchId, ip: req.ip });
        }

        // Flatten iotData to top-level for frontend compatibility
        if (batch.iotData) {
            batch.currentTemperature = batch.iotData.currentTemperature ?? null;
            batch.currentHumidity = batch.iotData.currentHumidity ?? null;
            batch.isSpoiled = batch.iotData.isSpoiled ?? false;
            batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
            delete batch.iotData;
        }

        const response = apiResponse.successResponse({ batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        logger.error('Error fetching batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to fetch batch',
            'BATCH_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
};

/**
 * Update a batch
 * @route PUT /api/batches/:batchId
 * @access Private (Batch owner + stage transition authorized)
 */
exports.updateBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        // Normalize stage to lowercase for consistency
        const normalizedStage = validatedData.stage.toLowerCase();

        const batch = await Batch.findOne({ batchId });

        if (!batch) {
            return res.status(404).json(
                apiResponse.notFoundResponse('Batch', `ID: ${batchId}`)
            );
        }

        // Update batch fields
        batch.currentStage = normalizedStage;
        
        // Add update entry
        batch.updates.push({
            stage: normalizedStage,
            actor: validatedData.actorName || req.user.name,
            location: validatedData.location,
            timestamp: validatedData.timestamp || new Date().toISOString(),
            notes: validatedData.notes
        });

        // Update additional fields if provided
        if (validatedData.quantity) batch.quantity = validatedData.quantity;
        if (validatedData.ipfsCID) batch.ipfsCID = validatedData.ipfsCID;
        if (validatedData.blockchainHash) batch.blockchainHash = validatedData.blockchainHash;

        await batch.save();

        logger.info('Batch updated', { batchId, stage: normalizedStage, userId: req.user.id });

        const response = apiResponse.successResponse(
            { batch },
            'Batch updated successfully'
        );
        res.json(response);
    } catch (error) {
        logger.error('Error updating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to update batch',
            'BATCH_UPDATE_ERROR',
            500
        );
        res.status(500).json(response);
    }
};

/**
 * Recall a batch (admin only)
 * @route POST /api/batches/:batchId/recall
 * @access Private (Admin only)
 */
exports.recallBatch = async (req, res) => {
    try {
        const { batchId } = req.params;

        const batch = await Batch.findOne({ batchId });

        if (!batch) {
            return res.status(404).json(
                apiResponse.notFoundResponse('Batch', `ID: ${batchId}`)
            );
        }

        if (batch.isRecalled) {
            return res.status(400).json(
                apiResponse.errorResponse('Batch already recalled', 'BATCH_ALREADY_RECALLED', 400)
            );
        }

        if (!req.user || !isAdminRole(req.user.role)) {
            return res.status(403).json(
                apiResponse.errorResponse(
                    'Access denied. Admin privileges required.',
                    'FORBIDDEN',
                    403
                )
            );
        }

        batch.isRecalled = true;
        await batch.save();

        logger.warn('Batch recalled', { batchId, adminId: req.user?.id, ip: req.ip });

        res.json({
            success: true,
            message: 'Batch recalled successfully',
            recalledBy: req.user?.email,
            recalledAt: new Date().toISOString(),
            batch
        });
    } catch (error) {
        logger.error('Error recalling batch', { error: error.message, stack: error.stack });
        res.status(500).json(
            apiResponse.errorResponse('Failed to recall batch', 'BATCH_RECALL_ERROR', 500)
        );
    }
};

// Helper function to simulate blockchain hash (replace with actual blockchain integration)
const simulateBlockchainHash = (data) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
        .update(JSON.stringify(data) + Date.now())
        .digest('hex');
};

exports.getBatches = async (req, res) => {
    try {
        const {
            search,
            batchId,
            farmerName,
            cropType,
            status,
            currentStage,
            stage,
            startDate,
            endDate,
            dateFrom,
            dateTo,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        // 1. Unified Search parameter (regex matches on batchId, cropType, farmerName)
        if (search) {
            const escaped = escapeRegex(search.trim());
            query.$or = [
                { batchId: { $regex: escaped, $options: 'i' } },
                { cropType: { $regex: escaped, $options: 'i' } },
                { farmerName: { $regex: escaped, $options: 'i' } },
            ];
        }

        // 2. Individual parameters (from existing & test requirements)
        const batchIdFilter = buildSafeSearchFilter(batchId);
        if (batchIdFilter) {
            query.batchId = batchIdFilter;
        }
        const farmerNameFilter = buildSafeSearchFilter(farmerName);
        if (farmerNameFilter) {
            query.farmerName = farmerNameFilter;
        }
        const cropTypeFilter = buildSafeSearchFilter(cropType);
        if (cropTypeFilter) {
            query.cropType = cropTypeFilter;
        }
        
        if (status) {
            query.status = status;
        }

        // Handle both 'currentStage' (existing) and 'stage' (new)
        const targetStage = currentStage || stage;
        if (targetStage) {
            const normalizedStage = targetStage.toLowerCase();
            if (STAGES.includes(normalizedStage)) {
                query.currentStage = normalizedStage;
            }
        }

        // Handle date range (both startDate/endDate and dateFrom/dateTo)
        const start = startDate || dateFrom;
        const end = endDate || dateTo;
        if (start || end) {
            query.createdAt = {};
            if (start) {
                query.createdAt.$gte = new Date(start);
            }
            if (end) {
                query.createdAt.$lte = new Date(end);
            }
        }

        const MAX_LIMIT = 100;
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), MAX_LIMIT);
        const skip = (pageNumber - 1) * limitNumber;

        const sort = {};
        sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        // Use lean() for read-only queries to skip Mongoose document hydration
        const batches = await Batch.find(query)
            .lean()
            .sort(sort)
            .skip(skip)
            .limit(limitNumber);

        // Flatten iotData to top-level for frontend compatibility
        for (const batch of batches) {
            if (batch.iotData) {
                batch.currentTemperature = batch.iotData.currentTemperature ?? null;
                batch.currentHumidity = batch.iotData.currentHumidity ?? null;
                batch.isSpoiled = batch.iotData.isSpoiled ?? false;
                batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
                delete batch.iotData;
            }
        }

        const totalItems = await Batch.countDocuments(query);

        // Fetch slim batch data for calculating statistics
        const allMatchingBatches = await Batch.find(query).select('farmerName quantity').lean();
        const totalFarmers = new Set(allMatchingBatches.map(b => b.farmerName)).size;
        const totalQuantity = allMatchingBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);

        res.json(apiResponse.successResponse({
            batches,
            stats: {
                totalBatches: totalItems,
                totalFarmers,
                totalQuantity,
                recentBatches: batches.slice(0, 5)
            },
            pagination: {
                totalItems,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalItems / limitNumber),
                limit: limitNumber
            }
        }, 'Batches retrieved successfully'));
    } catch (err) {
        res.status(500).json(apiResponse.errorResponse('Failed to fetch batches', 'FETCH_ERROR', 500, err.message));
    }
};

/**
 * Get all batches with filtering, pagination, and sorting
 * @route GET /api/batches
 * @access Public
 */
exports.getAllBatches = exports.getBatches; // Alias for consistency

/**
 * Update the status of a batch (Active/Flagged/Inactive)
 * Only accessible by admin users
 * @route PATCH /api/batches/:batchId/status
 * @access Private (Admin only)
 */
exports.updateBatchStatus = async (req, res) => {
    try {
        // CRITICAL: Check if user has admin role
        if (!req.user || !isAdminRole(req.user.role)) {
            return res.status(403).json(
                apiResponse.errorResponse(
                    'Access denied. Admin privileges required.',
                    'FORBIDDEN',
                    403
                )
            );
        }

        const { batchId } = req.params;
        const { status } = req.body;
        const allowedStatuses = ['Active', 'Flagged', 'Inactive'];
        
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status', allowed: allowedStatuses });
        }
        
        const batch = await Batch.findOneAndUpdate(
            { batchId },
            { $set: { status } },
            { new: true }
        );
        
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        
        logger.info('Batch status changed', { batchId, status, userId: req.user.id, role: req.user.role });

        emitToBatchRoom(batchId, 'batch:statusChanged', {
          batchId,
          status,
          updatedBy: req.user.email || req.user.name,
          timestamp: new Date().toISOString()
        });

        res.json(batch);
    } catch (err) {
        logger.error('Error updating batch status', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

exports.exportBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { format = 'pdf' } = req.query;

        const batch = await Batch.findOne({ batchId }).lean();
        if (!batch) {
            return res.status(404).json(
                apiResponse.errorResponse('Batch not found', 'BATCH_NOT_FOUND', 404)
            );
        }

        if (batch.iotData) {
            batch.currentTemperature = batch.iotData.currentTemperature ?? null;
            batch.currentHumidity = batch.iotData.currentHumidity ?? null;
            batch.isSpoiled = batch.iotData.isSpoiled ?? false;
            batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
            delete batch.iotData;
        }

        if (format === 'csv') {
            const csvData = [
                'Field,Value',
                `Batch ID,${batch.batchId}`,
                `Crop Type,${batch.cropType}`,
                `Quantity,${batch.quantity} kg`,
                `Harvest Date,${batch.harvestDate || 'N/A'}`,
                `Origin,${batch.origin}`,
                `Farmer,${batch.farmerName}`,
                `Current Stage,${batch.currentStage}`,
                `Status,${batch.isSpoiled ? 'Spoiled' : 'Active'}`,
            ];

            if (batch.updates?.length) {
                csvData.push('');
                csvData.push('Timeline');
                csvData.push('Stage,Actor,Location,Date,Notes');
                batch.updates.forEach(u => {
                    const stage = (u.stage || '').replace(/"/g, '""');
                    const actor = (u.actor || '').replace(/"/g, '""');
                    const location = (u.location || '').replace(/"/g, '""');
                    const timestamp = (u.timestamp || '').replace(/"/g, '""');
                    const notes = (u.notes || '').replace(/"/g, '""');
                    csvData.push(`"${stage}","${actor}","${location}","${timestamp}","${notes}"`);
                });
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}.csv"`);
            return res.send(csvData.join('\n'));
        }

        // PDF export
        const pdfService = require('../services/pdfService');
        const pdfBuffer = await pdfService.generateBatchJourneyPDF(batch);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}-journey.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Export failed:', error);
        return res.status(500).json(
            apiResponse.errorResponse('Export failed', 'EXPORT_ERROR', 500)
        );
    }
};

const spoilageDetectionService = require('../services/spoilageDetectionService');

/**
 * Record IoT sensor data for a batch
 * @route POST /api/batches/:batchId/iot
 */
exports.recordIoTData = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { temperature, humidity } = req.body;

        if (temperature == null) {
            return res.status(400).json(
                apiResponse.errorResponse('Temperature is required', 'MISSING_TEMPERATURE', 400)
            );
        }
        if (humidity == null) {
            return res.status(400).json(
                apiResponse.errorResponse('Humidity is required', 'MISSING_HUMIDITY', 400)
            );
        }

        if (typeof temperature !== 'number' || temperature < -20 || temperature > 140) {
            return res.status(400).json(
                apiResponse.errorResponse('Temperature must be a number between -20 and 140', 'INVALID_TEMPERATURE', 400)
            );
        }

        if (typeof humidity !== 'number' || humidity < 0 || humidity > 100) {
            return res.status(400).json(
                apiResponse.errorResponse('Humidity must be a number between 0 and 100', 'INVALID_HUMIDITY', 400)
            );
        }

        const batch = await spoilageDetectionService.recordIoTData(batchId, temperature, humidity);

        res.json(
            apiResponse.successResponse({
                batchId: batch.batchId,
                currentTemperature: batch.iotData.currentTemperature,
                currentHumidity: batch.iotData.currentHumidity,
                isSpoiled: batch.iotData.isSpoiled,
                lastUpdated: batch.iotData.lastUpdated,
            }, 'IoT data recorded successfully')
        );
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json(
                apiResponse.errorResponse('Batch not found', 'BATCH_NOT_FOUND', 404)
            );
        }
        console.error('Error recording IoT data:', error);
        res.status(500).json(
            apiResponse.errorResponse('Failed to record IoT data', 'IOT_RECORD_ERROR', 500)
        );
    }
};

/**
 * Get IoT sensor data for a batch
 * @route GET /api/batches/:batchId/iot
 */
exports.getIoTData = async (req, res) => {
    try {
        const { batchId } = req.params;

        if (!batchId) {
            return res.status(400).json(
                apiResponse.errorResponse('Batch ID is required', 'MISSING_BATCH_ID', 400)
            );
        }

        const data = await spoilageDetectionService.getIoTData(batchId);

        res.json(
            apiResponse.successResponse(data, 'IoT data retrieved successfully')
        );
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json(
                apiResponse.errorResponse('Batch not found', 'BATCH_NOT_FOUND', 404)
            );
        }
        console.error('Error getting IoT data:', error);
        res.status(500).json(
            apiResponse.errorResponse('Failed to retrieve IoT data', 'IOT_DATA_ERROR', 500)
        );
    }
};