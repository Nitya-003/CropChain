// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";

/**
 * @title CropBatchDNFT
 * @dev Dynamic NFT contract representing physical Crop Batches across the supply chain.
 * Metadata and stage progression dynamically update as crops move through lifecycle stages.
 */
contract CropBatchDNFT is AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant INSPECTOR_ROLE = keccak256("INSPECTOR_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");

    string public name;
    string public symbol;
    uint256 public totalSupply;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint8) public tokenStage;
    mapping(uint256 => bytes32) public tokenIdToBatchId;
    mapping(bytes32 => uint256) public batchToTokenId;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event CropNFTMinted(
        bytes32 indexed batchId,
        uint256 indexed tokenId,
        address indexed recipient,
        string tokenURI,
        uint256 quantity
    );
    event MetadataUpdated(
        uint256 indexed tokenId,
        bytes32 indexed batchId,
        uint8 stage,
        string newURI,
        address indexed updatedBy
    );

    constructor(string memory tokenName, string memory tokenSymbol) {
        name = tokenName;
        symbol = tokenSymbol;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
        _grantRole(INSPECTOR_ROLE, msg.sender);
        _grantRole(TRANSPORTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint a new dynamic NFT for a crop batch.
     */
    function mintCropNFT(
        address recipient,
        bytes32 batchId,
        uint256 quantity,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 tokenId) {
        require(recipient != address(0), "Invalid recipient");
        require(batchId != bytes32(0), "Invalid batchId");
        require(batchToTokenId[batchId] == 0, "NFT already minted for batch");
        require(bytes(metadataURI).length > 0, "Metadata URI required");

        unchecked {
            totalSupply += 1;
        }

        tokenId = totalSupply;
        _owners[tokenId] = recipient;
        _balances[recipient] += 1;
        _tokenURIs[tokenId] = metadataURI;
        tokenStage[tokenId] = 0; // Stage 0: Planted / Registered
        batchToTokenId[batchId] = tokenId;
        tokenIdToBatchId[tokenId] = batchId;

        emit Transfer(address(0), recipient, tokenId);
        emit CropNFTMinted(batchId, tokenId, recipient, metadataURI, quantity);
    }

    /**
     * @dev Update the dynamic metadata URI and stage of an existing crop batch NFT.
     * Restricted to authorized roles (Updater, Inspector, Transporter, or Admin).
     */
    function updateNFTMetadata(
        uint256 tokenId,
        uint8 newStage,
        string calldata newMetadataURI
    ) external nonReentrant {
        require(
            hasRole(UPDATER_ROLE, msg.sender) ||
                hasRole(INSPECTOR_ROLE, msg.sender) ||
                hasRole(TRANSPORTER_ROLE, msg.sender) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Caller lacks required role to update dNFT"
        );
        require(_owners[tokenId] != address(0), "Token does not exist");
        require(bytes(newMetadataURI).length > 0, "Metadata URI required");

        _tokenURIs[tokenId] = newMetadataURI;
        tokenStage[tokenId] = newStage;

        bytes32 batchId = tokenIdToBatchId[tokenId];
        emit MetadataUpdated(tokenId, batchId, newStage, newMetadataURI, msg.sender);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), "Zero address");
        return _balances[account];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function getNFTState(uint256 tokenId)
        external
        view
        returns (
            bytes32 batchId,
            uint8 stage,
            string memory metadataURI,
            address owner
        )
    {
        owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        batchId = tokenIdToBatchId[tokenId];
        stage = tokenStage[tokenId];
        metadataURI = _tokenURIs[tokenId];
    }
}
