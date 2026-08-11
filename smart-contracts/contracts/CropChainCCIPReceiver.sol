// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";
import "./lib/openzeppelin/security/Pausable.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";
import "./ccip/Client.sol";
import "./ccip/IAny2EVMMessageReceiver.sol";
import "./ProofOfDeliveryNFT.sol";

contract CropChainCCIPReceiver is AccessControl, Pausable, ReentrancyGuard, IAny2EVMMessageReceiver {
    struct RetailerProofPayload {
        bytes32 batchId;
        string actorName;
        string location;
        uint64 deliveredAt;
        string notes;
        address farmer;
        uint256 quantity;
        string ipfsCID;
    }

    struct BatchAttestationPayload {
        bytes32 batchId;
        bytes32 cropTypeHash;
        string ipfsCID;
        uint256 quantity;
        address farmer;
        string originLocation;
        uint8 qualityGrade;
        uint64 timestamp;
    }

    struct ProvenanceRecord {
        bytes32 batchId;
        bytes32 cropTypeHash;
        string ipfsCID;
        uint256 quantity;
        address farmer;
        string originLocation;
        uint8 qualityGrade;
        uint64 timestamp;
        uint64 sourceChainSelector;
        bool verified;
    }

    address public immutable router;
    ProofOfDeliveryNFT public immutable proofOfDeliveryNFT;

    uint64 public trustedSourceChainSelector;
    address public trustedSourceSender;

    mapping(bytes32 => bool) public processedMessages;
    mapping(bytes32 => ProvenanceRecord) public crossChainAttestations;

    event SourceConfigured(uint64 indexed sourceChainSelector, address indexed sourceSender);
    event RetailerProofReceived(
        bytes32 indexed messageId,
        bytes32 indexed batchId,
        address indexed farmer,
        uint256 tokenId,
        uint64 sourceChainSelector
    );
    event BatchAttestationReceived(
        bytes32 indexed messageId,
        bytes32 indexed batchId,
        address indexed farmer,
        uint64 sourceChainSelector
    );

    constructor(address routerAddress, address nftAddress) {
        require(routerAddress != address(0), "Invalid router");
        require(nftAddress != address(0), "Invalid NFT");

        router = routerAddress;
        proofOfDeliveryNFT = ProofOfDeliveryNFT(nftAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setTrustedSource(uint64 sourceChainSelector, address sourceSender)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(sourceChainSelector > 0, "Invalid chain");
        require(sourceSender != address(0), "Invalid sender");

        trustedSourceChainSelector = sourceChainSelector;
        trustedSourceSender = sourceSender;

        emit SourceConfigured(sourceChainSelector, sourceSender);
    }

    function ccipReceive(Client.Any2EVMMessage calldata message) external override whenNotPaused nonReentrant {
        require(msg.sender == router, "Only router");
        require(!processedMessages[message.messageId], "Message processed");

        if (trustedSourceChainSelector != 0) {
            require(message.sourceChainSelector == trustedSourceChainSelector, "Untrusted source chain");
        }

        if (trustedSourceSender != address(0)) {
            address decodedSender = abi.decode(message.sender, (address));
            require(decodedSender == trustedSourceSender, "Untrusted source sender");
        }

        processedMessages[message.messageId] = true;

        if (message.data.length >= 256) {
            try this.decodeBatchAttestation(message.data) returns (BatchAttestationPayload memory attestation) {
                if (attestation.cropTypeHash != bytes32(0)) {
                    crossChainAttestations[attestation.batchId] = ProvenanceRecord({
                        batchId: attestation.batchId,
                        cropTypeHash: attestation.cropTypeHash,
                        ipfsCID: attestation.ipfsCID,
                        quantity: attestation.quantity,
                        farmer: attestation.farmer,
                        originLocation: attestation.originLocation,
                        qualityGrade: attestation.qualityGrade,
                        timestamp: attestation.timestamp,
                        sourceChainSelector: message.sourceChainSelector,
                        verified: true
                    });
                    emit BatchAttestationReceived(
                        message.messageId,
                        attestation.batchId,
                        attestation.farmer,
                        message.sourceChainSelector
                    );
                    return;
                }
            } catch {}
        }

        RetailerProofPayload memory payload = abi.decode(message.data, (RetailerProofPayload));
        require(payload.batchId != bytes32(0), "Invalid batchId");

        string memory metadataURI = payload.ipfsCID;
        uint256 tokenId = proofOfDeliveryNFT.mintProof(payload.farmer, payload.batchId, metadataURI);

        emit RetailerProofReceived(
            message.messageId,
            payload.batchId,
            payload.farmer,
            tokenId,
            message.sourceChainSelector
        );
    }

    function decodeBatchAttestation(bytes calldata data) external pure returns (BatchAttestationPayload memory) {
        return abi.decode(data, (BatchAttestationPayload));
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
