const { ethers } = require("ethers");
const blockchainConfig = require("../config/blockchain");
const logger = require("../utils/logger");

const minimalForwarderABI = [
  "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) public payable returns (bool, bytes)",
  "function getNonce(address from) public view returns (uint256)",
  "function verify(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) req, bytes signature) public view returns (bool)"
];

class RelayerService {
  constructor() {
    // Will be initialized when accessed
  }

  getForwarderAddress() {
    return process.env.FORWARDER_ADDRESS;
  }

  /**
   * Initialize and get the forwarder contract
   */
  getForwarderContract() {
    const wallet = blockchainConfig.getWallet();
    if (!wallet) {
      throw new Error("Relayer wallet not configured");
    }
    const forwarderAddress = this.getForwarderAddress();
    if (!forwarderAddress) {
      throw new Error("FORWARDER_ADDRESS not set in environment");
    }
    return new ethers.Contract(forwarderAddress, minimalForwarderABI, wallet);
  }

  /**
   * Relay a meta-transaction
   * @param {Object} req - The ForwardRequest object
   * @param {string} signature - The EIP-712 signature from the user
   * @returns {Object} Transaction receipt
   */
  async relayTransaction(req, signature) {
    try {
      const forwarder = this.getForwarderContract();
      
      // Verify signature locally before paying gas
      const isValid = await forwarder.verify(req, signature);
      if (!isValid) {
        throw new Error("Invalid signature or request data");
      }

      logger.info(`Relaying transaction for user ${req.from} to contract ${req.to}`);
      
      // The backend pays the gas for this transaction
      const tx = await forwarder.execute(req, signature, {
        gasLimit: 3000000 // Provide enough gas for complex operations like createBatch
      });
      
      logger.info(`Relay transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      logger.error("Failed to relay transaction:", error);
      throw error;
    }
  }

  /**
   * Get nonce for a user
   * @param {string} userAddress - The user's wallet address
   * @returns {number} The current nonce
   */
  async getNonce(userAddress) {
    try {
      const forwarder = this.getForwarderContract();
      const nonce = await forwarder.getNonce(userAddress);
      return nonce.toString();
    } catch (error) {
      logger.error(`Failed to get nonce for ${userAddress}:`, error);
      throw error;
    }
  }
}

module.exports = new RelayerService();
