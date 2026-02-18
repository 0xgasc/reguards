const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Models
const User = require('../models/User');
const Business = require('../models/Business');
const Transaction = require('../models/Transaction');
const Reward = require('../models/Reward');
const CustomerPoints = require('../models/CustomerPoints');

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

// Middleware to verify business role
const verifyBusiness = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'business') {
      return res.status(403).json({ error: 'Business access required' });
    }
    req.business = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify business' });
  }
};

// POST /api/business/settings - Update business settings
router.post('/settings', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const { pointsPerQuetzal, experienceBonus, minRedemption, burnEnabled } = req.body;
    
    // Validate settings
    if (pointsPerQuetzal < 1 || pointsPerQuetzal > 10) {
      return res.status(400).json({ error: 'Points per quetzal must be between 1 and 10' });
    }
    
    if (experienceBonus < 5 || experienceBonus > 100) {
      return res.status(400).json({ error: 'Experience bonus must be between 5 and 100' });
    }
    
    if (minRedemption < 10 || minRedemption > 500) {
      return res.status(400).json({ error: 'Minimum redemption must be between 10 and 500' });
    }
    
    // Update business settings
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          'businessSettings.pointsPerQuetzal': parseInt(pointsPerQuetzal),
          'businessSettings.experienceBonus': parseInt(experienceBonus),
          'businessSettings.minRedemption': parseInt(minRedemption),
          'businessSettings.burnEnabled': Boolean(burnEnabled)
        }
      },
      { new: true }
    );
    
    res.json({
      success: true,
      settings: updatedUser.businessSettings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating business settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/business/settings - Get business settings
router.get('/settings', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({
      success: true,
      settings: user.businessSettings || {
        pointsPerQuetzal: 1,
        experienceBonus: 20,
        minRedemption: 50,
        burnEnabled: true
      }
    });
  } catch (error) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/business/create - Create a new business
router.post('/create', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const { name, category, address, city, zone } = req.body;
    
    // Check if business already exists for this user
    const existingBusiness = await Business.findOne({ ownerId: req.user.userId });
    if (existingBusiness) {
      return res.status(400).json({ error: 'You already have a business registered' });
    }
    
    const business = new Business({
      name,
      category,
      ownerId: req.user.userId,
      location: { address, city, zone }
    });
    
    await business.save();
    
    // Update user with business reference
    await User.findByIdAndUpdate(req.user.userId, {
      businessName: name
    });
    
    res.json({ success: true, business });
  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// GET /api/business/my-business - Get current user's business
router.get('/my-business', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user.userId });
    if (!business) {
      return res.status(404).json({ error: 'No business found' });
    }
    
    res.json({ success: true, business });
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// GET /api/business/stats - Get real business statistics
router.get('/stats', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user.userId });
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    // Get real stats from database
    const totalCustomers = await CustomerPoints.countDocuments({ businessId: business._id });
    const totalTransactions = await Transaction.countDocuments({ businessId: business._id });
    
    const revenueData = await Transaction.aggregate([
      { $match: { businessId: business._id, type: 'purchase' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const pointsData = await Transaction.aggregate([
      { $match: { businessId: business._id } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
    ]);
    
    const activeRewards = await Reward.countDocuments({ businessId: business._id, isActive: true });
    
    const stats = {
      totalCustomers,
      totalTransactions,
      totalRevenue: revenueData[0]?.total || 0,
      totalPointsIssued: pointsData[0]?.total || 0,
      activeRewards
    };
    
    // Update business stats
    await Business.findByIdAndUpdate(business._id, {
      'stats.totalCustomers': totalCustomers,
      'stats.totalTransactions': totalTransactions,
      'stats.totalRevenue': stats.totalRevenue,
      'stats.totalPointsIssued': stats.totalPointsIssued
    });
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching business stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/business/customers - Get business customers
router.get('/customers', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user.userId });
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const customers = await CustomerPoints.find({ businessId: business._id })
      .populate('customerId', 'email')
      .sort({ currentBalance: -1 })
      .limit(50);
    
    res.json({ success: true, customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/business/transaction - Record a customer transaction
router.post('/transaction', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const { customerEmail, amount, description, receiptNumber } = req.body;
    
    if (!customerEmail || !amount || !description) {
      return res.status(400).json({ error: 'Customer email, amount, and description required' });
    }
    
    const business = await Business.findOne({ ownerId: req.user.userId });
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    // Find or create customer
    let customer = await User.findOne({ email: customerEmail.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found. Customer must register first.' });
    }
    
    // Calculate points
    const pointsEarned = Math.floor(amount * business.settings.pointsPerQuetzal);
    
    // Create transaction
    const transaction = new Transaction({
      customerId: customer._id,
      businessId: business._id,
      type: 'purchase',
      amount: parseFloat(amount),
      description,
      pointsEarned,
      receiptNumber,
      status: 'completed'
    });
    
    await transaction.save();
    
    // Update or create customer points record
    let customerPoints = await CustomerPoints.findOne({ 
      customerId: customer._id, 
      businessId: business._id 
    });
    
    if (!customerPoints) {
      customerPoints = new CustomerPoints({
        customerId: customer._id,
        businessId: business._id,
        totalEarned: pointsEarned + business.settings.welcomeBonus,
        currentBalance: pointsEarned + business.settings.welcomeBonus,
        totalVisits: 1,
        totalSpent: amount,
        lastVisit: new Date()
      });
      
      // Give welcome bonus for first visit
      if (business.settings.welcomeBonus > 0) {
        const welcomeTransaction = new Transaction({
          customerId: customer._id,
          businessId: business._id,
          type: 'reward',
          amount: 0,
          description: 'Welcome bonus',
          pointsEarned: business.settings.welcomeBonus,
          status: 'completed'
        });
        await welcomeTransaction.save();
      }
    } else {
      customerPoints.totalEarned += pointsEarned;
      customerPoints.currentBalance += pointsEarned;
      customerPoints.totalVisits += 1;
      customerPoints.totalSpent += amount;
      customerPoints.lastVisit = new Date();
    }
    
    await customerPoints.save();
    
    res.json({ 
      success: true, 
      transaction,
      pointsEarned: customerPoints.totalVisits === 1 ? pointsEarned + business.settings.welcomeBonus : pointsEarned,
      customerBalance: customerPoints.currentBalance,
      isNewCustomer: customerPoints.totalVisits === 1,
      welcomeBonus: customerPoints.totalVisits === 1 ? business.settings.welcomeBonus : 0
    });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});

// GET /api/business/transactions - Get business transactions
router.get('/transactions', verifyToken, verifyBusiness, async (req, res) => {
  try {
    const business = await Business.findOne({ ownerId: req.user.userId });
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({ businessId: business._id })
      .populate('customerId', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Transaction.countDocuments({ businessId: business._id });
    
    res.json({ 
      success: true, 
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;