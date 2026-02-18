const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Receipt Schema
const receiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  pointsEarned: { type: Number, required: true },
  experienceCreated: { type: Boolean, default: false },
  experienceBonus: { type: Number, default: 0 },
  transactionId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

receiptSchema.index({ userId: 1, createdAt: -1 });

const Receipt = mongoose.model('Receipt', receiptSchema);

// Use shared User model
const User = require('../models/User');

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/receipts/create - Create a new receipt
router.post('/create', verifyToken, async (req, res) => {
  try {
    const { businessName, amount, date } = req.body;
    
    if (!businessName || !amount) {
      return res.status(400).json({ error: 'Business name and amount are required' });
    }
    
    // Calculate points (1 point per quetzal)
    const pointsEarned = Math.floor(amount);
    
    // Create receipt
    const receipt = new Receipt({
      userId: req.user.userId,
      businessName,
      amount: parseFloat(amount),
      date: new Date(date),
      pointsEarned,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    await receipt.save();
    
    // Update user points
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { totalPoints: pointsEarned }
    });
    
    res.json({ 
      success: true, 
      receipt,
      pointsEarned,
      message: `¡${pointsEarned} puntos ganados!`
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
});

// GET /api/receipts/my-receipts - Get user's receipts
router.get('/my-receipts', verifyToken, async (req, res) => {
  try {
    const receipts = await Receipt.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ success: true, receipts });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// POST /api/receipts/:receiptId/create-experience - Mark receipt as having experience
router.post('/:receiptId/create-experience', verifyToken, async (req, res) => {
  try {
    const { receiptId } = req.params;
    const experienceBonus = 20; // Fixed bonus for creating experience
    
    const receipt = await Receipt.findOne({ 
      _id: receiptId, 
      userId: req.user.userId,
      experienceCreated: false 
    });
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found or experience already created' });
    }
    
    // Update receipt
    receipt.experienceCreated = true;
    receipt.experienceBonus = experienceBonus;
    await receipt.save();
    
    // Give bonus points
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { 
        totalPoints: experienceBonus,
        totalExperiences: 1
      }
    });
    
    res.json({ 
      success: true, 
      experienceBonus,
      message: `¡Experiencia creada! +${experienceBonus} puntos bonus`
    });
  } catch (error) {
    console.error('Error creating experience from receipt:', error);
    res.status(500).json({ error: 'Failed to create experience' });
  }
});

// GET /api/receipts/stats - Get receipt stats (admin)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // Verify admin
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const totalReceipts = await Receipt.countDocuments();
    const totalRevenue = await Receipt.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPoints = await Receipt.aggregate([
      { $group: { _id: null, total: { $sum: "$pointsEarned" } } }
    ]);
    const experienceRate = await Receipt.aggregate([
      { $group: { 
        _id: null, 
        total: { $sum: 1 },
        withExperiences: { $sum: { $cond: ["$experienceCreated", 1, 0] } }
      }}
    ]);
    
    res.json({
      success: true,
      stats: {
        totalReceipts,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalPointsIssued: totalPoints[0]?.total || 0,
        experienceCreationRate: experienceRate[0] ? 
          Math.round((experienceRate[0].withExperiences / experienceRate[0].total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching receipt stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;