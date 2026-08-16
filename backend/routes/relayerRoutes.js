const express = require("express");
const router = express.Router();
const relayerService = require("../services/relayerService");
const apiResponse = require("../utils/apiResponse");

/**
 * @route GET /api/relayer/nonce/:address
 * @desc Get the nonce for a user's address to sign a meta-transaction
 */
router.get("/nonce/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const nonce = await relayerService.getNonce(address);
    res.json(apiResponse.success("Nonce retrieved successfully", { nonce }));
  } catch (error) {
    res.status(500).json(apiResponse.error(error.message));
  }
});

/**
 * @route POST /api/relayer/forward
 * @desc Relay a meta-transaction
 */
router.post("/forward", async (req, res) => {
  try {
    const { request, signature } = req.body;
    
    if (!request || !signature) {
      return res.status(400).json(apiResponse.error("Request and signature are required"));
    }

    const receipt = await relayerService.relayTransaction(request, signature);
    
    res.json(apiResponse.success("Transaction relayed successfully", {
      transactionHash: receipt.hash || receipt.transactionHash,
      receipt
    }));
  } catch (error) {
    res.status(500).json(apiResponse.error(error.message));
  }
});

module.exports = router;
