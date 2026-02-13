const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const apiResponse = require("../utils/apiResponse");

router.get('/status', (req, res) => {
    const state = mongoose.connection.readyState;

    const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    }

    const response = apiResponse.successResponse(
        {
            status: "online",
            database: stateMap[state] || "unknown",
            timestamp: new Date().toISOString()
        },
        'Server is running',
        200
    );
    res.json(response);
});



module.exports = router;
