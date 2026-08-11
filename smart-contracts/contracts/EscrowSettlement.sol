// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Interface for a standard ERC20 Token (e.g. USDC, USDT)
 */
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/**
 * @title EscrowSettlement
 * @dev Automated escrow contract for farm-to-fork transactions. Funds are locked by the distributor
 *      and released to the farmer upon confirmed delivery, or refunded upon verified dispute.
 */
contract EscrowSettlement {

    enum EscrowState { AWAITING_PAYMENT, AWAITING_DELIVERY, COMPLETED, DISPUTED, REFUNDED }

    struct Transaction {
        bytes32 batchId;
        address farmer;
        address distributor;
        uint256 amount;
        address tokenAddress; // The ERC20 stablecoin used for payment
        EscrowState state;
    }

    mapping(bytes32 => Transaction) public transactions;
    
    // For automated triggers, we trust certain logistics Oracles or delivery APIs
    mapping(address => bool) public trustedDeliveryOracles;
    
    address public owner;

    event EscrowInitiated(bytes32 indexed batchId, address indexed distributor, address indexed farmer, uint256 amount);
    event FundsLocked(bytes32 indexed batchId);
    event EscrowCompleted(bytes32 indexed batchId, address indexed farmer);
    event DisputeRaised(bytes32 indexed batchId);
    event EscrowRefunded(bytes32 indexed batchId, address indexed distributor);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyOracle() {
        require(trustedDeliveryOracles[msg.sender], "Not a trusted delivery oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Add an authorized oracle that can confirm deliveries.
     */
    function addDeliveryOracle(address _oracle) external onlyOwner {
        trustedDeliveryOracles[_oracle] = true;
    }

    /**
     * @dev Step 1: Distributor creates the transaction and locks funds in the escrow.
     *      Distributor must have already approved the EscrowSettlement contract to spend `_amount` of `_tokenAddress`.
     */
    function lockFunds(
        bytes32 _batchId,
        address _farmer,
        uint256 _amount,
        address _tokenAddress
    ) external {
        require(transactions[_batchId].amount == 0, "Transaction already exists");
        
        // Transfer funds from distributor to this escrow contract
        bool success = IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount);
        require(success, "Token transfer failed");

        transactions[_batchId] = Transaction({
            batchId: _batchId,
            farmer: _farmer,
            distributor: msg.sender,
            amount: _amount,
            tokenAddress: _tokenAddress,
            state: EscrowState.AWAITING_DELIVERY
        });

        emit EscrowInitiated(_batchId, msg.sender, _farmer, _amount);
        emit FundsLocked(_batchId);
    }

    /**
     * @dev Step 2: The distributor manually confirms receipt of goods, OR an Oracle confirms delivery.
     *      Funds are instantly released to the farmer.
     */
    function confirmDelivery(bytes32 _batchId) external {
        Transaction storage txn = transactions[_batchId];
        require(txn.state == EscrowState.AWAITING_DELIVERY, "Invalid state for delivery confirmation");
        require(msg.sender == txn.distributor || trustedDeliveryOracles[msg.sender], "Not authorized to confirm delivery");

        txn.state = EscrowState.COMPLETED;

        // Release funds to the farmer
        bool success = IERC20(txn.tokenAddress).transfer(txn.farmer, txn.amount);
        require(success, "Payment to farmer failed");

        emit EscrowCompleted(_batchId, txn.farmer);
    }

    /**
     * @dev Either party can raise a dispute if goods are damaged or not delivered.
     */
    function raiseDispute(bytes32 _batchId) external {
        Transaction storage txn = transactions[_batchId];
        require(txn.state == EscrowState.AWAITING_DELIVERY, "Can only dispute before completion");
        require(msg.sender == txn.farmer || msg.sender == txn.distributor, "Not a party to this transaction");

        txn.state = EscrowState.DISPUTED;
        emit DisputeRaised(_batchId);
    }

    /**
     * @dev Owner (or decentralized governance/arbitration contract) resolves the dispute in favor of the distributor.
     */
    function resolveDisputeRefund(bytes32 _batchId) external onlyOwner {
        Transaction storage txn = transactions[_batchId];
        require(txn.state == EscrowState.DISPUTED, "Transaction not in dispute");

        txn.state = EscrowState.REFUNDED;

        // Refund the distributor
        bool success = IERC20(txn.tokenAddress).transfer(txn.distributor, txn.amount);
        require(success, "Refund transfer failed");

        emit EscrowRefunded(_batchId, txn.distributor);
    }
    
    /**
     * @dev Owner resolves the dispute in favor of the farmer (e.g., distributor false claim).
     */
    function resolveDisputeComplete(bytes32 _batchId) external onlyOwner {
        Transaction storage txn = transactions[_batchId];
        require(txn.state == EscrowState.DISPUTED, "Transaction not in dispute");

        txn.state = EscrowState.COMPLETED;

        // Pay the farmer
        bool success = IERC20(txn.tokenAddress).transfer(txn.farmer, txn.amount);
        require(success, "Payment to farmer failed");

        emit EscrowCompleted(_batchId, txn.farmer);
    }
}
