// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../ccip/Client.sol";
import "../ccip/IRouterClient.sol";
import "../ccip/IAny2EVMMessageReceiver.sol";

contract MockCCIPRouter is IRouterClient {
    uint256 public fee;
    uint256 public nonce;

    struct QueuedMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
    }

    mapping(bytes32 => QueuedMessage) public queuedMessages;

    event MessageQueued(bytes32 indexed messageId, uint64 indexed destinationChainSelector, bytes receiver, bytes sender, bytes data);

    function setFee(uint256 newFee) external {
        fee = newFee;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external view override returns (uint256) {
        return fee;
    }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external
        payable
        override
        returns (bytes32)
    {
        require(msg.value >= fee, "insufficient fee");

        unchecked {
            nonce += 1;
        }

        bytes32 messageId = keccak256(abi.encodePacked(block.chainid, msg.sender, nonce, message.data));

        queuedMessages[messageId] = QueuedMessage({
            messageId: messageId,
            sourceChainSelector: destinationChainSelector,
            sender: abi.encode(msg.sender),
            data: message.data
        });

        emit MessageQueued(messageId, destinationChainSelector, message.receiver, abi.encode(msg.sender), message.data);

        return messageId;
    }

    function deliverToReceiver(bytes32 messageId, address receiver, uint64 sourceChainSelector, address sourceSender) external {
        QueuedMessage memory queued = queuedMessages[messageId];
        require(queued.messageId != bytes32(0), "message missing");

        Client.Any2EVMMessage memory inbound = Client.Any2EVMMessage({
            messageId: queued.messageId,
            sourceChainSelector: sourceChainSelector,
            sender: abi.encode(sourceSender),
            data: queued.data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        IAny2EVMMessageReceiver(receiver).ccipReceive(inbound);
    }
}
