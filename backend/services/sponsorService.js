const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const User = require('../models/User');

// Initialize provider and sponsor wallet
const provider = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
);

// Initialize sponsor wallet only if private key is provided
let sponsorWallet;
if (process.env.SPONSOR_PRIVATE_KEY && process.env.SPONSOR_PRIVATE_KEY !== 'placeholder') {
    sponsorWallet = new ethers.Wallet(process.env.SPONSOR_PRIVATE_KEY, provider);
} else {
    console.warn('⚠️  SPONSOR_PRIVATE_KEY not configured - sponsor transactions will fail');
}

// Contract ABIs (simplified - import from compiled contracts in production)
const FACTORY_ABI = [
    "function sponsorMintReward(address _program, address _customer, uint256 _points, uint256 _purchaseAmount) external",
    "function sponsorMintExperience(address _program, address _customer, string memory _experienceURI, uint256 _purchaseId) external returns (uint256)",
    "function sponsorBurnReward(address _program, uint256 _tokenId, address _customer) external",
    "function createBusinessProgram(string memory _businessName, uint256 _pointsPerGTQ, uint256 _experienceMultiplier, bool _burnToRedeemEnabled) external returns (address)"
];

// Initialize factory contract only if sponsor wallet is available
let factoryContract;
if (sponsorWallet) {
    factoryContract = new ethers.Contract(
        process.env.FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
        FACTORY_ABI,
        sponsorWallet
    );
}

// Authenticate middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Record purchase and mint rewards
router.post('/record-purchase', authenticateToken, async (req, res) => {
    try {
        if (!sponsorWallet || !factoryContract) {
            return res.status(500).json({ error: 'Sponsor wallet not configured' });
        }
        
        const { 
            businessProgramAddress,
            customerEmail,
            purchaseAmount, // in GTQ
            pointsPerGTQ = 1
        } = req.body;
        
        if (!businessProgramAddress || !customerEmail || !purchaseAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Get or create customer
        let customer = await User.findOne({ email: customerEmail });
        
        if (!customer) {
            // Auto-create customer account
            const { ethers } = require('ethers');
            const wallet = ethers.Wallet.createRandom();
            
            customer = new User({
                email: customerEmail,
                walletAddress: wallet.address,
                encryptedPrivateKey: Buffer.from(wallet.privateKey).toString('base64'),
                encryptedMnemonic: Buffer.from(wallet.mnemonic.phrase).toString('base64'),
                role: 'customer'
            });
            
            await customer.save();
        }
        
        // Calculate points
        const points = Math.floor(purchaseAmount * pointsPerGTQ);
        
        // Sponsor the transaction
        const tx = await factoryContract.sponsorMintReward(
            businessProgramAddress,
            customer.walletAddress,
            points,
            ethers.parseEther((purchaseAmount / 7.8).toFixed(6)) // Convert GTQ to ETH approximation
        );
        
        await tx.wait();
        
        // Update user stats
        await customer.addTransaction('earned', points, `Purchase at business`, tx.hash);
        customer.lifetimeValue += purchaseAmount;
        await customer.save();
        
        res.json({
            success: true,
            points: points,
            transactionHash: tx.hash,
            customerWallet: customer.walletAddress,
            message: `${points} points awarded to ${customerEmail}`,
            experienceLink: `${process.env.FRONTEND_URL}/experience/create?purchaseId=${tx.hash}&points=${points}`
        });
        
    } catch (error) {
        console.error('Purchase recording error:', error);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
});

// Create business program
router.post('/create-program', authenticateToken, async (req, res) => {
    try {
        if (!sponsorWallet || !factoryContract) {
            return res.status(500).json({ error: 'Sponsor wallet not configured' });
        }
        
        const {
            businessName,
            pointsPerGTQ = 1,
            experienceMultiplier = 2,
            burnToRedeemEnabled = true
        } = req.body;
        
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.businessProgramAddress) {
            return res.status(400).json({ 
                error: 'Business program already exists',
                programAddress: user.businessProgramAddress 
            });
        }
        
        // Deploy business program contract
        const tx = await factoryContract.createBusinessProgram(
            businessName,
            pointsPerGTQ,
            experienceMultiplier,
            burnToRedeemEnabled
        );
        
        const receipt = await tx.wait();
        
        // Extract program address from events
        const programAddress = receipt.logs[0]?.address || 'pending';
        
        // Update user
        user.businessName = businessName;
        user.businessProgramAddress = programAddress;
        user.role = 'business';
        await user.save();
        
        res.json({
            success: true,
            programAddress,
            transactionHash: tx.hash,
            message: `Business program created for ${businessName}`
        });
        
    } catch (error) {
        console.error('Program creation error:', error);
        res.status(500).json({ error: 'Failed to create program' });
    }
});

// Redeem rewards
router.post('/redeem', authenticateToken, async (req, res) => {
    try {
        const {
            businessProgramAddress,
            tokenId,
            redeemType = 'points' // 'points' or 'experience'
        } = req.body;
        
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Sponsor the burn transaction
        const tx = await factoryContract.sponsorBurnReward(
            businessProgramAddress,
            tokenId,
            user.walletAddress
        );
        
        await tx.wait();
        
        // Update user stats
        await user.addTransaction(
            'redeemed',
            tokenId === 0 ? user.totalPoints : 1,
            `Redeemed ${redeemType}`,
            tx.hash
        );
        
        res.json({
            success: true,
            transactionHash: tx.hash,
            message: `Successfully redeemed ${redeemType}`
        });
        
    } catch (error) {
        console.error('Redemption error:', error);
        res.status(500).json({ error: 'Failed to redeem reward' });
    }
});

// Check sponsor wallet balance
router.get('/balance', async (req, res) => {
    try {
        if (!sponsorWallet) {
            return res.status(500).json({ error: 'Sponsor wallet not configured' });
        }
        
        const balance = await provider.getBalance(sponsorWallet.address);
        const ethBalance = ethers.formatEther(balance);
        
        res.json({
            sponsorAddress: sponsorWallet.address,
            balance: ethBalance,
            network: 'Base Sepolia',
            isLow: parseFloat(ethBalance) < 0.01
        });
        
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ error: 'Failed to check balance' });
    }
});

module.exports = router;