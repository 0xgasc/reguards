const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Admin auth middleware
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Admin login is handled by the regular /api/auth/login endpoint.
// Admin users have role: 'admin' in the DB — use scripts/createAdmin.js to seed.

// Get all customers
router.get('/customers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;

        let query = { role: 'customer' };

        // Search by phone if provided
        if (search) {
            query.phone = { $regex: search, $options: 'i' };
        }

        const customers = await User.find(query)
            .select('-encryptedPrivateKey -encryptedMnemonic -pinHash')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            customers,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Search customer by phone
router.get('/customers/search', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone || phone.length < 4) {
            return res.status(400).json({ error: 'Please enter at least 4 digits' });
        }

        const customers = await User.find({
            role: 'customer',
            phone: { $regex: phone, $options: 'i' }
        })
        .select('-encryptedPrivateKey -encryptedMnemonic -pinHash')
        .limit(10);

        res.json({ customers });

    } catch (error) {
        console.error('Search customer error:', error);
        res.status(500).json({ error: 'Failed to search customers' });
    }
});

// Record purchase and award points (POS endpoint)
router.post('/record-purchase', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { customerPhone, amountQuetzales, description } = req.body;

        if (!customerPhone || !amountQuetzales) {
            return res.status(400).json({ error: 'Customer phone and purchase amount required' });
        }

        // Find customer
        const customer = await User.findOne({
            phone: { $regex: customerPhone, $options: 'i' },
            role: 'customer'
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Calculate points (1 point per quetzal)
        const pointsEarned = Math.floor(parseFloat(amountQuetzales));

        // Add transaction and update points
        await customer.addTransaction(
            'earned',
            pointsEarned,
            description || `Compra de Q${amountQuetzales}`,
            null
        );

        res.json({
            success: true,
            customer: {
                id: customer._id,
                phone: customer.phone,
                totalPoints: customer.totalPoints
            },
            pointsEarned,
            newBalance: customer.totalPoints
        });

    } catch (error) {
        console.error('Record purchase error:', error);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
});

// Manual points adjustment
router.post('/adjust-points', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { customerPhone, points, reason, type } = req.body;

        if (!customerPhone || !points || !type) {
            return res.status(400).json({ error: 'Customer phone, points, and type required' });
        }

        if (!['add', 'subtract'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "add" or "subtract"' });
        }

        const customer = await User.findOne({
            phone: { $regex: customerPhone, $options: 'i' },
            role: 'customer'
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const pointAmount = parseInt(points);
        const transactionType = type === 'add' ? 'earned' : 'redeemed';

        await customer.addTransaction(
            transactionType,
            pointAmount,
            reason || `Ajuste manual de puntos (${type})`,
            null
        );

        res.json({
            success: true,
            customer: {
                id: customer._id,
                phone: customer.phone,
                totalPoints: customer.totalPoints
            },
            adjustment: type === 'add' ? `+${pointAmount}` : `-${pointAmount}`,
            newBalance: customer.totalPoints
        });

    } catch (error) {
        console.error('Adjust points error:', error);
        res.status(500).json({ error: 'Failed to adjust points' });
    }
});

// Get platform analytics
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const totalCustomers = await User.countDocuments({ role: 'customer' });
        const totalAdmins = await User.countDocuments({ role: 'admin' });

        // Get total points in circulation
        const pointsAgg = await User.aggregate([
            { $match: { role: 'customer' } },
            { $group: {
                _id: null,
                totalPoints: { $sum: '$totalPoints' },
                totalExperiences: { $sum: '$totalExperiences' }
            }}
        ]);

        const totalPoints = pointsAgg.length > 0 ? pointsAgg[0].totalPoints : 0;
        const totalExperiences = pointsAgg.length > 0 ? pointsAgg[0].totalExperiences : 0;

        // Get recent signups (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSignups = await User.countDocuments({
            role: 'customer',
            createdAt: { $gte: sevenDaysAgo }
        });

        // Get top customers by points
        const topCustomers = await User.find({ role: 'customer' })
            .select('phone totalPoints createdAt')
            .sort({ totalPoints: -1 })
            .limit(10);

        res.json({
            overview: {
                totalCustomers,
                totalAdmins,
                totalPoints,
                totalExperiences,
                recentSignups,
                avgPointsPerCustomer: totalCustomers > 0 ? Math.round(totalPoints / totalCustomers) : 0
            },
            topCustomers
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get customer details
router.get('/customers/:customerId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const customer = await User.findById(req.params.customerId)
            .select('-encryptedPrivateKey -encryptedMnemonic -pinHash');

        if (!customer || customer.role !== 'customer') {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ customer });

    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

module.exports = router;