// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CropChain {
    
    struct CropBatch {
        string batchId;
        string farmerName;
        string farmerAddress;
        string cropType;
        uint256 quantity;
        string harvestDate;
        string origin;
        string certifications;
        string description;
        uint256 createdAt;
        address creator;
        bool exists;
        bool isRecalled;   // NEW
    }
    
    struct SupplyChainUpdate {
        string stage; // farmer, mandi, transport, retailer
        string actor;
        string location;
        uint256 timestamp;
        string notes;
        address updatedBy;
    }

    mapping(string => CropBatch) public cropBatches;
    mapping(string => SupplyChainUpdate[]) public batchUpdates;
    mapping(address => bool) public authorizedActors;
    
    string[] public allBatchIds;
    
    address public owner;
    
    event BatchCreated(
        string indexed batchId,
        string farmerName,
        string cropType,
        uint256 quantity,
        address indexed creator
    );
    
    event BatchUpdated(
        string indexed batchId,
        string stage,
        string actor,
        string location,
        address indexed updatedBy
    );
    
    event ActorAuthorized(address indexed actor, bool authorized);
    
    event BatchRecalled(string indexed batchId, address indexed triggeredBy);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            authorizedActors[msg.sender] || msg.sender == owner,
            "Not authorized to perform this action"
        );
        _;
    }
    
    modifier batchExists(string memory _batchId) {
        require(cropBatches[_batchId].exists, "Batch does not exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedActors[msg.sender] = true;
    }
    
    /**
     * @dev Create a new crop batch
     * @param _batchId Unique identifier for the batch
     * @param _farmerName Name of the farmer
     * @param _farmerAddress Address of the farmer
     * @param _cropType Type of crop (rice, wheat, etc.)
     * @param _quantity Quantity in kilograms
     * @param _harvestDate Date of harvest
     * @param _origin Origin location
     * @param _certifications Certifications (organic, fair trade, etc.)
     * @param _description Additional description
     */
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
    ) public onlyAuthorized whenNotPaused {
        require(!cropBatches[_batchId].exists, "Batch already exists");
        require(bytes(_batchId).length > 0, "Batch ID cannot be empty");
        require(bytes(_farmerName).length > 0, "Farmer name cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");
        
        // Create the crop batch
        cropBatches[_batchId] = CropBatch({
            batchId: _batchId,
            farmerName: _farmerName,
            farmerAddress: _farmerAddress,
            cropType: _cropType,
            quantity: _quantity,
            harvestDate: _harvestDate,
            origin: _origin,
            certifications: _certifications,
            description: _description,
            createdAt: block.timestamp,
            creator: msg.sender,
            exists: true,
            isRecalled: false
        });
        
        // Add initial farmer update
        batchUpdates[_batchId].push(SupplyChainUpdate({
            stage: "farmer",
            actor: _farmerName,
            location: _origin,
            timestamp: block.timestamp,
            notes: "Initial harvest recorded",
            updatedBy: msg.sender
        }));
        
        // Add to all batch IDs array
        allBatchIds.push(_batchId);
        
        emit BatchCreated(_batchId, _farmerName, _cropType, _quantity, msg.sender);
    }
    
    /**
     * @dev Add supply chain update to existing batch
     * @param _batchId ID of the batch to update
     * @param _stage Current stage (farmer, mandi, transport, retailer)
     * @param _actor Name of the actor performing the update
     * @param _location Current location
     * @param _notes Additional notes
     */
    function updateBatch(
        string memory _batchId,
        string memory _stage,
        string memory _actor,
        string memory _location,
        string memory _notes
    ) public onlyAuthorized batchExists(_batchId) {
        require(!cropBatches[_batchId].isRecalled, "Batch is recalled");
        require(bytes(_stage).length > 0, "Stage cannot be empty");
        require(bytes(_actor).length > 0, "Actor cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        
        // Add the update
        batchUpdates[_batchId].push(SupplyChainUpdate({
            stage: _stage,
            actor: _actor,
            location: _location,
            timestamp: block.timestamp,
            notes: _notes,
            updatedBy: msg.sender
        }));
        
        emit BatchUpdated(_batchId, _stage, _actor, _location, msg.sender);
    }
    
    /**
     * @dev Recall a batch (emergency/admin function)
     * @param _batchId ID of the batch to recall
     */
    function recallBatch(string memory _batchId)
        public
        onlyOwner
        batchExists(_batchId)
    {
        cropBatches[_batchId].isRecalled = true;

        emit BatchRecalled(_batchId, msg.sender);
    }
    
    /**
     * @dev Get crop batch information
     * @param _batchId ID of the batch
     * @return CropBatch struct
     */
    function getBatch(string memory _batchId) 
        public 
        view 
        batchExists(_batchId) 
        returns (CropBatch memory) 
    {
        return cropBatches[_batchId];
    }
    
    /**
     * @dev Get all updates for a specific batch
     * @param _batchId ID of the batch
     * @return Array of SupplyChainUpdate structs
     */
    function getBatchUpdates(string memory _batchId) 
        public 
        view 
        batchExists(_batchId) 
        returns (SupplyChainUpdate[] memory) 
    {
        return batchUpdates[_batchId];
    }
    
    /**
     * @dev Get total number of batches
     * @return Total count of batches
     */
    function getTotalBatches() public view returns (uint256) {
        return allBatchIds.length;
    }
    
    /**
     * @dev Get batch ID by index
     * @param _index Index in the allBatchIds array
     * @return Batch ID at the specified index
     */
    function getBatchIdByIndex(uint256 _index) public view returns (string memory) {
        require(_index < allBatchIds.length, "Index out of bounds");
        return allBatchIds[_index];
    }
    
    /**
     * @dev Authorize or deauthorize an actor
     * @param _actor Address of the actor
     * @param _authorized True to authorize, false to deauthorize
     */
    function setAuthorizedActor(address _actor, bool _authorized) public onlyOwner {
        authorizedActors[_actor] = _authorized;
        emit ActorAuthorized(_actor, _authorized);
    }
    
    /**
     * @dev Check if an address is authorized
     * @param _actor Address to check
     * @return True if authorized, false otherwise
     */
    function isAuthorized(address _actor) public view returns (bool) {
        return authorizedActors[_actor];
    }
    
    /**
     * @dev Get the latest update for a batch
     * @param _batchId ID of the batch
     * @return Latest SupplyChainUpdate for the batch
     */
    function getLatestUpdate(string memory _batchId) 
        public 
        view 
        batchExists(_batchId) 
        returns (SupplyChainUpdate memory) 
    {
        SupplyChainUpdate[] memory updates = batchUpdates[_batchId];
        require(updates.length > 0, "No updates found for this batch");
        return updates[updates.length - 1];
    }
    
    /**
     * @dev Transfer ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        owner = _newOwner;
        authorizedActors[_newOwner] = true;
    }
    
    /**
     * @dev Emergency function to pause contract operations
     * This is a simple implementation - in production, consider using OpenZeppelin's Pausable
     */
    bool public paused = false;
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    function setPaused(bool _paused) public onlyOwner {
        paused = _paused;
    }
}