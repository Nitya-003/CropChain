// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Client.sol";

interface IAny2EVMMessageReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}
