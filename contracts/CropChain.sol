// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/security/Pausable.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";

contract CropChain is Pausable, ReentrancyGuard {
    enum Stage {
        Farmer,
        Mandi,
        Transport,
        Retailer
    }

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

    string[] public allBatchIds;

    address public owner;
    uint256 public nextListingId;
    uint256 public twapWindow;
    uint256 public maxPriceDeviationBps;

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

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = ActorRole.Admin;
        nextListingId = 1;
        twapWindow = 1 hours;
        maxPriceDeviationBps = 1500;
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

    function pause() external onlyOwner nonReentrant {
        _pause();
    }

    function unpause() external onlyOwner nonReentrant {
        _unpause();
    }

    function setPaused(bool shouldPause) external onlyOwner nonReentrant {
        if (shouldPause) {
            _pause();
        } else {
            _unpause();
        }
    }

    function setTwapConfig(uint256 twapWindowSeconds, uint256 maxDeviationBps) external onlyOwner nonReentrant {
        require(twapWindowSeconds > 0, "Window=0");
        require(maxDeviationBps <= 5000, "Deviation too high");

        twapWindow = twapWindowSeconds;
        maxPriceDeviationBps = maxDeviationBps;

        emit TwapConfigUpdated(twapWindowSeconds, maxDeviationBps);
    }

    function createBatch(
        bytes32 batchId,
        bytes32 cropTypeHash,
        string calldata ipfsCID,
        uint256 quantity,
        string calldata actorName,
        string calldata location,
        string calldata notes
    ) external onlyAuthorized whenNotPaused nonReentrant {
        require(!cropBatches[batchId].exists, "Batch already exists");
        require(batchId != bytes32(0), "Invalid batch ID");
        require(cropTypeHash != bytes32(0), "Invalid crop type");
        require(quantity > 0, "Quantity must be > 0");

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
    }

    function updateBatch(
        bytes32 batchId,
        Stage stage,
        string calldata actorName,
        string calldata location,
        string calldata notes
    ) external onlyAuthorized whenNotPaused nonReentrant batchExists(batchId) {
        require(!cropBatches[batchId].isRecalled, "Batch is recalled");
        require(bytes(actorName).length > 0, "Actor required");
        require(bytes(location).length > 0, "Location required");
        require(_isNextStage(batchId, stage), "Invalid stage transition");

        ActorRole senderRole = roles[msg.sender];
        require(
            senderRole == ActorRole.Admin || _canUpdate(stage, senderRole),
            "Role not allowed for stage"
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
    }

    function recallBatch(bytes32 batchId) external onlyOwner whenNotPaused nonReentrant batchExists(batchId) {
        cropBatches[batchId].isRecalled = true;
        emit BatchRecalled(batchId, msg.sender);
    }

    function createListing(bytes32 batchId, uint256 quantity, uint256 unitPriceWei)
        external
        onlyAuthorized
        whenNotPaused
        nonReentrant
        batchExists(batchId)
        returns (uint256)
    {
        CropBatch storage batch = cropBatches[batchId];
        require(!batch.isRecalled, "Batch is recalled");
        require(quantity > 0 && quantity <= batch.quantity, "Invalid quantity");
        require(unitPriceWei > 0, "Price=0");

        ActorRole senderRole = roles[msg.sender];
        require(
            msg.sender == batch.creator || senderRole == ActorRole.Mandi || senderRole == ActorRole.Admin,
            "Only creator/mandi/admin"
        );

        uint256 listingId = nextListingId;
        nextListingId = listingId + 1;

        listings[listingId] = MarketListing({
            listingId: listingId,
            batchId: batchId,
            seller: msg.sender,
            quantity: quantity,
            quantityAvailable: quantity,
            unitPriceWei: unitPriceWei,
            active: true,
            createdAt: block.timestamp
        });

        emit ListingCreated(listingId, batchId, msg.sender, quantity, unitPriceWei);

        return listingId;
    }

    function buyFromListing(uint256 listingId, uint256 quantity)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        MarketListing storage listing = listings[listingId];
        require(listing.active, "Listing inactive");
        require(quantity > 0 && quantity <= listing.quantityAvailable, "Invalid quantity");

        CropBatch storage batch = cropBatches[listing.batchId];
        require(batch.exists && !batch.isRecalled, "Batch unavailable");

        uint256 twapPrice = getTwapPrice(batch.cropTypeHash, twapWindow);
        if (twapPrice > 0) {
            require(_withinDeviation(listing.unitPriceWei, twapPrice, maxPriceDeviationBps), "TWAP deviation too high");
        }

        uint256 totalCost = listing.unitPriceWei * quantity;
        require(msg.value >= totalCost, "Insufficient payment");

        listing.quantityAvailable -= quantity;
        if (listing.quantityAvailable == 0) {
            listing.active = false;
        }

        pendingWithdrawals[listing.seller] += totalCost;

        uint256 refund = msg.value - totalCost;
        if (refund > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: refund}("");
            require(refunded, "Refund failed");
        }

        emit ListingPurchased(listingId, msg.sender, quantity, totalCost);
    }

    function cancelListing(uint256 listingId) external whenNotPaused nonReentrant {
        MarketListing storage listing = listings[listingId];
        require(listing.active, "Listing inactive");
        require(msg.sender == listing.seller || msg.sender == owner, "Not allowed");

        listing.active = false;
        listing.quantityAvailable = 0;

        emit ListingCancelled(listingId, msg.sender);
    }

    function withdrawProceeds() external whenNotPaused nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No proceeds");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");

        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function recordSpotPrice(bytes32 cropTypeHash, uint256 priceWei)
        external
        onlyOracleOrAdmin
        whenNotPaused
        nonReentrant
    {
        require(cropTypeHash != bytes32(0), "Invalid crop type");
        require(priceWei > 0, "Price=0");

        _priceObservations[cropTypeHash].push(
            PriceObservation({timestamp: block.timestamp, priceWei: priceWei})
        );
        latestOraclePrice[cropTypeHash] = priceWei;

        emit SpotPriceRecorded(cropTypeHash, priceWei, block.timestamp);
    }

    function getBatch(bytes32 batchId) external view batchExists(batchId) returns (CropBatch memory) {
        return cropBatches[batchId];
    }

    function getBatchUpdates(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (SupplyChainUpdate[] memory)
    {
        return _batchUpdates[batchId];
    }

    function getLatestUpdate(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (SupplyChainUpdate memory)
    {
        uint256 length = _batchUpdates[batchId].length;
        require(length > 0, "No updates");
        return _batchUpdates[batchId][length - 1];
    }

    function getTotalBatches() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getBatchIdByIndex(uint256 index) external view returns (bytes32) {
        require(index < allBatchIds.length, "Out of bounds");
        return allBatchIds[index];
    }

    function getPriceObservationCount(bytes32 cropTypeHash) external view returns (uint256) {
        return _priceObservations[cropTypeHash].length;
    }

    function getTwapPrice(bytes32 cropTypeHash, uint256 windowSeconds)
        public
        view
        returns (uint256)
    {
        PriceObservation[] storage observations = _priceObservations[cropTypeHash];
        uint256 len = observations.length;

        if (len == 0) {
            return 0;
        }

        if (windowSeconds == 0) {
            return observations[len - 1].priceWei;
        }

        uint256 cutoff = block.timestamp > windowSeconds ? block.timestamp - windowSeconds : 0;
        uint256 endTime = block.timestamp;
        uint256 weightedSum;
        uint256 totalWeight;

        for (uint256 i = len; i > 0; ) {
            unchecked {
                i -= 1;
            }

            PriceObservation storage current = observations[i];
            uint256 segmentStart = current.timestamp > cutoff ? current.timestamp : cutoff;

            if (endTime > segmentStart) {
                uint256 dt = endTime - segmentStart;
                weightedSum += current.priceWei * dt;
                totalWeight += dt;
            }

            if (current.timestamp <= cutoff) {
                break;
            }

            endTime = current.timestamp;
        }

        if (totalWeight == 0) {
            return observations[len - 1].priceWei;
        }

        return weightedSum / totalWeight;
    }

    function _canUpdate(Stage stage, ActorRole role) internal pure returns (bool) {
        if (stage == Stage.Farmer && role == ActorRole.Farmer) return true;
        if (stage == Stage.Mandi && role == ActorRole.Mandi) return true;
        if (stage == Stage.Transport && role == ActorRole.Transporter) return true;
        if (stage == Stage.Retailer && role == ActorRole.Retailer) return true;
        return false;
    }

    function _isNextStage(bytes32 batchId, Stage newStage) internal view returns (bool) {
        SupplyChainUpdate[] storage updates = _batchUpdates[batchId];

        if (updates.length == 0) {
            return newStage == Stage.Farmer;
        }

        Stage last = updates[updates.length - 1].stage;
        return uint256(newStage) == uint256(last) + 1;
    }

    function _withinDeviation(uint256 observed, uint256 referencePrice, uint256 bps)
        internal
        pure
        returns (bool)
    {
        uint256 lower = (referencePrice * (10_000 - bps)) / 10_000;
        uint256 upper = (referencePrice * (10_000 + bps)) / 10_000;
        return observed >= lower && observed <= upper;
    }
}
