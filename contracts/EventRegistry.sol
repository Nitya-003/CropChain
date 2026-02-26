// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EventRegistry {

    mapping(bytes32 => bool) private _registered;
    bytes32[] private _eventList;

    address public owner;

    event EventRegistered(bytes32 indexed eventHash, address indexed caller, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerEvent(bytes32 eventHash) external {
        require(eventHash != bytes32(0), "Invalid hash");
        require(!_registered[eventHash], "Already registered");

        _registered[eventHash] = true;
        _eventList.push(eventHash);

        emit EventRegistered(eventHash, msg.sender, block.timestamp);
    }

    function isEventRegistered(bytes32 eventHash) external view returns (bool) {
        return _registered[eventHash];
    }

    function totalEvents() external view returns (uint256) {
        return _eventList.length;
    }

    function getEventByIndex(uint256 index) external view returns (bytes32) {
        require(index < _eventList.length, "Out of bounds");
        return _eventList[index];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }
}