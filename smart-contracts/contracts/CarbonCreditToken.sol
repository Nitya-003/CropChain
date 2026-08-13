// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Standard ERC20 interface
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title CarbonCreditToken
 * @dev An ERC-20 token representing Carbon Credits. Minted to farmers based on verified sustainable practices.
 */
contract CarbonCreditToken is IERC20 {
    string public constant name = "CropChain Carbon Credit";
    string public constant symbol = "CCC";
    uint8 public constant decimals = 18;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Trusted addresses (e.g. backend oracle/auditor) that can mint credits
    mapping(address => bool) public authorizedMinters;
    
    address public owner;

    // Track offset logic per farmer
    struct FarmerMetrics {
        uint256 totalSequestered; // Total carbon sequestered in kg
        uint256 totalMinted;      // Total tokens minted for this farmer
    }

    mapping(address => FarmerMetrics) public farmerMetrics;

    event CreditsMinted(address indexed farmer, uint256 amount, string practiceDetails);
    event ConsumerTip(address indexed consumer, address indexed farmer, uint256 amount);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "Not an authorized minter");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedMinters[msg.sender] = true;
    }

    // --- ERC20 Standard Implementation ---
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "Transfer amount exceeds allowance");
        unchecked {
            _approve(sender, msg.sender, currentAllowance - amount);
        }
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "Transfer from zero address");
        require(recipient != address(0), "Transfer to zero address");

        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "Transfer amount exceeds balance");
        unchecked {
            _balances[sender] = senderBalance - amount;
            _balances[recipient] += amount;
        }

        emit Transfer(sender, recipient, amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_ != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");

        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }

    // --- Carbon Credit Logic ---

    function addMinter(address _minter) external onlyOwner {
        authorizedMinters[_minter] = true;
        emit MinterAdded(_minter);
    }

    function removeMinter(address _minter) external onlyOwner {
        authorizedMinters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    /**
     * @dev Called by the backend logic after verifying a sustainable practice.
     * @param _farmer The farmer receiving the credits
     * @param _amount The amount of CCC tokens to mint (1 token = 1 kg CO2 sequestered, e.g.)
     * @param _practiceDetails IPFS CID or text describing the verified practice
     */
    function mintCredits(address _farmer, uint256 _amount, string calldata _practiceDetails) external onlyMinter {
        require(_farmer != address(0), "Cannot mint to zero address");
        
        _totalSupply += _amount;
        _balances[_farmer] += _amount;
        
        farmerMetrics[_farmer].totalSequestered += _amount;
        farmerMetrics[_farmer].totalMinted += _amount;

        emit Transfer(address(0), _farmer, _amount);
        emit CreditsMinted(_farmer, _amount, _practiceDetails);
    }

    /**
     * @dev Allows a consumer to tip a farmer directly in CCC tokens (or potentially native token)
     * For this implementation, the consumer transfers their own CCC tokens as a tip, or burns them
     * to offset their own footprint and rewards the farmer.
     */
    function tipFarmerForOffset(address _farmer, uint256 _amount) external {
        require(_balances[msg.sender] >= _amount, "Insufficient CCC tokens to tip");
        _transfer(msg.sender, _farmer, _amount);
        emit ConsumerTip(msg.sender, _farmer, _amount);
    }
}
