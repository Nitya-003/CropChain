// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";

/**
 * @title IoTDataOracle
 * @dev Connects to off-chain IoT sensor APIs to verify transit conditions (temperature/humidity).
 * Simulates an Oracle integration for automated quality verification.
 */
contract IoTDataOracle is AccessControl {
    bytes32 public constant ORACLE_NODE_ROLE = keccak256("ORACLE_NODE_ROLE");

    struct TransitData {
        int256 averageTemperature;
        int256 averageHumidity;
        int256 maxTemperature;
        bool isSpoiled;
        uint256 recordedAt;
        bool dataExists;
    }

    // Mapping from Batch ID to Transit Data
    mapping(bytes32 => TransitData) public batchTransitData;

    // Thresholds for spoilage (can be configured per crop type in a full implementation)
    int256 public constant MAX_SAFE_TEMP = 10; // e.g., 10 degrees Celsius for cold chain

    event TransitDataRequested(bytes32 indexed batchId);
    event TransitDataFulfilled(bytes32 indexed batchId, int256 avgTemp, int256 avgHumidity, bool isSpoiled);
    event BatchFlaggedSpoiled(bytes32 indexed batchId, string reason);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_NODE_ROLE, msg.sender);
    }

    /**
     * @dev Called by the supply chain contract or distributor to request IoT data upon delivery
     */
    function requestTransitData(bytes32 _batchId) external {
        // In a real Chainlink implementation, this would build a Chainlink.Request
        // For now, we emit an event that our off-chain node listens to
        emit TransitDataRequested(_batchId);
    }

    /**
     * @dev Called by the authorized Oracle Node to fulfill the data request
     */
    function fulfillTransitData(
        bytes32 _batchId,
        int256 _avgTemp,
        int256 _avgHumidity,
        int256 _maxTemp
    ) external onlyRole(ORACLE_NODE_ROLE) {
        bool spoiled = false;
        if (_maxTemp > MAX_SAFE_TEMP) {
            spoiled = true;
            emit BatchFlaggedSpoiled(_batchId, "Maximum safe temperature exceeded during transit");
        }

        batchTransitData[_batchId] = TransitData({
            averageTemperature: _avgTemp,
            averageHumidity: _avgHumidity,
            maxTemperature: _maxTemp,
            isSpoiled: spoiled,
            recordedAt: block.timestamp,
            dataExists: true
        });

        emit TransitDataFulfilled(_batchId, _avgTemp, _avgHumidity, spoiled);
    }

    /**
     * @dev Check if a batch is marked as spoiled based on IoT data
     */
    function isBatchSpoiled(bytes32 _batchId) external view returns (bool) {
        require(batchTransitData[_batchId].dataExists, "No transit data for this batch");
        return batchTransitData[_batchId].isSpoiled;
    }
}
