// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BusinessRewards.sol";

contract GuateRewardsFactory is Ownable {
    struct BusinessProgram {
        address contractAddress;
        string businessName;
        address businessOwner;
        uint256 createdAt;
        bool isActive;
    }
    
    mapping(address => BusinessProgram[]) public businessPrograms;
    mapping(address => BusinessProgram) public programsByAddress;
    address[] public allPrograms;
    
    uint256 public platformFeePercentage = 250; // 2.5% platform fee
    address public platformWallet;
    address public sponsorWallet; // For gasless transactions
    
    event ProgramCreated(
        address indexed contractAddress,
        string businessName,
        address indexed businessOwner,
        uint256 timestamp
    );
    
    event ExperienceMinted(
        address indexed program,
        address indexed customer,
        uint256 tokenId,
        string experienceURI
    );
    
    constructor(address _sponsorWallet) Ownable(msg.sender) {
        platformWallet = msg.sender;
        sponsorWallet = _sponsorWallet;
    }
    
    function createBusinessProgram(
        string memory _businessName,
        uint256 _pointsPerGTQ,
        uint256 _experienceMultiplier,
        bool _burnToRedeemEnabled
    ) external returns (address) {
        BusinessRewards newProgram = new BusinessRewards(
            _businessName,
            msg.sender,
            address(this),
            _pointsPerGTQ,
            _experienceMultiplier,
            _burnToRedeemEnabled
        );
        
        address programAddress = address(newProgram);
        
        BusinessProgram memory program = BusinessProgram({
            contractAddress: programAddress,
            businessName: _businessName,
            businessOwner: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });
        
        businessPrograms[msg.sender].push(program);
        programsByAddress[programAddress] = program;
        allPrograms.push(programAddress);
        
        emit ProgramCreated(
            programAddress,
            _businessName,
            msg.sender,
            block.timestamp
        );
        
        return programAddress;
    }
    
    function sponsorMintReward(
        address _program,
        address _customer,
        uint256 _points,
        uint256 _purchaseAmount
    ) external {
        require(msg.sender == sponsorWallet, "Only sponsor wallet");
        require(programsByAddress[_program].isActive, "Program not active");
        
        BusinessRewards(payable(_program)).mintReward(_customer, _points, _purchaseAmount);
    }
    
    function sponsorMintExperience(
        address _program,
        address _customer,
        string memory _experienceURI,
        uint256 _purchaseId
    ) external {
        require(msg.sender == sponsorWallet, "Only sponsor wallet");
        require(programsByAddress[_program].isActive, "Program not active");
        
        uint256 tokenId = BusinessRewards(payable(_program)).mintExperience(
            _customer,
            _experienceURI,
            _purchaseId
        );
        
        emit ExperienceMinted(_program, _customer, tokenId, _experienceURI);
    }
    
    function sponsorBurnReward(
        address _program,
        uint256 _tokenId,
        address _customer
    ) external {
        require(msg.sender == sponsorWallet, "Only sponsor wallet");
        BusinessRewards(payable(_program)).burnReward(_tokenId, _customer);
    }
    
    function deactivateProgram(address _program) external {
        require(
            msg.sender == programsByAddress[_program].businessOwner || 
            msg.sender == owner(),
            "Not authorized"
        );
        programsByAddress[_program].isActive = false;
    }
    
    function setPlatformFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Max 10% fee");
        platformFeePercentage = _feePercentage;
    }
    
    function setSponsorWallet(address _sponsorWallet) external onlyOwner {
        sponsorWallet = _sponsorWallet;
    }
    
    function getBusinessPrograms(address _owner) 
        external 
        view 
        returns (BusinessProgram[] memory) 
    {
        return businessPrograms[_owner];
    }
    
    function getAllPrograms() external view returns (address[] memory) {
        return allPrograms;
    }
    
    function getProgramCount() external view returns (uint256) {
        return allPrograms.length;
    }
}