/**
 * Rewards Service
 *
 * Serves per-restaurant rewards to customers based on which restaurants
 * they've visited. Generates one-time redemption codes (6 chars, 15 min TTL)
 * that merchants validate at the counter.
 *
 * Routes:
 *   GET  /api/rewards            - list rewards from restaurants I've visited
 *   POST /api/rewards/redeem     - deduct points, get a one-time code
 *   GET  /api/rewards/my-codes   - my active redemption codes
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Alliance = require('../models/Alliance');
const Campaign = require('../models/Campaign');

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// ─── GET /api/rewards ─────────────────────────────────────────────────────────
// Returns active rewards from every restaurant the customer has visited.
// Falls back to a global "starter" set if they have no visits yet.

router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('totalPoints transactions');
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Unique restaurant IDs from transaction history
        const visitedIds = [
            ...new Set(
                (user.transactions || [])
                    .map(t => t.restaurantId?.toString())
                    .filter(Boolean)
            ),
        ];

        let rewards = [];

        if (visitedIds.length > 0) {
            // Find active alliances that include any of the visited restaurants
            const now = new Date();
            const alliances = await Alliance.find({
                restaurants: { $in: visitedIds },
                isActive: true,
                startDate: { $lte: now },
                $or: [{ endDate: null }, { endDate: { $gte: now } }],
            }).populate('restaurants', 'name emoji accentColor rewards');

            // Collect allied restaurant IDs not already in visitedIds
            const alliedIds = new Set();
            const allianceByRestaurant = {}; // restaurantId → alliance info

            alliances.forEach(alliance => {
                alliance.restaurants.forEach(r => {
                    const rid = r._id.toString();
                    if (!visitedIds.includes(rid)) {
                        alliedIds.add(rid);
                        allianceByRestaurant[rid] = {
                            allianceId:   alliance._id,
                            allianceName: alliance.name,
                            allianceEmoji: alliance.emoji,
                            conversionRate: alliance.conversionRate,
                        };
                    }
                });
            });

            // Fetch all relevant restaurants (visited + allied)
            const allRestaurantIds = [...visitedIds, ...alliedIds];
            const restaurants = await Restaurant.find({
                _id: { $in: allRestaurantIds },
                isActive: true,
            }).select('name emoji accentColor rewards');

            // Find active campaigns for these restaurants
            const activeCampaigns = await Campaign.find({
                restaurant: { $in: allRestaurantIds },
                isActive: true,
                startDate: { $lte: now },
                endDate:   { $gte: now },
            }).select('restaurant name multiplier endDate').lean();

            const campaignByRestaurant = {};
            activeCampaigns.forEach(c => {
                campaignByRestaurant[c.restaurant.toString()] = {
                    name: c.name,
                    multiplier: c.multiplier,
                    endDate: c.endDate,
                };
            });

            restaurants.forEach(r => {
                const rid = r._id.toString();
                const isAllied = !visitedIds.includes(rid);
                const allianceInfo = isAllied ? allianceByRestaurant[rid] : null;
                const campaign = campaignByRestaurant[rid] || null;

                r.rewards
                    .filter(rw => rw.isActive)
                    .forEach(rw => {
                        rewards.push({
                            _id:             rw._id,
                            restaurantId:    r._id,
                            restaurantName:  r.name,
                            restaurantEmoji: r.emoji,
                            accentColor:     r.accentColor,
                            name:            rw.name,
                            description:     rw.description,
                            points:          rw.points,
                            emoji:           rw.emoji,
                            isAllied,
                            allianceInfo,
                            campaign,
                        });
                    });
            });
        }

        res.json({ rewards, userPoints: user.totalPoints || 0 });
    } catch (err) {
        console.error('Get rewards error:', err);
        res.status(500).json({ error: 'Failed to fetch rewards' });
    }
});

// ─── GET /api/rewards/my-codes ────────────────────────────────────────────────
// Active (non-expired, pending) redemption codes for the current user.

router.get('/my-codes', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('pendingRedemptions');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const now = new Date();

        // Auto-expire stale codes
        let changed = false;
        user.pendingRedemptions.forEach(r => {
            if (r.status === 'pending' && new Date(r.expiresAt) < now) {
                r.status = 'expired';
                changed = true;
            }
        });
        if (changed) await user.save();

        const active = user.pendingRedemptions.filter(
            r => r.status === 'pending' && new Date(r.expiresAt) >= now
        );

        res.json({ codes: active });
    } catch (err) {
        console.error('My-codes error:', err);
        res.status(500).json({ error: 'Failed to fetch codes' });
    }
});

// ─── POST /api/rewards/redeem ─────────────────────────────────────────────────
// Deducts points and generates a one-time 6-char code (valid 15 min).

router.post('/redeem', authenticateToken, async (req, res) => {
    try {
        const { rewardId, restaurantId } = req.body;

        if (!rewardId || !restaurantId) {
            return res.status(400).json({ error: 'rewardId and restaurantId required' });
        }

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant || !restaurant.isActive) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        const reward = restaurant.rewards.id(rewardId);
        if (!reward || !reward.isActive) {
            return res.status(404).json({ error: 'Reward not found or inactive' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.totalPoints < reward.points) {
            return res.status(400).json({
                error: `Puntos insuficientes. Necesitas ${reward.points}, tienes ${user.totalPoints}.`,
            });
        }

        // Deduct points
        user.totalPoints -= reward.points;
        user.transactions.push({
            type:         'redeemed',
            amount:       reward.points,
            description:  `Canje: ${reward.name} en ${restaurant.name}`,
            timestamp:    new Date(),
            restaurantId: restaurant._id,
        });

        // Generate redemption code
        const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9B2"
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        user.pendingRedemptions.push({
            code,
            rewardName:     reward.name,
            rewardEmoji:    reward.emoji || '🎁',
            pointsCost:     reward.points,
            restaurantId:   restaurant._id,
            restaurantName: restaurant.name,
            status:         'pending',
            expiresAt,
        });

        await user.save();

        res.json({
            success:      true,
            code,
            rewardName:   reward.name,
            rewardEmoji:  reward.emoji || '🎁',
            restaurantName: restaurant.name,
            pointsSpent:  reward.points,
            newBalance:   user.totalPoints,
            expiresAt:    expiresAt.toISOString(),
        });
    } catch (err) {
        console.error('Redeem error:', err);
        res.status(500).json({ error: 'Failed to redeem reward' });
    }
});

module.exports = router;
