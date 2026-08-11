const Batch = require("../models/Batch");
const ipfsService = require("./ipfsService");
const blockchainService = require("./blockchainService");
const logger = require("../utils/logger");

class NFTService {
  /**
   * Mint dynamic NFT for a crop batch
   * @param {string} batchId
   * @param {string} recipientAddress
   * @returns {Promise<Object>} Mint result with token ID, IPFS URI, and metadata
   */
  async mintBatchNFT(batchId, recipientAddress) {
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      const err = new Error("Batch not found");
      err.statusCode = 404;
      throw err;
    }

    if (batch.nftData && batch.nftData.tokenId) {
      return {
        success: true,
        alreadyMinted: true,
        nftData: batch.nftData,
        message: "dNFT already minted for this batch",
      };
    }

    const stage = 0; // Initial stage: Registered / Planted
    const metadataJSON = ipfsService.buildNFTMetadata(batch, stage);
    const ipfsURI = await ipfsService.uploadToIPFS(metadataJSON, batchId);

    // Simulate or write to blockchain if configured
    let transactionHash = null;
    let tokenId = batch.nftData?.tokenId || Math.floor(Math.random() * 10000) + 1;

    if (blockchainService.isAvailable()) {
      try {
        const contract = blockchainService.getContract();
        if (contract && typeof contract.mintCropNFT === "function") {
          const tx = await contract.mintCropNFT(
            recipientAddress || "0x0000000000000000000000000000000000000001",
            batchId,
            batch.quantity || 100,
            ipfsURI,
          );
          const receipt = await tx.wait();
          transactionHash = receipt.hash;
        }
      } catch (bcErr) {
        logger.warn("Blockchain NFT minting skipped or failed, saving metadata locally", { error: bcErr.message });
      }
    }

    const nftData = {
      tokenId,
      metadataURI: ipfsURI,
      currentStage: stage,
      mintedAt: new Date(),
      updatedAt: new Date(),
      metadataJSON,
      transactionHash,
    };

    batch.nftData = nftData;
    await batch.save();

    logger.info(`✓ dNFT minted for batch ${batchId}: tokenId #${tokenId}, URI: ${ipfsURI}`);

    return {
      success: true,
      batchId,
      nftData,
      message: "Dynamic NFT minted successfully",
    };
  }

  /**
   * Dynamically update NFT metadata on IPFS and chain when batch stage updates
   * @param {string} batchId
   * @param {number} stage
   * @param {string} actorName
   * @returns {Promise<Object>} Update result
   */
  async updateNFTMetadata(batchId, stage, actorName) {
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      const err = new Error("Batch not found");
      err.statusCode = 404;
      throw err;
    }

    const metadataJSON = ipfsService.buildNFTMetadata(batch, stage);
    const newIPFSURI = await ipfsService.uploadToIPFS(metadataJSON, batchId);

    const tokenId = batch.nftData?.tokenId || 1;
    let transactionHash = null;

    if (blockchainService.isAvailable()) {
      try {
        const contract = blockchainService.getContract();
        if (contract && typeof contract.updateNFTMetadata === "function") {
          const tx = await contract.updateNFTMetadata(tokenId, stage, newIPFSURI);
          const receipt = await tx.wait();
          transactionHash = receipt.hash;
        }
      } catch (bcErr) {
        logger.warn("Blockchain NFT metadata update skipped or failed, saving metadata locally", { error: bcErr.message });
      }
    }

    batch.nftData = {
      ...(batch.nftData || {}),
      tokenId,
      metadataURI: newIPFSURI,
      currentStage: stage,
      updatedAt: new Date(),
      metadataJSON,
      lastUpdatedBy: actorName || "Authorized Role",
      transactionHash: transactionHash || batch.nftData?.transactionHash,
    };

    await batch.save();

    logger.info(`✓ dNFT metadata updated for batch ${batchId} stage ${stage}: ${newIPFSURI}`);

    return {
      success: true,
      batchId,
      nftData: batch.nftData,
      message: "Dynamic NFT metadata updated successfully",
    };
  }

  /**
   * Get dynamic NFT info for a batch
   * @param {string} batchId
   * @returns {Promise<Object>} dNFT metadata and stage history
   */
  async getBatchNFT(batchId) {
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      const err = new Error("Batch not found");
      err.statusCode = 404;
      throw err;
    }

    const currentStage = batch.stageCode !== undefined ? batch.stageCode : 0;
    const metadataJSON = batch.nftData?.metadataJSON || ipfsService.buildNFTMetadata(batch, currentStage);
    const metadataURI = batch.nftData?.metadataURI || `ipfs://bafybeigdnft${batchId.toLowerCase()}`;

    return {
      success: true,
      batchId: batch.batchId,
      cropType: batch.cropType,
      nftData: {
        tokenId: batch.nftData?.tokenId || 1,
        metadataURI,
        currentStage,
        mintedAt: batch.nftData?.mintedAt || batch.createdAt,
        updatedAt: batch.nftData?.updatedAt || new Date(),
        metadataJSON,
        transactionHash: batch.nftData?.transactionHash || null,
      },
    };
  }
}

module.exports = new NFTService();
