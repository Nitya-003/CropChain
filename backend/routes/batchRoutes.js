const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const batchController = require('../controllers/batchController');
const { protect, adminOnly, authorizeBatchOwner, authorizeStageTransition, authorizeBlockchainTransaction, authorizeRoles } = require('../middleware/auth');
const { batchLimiter } = require('../middleware/rateLimiters');

// CREATE batch - requires farmer role and blockchain authorization
router.post('/', batchLimiter, protect, authorizeRoles('farmer'), batchController.createBatch);

// GET public batch tracking data - no authentication required
router.get('/public/:batchId', batchLimiter, async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await batchService.getPublicBatch(batchId);

        if (!result.success) {
            if (result.statusCode === 404) {
                logger.warn('Public batch not found', { batchId, ip: req.ip });
                const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
                return res.status(404).json(response);
            }

            const response = apiResponse.errorResponse(result.error, 'INVALID_BATCH_ID', result.statusCode || 400);
            return res.status(response.statusCode).json(response);
        }

        const response = apiResponse.successResponse({ batch: result.batch }, 'Public batch tracking data retrieved successfully');
        res.json(response);
    } catch (error) {
        notificationService.notifyError('public batch tracking fetch', error);
        logger.error('Error fetching public batch tracking data', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse('Failed to fetch public batch tracking data', 'PUBLIC_BATCH_FETCH_ERROR', 500);
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
router.put('/:batchId', batchLimiter, protect, authorizeBatchOwner, authorizeStageTransition, authorizeBlockchainTransaction, batchController.updateBatch);

// SECURED RECALL ENDPOINT
router.post('/:batchId/recall', batchLimiter, protect, adminOnly, batchController.recallBatch);

module.exports = router;

