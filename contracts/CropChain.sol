// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CropChain {

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

    /* ================= STORAGE ================= */

    mapping(bytes32 => CropBatch) public cropBatches;
    mapping(bytes32 => SupplyChainUpdate[]) public batchUpdates;

    mapping(address => ActorRole) public roles;

    bytes32[] public allBatchIds;

    address public owner;
    bool public paused = false;

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

    event Paused(address indexed caller, bool paused);

    /* ================= MODIFIERS ================= */

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
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
    {
        require(_user != address(0), "Invalid address");

        roles[_user] = _role;

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
    {
        require(roles[msg.sender] == ActorRole.Farmer || roles[msg.sender] == ActorRole.Admin,
            "Only farmer/admin");

        require(!cropBatches[_batchId].exists, "Batch exists");
        require(_batchId != bytes32(0), "Invalid batch ID");
        require(bytes(_ipfsCID).length > 0, "Invalid CID");
        require(_quantity > 0, "Invalid quantity");

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
        batchExists(_batchId)
    {
        ActorRole role = roles[msg.sender];

        require(role != ActorRole.None, "No role");
        require(_canUpdate(_stage, role), "Role not allowed");
        require(_isNextStage(_batchId, _stage), "Wrong stage order");

        require(bytes(_actorName).length > 0, "Invalid actor");
        require(bytes(_location).length > 0, "Invalid location");

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
    {
        require(_newOwner != address(0), "Invalid address");

        address previous = owner;

        owner = _newOwner;

        roles[_newOwner] = ActorRole.Admin;

        emit OwnershipTransferred(previous, _newOwner);
    }

    /**
     * @dev Pause/unpause system
     */
    function setPaused(bool _paused)
        public
        onlyOwner
    {
        paused = _paused;

        emit Paused(msg.sender, _paused);
    }
}
