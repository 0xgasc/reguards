// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract BusinessRewards is ERC1155, Ownable, ReentrancyGuard {
    using Strings for uint256;
    
    string public businessName;
    address public factoryAddress;
    
    // Token IDs
    uint256 public constant POINTS_TOKEN_ID = 0;
    uint256 public nextExperienceTokenId = 1000000; // Start experience NFTs at 1M
    
    // Reward Configuration
    uint256 public pointsPerGTQ;
    uint256 public experienceMultiplier; // Extra points for creating experiences
    bool public burnToRedeemEnabled;
    
    // Experience NFT Data
    struct Experience {
        uint256 tokenId;
        address creator;
        uint256 purchaseId;
        uint256 timestamp;
        string metadataURI;
        uint256 bonusPoints;
        bool isRedeemed;
    }
    
    mapping(uint256 => Experience) public experiences;
    mapping(address => uint256[]) public userExperiences;
    mapping(uint256 => uint256) public purchaseToExperience; // purchaseId => experienceTokenId
    
    // Redemption Tiers
    struct RedemptionTier {
        string name;
        uint256 pointsCost;
        string description;
        bool isActive;
    }
    
    RedemptionTier[] public redemptionTiers;
    
    // Stats
    uint256 public totalPointsIssued;
    uint256 public totalPointsBurned;
    uint256 public totalExperiencesCreated;
    mapping(address => uint256) public customerLifetimeValue;
    mapping(address => uint256) public customerPointsEarned;
    mapping(address => uint256) public customerPointsRedeemed;
    
    // Events
    event PointsEarned(address indexed customer, uint256 points, uint256 purchaseAmount);
    event ExperienceCreated(address indexed creator, uint256 tokenId, uint256 bonusPoints);
    event PointsRedeemed(address indexed customer, uint256 points, string redemptionType);
    event RedemptionTierAdded(uint256 tierId, string name, uint256 pointsCost);
    
    modifier onlyFactoryOrOwner() {
        require(msg.sender == factoryAddress || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor(
        string memory _businessName,
        address _owner,
        address _factory,
        uint256 _pointsPerGTQ,
        uint256 _experienceMultiplier,
        bool _burnToRedeemEnabled
    ) ERC1155("") Ownable(_owner) {
        businessName = _businessName;
        factoryAddress = _factory;
        pointsPerGTQ = _pointsPerGTQ;
        experienceMultiplier = _experienceMultiplier;
        burnToRedeemEnabled = _burnToRedeemEnabled;
        
        // Add default redemption tiers
        _addDefaultRedemptionTiers();
    }
    
    function mintReward(
        address _customer,
        uint256 _points,
        uint256 _purchaseAmount
    ) external onlyFactoryOrOwner {
        _mint(_customer, POINTS_TOKEN_ID, _points, "");
        
        totalPointsIssued += _points;
        customerLifetimeValue[_customer] += _purchaseAmount;
        customerPointsEarned[_customer] += _points;
        
        emit PointsEarned(_customer, _points, _purchaseAmount);
    }
    
    function mintExperience(
        address _customer,
        string memory _experienceURI,
        uint256 _purchaseId
    ) external onlyFactoryOrOwner returns (uint256) {
        require(purchaseToExperience[_purchaseId] == 0, "Experience already exists for this purchase");
        
        uint256 experienceId = nextExperienceTokenId++;
        uint256 bonusPoints = pointsPerGTQ * experienceMultiplier;
        
        // Create the experience NFT
        _mint(_customer, experienceId, 1, "");
        
        // Award bonus points for creating an experience
        if (bonusPoints > 0) {
            _mint(_customer, POINTS_TOKEN_ID, bonusPoints, "");
            totalPointsIssued += bonusPoints;
            customerPointsEarned[_customer] += bonusPoints;
        }
        
        // Store experience data
        experiences[experienceId] = Experience({
            tokenId: experienceId,
            creator: _customer,
            purchaseId: _purchaseId,
            timestamp: block.timestamp,
            metadataURI: _experienceURI,
            bonusPoints: bonusPoints,
            isRedeemed: false
        });
        
        userExperiences[_customer].push(experienceId);
        purchaseToExperience[_purchaseId] = experienceId;
        totalExperiencesCreated++;
        
        emit ExperienceCreated(_customer, experienceId, bonusPoints);
        
        return experienceId;
    }
    
    function burnReward(uint256 _tokenId, address _customer) external onlyFactoryOrOwner {
        require(burnToRedeemEnabled, "Burn to redeem not enabled");
        
        if (_tokenId == POINTS_TOKEN_ID) {
            // Burning points
            uint256 balance = balanceOf(_customer, POINTS_TOKEN_ID);
            require(balance > 0, "No points to burn");
            _burn(_customer, POINTS_TOKEN_ID, balance);
            totalPointsBurned += balance;
            customerPointsRedeemed[_customer] += balance;
            emit PointsRedeemed(_customer, balance, "Burned for reward");
        } else {
            // Burning an experience NFT
            require(balanceOf(_customer, _tokenId) > 0, "Don't own this experience");
            _burn(_customer, _tokenId, 1);
            experiences[_tokenId].isRedeemed = true;
            emit PointsRedeemed(_customer, 1, "Experience redeemed");
        }
    }
    
    function redeemPoints(uint256 _tierId) external nonReentrant {
        require(_tierId < redemptionTiers.length, "Invalid tier");
        RedemptionTier memory tier = redemptionTiers[_tierId];
        require(tier.isActive, "Tier not active");
        
        uint256 balance = balanceOf(msg.sender, POINTS_TOKEN_ID);
        require(balance >= tier.pointsCost, "Insufficient points");
        
        _burn(msg.sender, POINTS_TOKEN_ID, tier.pointsCost);
        totalPointsBurned += tier.pointsCost;
        customerPointsRedeemed[msg.sender] += tier.pointsCost;
        
        emit PointsRedeemed(msg.sender, tier.pointsCost, tier.name);
    }
    
    function addRedemptionTier(
        string memory _name,
        uint256 _pointsCost,
        string memory _description
    ) external onlyOwner {
        redemptionTiers.push(RedemptionTier({
            name: _name,
            pointsCost: _pointsCost,
            description: _description,
            isActive: true
        }));
        
        emit RedemptionTierAdded(redemptionTiers.length - 1, _name, _pointsCost);
    }
    
    function _addDefaultRedemptionTiers() private {
        redemptionTiers.push(RedemptionTier({
            name: "Free Coffee",
            pointsCost: 100,
            description: "Redeem for a free coffee",
            isActive: true
        }));
        
        redemptionTiers.push(RedemptionTier({
            name: "10% Discount",
            pointsCost: 50,
            description: "10% off your next purchase",
            isActive: true
        }));
        
        redemptionTiers.push(RedemptionTier({
            name: "Free Dessert",
            pointsCost: 150,
            description: "Any dessert on the menu",
            isActive: true
        }));
    }
    
    function uri(uint256 _tokenId) public view override returns (string memory) {
        if (_tokenId == POINTS_TOKEN_ID) {
            // Points token metadata
            return string(abi.encodePacked(
                "data:application/json;base64,",
                _encode(bytes(string(abi.encodePacked(
                    '{"name":"', businessName, ' Loyalty Points",',
                    '"description":"Loyalty points for ', businessName, '",',
                    '"image":"https://api.guaterewards.com/points/', 
                    Strings.toHexString(uint160(address(this)), 20), '.png"}'
                ))))
            ));
        } else if (experiences[_tokenId].tokenId != 0) {
            // Experience NFT metadata
            return experiences[_tokenId].metadataURI;
        }
        return "";
    }
    
    function getUserExperiences(address _user) external view returns (uint256[] memory) {
        return userExperiences[_user];
    }
    
    function getRedemptionTiers() external view returns (RedemptionTier[] memory) {
        return redemptionTiers;
    }
    
    function getCustomerStats(address _customer) external view returns (
        uint256 currentPoints,
        uint256 lifetimeEarned,
        uint256 lifetimeRedeemed,
        uint256 lifetimeValue,
        uint256 experienceCount
    ) {
        return (
            balanceOf(_customer, POINTS_TOKEN_ID),
            customerPointsEarned[_customer],
            customerPointsRedeemed[_customer],
            customerLifetimeValue[_customer],
            userExperiences[_customer].length
        );
    }
    
    function updateConfiguration(
        uint256 _pointsPerGTQ,
        uint256 _experienceMultiplier,
        bool _burnToRedeemEnabled
    ) external onlyOwner {
        pointsPerGTQ = _pointsPerGTQ;
        experienceMultiplier = _experienceMultiplier;
        burnToRedeemEnabled = _burnToRedeemEnabled;
    }
    
    function _encode(bytes memory data) private pure returns (string memory) {
        // Base64 encoding for JSON metadata
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        string memory result = "";
        
        // Simplified base64 encoding (you might want to use a library for production)
        return string(data); // Placeholder - use proper base64 encoding library
    }
}