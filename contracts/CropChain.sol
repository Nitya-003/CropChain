// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./security/ReentrancyGuard.sol";
import "./security/Pausable.sol";

contract CropChain is ReentrancyGuard, Pausable {
    /* ================= ENUMS ================= */

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
        Admin
    }

    /* ================= STRUCTS ================= */

    struct CropBatch {
        bytes32 batchId;
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

    struct PriceObservation {
        uint256 price;
        uint256 timestamp;
    }

    /* ================= STORAGE ================= */

    mapping(bytes32 => CropBatch) public cropBatches;
    mapping(bytes32 => SupplyChainUpdate[]) public batchUpdates;
    mapping(address => ActorRole) public roles;

    bytes32[] public allBatchIds;

    address public owner;

    mapping(address => uint256) public mandiLiquidity;
    uint256 public totalLiquidity;

    mapping(bytes32 => PriceObservation[]) private cropPriceObservations;
    uint256 public constant DEFAULT_TWAP_WINDOW = 30 minutes;

    /* ================= EVENTS ================= */

    event BatchCreated(
        bytes32 indexed batchId,
        string ipfsCID,
        uint256 quantity,
        address indexed creator
    );

    event BatchUpdated(
        bytes32 indexed batchId,
        Stage stage,
        string actorName,
        string location,
        address indexed updatedBy
    );

    event ActorAuthorized(address indexed actor, bool authorized);
    event RoleUpdated(address indexed actor, ActorRole role);
    event BatchRecalled(string indexed batchId, address indexed triggeredBy);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauseStateUpdated(address indexed by, bool paused);

    event LiquidityDeposited(address indexed account, uint256 amount);
    event LiquidityWithdrawn(address indexed account, uint256 amount);

    event SpotPriceSubmitted(string indexed cropType, uint256 price, uint256 timestamp, address indexed updatedBy);

    /* ================= MODIFIERS ================= */

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorized() {
        require(roles[msg.sender] != ActorRole.None, "Not authorized");
        _;
    }

    modifier onlyMandiOrAdmin() {
        ActorRole role = roles[msg.sender];
        require(role == ActorRole.Mandi || role == ActorRole.Admin, "Mandi/Admin only");
        _;
    }

    modifier batchExists(bytes32 _batchId) {
        require(cropBatches[_batchId].exists, "Batch not found");
        _;
    }

    /* ================= CONSTRUCTOR ================= */

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = ActorRole.Admin;
    }

    /* ================= ROLE MANAGEMENT ================= */

    function setRole(address _user, ActorRole _role)
        external
        onlyOwner
        nonReentrant
    {
        require(_user != address(0), "Invalid address");

        roles[_user] = _role;

        emit RoleUpdated(_user, _role);
        emit ActorAuthorized(_user, _role != ActorRole.None);
    }

    /* ================= INTERNAL HELPERS ================= */

    function _toBatchHash(string memory _batchId) internal pure returns (bytes32) {
        return keccak256(bytes(_batchId));
    }

    function _canUpdate(Stage _stage, ActorRole _role)
        internal
        pure
        returns (bool)
    {
        if (_stage == Stage.Farmer && _role == ActorRole.Farmer) return true;
        if (_stage == Stage.Mandi && _role == ActorRole.Mandi) return true;
        if (_stage == Stage.Transport && _role == ActorRole.Transporter) return true;
        if (_stage == Stage.Retailer && _role == ActorRole.Retailer) return true;
        return false;
    }

    function _isNextStage(bytes32 _batchId, Stage _newStage)
        internal
        view
        returns (bool)
    {
        SupplyChainUpdate[] storage updates = batchUpdates[_batchId];

        if (updates.length == 0) {
            return _newStage == Stage.Farmer;
        }

        Stage last = updates[updates.length - 1].stage;
        return uint256(_newStage) == uint256(last) + 1;
    }

    /* ================= BATCH CREATION ================= */

    function createBatch(
        string memory _batchId,
        string memory _farmerName,
        string memory _farmerAddress,
        string memory _cropType,
        uint256 _quantity,
        string memory _harvestDate,
        string memory _origin,
        string memory _certifications,
        string memory _description
    ) external onlyAuthorized whenNotPaused nonReentrant {
        bytes32 batchHash = _toBatchHash(_batchId);

        require(!cropBatches[batchHash].exists, "Batch already exists");
        require(bytes(_batchId).length > 0, "Batch ID cannot be empty");
        require(bytes(_farmerName).length > 0, "Farmer name cannot be empty");
        require(bytes(_farmerAddress).length > 0, "Farmer address cannot be empty");
        require(bytes(_cropType).length > 0, "Crop type cannot be empty");
        require(bytes(_harvestDate).length > 0, "Harvest date cannot be empty");
        require(bytes(_origin).length > 0, "Origin cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");

        // Backward-compatible field usage: _description carries the off-chain metadata CID.
        string memory ipfsCID = _description;

        cropBatches[batchHash] = CropBatch({
            batchId: batchHash,
            ipfsCID: ipfsCID,
            quantity: _quantity,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true,
            isRecalled: false
        });

        batchUpdates[batchHash].push(
            SupplyChainUpdate({
                stage: Stage.Farmer,
                actorName: _farmerName,
                location: _origin,
                timestamp: block.timestamp,
                notes: string.concat("Crop:", _cropType, "; Harvest:", _harvestDate, "; FarmerAddr:", _farmerAddress, "; Cert:", _certifications),
                updatedBy: msg.sender
            })
        );

        allBatchIds.push(batchHash);

        emit BatchCreated(batchHash, ipfsCID, _quantity, msg.sender);
    }

    /* ================= BATCH UPDATE ================= */

    function updateBatch(
        bytes32 _batchId,
        Stage _stage,
        string memory _actorName,
        string memory _location,
        string memory _notes
    ) external onlyAuthorized whenNotPaused nonReentrant batchExists(_batchId) {
        ActorRole callerRole = roles[msg.sender];

        require(!cropBatches[_batchId].isRecalled, "Batch is recalled");
        require(bytes(_actorName).length > 0, "Actor cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(_isNextStage(_batchId, _stage), "Invalid stage transition");
        require(callerRole == ActorRole.Admin || _canUpdate(_stage, callerRole), "Role cannot update this stage");

        batchUpdates[_batchId].push(
            SupplyChainUpdate({
                stage: _stage,
                actorName: _actorName,
                location: _location,
                timestamp: block.timestamp,
                notes: _notes,
                updatedBy: msg.sender
            })
        );

        emit BatchUpdated(_batchId, _stage, _actorName, _location, msg.sender);
    }

    function recallBatch(string memory _batchId)
        external
        onlyOwner
        nonReentrant
    {
        bytes32 batchHash = _toBatchHash(_batchId);
        require(cropBatches[batchHash].exists, "Batch not found");

        cropBatches[batchHash].isRecalled = true;

        emit BatchRecalled(_batchId, msg.sender);
    }

    /* ================= MARKETPLACE LIQUIDITY ================= */

    function depositLiquidity()
        external
        payable
        onlyAuthorized
        onlyMandiOrAdmin
        whenNotPaused
        nonReentrant
    {
        require(msg.value > 0, "Amount must be > 0");

        mandiLiquidity[msg.sender] += msg.value;
        totalLiquidity += msg.value;

        emit LiquidityDeposited(msg.sender, msg.value);
    }

    function withdrawLiquidity(uint256 _amount)
        external
        onlyAuthorized
        onlyMandiOrAdmin
        whenNotPaused
        nonReentrant
    {
        require(_amount > 0, "Amount must be > 0");

        uint256 balance = mandiLiquidity[msg.sender];
        require(balance >= _amount, "Insufficient liquidity");

        // CEI: effects first
        mandiLiquidity[msg.sender] = balance - _amount;
        totalLiquidity -= _amount;

        // Interaction last
        (bool sent, ) = payable(msg.sender).call{value: _amount}("");
        require(sent, "Transfer failed");

        emit LiquidityWithdrawn(msg.sender, _amount);
    }

    /* ================= TWAP ORACLE HARDENING ================= */

    function submitSpotPrice(string calldata _cropType, uint256 _price)
        external
        onlyAuthorized
        onlyMandiOrAdmin
        whenNotPaused
        nonReentrant
    {
        require(bytes(_cropType).length > 0, "Crop type cannot be empty");
        require(_price > 0, "Price must be > 0");

        bytes32 cropKey = keccak256(bytes(_cropType));
        cropPriceObservations[cropKey].push(
            PriceObservation({price: _price, timestamp: block.timestamp})
        );

        emit SpotPriceSubmitted(_cropType, _price, block.timestamp, msg.sender);
    }

    function getPriceObservationCount(string calldata _cropType)
        external
        view
        returns (uint256)
    {
        bytes32 cropKey = keccak256(bytes(_cropType));
        return cropPriceObservations[cropKey].length;
    }

    function getLatestSpotPrice(string calldata _cropType)
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        bytes32 cropKey = keccak256(bytes(_cropType));
        PriceObservation[] storage observations = cropPriceObservations[cropKey];
        require(observations.length > 0, "No price observations");

        PriceObservation storage latest = observations[observations.length - 1];
        return (latest.price, latest.timestamp);
    }

    function getTwapPrice(string calldata _cropType, uint256 _windowSeconds)
        public
        view
        returns (uint256)
    {
        bytes32 cropKey = keccak256(bytes(_cropType));
        PriceObservation[] storage observations = cropPriceObservations[cropKey];
        require(observations.length > 0, "No price observations");

        uint256 windowSeconds = _windowSeconds == 0 ? DEFAULT_TWAP_WINDOW : _windowSeconds;
        require(windowSeconds > 0, "Invalid window");

        uint256 endTime = block.timestamp;
        uint256 startTime = endTime - windowSeconds;

        uint256 weightedSum = 0;
        uint256 weightedTime = 0;
        uint256 cursorTime = endTime;

        for (uint256 i = observations.length; i > 0; i--) {
            PriceObservation storage obs = observations[i - 1];

            if (obs.timestamp >= cursorTime) {
                continue;
            }

            uint256 segmentStart = obs.timestamp > startTime ? obs.timestamp : startTime;
            if (cursorTime > segmentStart) {
                uint256 duration = cursorTime - segmentStart;
                weightedSum += obs.price * duration;
                weightedTime += duration;
            }

            if (obs.timestamp <= startTime) {
                break;
            }

            cursorTime = obs.timestamp;
        }

        require(weightedTime > 0, "Insufficient observations");
        return weightedSum / weightedTime;
    }

    /* ================= READS ================= */

    function getBatch(string memory _batchId)
        external
        view
        returns (CropBatch memory)
    {
        bytes32 batchHash = _toBatchHash(_batchId);
        require(cropBatches[batchHash].exists, "Batch not found");
        return cropBatches[batchHash];
    }

    function getBatchUpdates(bytes32 _batchId)
        external
        view
        batchExists(_batchId)
        returns (SupplyChainUpdate[] memory)
    {
        return batchUpdates[_batchId];
    }

    function getBatchUpdatesById(string memory _batchId)
        external
        view
        returns (SupplyChainUpdate[] memory)
    {
        bytes32 batchHash = _toBatchHash(_batchId);
        require(cropBatches[batchHash].exists, "Batch not found");
        return batchUpdates[batchHash];
    }

    function getLatestUpdate(bytes32 _batchId)
        external
        view
        batchExists(_batchId)
        returns (SupplyChainUpdate memory)
    {
        SupplyChainUpdate[] storage updates = batchUpdates[_batchId];
        require(updates.length > 0, "No updates");
        return updates[updates.length - 1];
    }

    function getLatestUpdateById(string memory _batchId)
        external
        view
        returns (SupplyChainUpdate memory)
    {
        bytes32 batchHash = _toBatchHash(_batchId);
        require(cropBatches[batchHash].exists, "Batch not found");

        SupplyChainUpdate[] storage updates = batchUpdates[batchHash];
        require(updates.length > 0, "No updates");

        return updates[updates.length - 1];
    }

    function getTotalBatches() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getBatchCount() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getBatchIdByIndex(uint256 _index)
        external
        view
        returns (bytes32)
    {
        require(_index < allBatchIds.length, "Out of bounds");
        return allBatchIds[_index];
    }

    /* ================= ADMIN ================= */

    function transferOwnership(address _newOwner)
        external
        onlyOwner
        nonReentrant
    {
        require(_newOwner != address(0), "Invalid address");

        address previous = owner;
        owner = _newOwner;
        roles[_newOwner] = ActorRole.Admin;

        emit OwnershipTransferred(previous, _newOwner);
    }

    function setPaused(bool _paused)
        external
        onlyOwner
        nonReentrant
    {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }

        emit PauseStateUpdated(msg.sender, _paused);
    }
}
