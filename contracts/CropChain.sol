// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/security/Pausable.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";
import "./EventRegistry.sol";

contract CropChain is Pausable, ReentrancyGuard {

    enum Stage { Farmer, Mandi, Transport, Retailer }

    enum ActorRole {
        None,
        Farmer,
        Mandi,
        Transporter,
        Retailer,
        Oracle,
        Admin
    }

    struct CropBatch {
        bytes32 batchId;
        bytes32 cropTypeHash;
        string ipfsCID;
        uint256 quantity;
        uint256 createdAt;
        address creator;
        bool exists;
        bool isRecalled;
    }

    struct SupplyChainUpdate {
        Stage stage;
        string actorName;
        string location;
        uint256 timestamp;
        string notes;
        address updatedBy;
    }

    struct MarketListing {
        uint256 listingId;
        bytes32 batchId;
        address seller;
        uint256 quantity;
        uint256 quantityAvailable;
        uint256 unitPriceWei;
        bool active;
        uint256 createdAt;
    }

    struct PriceObservation {
        uint256 timestamp;
        uint256 priceWei;
    }

    mapping(bytes32 => CropBatch) public cropBatches;
    mapping(bytes32 => SupplyChainUpdate[]) private _batchUpdates;
    mapping(address => ActorRole) public roles;
    mapping(uint256 => MarketListing) public listings;
    mapping(bytes32 => PriceObservation[]) private _priceObservations;
    mapping(bytes32 => uint256) public latestOraclePrice;
    mapping(address => uint256) public pendingWithdrawals;

    bytes32[] public allBatchIds;

    address public owner;
    uint256 public nextListingId;
    uint256 public twapWindow;
    uint256 public maxPriceDeviationBps;

    EventRegistry public eventRegistry;

    event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator);
    event BatchUpdated(bytes32 indexed batchId, Stage stage, string actorName, string location, address indexed updatedBy);
    event BatchRecalled(bytes32 indexed batchId, address indexed triggeredBy);
    event RoleUpdated(address indexed user, ActorRole role);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ListingCreated(uint256 indexed listingId, bytes32 indexed batchId, address indexed seller, uint256 quantity, uint256 unitPriceWei);
    event ListingPurchased(uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPaidWei);
    event ListingCancelled(uint256 indexed listingId, address indexed cancelledBy);
    event ProceedsWithdrawn(address indexed account, uint256 amountWei);
    event SpotPriceRecorded(bytes32 indexed cropTypeHash, uint256 priceWei, uint256 timestamp);
    event TwapConfigUpdated(uint256 twapWindowSeconds, uint256 maxPriceDeviationBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(roles[msg.sender] != ActorRole.None, "Not authorized");
        _;
    }

    modifier batchExists(bytes32 batchId) {
        require(cropBatches[batchId].exists, "Batch not found");
        _;
    }

    modifier onlyOracleOrAdmin() {
        ActorRole role = roles[msg.sender];
        require(role == ActorRole.Oracle || role == ActorRole.Admin, "Only oracle/admin");
        _;
    }

    constructor(address registryAddress) {
        require(registryAddress != address(0), "Invalid registry");

        owner = msg.sender;
        roles[msg.sender] = ActorRole.Admin;
        nextListingId = 1;
        twapWindow = 1 hours;
        maxPriceDeviationBps = 1500;

        eventRegistry = EventRegistry(registryAddress);
    }

    function setRole(address user, ActorRole role) external onlyOwner nonReentrant {
        require(user != address(0), "Invalid address");
        roles[user] = role;
        emit RoleUpdated(user, role);
    }

    function transferOwnership(address newOwner) external onlyOwner nonReentrant {
        require(newOwner != address(0), "Invalid address");

        address previousOwner = owner;
        owner = newOwner;
        roles[newOwner] = ActorRole.Admin;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function pause() external onlyOwner nonReentrant { _pause(); }
    function unpause() external onlyOwner nonReentrant { _unpause(); }

    function setTwapConfig(uint256 windowSeconds, uint256 deviationBps)
        external
        onlyOwner
        nonReentrant
    {
        require(windowSeconds > 0, "Window=0");
        require(deviationBps <= 5000, "Deviation too high");

        twapWindow = windowSeconds;
        maxPriceDeviationBps = deviationBps;

        emit TwapConfigUpdated(windowSeconds, deviationBps);
    }

    function createBatch(
        bytes32 batchId,
        bytes32 cropTypeHash,
        string calldata ipfsCID,
        uint256 quantity,
        string calldata actorName,
        string calldata location,
        string calldata notes
    )
        external
        onlyAuthorized
        whenNotPaused
        nonReentrant
    {
        require(!cropBatches[batchId].exists, "Batch exists");
        require(batchId != bytes32(0), "Invalid batch");
        require(cropTypeHash != bytes32(0), "Invalid crop");
        require(quantity > 0, "Quantity=0");

        cropBatches[batchId] = CropBatch({
            batchId: batchId,
            cropTypeHash: cropTypeHash,
            ipfsCID: ipfsCID,
            quantity: quantity,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true,
            isRecalled: false
        });

        _batchUpdates[batchId].push(
            SupplyChainUpdate({
                stage: Stage.Farmer,
                actorName: actorName,
                location: location,
                timestamp: block.timestamp,
                notes: notes,
                updatedBy: msg.sender
            })
        );

        allBatchIds.push(batchId);

        emit BatchCreated(batchId, ipfsCID, quantity, msg.sender);

        bytes32 eventHash = keccak256(
            abi.encodePacked("CREATE_BATCH", batchId, msg.sender, block.timestamp)
        );
        eventRegistry.registerEvent(eventHash);
    }

    function updateBatch(
        bytes32 batchId,
        Stage stage,
        string calldata actorName,
        string calldata location,
        string calldata notes
    )
        external
        onlyAuthorized
        whenNotPaused
        nonReentrant
        batchExists(batchId)
    {
        require(!cropBatches[batchId].isRecalled, "Recalled");
        require(bytes(actorName).length > 0, "Actor");
        require(bytes(location).length > 0, "Location");
        require(_isNextStage(batchId, stage), "Stage");

        ActorRole senderRole = roles[msg.sender];
        require(
            senderRole == ActorRole.Admin || _canUpdate(stage, senderRole),
            "Role"
        );

        _batchUpdates[batchId].push(
            SupplyChainUpdate({
                stage: stage,
                actorName: actorName,
                location: location,
                timestamp: block.timestamp,
                notes: notes,
                updatedBy: msg.sender
            })
        );

        emit BatchUpdated(batchId, stage, actorName, location, msg.sender);

        bytes32 eventHash = keccak256(
            abi.encodePacked("UPDATE_BATCH", batchId, stage, msg.sender, block.timestamp)
        );
        eventRegistry.registerEvent(eventHash);
    }

    function recallBatch(bytes32 batchId)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
        batchExists(batchId)
    {
        cropBatches[batchId].isRecalled = true;
        emit BatchRecalled(batchId, msg.sender);
    }

    function _canUpdate(Stage stage, ActorRole role)
        internal
        pure
        returns (bool)
    {
        if (stage == Stage.Farmer && role == ActorRole.Farmer) return true;
        if (stage == Stage.Mandi && role == ActorRole.Mandi) return true;
        if (stage == Stage.Transport && role == ActorRole.Transporter) return true;
        if (stage == Stage.Retailer && role == ActorRole.Retailer) return true;
        return false;
    }

    function _isNextStage(bytes32 batchId, Stage newStage)
        internal
        view
        returns (bool)
    {
        SupplyChainUpdate[] storage updates = _batchUpdates[batchId];
        if (updates.length == 0) return newStage == Stage.Farmer;

        Stage last = updates[updates.length - 1].stage;
        return uint256(newStage) == uint256(last) + 1;
    }
}