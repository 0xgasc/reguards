/**
 * Alliance Service
 *
 * Admin manages restaurant alliances. Public endpoint returns live alliances
 * for the explore page and restaurant profiles.
 *
 * Routes:
 *   POST   /api/admin/alliances          — create alliance
 *   GET    /api/admin/alliances          — list all (admin)
 *   PATCH  /api/admin/alliances/:id      — update / toggle active / extend endDate
 *   DELETE /api/admin/alliances/:id      — delete
 *
 *   GET    /api/alliances/public         — live alliances (public, no auth)
 *   GET    /api/alliances/restaurant/:restaurantId — alliances for one restaurant
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const Alliance = require('../models/Alliance');
const Restaurant = require('../models/Restaurant');

// ─── Auth middleware ───────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ─── Admin router ──────────────────────────────────────────────────────────────

const adminRouter = express.Router();

// POST /api/admin/alliances
adminRouter.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, emoji, description, restaurants, conversionRate, startDate, endDate } = req.body;

        if (!name || !restaurants || restaurants.length < 2) {
            return res.status(400).json({ error: 'name and at least 2 restaurants required' });
        }
        if (restaurants.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 restaurants per alliance' });
        }

        // Verify all restaurants exist
        const found = await Restaurant.find({ _id: { $in: restaurants } }).select('name emoji');
        if (found.length !== restaurants.length) {
            return res.status(400).json({ error: 'One or more restaurants not found' });
        }

        const alliance = await Alliance.create({
            name,
            emoji: emoji || '🤝',
            description: description || '',
            restaurants,
            conversionRate: conversionRate || 1.0,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            createdBy: req.user.userId,
        });

        const populated = await alliance.populate('restaurants', 'name emoji accentColor');
        res.json({ success: true, alliance: populated });
    } catch (err) {
        console.error('Create alliance error:', err);
        res.status(500).json({ error: 'Failed to create alliance' });
    }
});

// GET /api/admin/alliances
adminRouter.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const alliances = await Alliance.find()
            .populate('restaurants', 'name emoji accentColor slug')
            .sort({ createdAt: -1 });
        res.json({ alliances });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alliances' });
    }
});

// PATCH /api/admin/alliances/:id
adminRouter.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, emoji, description, isActive, endDate, conversionRate } = req.body;
        const alliance = await Alliance.findById(req.params.id);
        if (!alliance) return res.status(404).json({ error: 'Alliance not found' });

        if (name !== undefined) alliance.name = name;
        if (emoji !== undefined) alliance.emoji = emoji;
        if (description !== undefined) alliance.description = description;
        if (isActive !== undefined) alliance.isActive = isActive;
        if (conversionRate !== undefined) alliance.conversionRate = conversionRate;
        if (endDate !== undefined) alliance.endDate = endDate ? new Date(endDate) : null;

        await alliance.save();
        await alliance.populate('restaurants', 'name emoji accentColor slug');
        res.json({ success: true, alliance });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update alliance' });
    }
});

// DELETE /api/admin/alliances/:id
adminRouter.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await Alliance.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete alliance' });
    }
});

// ─── Public router ────────────────────────────────────────────────────────────

const publicRouter = express.Router();

// GET /api/alliances/public — live alliances (active + within date range)
publicRouter.get('/public', async (req, res) => {
    try {
        const now = new Date();
        const alliances = await Alliance.find({
            isActive: true,
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        })
            .populate('restaurants', 'name emoji accentColor slug')
            .sort({ createdAt: -1 });

        res.json({ alliances });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alliances' });
    }
});

// GET /api/alliances/restaurant/:restaurantId — alliances for one restaurant
publicRouter.get('/restaurant/:restaurantId', async (req, res) => {
    try {
        const now = new Date();
        const alliances = await Alliance.find({
            restaurants: req.params.restaurantId,
            isActive: true,
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        }).populate('restaurants', 'name emoji accentColor slug');

        res.json({ alliances });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alliances' });
    }
});

// ─── Helper: check if two restaurants share an active alliance ────────────────
// Used by merchantService.validate-redemption for cross-restaurant redemptions.

async function getAllianceForPair(restaurantIdA, restaurantIdB) {
    const now = new Date();
    return Alliance.findOne({
        restaurants: { $all: [restaurantIdA, restaurantIdB] },
        isActive: true,
        startDate: { $lte: now },
        $or: [{ endDate: null }, { endDate: { $gte: now } }],
    });
}

module.exports = { adminRouter, publicRouter, getAllianceForPair };
