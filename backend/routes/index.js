const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { updateBatchStatus, getBatches, exportBatch, recordIoTData, getIoTData } = require("../controllers/batchController");
const { protect, adminOnly } = require("../middleware/auth");
const { batchLimiter, iotLimiter } = require("../middleware/rateLimiters");

router.get('/status', (req, res) => {
    const state = mongoose.connection.readyState;

    const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    }


    res.json({
        status: "online",
        database: stateMap[state] || "unknown",
        timestamp: new Date().toISOString()
    })
});

router.get('/batches', batchLimiter, protect, getBatches);
router.get('/batches/:batchId/export', batchLimiter, protect, exportBatch);

// Update batch status (admin only)
router.patch('/batches/:batchId/status', batchLimiter, protect, adminOnly, updateBatchStatus);

// IoT sensor data
router.post('/batches/:batchId/iot', iotLimiter, protect, recordIoTData);
router.get('/batches/:batchId/iot', iotLimiter, protect, getIoTData);
router.get('/batches/:batchId/iot/history', iotLimiter, protect, getIoTData);

module.exports = router;