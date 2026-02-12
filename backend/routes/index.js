
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { updateBatchStatus } = require("../controllers/batchController");
const { protect, adminOnly } = require("../middleware/auth");

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

// Update batch status (admin only)
router.patch('/batch/:batchId/status', protect, adminOnly, updateBatchStatus);



module.exports = router;
