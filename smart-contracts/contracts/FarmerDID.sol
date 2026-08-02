// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";

/**
 * @title FarmerDID
 * @dev Manages Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) for Farmers
 */
contract FarmerDID is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct FarmerProfile {
        string did;
        bool isRegistered;
        bool hasOrganicCertification;
        bool hasFairTradeCertification;
        uint256 registeredAt;
        string metadataURI;
    }

    mapping(address => FarmerProfile) public profiles;
    address[] public allRegisteredFarmers;

    event ProfileCreated(address indexed farmerAddress, string did, uint256 timestamp);
    event CredentialIssued(address indexed farmerAddress, string credentialType, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    function registerProfile(string memory _did, string memory _metadataURI) external {
        require(!profiles[msg.sender].isRegistered, "Profile already exists");
        
        profiles[msg.sender] = FarmerProfile({
            did: _did,
            isRegistered: true,
            hasOrganicCertification: false,
            hasFairTradeCertification: false,
            registeredAt: block.timestamp,
            metadataURI: _metadataURI
        });
        
        allRegisteredFarmers.push(msg.sender);
        
        emit ProfileCreated(msg.sender, _did, block.timestamp);
    }

    function issueCredential(address _farmerAddress, string memory _credentialType) external onlyRole(ISSUER_ROLE) {
        require(profiles[_farmerAddress].isRegistered, "Farmer not registered");
        
        if (keccak256(abi.encodePacked(_credentialType)) == keccak256(abi.encodePacked("ORGANIC"))) {
            profiles[_farmerAddress].hasOrganicCertification = true;
        } else if (keccak256(abi.encodePacked(_credentialType)) == keccak256(abi.encodePacked("FAIR_TRADE"))) {
            profiles[_farmerAddress].hasFairTradeCertification = true;
        } else {
            revert("Unknown credential type");
        }

        emit CredentialIssued(_farmerAddress, _credentialType, block.timestamp);
    }

    function verifyOrganic(address _farmerAddress) external view returns (bool) {
        return profiles[_farmerAddress].hasOrganicCertification;
    }
}
