const express = require('express');
const router = express.Router();
const oracleService = require('../services/oracleService');
const { protect, authorizeRoles } = require('../middleware/auth');
const apiResponse = require('../utils/apiResponse');

/**
 * Get oracle service status
 * GET /api/oracle/status
 */
router.get('/status', (req, res) => {
    try {
        const status = oracleService.getStatus();
        
        const response = apiResponse.successResponse({
            oracle: {
                isListening: status.isListening,
                oracleAddress: status.oracleAddress,
                contractAddress: status.contractAddress,
                pendingRequests: status.pendingRequests,
                providerConnected: status.providerConnected
            },
            timestamp: new Date().toISOString()
        }, 'Oracle status retrieved successfully');
        
        res.json(response);
        
    } catch (error) {
        console.error('Error getting oracle status:', error);
        const response = apiResponse.errorResponse(
            'Failed to get oracle status',
            'ORACLE_STATUS_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

/**
 * Get IoT data for a specific batch
 * GET /api/oracle/batch/:batchId/iot-data
 */
router.get('/batch/:batchId/iot-data', protect, async (req, res) => {
    try {
        const { batchId } = req.params;
        
        if (!batchId) {
            const response = apiResponse.errorResponse(
                'Batch ID is required',
                'MISSING_BATCH_ID',
                400
            );
            return res.status(400).json(response);
        }
        
        const iotData = await oracleService.getBatchIoTData(batchId);
        
        if (!iotData.exists) {
            const response = apiResponse.errorResponse(
                'Batch not found',
                'BATCH_NOT_FOUND',
                404
            );
            return res.status(404).json(response);
        }
        
        const response = apiResponse.successResponse({
            batch: {
                batchId: iotData.batchId,
                temperature: iotData.temperature,
                humidity: iotData.humidity,
                isSpoiled: iotData.isSpoiled,
                lastUpdated: new Date().toISOString()
            }
        }, 'IoT data retrieved successfully');
        
        res.json(response);
        
    } catch (error) {
        console.error(`Error getting IoT data for batch ${req.params.batchId}:`, error);
        const response = apiResponse.errorResponse(
            'Failed to retrieve IoT data',
            'IOT_DATA_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

/**
 * Get oracle statistics
 * GET /api/oracle/stats
 * Admin only
 */
router.get('/stats', protect, authorizeRoles('admin'), async (req, res) => {
    try {
        const status = oracleService.getStatus();
        
        // Calculate uptime (simplified - in production, store start time)
        const uptimeHours = process.uptime() / 3600;
        
        const response = apiResponse.successResponse({
            oracle: {
                ...status,
                uptimeHours: Math.round(uptimeHours * 100) / 100,
                version: '1.0.0'
            },
            performance: {
                averageResponseTime: '2.3s', // Mock data
                successRate: '99.8%', // Mock data
                totalProcessed: 1247 // Mock data
            }
        }, 'Oracle statistics retrieved successfully');
        
        res.json(response);
        
    } catch (error) {
        console.error('Error getting oracle stats:', error);
        const response = apiResponse.errorResponse(
            'Failed to retrieve oracle statistics',
            'ORACLE_STATS_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

/**
 * Health check for oracle service
 * GET /api/oracle/health
 */
router.get('/health', (req, res) => {
    try {
        const status = oracleService.getStatus();
        
        const isHealthy = status.isListening && status.providerConnected;
        
        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            oracle: {
                isListening: status.isListening,
                providerConnected: status.providerConnected,
                pendingRequests: status.pendingRequests
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
