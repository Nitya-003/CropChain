/**
 * Multi-Signature Approval Routes
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly, inspectorOnly, requirePermissions } = require('../middleware/auth');
const { PERMISSIONS, ROLES, isAdminRole } = require('../constants/permissions');
const MultisigService = require('../services/multisigService');
const Joi = require('joi');
const logger = require('../utils/logger');
const activityService = require('../services/activityService');

const createApprovalSchema = Joi.object({
    batchId: Joi.string().required(),
    actionType: Joi.string().valid('batch_recall', 'batch_contaminated', 'batch_destroy', 'batch_quality_check').required(),
    justification: Joi.string().min(20).max(2000).required(),
    evidence: Joi.array().items(Joi.object({
        type: Joi.string().valid('image', 'document', 'lab_report', 'video', 'other'),
        cid: Joi.string(),
        hash: Joi.string(),
        description: Joi.string().max(500)
    })).max(10)
});

const addSignatureSchema = Joi.object({
    decision: Joi.string().valid('approved', 'rejected').required(),
    reason: Joi.string().max(1000)
});

// Create approval request
router.post('/', protect, requirePermissions(PERMISSIONS.BATCH_RECALL, PERMISSIONS.BATCH_CONTAMINATED, PERMISSIONS.BATCH_DESTROY), async (req, res) => {
    try {
        const { error, value } = createApprovalSchema.validate(req.body);
        if (error) return res.status(400).json({ error: 'Validation error', details: error.details[0].message });
        const result = await MultisigService.createApprovalRequest({ ...value, initiatedBy: req.user._id });
        logger.info(`[APPROVAL] Created request ${result.requestId} by ${req.user.email}`);

        await activityService.logActivity({
            userId: req.user._id || req.user.id,
            userRole: req.user.role,
            eventType: 'batch_verified',
            batchId: value.batchId,
            description: `Verification request initiated: ${value.actionType} for batch ${value.batchId}`,
            metadata: {
                actionType: value.actionType,
                requestId: result.requestId,
                justification: value.justification
            }
        });

        res.status(201).json({ success: true, message: 'Approval request created successfully', data: result });
    } catch (error) {
        logger.error('[APPROVAL] Create error:', error);
        res.status(400).json({ error: 'Failed to create approval request', message: error.message });
    }
});

// Get pending approvals
router.get('/', protect, requirePermissions(PERMISSIONS.BATCH_VIEW_ALL), async (req, res) => {
    try {
        const { batchId, actionType } = req.query;
        const filters = {};
        if (batchId) filters.batchId = batchId;
        if (actionType) filters.actionType = actionType;
        const requests = await MultisigService.getPendingRequests(filters);
        res.json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        logger.error('[APPROVAL] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch approval requests', message: error.message });
    }
});

// Get requests needing current user's signature
router.get('/pending', protect, inspectorOnly, async (req, res) => {
    try {
        const requests = await MultisigService.getRequestsNeedingSignature(req.user._id);
        res.json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        logger.error('[APPROVAL] Fetch pending error:', error);
        res.status(500).json({ error: 'Failed to fetch pending approvals', message: error.message });
    }
});

// Get approval request details
router.get('/:requestId', protect, async (req, res) => {
    try {
        const approval = await MultisigService.getRequestDetails(req.params.requestId);
        const isInitiator = approval.initiatedBy._id.toString() === req.user._id.toString();
        const isAdmin = isAdminRole(req.user.role);
        const isInspector = req.user.role === ROLES.QUALITY_INSPECTOR;
        if (!isInitiator && !isAdmin && !isInspector) {
            return res.status(403).json({ error: 'Access denied', message: 'Not authorized to view this approval request' });
        }
        res.json({ success: true, data: approval });
    } catch (error) {
        logger.error('[APPROVAL] Fetch detail error:', error);
        res.status(404).json({ error: 'Not found', message: error.message });
    }
});

// Add signature
router.post('/:requestId/sign', protect, inspectorOnly, async (req, res) => {
    try {
        const { error, value } = addSignatureSchema.validate(req.body);
        if (error) return res.status(400).json({ error: 'Validation error', details: error.details[0].message });
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // Fetch request details first to get the batchId
        const approval = await MultisigService.getRequestDetails(req.params.requestId);
        
        const result = await MultisigService.addSignature(req.params.requestId, req.user, value.decision, value.reason || '', ipAddress);
        logger.info(`[APPROVAL] Signature added to ${req.params.requestId} by ${req.user.email}: ${value.decision}`);
        
        await activityService.logActivity({
            userId: req.user._id || req.user.id,
            userRole: req.user.role,
            eventType: 'batch_verified',
            batchId: approval.batchId,
            description: `Verification signed (${value.decision}) by inspector for batch ${approval.batchId}`,
            metadata: {
                requestId: req.params.requestId,
                decision: value.decision,
                reason: value.reason,
                status: result.status
            }
        });

        res.json({
            success: true,
            message: result.status === 'approved' ? 'Action has been approved and executed' : `Signature recorded. ${result.approvalCount}/${result.requiredApprovals} approvals`,
            data: result
        });
    } catch (error) {
        logger.error('[APPROVAL] Sign error:', error);
        res.status(400).json({ error: 'Failed to add signature', message: error.message });
    }
});

// Cancel approval request
router.post('/:requestId/cancel', protect, async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await MultisigService.cancelRequest(req.params.requestId, req.user._id, reason || 'Cancelled by user');
        logger.info(`[APPROVAL] Cancelled ${req.params.requestId} by ${req.user.email}`);
        res.json({ success: true, message: 'Approval request cancelled', data: result });
    } catch (error) {
        logger.error('[APPROVAL] Cancel error:', error);
        res.status(400).json({ error: 'Failed to cancel approval request', message: error.message });
    }
});

// Get batch approval history
router.get('/batch/:batchId', protect, async (req, res) => {
    try {
        const history = await MultisigService.getBatchApprovalHistory(req.params.batchId);
        res.json({ success: true, count: history.length, data: history });
    } catch (error) {
        logger.error('[APPROVAL] History error:', error);
        res.status(500).json({ error: 'Failed to fetch approval history', message: error.message });
    }
});

// Get statistics
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const stats = await MultisigService.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        logger.error('[APPROVAL] Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics', message: error.message });
    }
});

// Request batch recall
router.post('/recall/:batchId', protect, requirePermissions(PERMISSIONS.BATCH_RECALL), async (req, res) => {
    try {
        const { justification, evidence } = req.body;
        if (!justification || justification.length < 20) return res.status(400).json({ error: 'Validation error', message: 'Justification must be at least 20 characters' });
        const result = await MultisigService.createApprovalRequest({
            batchId: req.params.batchId, actionType: 'batch_recall', initiatedBy: req.user._id, justification, evidence: evidence || []
        });
        res.status(201).json({ success: true, message: 'Recall approval request created. Waiting for inspector approvals.', data: result });
    } catch (error) {
        logger.error('[RECALL] Request error:', error);
        res.status(400).json({ error: 'Failed to create recall request', message: error.message });
    }
});

// Request contamination marking
router.post('/contaminate/:batchId', protect, requirePermissions(PERMISSIONS.BATCH_CONTAMINATED), async (req, res) => {
    try {
        const { justification, evidence } = req.body;
        if (!justification || justification.length < 20) return res.status(400).json({ error: 'Validation error', message: 'Justification must be at least 20 characters' });
        const result = await MultisigService.createApprovalRequest({
            batchId: req.params.batchId, actionType: 'batch_contaminated', initiatedBy: req.user._id, justification, evidence: evidence || []
        });
        res.status(201).json({ success: true, message: 'Contamination approval request created. Waiting for inspector approvals.', data: result });
    } catch (error) {
        logger.error('[CONTAMINATION] Request error:', error);
        res.status(400).json({ error: 'Failed to create contamination request', message: error.message });
    }
});

// Request destruction authorization
router.post('/destroy/:batchId', protect, requirePermissions(PERMISSIONS.BATCH_DESTROY), async (req, res) => {
    try {
        const { justification, evidence } = req.body;
        if (!justification || justification.length < 20) return res.status(400).json({ error: 'Validation error', message: 'Justification must be at least 20 characters' });
        const result = await MultisigService.createApprovalRequest({
            batchId: req.params.batchId, actionType: 'batch_destroy', initiatedBy: req.user._id, justification, evidence: evidence || []
        });
        res.status(201).json({ success: true, message: 'Destruction authorization request created. Waiting for inspector approvals.', data: result });
    } catch (error) {
        logger.error('[DESTROY] Request error:', error);
        res.status(400).json({ error: 'Failed to create destruction request', message: error.message });
    }
});

// Request quality check
router.post('/quality-check/:batchId', protect, requirePermissions(PERMISSIONS.BATCH_QUALITY_CHECK), async (req, res) => {
    try {
        const { justification, evidence } = req.body;
        if (!justification || justification.length < 20) return res.status(400).json({ error: 'Validation error', message: 'Justification must be at least 20 characters' });
        const result = await MultisigService.createApprovalRequest({
            batchId: req.params.batchId, actionType: 'batch_quality_check', initiatedBy: req.user._id, justification, evidence: evidence || []
        });
        res.status(201).json({ success: true, message: 'Quality check approval request created. Waiting for inspector approvals.', data: result });
    } catch (error) {
        logger.error('[QUALITY_CHECK] Request error:', error);
        res.status(400).json({ error: 'Failed to create quality check request', message: error.message });
    }
});

module.exports = router;

