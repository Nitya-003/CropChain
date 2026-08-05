// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

abstract contract ReentrancyGuardUpgradeable is Initializable {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    uint256[49] private __gap;
}

/**
 * @title CropChainUpgradeable
 * @dev UUPS Upgradeable Smart Contract for CropChain Agricultural Supply Chain Tracking.
 * Features:
 *  - UUPS Proxy Pattern (Upgradeable logic with immutable state storage)
 *  - Custom Errors for EVM Gas Optimization
 *  - Multi-Role Access Control (Farmer, Mandi, Transporter, Retailer, Oracle, Admin)
 *  - Crop Batch Provenance, TWAP Oracles, IoT Telemetry & Decentralized Marketplace
 */
contract CropChainUpgradeable is
    Initializable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    // --- Custom Errors for Gas Optimization ---
    error BatchNotFound();
    error NotAuthorized();
    error InvalidAddress();
    error InsufficientPayment();
    error AllocationExceeded();
    error InvalidStageTransition();
    error InvalidCropType();
    error BatchAlreadyExists();
    error BatchIsRecalled();
    error BatchIsSpoiled();
    error ListingInactive();
    error NoProceedsToWithdraw();
    error WithdrawFailed();
    error LengthValidationFailed();
    error CustodianNotApproved();

    // --- Role Constants ---
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant MANDI_ROLE = keccak256("MANDI_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

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

    // --- Struct Definitions ---
    struct CropBatch {
        bytes32 batchId;
        bytes32 cropTypeHash;
        string ipfsCID;
        uint256 quantity;
        uint256 createdAt;
        address creator;
        bool exists;
        bool isRecalled;
        int256 currentTemperature;
        int256 currentHumidity;
        bool isSpoiled;
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

    // --- State Storage Layout ---
    mapping(bytes32 => CropBatch) public cropBatches;
    mapping(bytes32 => SupplyChainUpdate[]) private _batchUpdates;
    mapping(address => ActorRole) public roles;
    mapping(uint256 => MarketListing) public listings;
    mapping(bytes32 => PriceObservation[]) private _priceObservations;
    mapping(bytes32 => uint256) public latestOraclePrice;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(bytes32 => uint256) public batchListedQuantity;
    mapping(bytes32 => address) public nextCustodianApproval;

    bytes32[] public allBatchIds;

    address public owner;
    uint256 public nextListingId;
    uint256 public twapWindow;
    uint256 public maxPriceDeviationBps;

    // --- Events ---
    event BatchCreated(bytes32 indexed batchId, string ipfsCID, uint256 quantity, address indexed creator);
    event BatchUpdated(bytes32 indexed batchId, Stage stage, string actorName, string location, address indexed updatedBy);
    event BatchRecalled(bytes32 indexed batchId, address indexed triggeredBy);
    event RoleUpdated(address indexed user, ActorRole role);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ListingCreated(uint256 indexed listingId, bytes32 indexed batchId, address indexed seller, uint256 quantity, uint256 unitPriceWei);
    event ListingPurchased(uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPaidWei);
    event SubBatchCreated(bytes32 indexed parentBatchId, bytes32 indexed subBatchId, address indexed owner, uint256 quantity);
    event ListingCancelled(uint256 indexed listingId, address indexed cancelledBy);
    event ProceedsWithdrawn(address indexed account, uint256 amountWei);
    event SpotPriceRecorded(bytes32 indexed cropTypeHash, uint256 priceWei, uint256 timestamp);
    event TwapConfigUpdated(uint256 twapWindowSeconds, uint256 maxPriceDeviationBps);
    event IoTDataRequested(bytes32 indexed batchId, address requester);
    event IoTDataFulfilled(bytes32 indexed batchId, int256 temperature, int256 humidity, bool isSpoiled);
    event CustodianApproved(bytes32 indexed batchId, address indexed approver, address indexed nextCustodian);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (roles[msg.sender] == ActorRole.None) revert NotAuthorized();
        _;
    }

    modifier batchExists(bytes32 batchId) {
        if (!cropBatches[batchId].exists) revert BatchNotFound();
        _;
    }

    modifier onlyOracleOrAdmin() {
        ActorRole role = roles[msg.sender];
        if (role != ActorRole.Oracle && role != ActorRole.Admin) revert NotAuthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializer function replacing contract constructor for UUPS proxy deployment.
     */
    function initialize() external initializer {
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();

        owner = msg.sender;
        roles[msg.sender] = ActorRole.Admin;
        nextListingId = 1;
        twapWindow = 1 hours;
        maxPriceDeviationBps = 1500;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _setRoleAdmin(FARMER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANDI_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(TRANSPORTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(RETAILER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ORACLE_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @dev Restricts proxy upgrades to DEFAULT_ADMIN_ROLE.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function setRole(address user, ActorRole role) external onlyOwner nonReentrant {
        if (user == address(0)) revert InvalidAddress();
        if (user == owner) revert NotAuthorized();
        if (role == ActorRole.Admin) revert NotAuthorized();

        _revokeRole(FARMER_ROLE, user);
        _revokeRole(MANDI_ROLE, user);
        _revokeRole(TRANSPORTER_ROLE, user);
        _revokeRole(RETAILER_ROLE, user);
        _revokeRole(ORACLE_ROLE, user);

        roles[user] = role;

        if (role == ActorRole.Farmer) _grantRole(FARMER_ROLE, user);
        else if (role == ActorRole.Mandi) _grantRole(MANDI_ROLE, user);
        else if (role == ActorRole.Transporter) _grantRole(TRANSPORTER_ROLE, user);
        else if (role == ActorRole.Retailer) _grantRole(RETAILER_ROLE, user);
        else if (role == ActorRole.Oracle) _grantRole(ORACLE_ROLE, user);

        emit RoleUpdated(user, role);
    }

    function transferOwnership(address newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (newOwner == address(0) || newOwner == owner) revert InvalidAddress();

        address previousOwner = owner;
        owner = newOwner;

        roles[previousOwner] = ActorRole.None;
        roles[newOwner] = ActorRole.Admin;

        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        _unpause();
    }

    function setPaused(bool shouldPause) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (shouldPause) {
            _pause();
        } else {
            _unpause();
        }
    }

    function setTwapConfig(uint256 twapWindowSeconds, uint256 maxDeviationBps) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (twapWindowSeconds == 0 || maxDeviationBps > 5000) revert AllocationExceeded();

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
    ) external onlyRole(FARMER_ROLE) whenNotPaused nonReentrant {
        _validateStringLength(ipfsCID, 46, 64);
        _validateStringLength(actorName, 2, 50);
        _validateStringLength(location, 2, 100);
        _validateStringLength(notes, 0, 500);

        if (cropBatches[batchId].exists) revert BatchAlreadyExists();
        if (batchId == bytes32(0) || cropTypeHash == bytes32(0) || quantity == 0) revert InvalidAddress();

        cropBatches[batchId] = CropBatch({
            batchId: batchId,
            cropTypeHash: cropTypeHash,
            ipfsCID: ipfsCID,
            quantity: quantity,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true,
            isRecalled: false,
            currentTemperature: 0,
            currentHumidity: 0,
            isSpoiled: false
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

    function approveCustodian(bytes32 batchId, address nextCustodian) external whenNotPaused nonReentrant batchExists(batchId) {
        address currentCustodian = _getCurrentCustodian(batchId);

        if (msg.sender != currentCustodian && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();
        if (nextCustodian == address(0)) revert InvalidAddress();

        nextCustodianApproval[batchId] = nextCustodian;
        emit CustodianApproved(batchId, msg.sender, nextCustodian);
    }

    function updateBatch(
        bytes32 batchId,
        Stage stage,
        string calldata actorName,
        string calldata location,
        string calldata notes
    ) external whenNotPaused nonReentrant batchExists(batchId) {
        _validateStringLength(actorName, 2, 50);
        _validateStringLength(location, 2, 100);
        _validateStringLength(notes, 0, 500);

        if (cropBatches[batchId].isRecalled) revert BatchIsRecalled();
        if (!_isNextStage(batchId, stage)) revert InvalidStageTransition();

        if (nextCustodianApproval[batchId] != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert CustodianNotApproved();
        nextCustodianApproval[batchId] = address(0);

        batchListedQuantity[batchId] = 0;

        if (!_canUpdateStage(batchId, stage)) revert NotAuthorized();

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
        if (batch.isRecalled) revert BatchIsRecalled();
        if (batch.isSpoiled) revert BatchIsSpoiled();
        if (quantity == 0 || unitPriceWei == 0) revert InvalidAddress();

        SupplyChainUpdate[] storage updates = _batchUpdates[batchId];
        SupplyChainUpdate storage latestUpdate = updates[updates.length - 1];

        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            if (latestUpdate.stage == Stage.Farmer) {
                if (msg.sender != batch.creator) revert NotAuthorized();
            } else if (latestUpdate.stage == Stage.Mandi) {
                if (msg.sender != latestUpdate.updatedBy) revert NotAuthorized();
            } else {
                revert NotAuthorized();
            }
        }

        uint256 alreadyListed = batchListedQuantity[batchId];
        if (quantity > batch.quantity - alreadyListed) revert AllocationExceeded();
        batchListedQuantity[batchId] = alreadyListed + quantity;

        uint256 listingId = nextListingId;
        nextListingId = listingId + 1;

        address listingSeller = _getCurrentCustodian(batchId);

        listings[listingId] = MarketListing({
            listingId: listingId,
            batchId: batchId,
            seller: listingSeller,
            quantity: quantity,
            quantityAvailable: quantity,
            unitPriceWei: unitPriceWei,
            active: true,
            createdAt: block.timestamp
        });

        emit ListingCreated(listingId, batchId, listingSeller, quantity, unitPriceWei);

        return listingId;
    }

    function buyFromListing(uint256 listingId, uint256 quantity)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        MarketListing storage listing = listings[listingId];
        if (!listing.active) revert ListingInactive();
        if (quantity == 0 || quantity > listing.quantityAvailable) revert AllocationExceeded();

        CropBatch storage batch = cropBatches[listing.batchId];
        if (!batch.exists || batch.isRecalled) revert BatchIsRecalled();
        if (batch.isSpoiled) revert BatchIsSpoiled();
        if (listing.seller != _getCurrentCustodian(listing.batchId)) revert NotAuthorized();

        uint256 twapPrice = getTwapPrice(batch.cropTypeHash, twapWindow);
        if (twapPrice > 0) {
            if (!_withinDeviation(listing.unitPriceWei, twapPrice, maxPriceDeviationBps)) revert InvalidStageTransition();
        }

        uint256 totalCost = listing.unitPriceWei * quantity;
        if (msg.value < totalCost) revert InsufficientPayment();

        listing.quantityAvailable -= quantity;
        batchListedQuantity[listing.batchId] -= quantity;
        batch.quantity -= quantity;
        if (listing.quantityAvailable == 0) {
            listing.active = false;
        }

        bytes32 subBatchId = keccak256(abi.encodePacked(listing.batchId, msg.sender, block.timestamp, listingId, allBatchIds.length));

        cropBatches[subBatchId] = CropBatch({
            batchId: subBatchId,
            cropTypeHash: batch.cropTypeHash,
            ipfsCID: batch.ipfsCID,
            quantity: quantity,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true,
            isRecalled: false,
            currentTemperature: batch.currentTemperature,
            currentHumidity: batch.currentHumidity,
            isSpoiled: false
        });

        _batchUpdates[subBatchId].push(
            SupplyChainUpdate({
                stage: _batchUpdates[listing.batchId].length > 0 ? _batchUpdates[listing.batchId][_batchUpdates[listing.batchId].length - 1].stage : Stage.Farmer,
                actorName: "Buyer",
                location: "Marketplace",
                timestamp: block.timestamp,
                notes: "Purchased and split from parent batch",
                updatedBy: msg.sender
            })
        );

        allBatchIds.push(subBatchId);

        pendingWithdrawals[listing.seller] += totalCost;

        uint256 refund = msg.value - totalCost;
        if (refund > 0) {
            pendingWithdrawals[msg.sender] += refund;
        }

        emit ListingPurchased(listingId, msg.sender, quantity, totalCost);
        emit SubBatchCreated(listing.batchId, subBatchId, msg.sender, quantity);
    }

    function cancelListing(uint256 listingId) external whenNotPaused nonReentrant {
        MarketListing storage listing = listings[listingId];
        if (!listing.active) revert ListingInactive();
        if (msg.sender != listing.seller && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotAuthorized();

        if (listing.seller == _getCurrentCustodian(listing.batchId)) {
            batchListedQuantity[listing.batchId] -= listing.quantityAvailable;
        }

        listing.active = false;
        listing.quantityAvailable = 0;

        emit ListingCancelled(listingId, msg.sender);
    }

    function withdrawProceeds() external whenNotPaused nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoProceedsToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert WithdrawFailed();

        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function recordSpotPrice(bytes32 cropTypeHash, uint256 priceWei)
        external
        onlyOracleOrAdmin
        whenNotPaused
        nonReentrant
    {
        if (cropTypeHash == bytes32(0) || priceWei == 0) revert InvalidAddress();

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
        if (length == 0) revert BatchNotFound();
        return _batchUpdates[batchId][length - 1];
    }

    function getTotalBatches() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getBatchIdByIndex(uint256 index) external view returns (bytes32) {
        if (index >= allBatchIds.length) revert AllocationExceeded();
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

    function grantStakeholderRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (account == address(0)) revert InvalidAddress();
        if (
            role != FARMER_ROLE && role != MANDI_ROLE && role != TRANSPORTER_ROLE && role != RETAILER_ROLE && role != ORACLE_ROLE
        ) revert NotAuthorized();

        _revokeRole(FARMER_ROLE, account);
        _revokeRole(MANDI_ROLE, account);
        _revokeRole(TRANSPORTER_ROLE, account);
        _revokeRole(RETAILER_ROLE, account);
        _revokeRole(ORACLE_ROLE, account);

        if (role == FARMER_ROLE) roles[account] = ActorRole.Farmer;
        else if (role == MANDI_ROLE) roles[account] = ActorRole.Mandi;
        else if (role == TRANSPORTER_ROLE) roles[account] = ActorRole.Transporter;
        else if (role == RETAILER_ROLE) roles[account] = ActorRole.Retailer;
        else if (role == ORACLE_ROLE) roles[account] = ActorRole.Oracle;

        _grantRole(role, account);
        emit RoleUpdated(account, roles[account]);
    }

    function _getCurrentCustodian(bytes32 batchId) internal view returns (address) {
        SupplyChainUpdate[] storage updates = _batchUpdates[batchId];
        if (updates.length == 0) {
            return cropBatches[batchId].creator;
        }
        SupplyChainUpdate storage latestUpdate = updates[updates.length - 1];
        if (latestUpdate.stage == Stage.Farmer) {
            return cropBatches[batchId].creator;
        }
        return latestUpdate.updatedBy;
    }

    function _canUpdateStage(bytes32 batchId, Stage newStage) internal view returns (bool) {
        SupplyChainUpdate[] storage updates = _batchUpdates[batchId];

        if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            return true;
        }

        Stage currentStage;
        if (updates.length == 0) {
            currentStage = Stage.Farmer;
        } else {
            currentStage = updates[updates.length - 1].stage;
        }

        if (currentStage == Stage.Farmer && newStage == Stage.Mandi) {
            return hasRole(MANDI_ROLE, msg.sender);
        }
        if (currentStage == Stage.Mandi && newStage == Stage.Transport) {
            return hasRole(TRANSPORTER_ROLE, msg.sender);
        }
        if (currentStage == Stage.Transport && newStage == Stage.Retailer) {
            return hasRole(RETAILER_ROLE, msg.sender);
        }

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

    function _validateStringLength(string memory str, uint256 minLen, uint256 maxLen) internal pure {
        uint256 length = bytes(str).length;
        if (length < minLen || length > maxLen) revert LengthValidationFailed();
    }

    function requestIoTVerification(bytes32 batchId)
        external
        whenNotPaused
        nonReentrant
        batchExists(batchId)
    {
        if (!hasRole(TRANSPORTER_ROLE, msg.sender) && !hasRole(MANDI_ROLE, msg.sender)) revert NotAuthorized();
        if (cropBatches[batchId].isRecalled) revert BatchIsRecalled();

        emit IoTDataRequested(batchId, msg.sender);
    }

    function fulfillIoTData(
        bytes32 batchId,
        int256 temperature,
        int256 humidity
    )
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
        nonReentrant
        batchExists(batchId)
    {
        if (cropBatches[batchId].isRecalled) revert BatchIsRecalled();
        if (humidity < 0 || humidity > 10000) revert AllocationExceeded();

        cropBatches[batchId].currentTemperature = temperature;
        cropBatches[batchId].currentHumidity = humidity;

        if (temperature > 800 || temperature < 320) {
            cropBatches[batchId].isSpoiled = true;
        }

        emit IoTDataFulfilled(batchId, temperature, humidity, cropBatches[batchId].isSpoiled);
    }

    function getBatchIoTData(bytes32 batchId)
        external
        view
        batchExists(batchId)
        returns (
            int256 temperature,
            int256 humidity,
            bool isSpoiled
        )
    {
        CropBatch storage batch = cropBatches[batchId];
        return (
            batch.currentTemperature,
            batch.currentHumidity,
            batch.isSpoiled
        );
    }
}
