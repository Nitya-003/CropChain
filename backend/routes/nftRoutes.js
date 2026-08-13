const express = require("express");
const router = express.Router();
const nftController = require("../controllers/nftController");
const { protect, authorizeBlockchainTransaction } = require("../middleware/auth");
const { batchLimiter } = require("../middleware/rateLimiters");

// Public route to view dNFT details for a crop batch
router.get("/:batchId", batchLimiter, nftController.getNFT);

// Protected routes to mint & update dNFT metadata
router.post("/mint", batchLimiter, protect, authorizeBlockchainTransaction, nftController.mintNFT);
router.patch(
  "/:batchId/metadata",
  batchLimiter,
  protect,
  authorizeBlockchainTransaction,
  nftController.updateNFTMetadata,
);

module.exports = router;
