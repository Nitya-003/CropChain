// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";

contract ProofOfDeliveryNFT is AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public name;
    string public symbol;

    uint256 public totalSupply;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenURIs;
    mapping(bytes32 => uint256) public batchToTokenId;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event ProofMinted(bytes32 indexed batchId, uint256 indexed tokenId, address indexed recipient, string tokenURI);

    constructor(string memory tokenName, string memory tokenSymbol) {
        name = tokenName;
        symbol = tokenSymbol;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintProof(address recipient, bytes32 batchId, string calldata metadataURI)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
        returns (uint256 tokenId)
    {
        require(recipient != address(0), "Invalid recipient");
        require(batchId != bytes32(0), "Invalid batchId");
        require(batchToTokenId[batchId] == 0, "Proof already minted");

        unchecked {
            totalSupply += 1;
        }

        tokenId = totalSupply;
        _owners[tokenId] = recipient;
        _balances[recipient] += 1;
        _tokenURIs[tokenId] = metadataURI;
        batchToTokenId[batchId] = tokenId;

        emit Transfer(address(0), recipient, tokenId);
        emit ProofMinted(batchId, tokenId, recipient, metadataURI);
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
}
