// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EcoPointsToken
 * @dev A gamified token system to incentivize sustainable farming practices.
 *      Farmers earn "Eco-Points" for logging eco-friendly actions, climbing a leaderboard,
 *      and unlocking achievements. Points can be redeemed in a reward store.
 */
contract EcoPointsToken {
    string public name = "CropChain EcoPoints";
    string public symbol = "ECO";
    uint8 public decimals = 0; // Points are whole numbers

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public lifetimePoints; // Used for leaderboard/achievements without penalizing spent points
    
    // Achievement tracking (Farmer Address => Achievement ID => Unlocked Status)
    mapping(address => mapping(string => bool)) public achievements;
    
    // List of active farmers for frontend leaderboard indexing
    address[] public activeFarmers;
    mapping(address => bool) public isActiveFarmer;

    address public owner;
    
    // Oracle/Backend addresses allowed to mint points for verified actions
    mapping(address => bool) public authorizedValidators;

    event PointsMinted(address indexed farmer, uint256 amount, string reason);
    event PointsRedeemed(address indexed farmer, uint256 amount, string rewardId);
    event AchievementUnlocked(address indexed farmer, string achievementId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyValidator() {
        require(authorizedValidators[msg.sender], "Not an authorized validator");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedValidators[msg.sender] = true;
    }

    function addValidator(address _validator) external onlyOwner {
        authorizedValidators[_validator] = true;
    }

    function removeValidator(address _validator) external onlyOwner {
        authorizedValidators[_validator] = false;
    }

    /**
     * @dev Mint Eco-Points to a farmer for logging a verified sustainable action.
     * @param _farmer The farmer's address
     * @param _amount The amount of points to award
     * @param _reason Description of the sustainable action (e.g., "Used 20% less water")
     */
    function awardPoints(address _farmer, uint256 _amount, string calldata _reason) external onlyValidator {
        if (!isActiveFarmer[_farmer]) {
            isActiveFarmer[_farmer] = true;
            activeFarmers.push(_farmer);
        }

        balanceOf[_farmer] += _amount;
        lifetimePoints[_farmer] += _amount;

        emit PointsMinted(_farmer, _amount, _reason);
        
        // Auto-check for baseline achievements in the smart contract
        _checkAchievements(_farmer, lifetimePoints[_farmer]);
    }

    /**
     * @dev Allows the farmer to redeem their Eco-Points for real-world rewards (e.g., discounted seeds).
     *      The actual fulfillment of the reward is handled off-chain via event listeners.
     */
    function redeemReward(uint256 _cost, string calldata _rewardId) external {
        require(balanceOf[msg.sender] >= _cost, "Insufficient Eco-Points");
        
        balanceOf[msg.sender] -= _cost;
        
        emit PointsRedeemed(msg.sender, _cost, _rewardId);
    }

    /**
     * @dev Direct manual achievement unlock (e.g., triggered by backend computer vision verifying a new irrigation setup)
     */
    function unlockAchievement(address _farmer, string calldata _achievementId) external onlyValidator {
        require(!achievements[_farmer][_achievementId], "Achievement already unlocked");
        
        achievements[_farmer][_achievementId] = true;
        emit AchievementUnlocked(_farmer, _achievementId);
    }

    /**
     * @dev Internal milestone check based purely on accumulated points.
     */
    function _checkAchievements(address _farmer, uint256 _totalPoints) internal {
        if (_totalPoints >= 1000 && !achievements[_farmer]["ECO_STARTER"]) {
            achievements[_farmer]["ECO_STARTER"] = true;
            emit AchievementUnlocked(_farmer, "ECO_STARTER");
        }
        if (_totalPoints >= 5000 && !achievements[_farmer]["WATER_SAVER_PRO"]) {
            achievements[_farmer]["WATER_SAVER_PRO"] = true;
            emit AchievementUnlocked(_farmer, "WATER_SAVER_PRO");
        }
        if (_totalPoints >= 10000 && !achievements[_farmer]["CARBON_HERO"]) {
            achievements[_farmer]["CARBON_HERO"] = true;
            emit AchievementUnlocked(_farmer, "CARBON_HERO");
        }
    }

    /**
     * @dev Helper for the frontend Leaderboard UI to iterate over farmers and get their lifetime points.
     */
    function getActiveFarmersCount() external view returns (uint256) {
        return activeFarmers.length;
    }
}
