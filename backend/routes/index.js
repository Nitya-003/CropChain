const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

router.get('status', (req, res) => {
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



module.exports = router;
