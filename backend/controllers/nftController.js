const nftService = require("../services/nftService");
const apiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");

/**
 * Mint dNFT for a batch
 * @route POST /api/nft/mint
 */
exports.mintNFT = async (req, res) => {
  try {
    const { batchId, recipientAddress } = req.body;
    if (!batchId) {
      return res
        .status(400)
        .json(apiResponse.errorResponse("batchId is required", "MISSING_BATCH_ID", 400));
    }

    const result = await nftService.mintBatchNFT(batchId, recipientAddress);
    return res.status(201).json(apiResponse.successResponse(result, result.message));
  } catch (error) {
    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(apiResponse.errorResponse("Batch not found", "BATCH_NOT_FOUND", 404));
    }
    logger.error("Error minting dNFT:", { error: error.message, stack: error.stack });
    return res
      .status(500)
      .json(apiResponse.errorResponse("Failed to mint dynamic NFT", "NFT_MINT_ERROR", 500));
  }
};

/**
 * Update metadata & stage for a dynamic NFT
 * @route PATCH /api/nft/:batchId/metadata
 */
exports.updateNFTMetadata = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { stage, actorName } = req.body;

    if (stage === undefined || stage === null) {
      return res
        .status(400)
        .json(apiResponse.errorResponse("stage is required", "MISSING_STAGE", 400));
    }

    const result = await nftService.updateNFTMetadata(batchId, Number(stage), actorName);
    return res.json(apiResponse.successResponse(result, result.message));
  } catch (error) {
    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(apiResponse.errorResponse("Batch not found", "BATCH_NOT_FOUND", 404));
    }
    logger.error("Error updating dNFT metadata:", { error: error.message, stack: error.stack });
    return res
      .status(500)
      .json(apiResponse.errorResponse("Failed to update dNFT metadata", "NFT_UPDATE_ERROR", 500));
  }
};

/**
 * Get dynamic NFT details and metadata for a batch
 * @route GET /api/nft/:batchId
 */
exports.getNFT = async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await nftService.getBatchNFT(batchId);
    return res.json(apiResponse.successResponse(result, "dNFT details retrieved successfully"));
  } catch (error) {
    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(apiResponse.errorResponse("Batch not found", "BATCH_NOT_FOUND", 404));
    }
    logger.error("Error fetching dNFT:", { error: error.message, stack: error.stack });
    return res
      .status(500)
      .json(apiResponse.errorResponse("Failed to fetch dNFT", "NFT_FETCH_ERROR", 500));
  }
};
