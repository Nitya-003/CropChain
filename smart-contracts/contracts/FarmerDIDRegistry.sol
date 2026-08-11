// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FarmerDIDRegistry
 * @dev Simple DID registry for farmers to anchor their identity and authorities to issue Verifiable Credentials.
 */
contract FarmerDIDRegistry {
    struct FarmerProfile {
        string didDocument; // IPFS hash or DID Document URI
        bool isRegistered;
        address registeredBy;
    }

    struct VerifiableCredential {
        bytes32 credentialId;
        address issuer;
        string credentialHash; // IPFS hash of the actual VC
        bool isValid;
        uint256 issuedAt;
    }

    mapping(address => FarmerProfile) public farmers;
    mapping(address => mapping(bytes32 => VerifiableCredential)) public credentials;
    mapping(address => bytes32[]) public farmerCredentialIds;
    mapping(address => bool) public authorizedIssuers;

    address public owner;

    event FarmerRegistered(address indexed farmer, string didDocument);
    event CredentialIssued(address indexed farmer, bytes32 indexed credentialId, address indexed issuer);
    event CredentialRevoked(address indexed farmer, bytes32 indexed credentialId);
    event IssuerAdded(address indexed issuer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true; // Owner is an issuer by default
    }

    function addIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer);
    }

    function registerFarmerDID(address _farmer, string calldata _didDocument) external {
        require(!farmers[_farmer].isRegistered, "Farmer already registered");
        // For simplicity, anyone can register a DID, but in production this might be restricted
        
        farmers[_farmer] = FarmerProfile({
            didDocument: _didDocument,
            isRegistered: true,
            registeredBy: msg.sender
        });

        emit FarmerRegistered(_farmer, _didDocument);
    }

    function issueCredential(address _farmer, bytes32 _credentialId, string calldata _credentialHash) external onlyIssuer {
        require(farmers[_farmer].isRegistered, "Farmer not registered");
        require(!credentials[_farmer][_credentialId].isValid, "Credential already exists");

        credentials[_farmer][_credentialId] = VerifiableCredential({
            credentialId: _credentialId,
            issuer: msg.sender,
            credentialHash: _credentialHash,
            isValid: true,
            issuedAt: block.timestamp
        });

        farmerCredentialIds[_farmer].push(_credentialId);
        emit CredentialIssued(_farmer, _credentialId, msg.sender);
    }

    function revokeCredential(address _farmer, bytes32 _credentialId) external onlyIssuer {
        require(credentials[_farmer][_credentialId].isValid, "Credential not valid");
        require(credentials[_farmer][_credentialId].issuer == msg.sender, "Only the issuer can revoke");

        credentials[_farmer][_credentialId].isValid = false;
        emit CredentialRevoked(_farmer, _credentialId);
    }

    function getFarmerCredentials(address _farmer) external view returns (bytes32[] memory) {
        return farmerCredentialIds[_farmer];
    }
}
