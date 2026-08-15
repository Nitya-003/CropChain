const { ethers } = require("ethers");
const logger = require("../utils/logger");

/**
 * Backend Service for Mandi DAO Governance & Dispute Voting
 */
class DAOService {
  constructor() {
    this.daoAddress = process.env.MANDI_DAO_ADDRESS || "0x0000000000000000000000000000000000000000";
    this.tokenAddress = process.env.MANDI_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
  }

  /**
   * Format dispute proposal data for frontend
   */
  formatProposal(id, targets, values, description, state, votes) {
    const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
    return {
      proposalId: id,
      targets,
      values,
      description,
      state: states[state] || "Unknown",
      forVotes: votes?.forVotes || "0",
      againstVotes: votes?.againstVotes || "0",
      abstainVotes: votes?.abstainVotes || "0",
      createdAt: Date.now(),
    };
  }

  /**
   * Encode proposal data for smart contract submission
   */
  encodeProposalData(target, value, calldata, description) {
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    return {
      targets: [target],
      values: [value],
      calldatas: [calldata],
      description,
      descriptionHash,
    };
  }
}

module.exports = new DAOService();
