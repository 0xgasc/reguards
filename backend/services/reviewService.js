/**
 * Review Service
 *
 * Routes:
 *   POST /api/reviews              — submit or update a review (auth required)
 *   GET  /api/reviews/:restaurantId — public: get reviews for a restaurant
 *   GET  /api/merchant/reviews     — merchant: see reviews for their restaurant
 *   PATCH /api/merchant/reviews/:id — merchant: toggle visibility
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { checkAchievements } = require('./achievementService');

function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required' });
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// POST /api/reviews — create or update review (upsert by user+restaurant)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { restaurantId, rating, text, emoji } = req.body;
        if (!restaurantId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'restaurantId and rating (1-5) required' });
        }

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !restaurant.isActive) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Check that user has actually visited (has a transaction with this restaurant)
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const hasVisited = (user.transactions || []).some(
            t => t.restaurantId?.toString() === restaurantId && t.type === 'earned'
        );
        if (!hasVisited) {
            return res.status(403).json({ error: 'Debes visitar el restaurante antes de dejar una reseña' });
        }

        // Upsert review
        const isNew = !(await Review.findOne({ user: user._id, restaurant: restaurantId }));
        const review = await Review.findOneAndUpdate(
            { user: user._id, restaurant: restaurantId },
            {
                rating,
                text: text?.trim().slice(0, 500) || '',
                emoji: emoji || '⭐',
                visitDate: new Date(),
            },
            { upsert: true, new: true }
        );

        // Award achievement for first review
        if (isNew) {
            const newAch = checkAchievements(user, { event: 'review' });
            if (newAch.length > 0) await user.save();
        }

        res.json({ success: true, review, newAchievements: isNew ? [] : [] });
    } catch (err) {
        if (err.code === 11000) {
            // Race condition on upsert — just fetch existing
            const review = await Review.findOne({ user: req.user.userId, restaurant: req.body.restaurantId });
            return res.json({ success: true, review });
        }
        console.error('Review submit error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// GET /api/reviews/:restaurantId — public
router.get('/:restaurantId', async (req, res) => {
    try {
        const reviews = await Review.find({
            restaurant: req.params.restaurantId,
            isVisible: true,
        })
            .select('rating text emoji createdAt visitDate')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const total = reviews.length;
        const avgRating = total > 0
            ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
            : 0;

        const dist = [5,4,3,2,1].map(r => ({
            stars: r,
            count: reviews.filter(rv => rv.rating === r).length,
        }));

        res.json({ reviews, total, avgRating, distribution: dist });
    } catch (err) {
        console.error('Get reviews error:', err);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// GET /api/merchant/reviews — merchant sees their own restaurant's reviews
router.get('/merchant/mine', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'merchant' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Merchant access required' });
        }
        const restaurant = await Restaurant.findOne({ owner: req.user.userId });
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        const reviews = await Review.find({ restaurant: restaurant._id })
            .select('rating text emoji createdAt isVisible')
            .sort({ createdAt: -1 })
            .lean();

        const avgRating = reviews.length > 0
            ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
            : 0;

        res.json({ reviews, avgRating, total: reviews.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// PATCH /api/reviews/:id/visibility — merchant toggles review visibility
router.patch('/:id/visibility', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'merchant' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Merchant access required' });
        }
        const restaurant = await Restaurant.findOne({ owner: req.user.userId });
        const review = await Review.findOne({
            _id: req.params.id,
            ...(req.user.role !== 'admin' ? { restaurant: restaurant?._id } : {}),
        });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        review.isVisible = !review.isVisible;
        await review.save();
        res.json({ success: true, isVisible: review.isVisible });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update review' });
    }
});

module.exports = router;
