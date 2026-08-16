// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DisputeResolution
 * @dev Multi-signature dispute resolution system for damaged goods in the supply chain.
 *      Allows verified auditors to review evidence (IPFS links) and vote on outcomes.
 */
contract DisputeResolution {

    enum DisputeStatus { PENDING, RESOLVED_REFUND, RESOLVED_NO_REFUND }

    struct Dispute {
        bytes32 batchId;
        address initiator; // Distributor raising the dispute
        address respondent; // Farmer/Supplier
        string evidenceIpfsHash; // Link to photos/documents
        uint256 votesForRefund;
        uint256 votesAgainstRefund;
        uint256 createdAt;
        DisputeStatus status;
        bool exists;
    }

    mapping(bytes32 => Dispute) public disputes;
    
    // Tracks if an auditor has voted on a specific dispute (DisputeID => AuditorAddress => hasVoted)
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    // Registry of verified auditors
    mapping(address => bool) public verifiedAuditors;
    uint256 public totalAuditors;

    // Minimum votes required to resolve a dispute
    uint256 public constant MIN_VOTES_REQUIRED = 3; 

    address public owner;

    event DisputeRaised(bytes32 indexed disputeId, bytes32 indexed batchId, address indexed initiator, string evidence);
    event AuditorAdded(address indexed auditor);
    event AuditorRemoved(address indexed auditor);
    event VoteCast(bytes32 indexed disputeId, address indexed auditor, bool voteForRefund);
    event DisputeResolved(bytes32 indexed disputeId, DisputeStatus result);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAuditor() {
        require(verifiedAuditors[msg.sender], "Not a verified auditor");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Add a new verified auditor to the panel.
     */
    function addAuditor(address _auditor) external onlyOwner {
        require(!verifiedAuditors[_auditor], "Already an auditor");
        verifiedAuditors[_auditor] = true;
        totalAuditors++;
        emit AuditorAdded(_auditor);
    }

    /**
     * @dev Remove an auditor.
     */
    function removeAuditor(address _auditor) external onlyOwner {
        require(verifiedAuditors[_auditor], "Not an auditor");
        verifiedAuditors[_auditor] = false;
        totalAuditors--;
        emit AuditorRemoved(_auditor);
    }

    /**
     * @dev A distributor raises a dispute with evidence.
     */
    function raiseDispute(bytes32 _batchId, address _respondent, string calldata _evidenceIpfsHash) external {
        bytes32 disputeId = keccak256(abi.encodePacked(_batchId, msg.sender, block.timestamp));
        require(!disputes[disputeId].exists, "Dispute already exists");

        disputes[disputeId] = Dispute({
            batchId: _batchId,
            initiator: msg.sender,
            respondent: _respondent,
            evidenceIpfsHash: _evidenceIpfsHash,
            votesForRefund: 0,
            votesAgainstRefund: 0,
            createdAt: block.timestamp,
            status: DisputeStatus.PENDING,
            exists: true
        });

        emit DisputeRaised(disputeId, _batchId, msg.sender, _evidenceIpfsHash);
    }

    /**
     * @dev Verified auditor casts a vote based on the provided evidence.
     * @param _disputeId The ID of the dispute.
     * @param _voteForRefund True = Distributor deserves refund (damaged), False = Farmer gets paid (not damaged).
     */
    function castVote(bytes32 _disputeId, bool _voteForRefund) external onlyAuditor {
        Dispute storage dispute = disputes[_disputeId];
        require(dispute.exists, "Dispute does not exist");
        require(dispute.status == DisputeStatus.PENDING, "Dispute already resolved");
        require(!hasVoted[_disputeId][msg.sender], "Auditor already voted");

        hasVoted[_disputeId][msg.sender] = true;

        if (_voteForRefund) {
            dispute.votesForRefund++;
        } else {
            dispute.votesAgainstRefund++;
        }

        emit VoteCast(_disputeId, msg.sender, _voteForRefund);

        // Check if resolution threshold is met
        _checkResolutionThreshold(_disputeId);
    }

    /**
     * @dev Internal function to resolve dispute if enough votes are cast.
     */
    function _checkResolutionThreshold(bytes32 _disputeId) internal {
        Dispute storage dispute = disputes[_disputeId];
        
        // Simple majority resolution mechanism
        if (dispute.votesForRefund >= MIN_VOTES_REQUIRED) {
            dispute.status = DisputeStatus.RESOLVED_REFUND;
            emit DisputeResolved(_disputeId, DisputeStatus.RESOLVED_REFUND);
            // In a full integration, this would call the Escrow contract to trigger refund.
        } else if (dispute.votesAgainstRefund >= MIN_VOTES_REQUIRED) {
            dispute.status = DisputeStatus.RESOLVED_NO_REFUND;
            emit DisputeResolved(_disputeId, DisputeStatus.RESOLVED_NO_REFUND);
            // In a full integration, this would call the Escrow contract to release funds to the farmer.
        }
    }
}
