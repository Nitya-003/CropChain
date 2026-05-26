const Batch = require('../models/Batch');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');
const apiResponse = require('../utils/apiResponse');
const { isAdminRole } = require('../constants/permissions');

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

        console.log(`[SUCCESS] Batch created: ${batchId} by user ${req.user.id} (${req.user.email}) from IP: ${req.ip}`);

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

        console.error('Error creating batch:', error);
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
            console.log(`[NOT FOUND] Batch lookup failed: ${batchId} from IP: ${req.ip}`);
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(404).json(response);
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Recalled batch viewed:", batchId);
        }

        const response = apiResponse.successResponse({ batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        console.error('Error fetching batch:', error);
        const response = apiResponse.errorResponse(
            'Failed to fetch batch',
            'BATCH_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
};

/**
 * Get all batches with filtering, pagination, and sorting
 * @route GET /api/batches
 * @access Public
 */
exports.getAllBatches = exports.getBatches; // Alias for consistency

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

        console.log(`[UPDATE] Batch ${batchId} updated to stage ${normalizedStage} by user ${req.user.id}`);

        const response = apiResponse.successResponse(
            { batch },
            'Batch updated successfully'
        );
        res.json(response);
    } catch (error) {
        console.error('Error updating batch:', error);
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

        console.log(`🚨 RECALL by admin ${req.user?.email || 'unknown'} for batch ${batchId}`);

        res.json({
            success: true,
            message: 'Batch recalled successfully',
            recalledBy: req.user?.email,
            recalledAt: new Date().toISOString(),
            batch
        });
    } catch (error) {
        console.error('Error recalling batch:', error);
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
            batchId,
            farmerName,
            cropType,
            status,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

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

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const sort = {};
        sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        // Use lean() for read-only queries to skip Mongoose document hydration
        const batches = await Batch.find(query)
            .lean()
            .sort(sort)
            .skip(skip)
            .limit(limitNumber);

        const totalItems = await Batch.countDocuments(query);

        res.json({
            batches,
            pagination: {
                totalItems,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalItems / limitNumber),
                limit: limitNumber
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

/**
 * Update the status of a batch (Active/Flagged/Inactive)
 * Only accessible by admin users
 * @route PATCH /api/batch/:batchId/status
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
        
        console.log(`[ADMIN ACTION] User ${req.user.email} (${req.user.role}) changed status of batch ${batchId} to ${status}`);
        
        res.json(batch);
    } catch (err) {
        console.error('Error updating batch status:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};