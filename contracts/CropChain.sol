// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./security/Pausable.sol";
import "./security/ReentrancyGuard.sol";

contract CropChain is Pausable, ReentrancyGuard {

    /* ================= ENUMS ================= */

    /**
     * @dev Supply chain stages
     */
    enum Stage {
        Farmer,
        Mandi,
        Transport,
        Retailer
    }

    /**
     * @dev Actor roles
     */
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
        bytes32 batchId; // Gas-optimized batch identifier   
        string ipfsCID;   // All farmer and crop metadata is stored off-chain on IPFS as JSON.
        uint256 quantity;
        uint256 createdAt;
        address creator;
        bool exists;
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
        uint256 timestamp;
        uint256 price;
    }

    /* ================= STORAGE ================= */

    mapping(bytes32 => CropBatch) public cropBatches;
    mapping(bytes32 => SupplyChainUpdate[]) public batchUpdates;
    mapping(bytes32 => PriceObservation[]) private priceObservations;
    mapping(address => uint256) public mandiLiquidity;

    mapping(address => ActorRole) public roles;

    bytes32[] public allBatchIds;

    address public owner;
    uint256 public twapWindow = 1 hours;

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

    event RoleUpdated(address indexed user, ActorRole role);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event CircuitBreakerToggled(address indexed caller, bool isPaused);
    event LiquidityDeposited(address indexed mandi, uint256 amount);
    event LiquidityWithdrawn(address indexed mandi, uint256 amount);
    event CropPriceObserved(bytes32 indexed cropKey, uint256 price, uint256 timestamp);
    event TWAPWindowUpdated(uint256 previousWindow, uint256 newWindow);

    /* ================= MODIFIERS ================= */

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
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

    /**
     * @dev Assign role to user
     */
    function setRole(address _user, ActorRole _role)
        public
        onlyOwner
        nonReentrant
    {
        // Checks
        require(_user != address(0), "Invalid address");

        // Effects
        roles[_user] = _role;

        // Interactions
        emit RoleUpdated(_user, _role);
    }

    /* ================= INTERNAL HELPERS ================= */

    /**
     * @dev Check if role can update stage
     */
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

    /**
     * @dev Validate stage order
     */
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

    /**
     * @dev Create new batch
     */
    function createBatch(
        bytes32 _batchId,
        string memory _ipfsCID,
        uint256 _quantity
    )
        public
        whenNotPaused
        nonReentrant
    {
        // Checks
        require(roles[msg.sender] == ActorRole.Farmer || roles[msg.sender] == ActorRole.Admin,
            "Only farmer/admin");

        require(!cropBatches[_batchId].exists, "Batch exists");
        require(_batchId != bytes32(0), "Invalid batch ID");
        require(bytes(_ipfsCID).length > 0, "Invalid CID");
        require(_quantity > 0, "Invalid quantity");

        // Effects
        cropBatches[_batchId] = CropBatch({
            batchId: _batchId,
            ipfsCID: _ipfsCID,
            quantity: _quantity,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true
        });

        // Initial farmer record
        batchUpdates[_batchId].push(
            SupplyChainUpdate({
                stage: Stage.Farmer,
                actorName: "Farmer",
                location: "From IPFS",
                timestamp: block.timestamp,
                notes: "Initial harvest",
                updatedBy: msg.sender
            })
        );

        allBatchIds.push(_batchId);

        // Interactions
        emit BatchCreated(_batchId, _ipfsCID, _quantity, msg.sender);
    }

    /* ================= BATCH UPDATE ================= */

    /**
     * @dev Update batch stage
     */
    function updateBatch(
        bytes32 _batchId,
        Stage _stage,
        string memory _actorName,
        string memory _location,
        string memory _notes
    )
        public
        whenNotPaused
        nonReentrant
        batchExists(_batchId)
    {
        // Checks
        ActorRole role = roles[msg.sender];

        require(role != ActorRole.None, "No role");
        require(_canUpdate(_stage, role), "Role not allowed");
        require(_isNextStage(_batchId, _stage), "Wrong stage order");

        require(bytes(_actorName).length > 0, "Invalid actor");
        require(bytes(_location).length > 0, "Invalid location");

        // Effects
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

        // Interactions
        emit BatchUpdated(
            _batchId,
            _stage,
            _actorName,
            _location,
            msg.sender
        );
    }

    /* ================= VIEW FUNCTIONS ================= */

    function getBatch(bytes32 _batchId)
        public
        view
        batchExists(_batchId)
        returns (CropBatch memory)
    {
        return cropBatches[_batchId];
    }

    function getBatchUpdates(bytes32 _batchId)
        public
        view
        batchExists(_batchId)
        returns (SupplyChainUpdate[] memory)
    {
        return batchUpdates[_batchId];
    }

    function getLatestUpdate(bytes32 _batchId)
        public
        view
        batchExists(_batchId)
        returns (SupplyChainUpdate memory)
    {
        SupplyChainUpdate[] memory updates = batchUpdates[_batchId];

        require(updates.length > 0, "No updates");

        return updates[updates.length - 1];
    }

    function getTotalBatches() public view returns (uint256) {
        return allBatchIds.length;
    }

    function getBatchIdByIndex(uint256 _index)
        public
        view
        returns (bytes32)
    {
        require(_index < allBatchIds.length, "Out of bounds");

        return allBatchIds[_index];
    }

    /* ================= ADMIN ================= */

    function transferOwnership(address _newOwner)
        public
        onlyOwner
        nonReentrant
    {
        // Checks
        require(_newOwner != address(0), "Invalid address");

        // Effects
        address previous = owner;
        owner = _newOwner;
        roles[_newOwner] = ActorRole.Admin;

        // Interactions
        emit OwnershipTransferred(previous, _newOwner);
    }

    /**
     * @dev Pause/unpause system (backward-compatible wrapper)
     */
    function setPaused(bool _paused)
        public
        onlyOwner
        nonReentrant
    {
        if (_paused && !paused()) {
            _pause();
            emit CircuitBreakerToggled(msg.sender, true);
        }

        if (!_paused && paused()) {
            _unpause();
            emit CircuitBreakerToggled(msg.sender, false);
        }
    }

    function pause() public onlyOwner nonReentrant {
        _pause();
        emit CircuitBreakerToggled(msg.sender, true);
    }

    function unpause() public onlyOwner nonReentrant {
        _unpause();
        emit CircuitBreakerToggled(msg.sender, false);
    }

    function depositLiquidity()
        public
        payable
        whenNotPaused
        nonReentrant
    {
        // Checks
        require(msg.value > 0, "No value sent");

        // Effects
        mandiLiquidity[msg.sender] += msg.value;

        // Interactions
        emit LiquidityDeposited(msg.sender, msg.value);
    }

    function withdrawLiquidity(uint256 _amount)
        public
        whenNotPaused
        nonReentrant
    {
        // Checks
        require(_amount > 0, "Invalid amount");
        uint256 currentBalance = mandiLiquidity[msg.sender];
        require(currentBalance >= _amount, "Insufficient liquidity");

        // Effects
        mandiLiquidity[msg.sender] = currentBalance - _amount;

        // Interactions
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "Withdrawal transfer failed");

        emit LiquidityWithdrawn(msg.sender, _amount);
    }

    function recordCropPrice(bytes32 _cropKey, uint256 _spotPrice)
        public
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        // Checks
        require(_cropKey != bytes32(0), "Invalid crop key");
        require(_spotPrice > 0, "Invalid spot price");

        // Effects
        priceObservations[_cropKey].push(
            PriceObservation({
                timestamp: block.timestamp,
                price: _spotPrice
            })
        );

        // Interactions
        emit CropPriceObserved(_cropKey, _spotPrice, block.timestamp);
    }

    function setTWAPWindow(uint256 _newWindowSeconds)
        public
        onlyOwner
        nonReentrant
    {
        require(_newWindowSeconds >= 5 minutes, "TWAP window too small");
        require(_newWindowSeconds <= 7 days, "TWAP window too large");

        uint256 previousWindow = twapWindow;
        twapWindow = _newWindowSeconds;

        emit TWAPWindowUpdated(previousWindow, _newWindowSeconds);
    }

    function getLatestCropPrice(bytes32 _cropKey) public view returns (uint256) {
        PriceObservation[] storage observations = priceObservations[_cropKey];
        require(observations.length > 0, "No price observations");
        return observations[observations.length - 1].price;
    }

    function getCropTWAP(bytes32 _cropKey) public view returns (uint256) {
        PriceObservation[] storage observations = priceObservations[_cropKey];
        require(observations.length >= 2, "Insufficient TWAP data");

        uint256 startTime = block.timestamp > twapWindow
            ? block.timestamp - twapWindow
            : 0;

        uint256 weightedPriceSum = 0;
        uint256 cumulativeDuration = 0;
        uint256 cursorTime = block.timestamp;

        for (uint256 i = observations.length; i > 0; i--) {
            PriceObservation storage obs = observations[i - 1];

            if (obs.timestamp < startTime) {
                if (cursorTime > startTime) {
                    uint256 partialDuration = cursorTime - startTime;
                    weightedPriceSum += obs.price * partialDuration;
                    cumulativeDuration += partialDuration;
                }
                break;
            }

            if (cursorTime > obs.timestamp) {
                uint256 duration = cursorTime - obs.timestamp;
                weightedPriceSum += obs.price * duration;
                cumulativeDuration += duration;
            }

            cursorTime = obs.timestamp;
        }

        require(cumulativeDuration > 0, "No TWAP duration");
        return weightedPriceSum / cumulativeDuration;
    }
}
