// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IoTQualityOracle
 * @dev Smart contract to verify crop shipment conditions using IoT sensor data via Oracles.
 */
contract IoTQualityOracle {
    
    struct ShipmentConfig {
        uint256 minTemp; // Minimum safe temperature (e.g., in Celsius * 100)
        uint256 maxTemp; // Maximum safe temperature (e.g., in Celsius * 100)
        uint256 maxHumidity; // Maximum safe humidity percentage
        bool isConfigured;
    }

    struct ShipmentStatus {
        bool isDelivered;
        bool qualityCompromised;
        string reason; // Reason if compromised (e.g., "Temperature Exceeded")
    }

    // Mapping from Batch ID to its required environmental configurations
    mapping(bytes32 => ShipmentConfig) public shipmentConfigs;
    
    // Mapping from Batch ID to its current status
    mapping(bytes32 => ShipmentStatus) public shipmentStatuses;

    // Authorized oracle addresses allowed to write sensor data
    mapping(address => bool) public authorizedOracles;

    address public owner;

    event ShipmentConfigured(bytes32 indexed batchId, uint256 minTemp, uint256 maxTemp, uint256 maxHumidity);
    event QualityCompromised(bytes32 indexed batchId, string reason);
    event ShipmentVerified(bytes32 indexed batchId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Not an authorized oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Add an authorized oracle node address that pushes IoT data.
     */
    function addOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = true;
    }

    /**
     * @dev Configure the safe environmental thresholds for a specific batch before transit.
     */
    function configureShipment(
        bytes32 _batchId, 
        uint256 _minTemp, 
        uint256 _maxTemp, 
        uint256 _maxHumidity
    ) external {
        // Assuming only the distributor/farmer can configure it. Adding simple access logic.
        require(!shipmentConfigs[_batchId].isConfigured, "Shipment already configured");
        
        shipmentConfigs[_batchId] = ShipmentConfig({
            minTemp: _minTemp,
            maxTemp: _maxTemp,
            maxHumidity: _maxHumidity,
            isConfigured: true
        });

        emit ShipmentConfigured(_batchId, _minTemp, _maxTemp, _maxHumidity);
    }

    /**
     * @dev The Oracle calls this function upon delivery or periodically during transit
     *      to verify if conditions were met.
     */
    function verifyTransitConditions(
        bytes32 _batchId, 
        uint256 _recordedMaxTemp, 
        uint256 _recordedMinTemp,
        uint256 _recordedAvgHumidity
    ) external onlyOracle {
        require(shipmentConfigs[_batchId].isConfigured, "Shipment not configured");
        require(!shipmentStatuses[_batchId].isDelivered, "Shipment already marked delivered");

        ShipmentConfig memory config = shipmentConfigs[_batchId];
        
        bool isCompromised = false;
        string memory reason = "";

        if (_recordedMaxTemp > config.maxTemp) {
            isCompromised = true;
            reason = "Max Temperature Exceeded";
        } else if (_recordedMinTemp < config.minTemp) {
            isCompromised = true;
            reason = "Min Temperature Dropped";
        } else if (_recordedAvgHumidity > config.maxHumidity) {
            isCompromised = true;
            reason = "Max Humidity Exceeded";
        }

        if (isCompromised) {
            shipmentStatuses[_batchId] = ShipmentStatus({
                isDelivered: true,
                qualityCompromised: true,
                reason: reason
            });
            emit QualityCompromised(_batchId, reason);
        } else {
            shipmentStatuses[_batchId] = ShipmentStatus({
                isDelivered: true,
                qualityCompromised: false,
                reason: "Optimal"
            });
            emit ShipmentVerified(_batchId);
        }
    }
}
