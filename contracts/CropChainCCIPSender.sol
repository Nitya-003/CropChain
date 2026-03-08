// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./lib/openzeppelin/access/AccessControl.sol";
import "./lib/openzeppelin/security/Pausable.sol";
import "./lib/openzeppelin/security/ReentrancyGuard.sol";
import "./ccip/Client.sol";
import "./ccip/IRouterClient.sol";

contract CropChainCCIPSender is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant CCIP_SENDER_ROLE = keccak256("CCIP_SENDER_ROLE");

    struct RetailerProofPayload {
        bytes32 batchId;
        string actorName;
        string location;
        uint64 deliveredAt;
        string notes;
        address farmer;
        uint256 quantity;
        string ipfsCID;
    }

    IRouterClient public immutable router;

    uint64 public destinationChainSelector;
    address public destinationReceiver;

    mapping(address => uint256) public paymasterCredits;

    event DestinationConfigured(uint64 indexed chainSelector, address indexed receiver);
    event PaymasterCreditFunded(address indexed farmer, uint256 amount);
    event PaymasterCreditDebited(address indexed farmer, uint256 amount, uint256 remainingBalance);
    event RetailerProofDispatched(
        bytes32 indexed messageId,
        bytes32 indexed batchId,
        address indexed farmer,
        uint256 feePaid,
        uint64 destinationChainSelector,
        address destinationReceiver
    );

    constructor(address routerAddress) {
        require(routerAddress != address(0), "Invalid router");

        router = IRouterClient(routerAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CCIP_SENDER_ROLE, msg.sender);
    }

    function setDestination(uint64 chainSelector, address receiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(chainSelector > 0, "Invalid chain");
        require(receiver != address(0), "Invalid receiver");

        destinationChainSelector = chainSelector;
        destinationReceiver = receiver;

        emit DestinationConfigured(chainSelector, receiver);
    }

    function fundPaymasterCredit(address farmer) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
        require(farmer != address(0), "Invalid farmer");
        require(msg.value > 0, "No value");

        paymasterCredits[farmer] += msg.value;
        emit PaymasterCreditFunded(farmer, msg.value);
    }

    function syncRetailerProof(RetailerProofPayload calldata payload)
        external
        onlyRole(CCIP_SENDER_ROLE)
        whenNotPaused
        nonReentrant
        returns (bytes32 messageId)
    {
        require(destinationChainSelector > 0, "Destination not set");
        require(destinationReceiver != address(0), "Receiver not set");
        require(payload.batchId != bytes32(0), "Invalid batchId");
        require(payload.farmer != address(0), "Invalid farmer");

        bytes memory data = abi.encode(payload);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationReceiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: ""
        });

        uint256 fee = router.getFee(destinationChainSelector, message);
        uint256 farmerCredit = paymasterCredits[payload.farmer];
        require(farmerCredit >= fee, "Insufficient paymaster credit");

        unchecked {
            paymasterCredits[payload.farmer] = farmerCredit - fee;
        }

        emit PaymasterCreditDebited(payload.farmer, fee, paymasterCredits[payload.farmer]);

        messageId = router.ccipSend{value: fee}(destinationChainSelector, message);

        emit RetailerProofDispatched(
            messageId,
            payload.batchId,
            payload.farmer,
            fee,
            destinationChainSelector,
            destinationReceiver
        );
    }

    function quoteFee(RetailerProofPayload calldata payload) external view returns (uint256) {
        require(destinationChainSelector > 0, "Destination not set");
        require(destinationReceiver != address(0), "Receiver not set");

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationReceiver),
            data: abi.encode(payload),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(0),
            extraArgs: ""
        });

        return router.getFee(destinationChainSelector, message);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function withdraw(address payable to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {

        require(to != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    receive() external payable {}
}
