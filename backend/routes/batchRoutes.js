const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const validateRequest = require('../middleware/validator');
const { createBatchSchema, updateBatchSchema } = require("../validations/batchSchema");
const { protect, adminOnly, authorizeBatchOwner, authorizeStageTransition, authorizeBlockchainTransaction, authorizeRoles } = require('../middleware/auth');
const { batchLimiter } = require('../middleware/rateLimiters');

// CREATE batch - requires farmer role and blockchain authorization
router.post('/', batchLimiter, protect, authorizeRoles('farmer'), validateRequest(createBatchSchema), async (req, res) => {
    try {
        const result = await batchService.createBatch(req.body, req.user);
        logger.info('Batch created', { batchId: result.batch.batchId, userId: req.user.id, email: req.user.email, ip: req.ip });
        notificationService.notifyBatchCreated(result.batch.batchId, req.user);

        const response = apiResponse.successResponse({ batch: result.batch }, 'Batch created successfully', 201);
        res.status(201).json(response);
    } catch (error) {
        if (error.code === 11000) {
            const response = apiResponse.errorResponse('Batch with this ID already exists', 'DUPLICATE_BATCH_ERROR', 409);
            return res.status(409).json(response);
        }
        notificationService.notifyError('batch creation', error);
        logger.error('Error creating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse('Failed to create batch', 'BATCH_CREATION_ERROR', 500);
        res.status(500).json(response);
    }
});

// GET one batch - requires authentication
router.get('/:batchId', batchLimiter, protect, async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await batchService.getBatch(batchId);

        if (!result.success) {
            logger.warn('Batch not found', { batchId, ip: req.ip });
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode).json(response);
        }

        const response = apiResponse.successResponse({ batch: result.batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch fetch', error);
        logger.error('Error fetching batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse('Failed to fetch batch', 'BATCH_FETCH_ERROR', 500);
        res.status(500).json(response);
    }
});

// GET batch journey PDF - requires authentication
router.get('/:batchId/pdf', batchLimiter, protect, async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await batchService.getBatch(batchId);

        if (!result.success) {
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode).json(response);
        }

        const pdfBuffer = await pdfService.generateBatchJourneyPDF(result.batch);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}-journey.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        notificationService.notifyError('batch pdf generation', error);
        logger.error('Error generating batch PDF', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse('Failed to generate batch PDF', 'PDF_GENERATION_ERROR', 500);
        res.status(500).json(response);
    }
});

// UPDATE batch - requires authentication, ownership, and stage transition authorization
router.put('/:batchId', batchLimiter, protect, authorizeBatchOwner, authorizeStageTransition, authorizeBlockchainTransaction, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;
        const result = await batchService.updateBatch(batchId, validatedData, req.user);

        if (!result.success) {
            const statusCode = result.statusCode || 500;
            const response = statusCode === 404
                ? apiResponse.notFoundResponse('Batch', `ID: ${batchId}`)
                : apiResponse.errorResponse(result.error, 'BATCH_UPDATE_ERROR', statusCode);
            return res.status(statusCode).json(response);
        }

        logger.info('Batch updated', { batchId, stage: validatedData.stage, actor: validatedData.actor, ip: req.ip });
        notificationService.notifyBatchUpdated(batchId, validatedData.stage, req.user);

        const response = apiResponse.successResponse({ batch: result.batch }, 'Batch updated successfully');
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch update', error);
        logger.error('Error updating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse('Failed to update batch', 'BATCH_UPDATE_ERROR', 500);
        res.status(500).json(response);
    }
});

// SECURED RECALL ENDPOINT
router.post('/:batchId/recall', batchLimiter, protect, adminOnly, async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await batchService.recallBatch(batchId, req.user);

        if (!result.success) {
            return res.status(result.statusCode).json({ error: result.error });
        }

        res.json({
            success: true,
            message: result.message,
            recalledBy: result.recalledBy,
            recalledAt: result.recalledAt,
            batch: result.batch
        });
    } catch (error) {
        notificationService.notifyError('batch recall', error);
        logger.error('Error recalling batch', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Failed to recall batch' });
    }
});

module.exports = router;
