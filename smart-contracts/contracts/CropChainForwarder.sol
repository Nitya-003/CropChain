// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ForwarderUpgradeable.sol";

/**
 * @title CropChainForwarder
 * @dev Trusted EIP-2771 Forwarder for relaying gasless meta-transactions on CropChain.
 */
contract CropChainForwarder is Initializable, ERC2771ForwarderUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory name) public override initializer {
        __ERC2771Forwarder_init(name);
    }
}
