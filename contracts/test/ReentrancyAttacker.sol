// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../CropChain.sol";

contract ReentrancyAttacker {
    CropChain public immutable target;

    uint256 public withdrawAmount;
    uint256 public maxReentries;
    uint256 public reentryCount;
    bool public attackInProgress;
    bool public reentryBlocked;

    constructor(address _target) {
        target = CropChain(_target);
    }

    function depositToTarget() external payable {
        require(msg.value > 0, "No value");
        target.depositLiquidity{value: msg.value}();
    }

    function initiateAttack(uint256 _withdrawAmount, uint256 _maxReentries) external {
        require(_withdrawAmount > 0, "Amount must be > 0");

        withdrawAmount = _withdrawAmount;
        maxReentries = _maxReentries;
        reentryCount = 0;
        reentryBlocked = false;
        attackInProgress = true;

        target.withdrawLiquidity(_withdrawAmount);

        attackInProgress = false;
    }

    receive() external payable {
        if (!attackInProgress || reentryCount >= maxReentries) {
            return;
        }

        reentryCount += 1;

        try target.withdrawLiquidity(withdrawAmount) {
            // If this succeeds, the target is vulnerable.
        } catch {
            reentryBlocked = true;
        }
    }
}
