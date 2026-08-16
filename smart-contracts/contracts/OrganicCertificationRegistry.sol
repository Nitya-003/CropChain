// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title OrganicCertificationRegistry
 * @dev Smart contract registry mapping agricultural Batch IDs to their respective
 *      tamper-proof organic digital certificates stored on IPFS.
 */
contract OrganicCertificationRegistry {

    struct Certificate {
        string ipfsCid;           // The IPFS Content Identifier mapping to the PDF/Metadata
        address certifier;        // The official authority that issued this cert
        uint256 issuanceDate;
        uint256 expirationDate;
        bool isRevoked;
        bool exists;
    }

    // Mapping from Batch ID to its Organic Certificate
    mapping(bytes32 => Certificate) public batchCertificates;

    // Registry of authorized certifiers (e.g. USDA Organic, EU Organic bodies)
    mapping(address => bool) public authorizedCertifiers;
    
    address public owner;

    event CertifierAdded(address indexed certifier);
    event CertifierRemoved(address indexed certifier);
    event CertificateIssued(bytes32 indexed batchId, string ipfsCid, address indexed certifier);
    event CertificateRevoked(bytes32 indexed batchId, address indexed certifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyCertifier() {
        require(authorizedCertifiers[msg.sender], "Not an authorized certifier");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Add an official certification authority to the network.
     */
    function addCertifier(address _certifier) external onlyOwner {
        require(!authorizedCertifiers[_certifier], "Already an authorized certifier");
        authorizedCertifiers[_certifier] = true;
        emit CertifierAdded(_certifier);
    }

    /**
     * @dev Remove a certification authority.
     */
    function removeCertifier(address _certifier) external onlyOwner {
        require(authorizedCertifiers[_certifier], "Not an authorized certifier");
        authorizedCertifiers[_certifier] = false;
        emit CertifierRemoved(_certifier);
    }

    /**
     * @dev Issue a new organic certificate for a specific crop batch.
     * @param _batchId The unique identifier for the crop batch.
     * @param _ipfsCid The IPFS hash pointing to the digital certificate.
     * @param _validityPeriodDays How long the certification is valid.
     */
    function issueCertificate(
        bytes32 _batchId, 
        string calldata _ipfsCid, 
        uint256 _validityPeriodDays
    ) external onlyCertifier {
        require(!batchCertificates[_batchId].exists, "Certificate already exists for this batch");

        uint256 expirationDate = block.timestamp + (_validityPeriodDays * 1 days);

        batchCertificates[_batchId] = Certificate({
            ipfsCid: _ipfsCid,
            certifier: msg.sender,
            issuanceDate: block.timestamp,
            expirationDate: expirationDate,
            isRevoked: false,
            exists: true
        });

        emit CertificateIssued(_batchId, _ipfsCid, msg.sender);
    }

    /**
     * @dev Revoke a certificate in case of a violation or error.
     * @param _batchId The unique identifier for the crop batch.
     */
    function revokeCertificate(bytes32 _batchId) external onlyCertifier {
        Certificate storage cert = batchCertificates[_batchId];
        require(cert.exists, "Certificate does not exist");
        require(!cert.isRevoked, "Certificate already revoked");
        // Typically only the original certifier or the owner should be able to revoke
        require(msg.sender == cert.certifier || msg.sender == owner, "Not authorized to revoke this cert");

        cert.isRevoked = true;

        emit CertificateRevoked(_batchId, msg.sender);
    }

    /**
     * @dev Check if a batch currently has a valid organic certification.
     *      Useful for consumer-facing apps scanning the QR code.
     */
    function verifyCertificate(bytes32 _batchId) external view returns (bool isValid, string memory ipfsCid) {
        Certificate memory cert = batchCertificates[_batchId];
        
        if (!cert.exists || cert.isRevoked || block.timestamp > cert.expirationDate) {
            return (false, "");
        }

        return (true, cert.ipfsCid);
    }
}
