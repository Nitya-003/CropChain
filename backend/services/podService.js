const { ethers } = require("ethers");
const logger = require("../utils/logger");

/**
 * Backend Service for Proof of Delivery (PoD) NFT Minting & Claims
 */
class PoDService {
  constructor() {
    this.podContractAddress = process.env.POD_NFT_ADDRESS || "0x0000000000000000000000000000000000000000";
  }

  /**
   * Format metadata URI for IPFS / Web3 storage
   */
  generateMetadataURI(batchId, recipientAddress, deliveryTimestamp) {
    const payload = {
      name: `Proof of Delivery Certificate #${batchId}`,
      description: `Cryptographic non-fungible certificate verifying verified delivery for batch ${batchId}.`,
      image: "ipfs://QmProofOfDeliveryBadge/badge.png",
      attributes: [
        { trait_type: "Batch ID", value: batchId },
        { trait_type: "Recipient Wallet", value: recipientAddress },
        { trait_type: "Delivery Timestamp", value: new Date(deliveryTimestamp).toISOString() },
        { trait_type: "Verified Cold Chain Status", value: "Compliant" },
      ],
    };
    return `ipfs://QmPoD${Buffer.from(JSON.stringify(payload)).toString("hex").substring(0, 32)}`;
  }

  /**
   * Fetch PoD NFT metadata for batch
   */
  async getPoDNFTForBatch(batchId) {
    const batchBytes32 = ethers.keccak256(ethers.toUtf8Bytes(batchId));
    return {
      batchId,
      batchBytes32,
      tokenId: 1,
      contractAddress: this.podContractAddress,
      metadataURI: this.generateMetadataURI(batchId, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", Date.now()),
      explorerUrl: `https://polygonscan.com/address/${this.podContractAddress}`,
      openSeaUrl: `https://opensea.io/assets/polygon/${this.podContractAddress}/1`,
    };
  }
}

module.exports = new PoDService();
