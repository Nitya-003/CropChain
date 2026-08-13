const { ethers } = require("ethers");
const { loadWallet } = require("../utils/keystore");

const SENDER_ABI = [
  "function syncRetailerProof((bytes32 batchId,string actorName,string location,uint64 deliveredAt,string notes,address farmer,uint256 quantity,string ipfsCID) payload) external returns (bytes32)",
  "function syncBatchAttestation((bytes32 batchId,bytes32 cropTypeHash,string ipfsCID,uint256 quantity,address farmer,string originLocation,uint8 qualityGrade,uint64 timestamp) payload) external returns (bytes32)",
  "function destinationChainSelector() view returns (uint64)",
  "function paymasterCredits(address farmer) view returns (uint256)",
];

function toBatchIdBytes32(batchId) {
  if (!batchId || typeof batchId !== "string") {
    throw new Error("Invalid batchId");
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(batchId)) {
    return batchId;
  }

  // Use deterministic hashing to support IDs longer than 31 bytes.
  return ethers.id(batchId);
}

class CCIPService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.senderContract = null;
    this.enabled = false;

    this.destinationLabel = process.env.CCIP_DESTINATION_LABEL || "ethereum";
  }

  async initialize() {
    const rpcUrl = process.env.CCIP_SOURCE_RPC_URL || process.env.INFURA_URL;
    const contractAddress = process.env.CCIP_SENDER_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress) {
      this.enabled = false;
      return false;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      // Credentials are resolved via utils/keystore (encrypted keystore, AWS
      // KMS, Vault, or deprecated CCIP_SENDER_PRIVATE_KEY env var).
      this.wallet = await loadWallet(this.provider, "ccip");
      if (!this.wallet) {
        console.warn(
          "CCIP service not configured: no signing credentials found. Set " +
            "CCIP_KEYSTORE_PATH + CCIP_KEYSTORE_PASSWORD, AWS KMS, Vault, or " +
            "CCIP_SENDER_PRIVATE_KEY (deprecated).",
        );
        this.enabled = false;
        return false;
      }
      this.senderContract = new ethers.Contract(
        contractAddress,
        SENDER_ABI,
        this.wallet,
      );
      this.enabled = true;

      return true;
    } catch (error) {
      console.error("CCIP service initialization failed:", error.message);
      this.enabled = false;
      return false;
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async dispatchRetailerProof(batch, update) {
    if (!this.enabled) {
      throw new Error("CCIP service is not configured");
    }

    const farmerWallet = (
      batch.farmerWalletAddress ||
      process.env.CCIP_DEFAULT_FARMER_WALLET ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!ethers.isAddress(farmerWallet)) {
      throw new Error("Missing valid farmer wallet for CCIP paymaster debit");
    }

    const payload = {
      batchId: toBatchIdBytes32(batch.batchId),
      actorName: update.actor,
      location: update.location,
      deliveredAt: Math.floor(
        new Date(update.timestamp || Date.now()).getTime() / 1000,
      ),
      notes: update.notes || "",
      farmer: farmerWallet,
      quantity: BigInt(batch.quantity || 0),
      ipfsCID: batch.ipfsCID || "",
    };

    // Preflight check to provide clear operator errors when credit is missing.
    const credit = await this.senderContract.paymasterCredits(farmerWallet);
    if (credit <= 0n) {
      throw new Error(`No paymaster credit for farmer ${farmerWallet}`);
    }

    const tx = await this.senderContract.syncRetailerProof(payload);
    const receipt = await tx.wait();

    const messageEvent = receipt.logs
      .map((log) => {
        try {
          return this.senderContract.interface.parseLog(log);
        } catch (_) {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "RetailerProofDispatched");

    return {
      txHash: tx.hash,
      messageId: messageEvent ? messageEvent.args.messageId : "",
      destinationChain: this.destinationLabel,
    };
  }

  async dispatchBatchAttestation(batch, qualityGrade = 1) {
    if (!this.enabled) {
      throw new Error("CCIP service is not configured");
    }

    const farmerWallet = (
      batch.farmerWalletAddress ||
      process.env.CCIP_DEFAULT_FARMER_WALLET ||
      ""
    )
      .trim()
      .toLowerCase();

    if (!ethers.isAddress(farmerWallet)) {
      throw new Error("Missing valid farmer wallet for CCIP paymaster debit");
    }

    const payload = {
      batchId: toBatchIdBytes32(batch.batchId),
      cropTypeHash: ethers.id(batch.cropType || "GENERIC_CROP"),
      ipfsCID: batch.ipfsCID || "",
      quantity: BigInt(batch.quantity || 0),
      farmer: farmerWallet,
      originLocation: batch.location || batch.origin || "Unknown",
      qualityGrade: Number(qualityGrade || 1),
      timestamp: Math.floor(Date.now() / 1000),
    };

    const credit = await this.senderContract.paymasterCredits(farmerWallet);
    if (credit <= 0n) {
      throw new Error(`No paymaster credit for farmer ${farmerWallet}`);
    }

    const tx = await this.senderContract.syncBatchAttestation(payload);
    const receipt = await tx.wait();

    const messageEvent = receipt.logs
      .map((log) => {
        try {
          return this.senderContract.interface.parseLog(log);
        } catch (_) {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "BatchAttestationDispatched");

    return {
      txHash: tx.hash,
      messageId: messageEvent ? messageEvent.args.messageId : "",
      destinationChain: this.destinationLabel,
    };
  }
}

module.exports = new CCIPService();
