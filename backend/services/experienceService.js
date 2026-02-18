const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Initialize provider and sponsor wallet
const provider = new ethers.JsonRpcProvider(
    process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
);

// Initialize sponsor wallet only if private key is provided
let sponsorWallet;
if (process.env.SPONSOR_PRIVATE_KEY && process.env.SPONSOR_PRIVATE_KEY !== 'placeholder') {
    sponsorWallet = new ethers.Wallet(process.env.SPONSOR_PRIVATE_KEY, provider);
} else {
    console.warn('⚠️  SPONSOR_PRIVATE_KEY not configured - experience minting will fail');
}

// Factory contract interface
const FACTORY_ABI = [
    "function sponsorMintExperience(address _program, address _customer, string memory _experienceURI, uint256 _purchaseId) external returns (uint256)"
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

// Auth middleware
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

// Upload experience photo and create NFT
router.post('/create', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        if (!sponsorWallet || !factoryContract) {
            return res.status(500).json({ error: 'Sponsor wallet not configured' });
        }
        
        const {
            businessProgramAddress,
            purchaseId,
            description,
            rating,
            location
        } = req.body;
        
        if (!businessProgramAddress || !purchaseId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Upload to IPFS (using Web3.Storage or similar)
        const imageUrl = await uploadToIPFS(req.file.path);
        
        // Create metadata
        const metadata = {
            name: `Experience at ${location || 'Business'}`,
            description: description || 'A memorable experience',
            image: imageUrl,
            attributes: [
                { trait_type: 'Rating', value: rating || 5 },
                { trait_type: 'Location', value: location || 'Guatemala' },
                { trait_type: 'Date', value: new Date().toISOString() },
                { trait_type: 'Purchase ID', value: purchaseId }
            ],
            created_by: user.email,
            timestamp: Date.now()
        };
        
        // Upload metadata to IPFS
        const metadataUrl = await uploadJSONToIPFS(metadata);
        
        // Mint experience NFT via sponsor wallet
        const tx = await factoryContract.sponsorMintExperience(
            businessProgramAddress,
            user.walletAddress,
            metadataUrl,
            purchaseId
        );
        
        const receipt = await tx.wait();
        
        // Extract token ID from events (simplified)
        const tokenId = Date.now(); // In production, parse from events
        
        // Save to user profile
        await user.addExperience(tokenId, metadataUrl, purchaseId);
        
        // Clean up uploaded file
        await fs.unlink(req.file.path);
        
        res.json({
            success: true,
            experienceId: tokenId,
            metadataUrl,
            imageUrl,
            transactionHash: tx.hash,
            message: 'Experience created successfully!',
            bonusPoints: 10 // Experience multiplier bonus
        });
        
    } catch (error) {
        console.error('Experience creation error:', error);
        res.status(500).json({ error: 'Failed to create experience' });
    }
});

// Get user's experiences
router.get('/my-experiences', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Fetch metadata for each experience
        const experiences = await Promise.all(
            user.experiences.map(async (exp) => {
                try {
                    const metadata = await fetchFromIPFS(exp.metadataURI);
                    return {
                        ...exp.toObject(),
                        metadata
                    };
                } catch (err) {
                    return exp.toObject();
                }
            })
        );
        
        res.json({
            experiences,
            total: experiences.length,
            totalPoints: user.totalPoints
        });
        
    } catch (error) {
        console.error('Fetch experiences error:', error);
        res.status(500).json({ error: 'Failed to fetch experiences' });
    }
});

// Get experience by ID
router.get('/:experienceId', async (req, res) => {
    try {
        const { experienceId } = req.params;
        
        // Find user with this experience
        const user = await User.findOne({
            'experiences.tokenId': parseInt(experienceId)
        });
        
        if (!user) {
            return res.status(404).json({ error: 'Experience not found' });
        }
        
        const experience = user.experiences.find(
            exp => exp.tokenId === parseInt(experienceId)
        );
        
        // Fetch metadata
        const metadata = await fetchFromIPFS(experience.metadataURI);
        
        res.json({
            experience: {
                ...experience.toObject(),
                metadata,
                creator: user.email
            }
        });
        
    } catch (error) {
        console.error('Get experience error:', error);
        res.status(500).json({ error: 'Failed to get experience' });
    }
});

// Helper function to upload to IPFS
async function uploadToIPFS(filePath) {
    // In production, use Web3.Storage, Pinata, or similar
    // For now, return a placeholder URL
    const fileData = await fs.readFile(filePath);
    
    // Mock IPFS upload
    if (process.env.IPFS_API_KEY) {
        // Implement actual IPFS upload
        // const response = await axios.post('https://api.web3.storage/upload', ...);
        // return `ipfs://${response.data.cid}`;
    }
    
    // For development, return local URL
    return `https://api.guaterewards.com/images/${path.basename(filePath)}`;
}

// Helper function to upload JSON to IPFS
async function uploadJSONToIPFS(data) {
    // In production, use Web3.Storage
    if (process.env.IPFS_API_KEY) {
        // Implement actual IPFS upload
        // const response = await axios.post('https://api.web3.storage/upload', ...);
        // return `ipfs://${response.data.cid}`;
    }
    
    // For development, return data URL
    const base64 = Buffer.from(JSON.stringify(data)).toString('base64');
    return `data:application/json;base64,${base64}`;
}

// Helper function to fetch from IPFS
async function fetchFromIPFS(uri) {
    if (uri.startsWith('data:')) {
        // Parse data URL
        const base64Data = uri.split(',')[1];
        return JSON.parse(Buffer.from(base64Data, 'base64').toString());
    }
    
    if (uri.startsWith('ipfs://')) {
        // Fetch from IPFS gateway
        const cid = uri.replace('ipfs://', '');
        const response = await axios.get(`https://ipfs.io/ipfs/${cid}`);
        return response.data;
    }
    
    // Fetch from regular URL
    const response = await axios.get(uri);
    return response.data;
}

module.exports = router;