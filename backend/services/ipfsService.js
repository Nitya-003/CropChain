const crypto = require("crypto");
const logger = require("../utils/logger");

let pinataClient = null;

try {
  const pinataSDK = require("@pinata/sdk");
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  if (apiKey && secretKey) {
    pinataClient = new pinataSDK(apiKey, secretKey);
  }
} catch (err) {
  logger.warn("Pinata SDK not configured, using IPFS simulation fallback", { error: err.message });
}

/**
 * Stages mapping for dNFT visual representations and descriptions
 */
const STAGE_VISUAL_MAP = {
  0: {
    name: "Planted 🌱",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/planted.png",
    description: "Crop batch has been registered and planted in the fields.",
  },
  1: {
    name: "Growing 🌿",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/growing.png",
    description: "Crop batch is actively cultivated with monitored soil & weather conditions.",
  },
  2: {
    name: "Harvested 🌾",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/harvested.png",
    description: "Crop batch has been harvested and prepared for quality inspection.",
  },
  3: {
    name: "Quality Inspected 🔍",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/inspected.png",
    description: "Batch passed quality inspection and certified safe for distribution.",
  },
  4: {
    name: "Transported 🚚",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/transported.png",
    description: "Batch is in-transit under cold-chain logistics monitoring.",
  },
  5: {
    name: "Delivered 🏬",
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/delivered.png",
    description: "Batch successfully delivered to destination retailer store.",
  },
};

/**
 * Build OpenSea standard dNFT JSON metadata
 * @param {Object} batchData
 * @param {number} stage
 * @returns {Object} OpenSea standard metadata JSON
 */
function buildNFTMetadata(batchData, stage = 0) {
  const stageInfo = STAGE_VISUAL_MAP[stage] || STAGE_VISUAL_MAP[0];
  const cropType = batchData.cropType || "Crop Batch";
  const batchId = batchData.batchId || "BATCH-UNKNOWN";

  return {
    name: `CropChain dNFT: ${cropType} (${batchId})`,
    description: `Dynamic NFT representing physical crop batch ${batchId}. Current Stage: ${stageInfo.name}. ${stageInfo.description}`,
    image: stageInfo.image,
    external_url: `https://cropchain.sonusid.in/track-batch?id=${encodeURIComponent(batchId)}`,
    attributes: [
      { trait_type: "Batch ID", value: batchId },
      { trait_type: "Crop Type", value: cropType },
      { trait_type: "Stage Code", value: stage },
      { trait_type: "Lifecycle Stage", value: stageInfo.name },
      { trait_type: "Quantity (kg)", value: Number(batchData.quantity || 0) },
      { trait_type: "Origin", value: batchData.origin || "Unknown" },
      { trait_type: "Farmer", value: batchData.farmerName || "Registered Farmer" },
      { trait_type: "Harvest Date", value: batchData.harvestDate || new Date().toISOString() },
      { trait_type: "Last Updated", value: new Date().toISOString() },
    ],
  };
}

/**
 * Upload metadata JSON to IPFS via Pinata or generate deterministic IPFS CID fallback
 * @param {Object} metadataJSON
 * @param {string} batchId
 * @returns {Promise<string>} IPFS URI (ipfs://<cid>)
 */
async function uploadToIPFS(metadataJSON, batchId) {
  if (pinataClient) {
    try {
      const options = {
        pinataMetadata: {
          name: `crop-dnft-${batchId}-${Date.now()}`,
        },
      };
      const result = await pinataClient.pinJSONToIPFS(metadataJSON, options);
      logger.info(`✓ Dynamic NFT metadata pinned to IPFS for ${batchId}: ${result.IpfsHash}`);
      return `ipfs://${result.IpfsHash}`;
    } catch (error) {
      logger.error("Failed to pin metadata to Pinata IPFS, using fallback hash:", error.message);
    }
  }

  // Fallback: SHA-256 derived deterministic fake CID for local/testing mode
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(metadataJSON) + batchId)
    .digest("hex")
    .substring(0, 46);
  const fallbackCID = `bafybeigdnft${hash.toLowerCase()}`;
  return `ipfs://${fallbackCID}`;
}

module.exports = {
  buildNFTMetadata,
  uploadToIPFS,
  STAGE_VISUAL_MAP,
};
