/**
 * Merchant Service
 *
 * Merchant-scoped routes — a merchant can only see/edit their own restaurant.
 * Also exposes a public POS endpoint authenticated by API key only (no JWT).
 *
 * Routes:
 *   GET  /api/merchant/me            - my restaurant profile + API key
 *   PUT  /api/merchant/me            - update restaurant settings
 *   GET  /api/merchant/rewards       - my rewards catalog
 *   POST /api/merchant/rewards       - create reward
 *   PUT  /api/merchant/rewards/:id   - update reward
 *   DEL  /api/merchant/rewards/:id   - delete reward
 *   GET  /api/merchant/customers     - customers who have points with me
 *   POST /api/merchant/record-purchase - POS: record purchase (via JWT)
 *   GET  /api/merchant/analytics     - my stats
 *
 *   POST /api/pos/purchase           - API-key only POS endpoint (no login)
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { notifyPointsEarned, notifyRedemptionFulfilled } = require('./notificationService');
const { getAllianceForPair } = require('./allianceService');
const Campaign = require('../models/Campaign');
const Challenge = require('../models/Challenge');
const { checkAchievements } = require('./achievementService');

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

function requireMerchant(req, res, next) {
    if (!req.user || (req.user.role !== 'merchant' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Merchant access required' });
    }
    next();
}

// Attach the merchant's restaurant to req.restaurant
async function loadRestaurant(req, res, next) {
    try {
        const rest = await Restaurant.findOne({ owner: req.user.userId });
        if (!rest) {
            return res.status(404).json({
                error: 'No restaurant found. Ask the admin to set up your account.',
            });
        }
        req.restaurant = rest;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Failed to load restaurant' });
    }
}

// ─── Merchant profile ─────────────────────────────────────────────────────────

// GET /api/merchant/me
router.get('/me', authenticateToken, requireMerchant, loadRestaurant, (req, res) => {
    res.json({ restaurant: req.restaurant });
});

// PUT /api/merchant/me
router.put('/me', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    const allowed = ['name', 'emoji', 'accentColor', 'description', 'address', 'phone',
                     'website', 'pointsPerQuetzal', 'welcomeBonus'];
    allowed.forEach(k => {
        if (req.body[k] !== undefined) req.restaurant[k] = req.body[k];
    });
    await req.restaurant.save();
    res.json({ success: true, restaurant: req.restaurant });
});

// POST /api/merchant/rotate-key — regenerate API key
router.post('/rotate-key', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    const crypto = require('crypto');
    req.restaurant.apiKey = 'reguards_mk_' + crypto.randomBytes(16).toString('hex');
    await req.restaurant.save();
    res.json({ success: true, apiKey: req.restaurant.apiKey });
});

// ─── Rewards catalog management ───────────────────────────────────────────────

// GET /api/merchant/rewards
router.get('/rewards', authenticateToken, requireMerchant, loadRestaurant, (req, res) => {
    res.json({ rewards: req.restaurant.rewards });
});

// POST /api/merchant/rewards
router.post('/rewards', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    const { name, description, points, emoji } = req.body;
    if (!name || !points || points < 1) {
        return res.status(400).json({ error: 'Name and points (≥1) required' });
    }

    // Free plan: max 3 active rewards
    const active = req.restaurant.rewards.filter(r => r.isActive).length;
    if (req.restaurant.plan === 'free' && active >= 3) {
        return res.status(403).json({ error: 'Free plan allows up to 3 rewards. Upgrade to Starter for unlimited.' });
    }

    req.restaurant.rewards.push({ name, description, points, emoji: emoji || '🎁', isActive: true });
    await req.restaurant.save();
    res.json({ success: true, rewards: req.restaurant.rewards });
});

// PUT /api/merchant/rewards/:rewardId
router.put('/rewards/:rewardId', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    const reward = req.restaurant.rewards.id(req.params.rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    ['name', 'description', 'points', 'emoji', 'isActive'].forEach(k => {
        if (req.body[k] !== undefined) reward[k] = req.body[k];
    });
    await req.restaurant.save();
    res.json({ success: true, rewards: req.restaurant.rewards });
});

// DELETE /api/merchant/rewards/:rewardId
router.delete('/rewards/:rewardId', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    req.restaurant.rewards.pull(req.params.rewardId);
    await req.restaurant.save();
    res.json({ success: true });
});

// ─── Customer management ──────────────────────────────────────────────────────

// GET /api/merchant/customers?search=phone
// Returns customers who have earned points from this restaurant
router.get('/customers', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    try {
        const { search } = req.query;
        const restaurantId = req.restaurant._id.toString();

        let query = { role: 'customer' };
        if (search) query.phone = { $regex: search, $options: 'i' };

        // Find customers who have transactions from this restaurant
        const customers = await User.find(query)
            .select('-encryptedPrivateKey -encryptedMnemonic -pinHash')
            .sort({ totalPoints: -1 })
            .limit(50)
            .lean();

        // Filter: only show customers who have a transaction tagged to this restaurant
        const filtered = customers.filter(c =>
            (c.transactions || []).some(t =>
                t.restaurantId && t.restaurantId.toString() === restaurantId
            )
        );

        res.json({ customers: filtered, total: filtered.length });
    } catch (err) {
        console.error('Merchant customers error:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// POST /api/merchant/record-purchase — merchant records a customer purchase (JWT auth)
router.post('/record-purchase', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    return recordPurchaseHandler(req, res, req.restaurant);
});

// POST /api/merchant/validate-redemption — validate a customer's one-time code at the counter
router.post('/validate-redemption', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'code required' });

        const upperCode = code.toUpperCase().trim();
        const restaurantId = req.restaurant._id.toString();

        // Find the customer holding this code for THIS restaurant
        const customer = await User.findOne({
            'pendingRedemptions.code': upperCode,
            'pendingRedemptions.status': 'pending',
        });

        if (!customer) {
            return res.status(404).json({ error: 'Código inválido o ya utilizado' });
        }

        const redemption = customer.pendingRedemptions.find(
            r => r.code === upperCode && r.status === 'pending'
        );

        // Check it belongs to this restaurant — or an active alliance covers both
        if (redemption.restaurantId?.toString() !== restaurantId) {
            const alliance = await getAllianceForPair(redemption.restaurantId, restaurantId);
            if (!alliance) {
                return res.status(403).json({ error: 'Este código es de otro restaurante' });
            }
            // Alliance found — cross-restaurant redemption is allowed
        }

        // Check not expired
        if (new Date(redemption.expiresAt) < new Date()) {
            redemption.status = 'expired';
            await customer.save();
            return res.status(400).json({ error: 'Código expirado (válido 15 min)' });
        }

        // Fulfill
        redemption.status = 'fulfilled';
        redemption.fulfilledAt = new Date();
        await customer.save();

        // WhatsApp notification (best-effort)
        notifyRedemptionFulfilled({
            phone: customer.phone,
            rewardName: redemption.rewardName,
            restaurantName: req.restaurant.name,
            remainingPoints: customer.totalPoints,
        }).catch(() => {});

        res.json({
            success: true,
            customer: { phone: customer.phone, totalPoints: customer.totalPoints },
            reward: { name: redemption.rewardName, emoji: redemption.rewardEmoji },
            message: `✓ ${redemption.rewardName} canjeado para ${customer.phone}`,
        });
    } catch (err) {
        console.error('Validate redemption error:', err);
        res.status(500).json({ error: 'Failed to validate code' });
    }
});

// GET /api/merchant/analytics
router.get('/analytics', authenticateToken, requireMerchant, loadRestaurant, async (req, res) => {
    try {
        const restaurantId = req.restaurant._id.toString();

        const allCustomers = await User.find({ role: 'customer' }).lean();

        let totalTransactions = 0;
        let totalPointsIssued = 0;
        let totalPointsRedeemed = 0;
        let uniqueCustomers = new Set();

        allCustomers.forEach(c => {
            (c.transactions || []).forEach(t => {
                if (t.restaurantId && t.restaurantId.toString() === restaurantId) {
                    totalTransactions++;
                    uniqueCustomers.add(c._id.toString());
                    if (t.type === 'earned') totalPointsIssued += t.amount;
                    if (t.type === 'redeemed') totalPointsRedeemed += t.amount;
                }
            });
        });

        // Per-day activity for last 14 days
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const dailyMap = {}; // 'YYYY-MM-DD' -> { visits: 0, pointsIssued: 0, pointsRedeemed: 0 }
        const customerPointsMap = {}; // customerId -> totalPointsFromThisRestaurant

        allCustomers.forEach(c => {
            (c.transactions || []).forEach(t => {
                if (t.restaurantId?.toString() !== restaurantId) return;
                const ts = new Date(t.timestamp).getTime();
                if (ts > fourteenDaysAgo) {
                    const dayKey = new Date(t.timestamp).toISOString().slice(0, 10);
                    if (!dailyMap[dayKey]) dailyMap[dayKey] = { visits: 0, pointsIssued: 0, pointsRedeemed: 0 };
                    if (t.type === 'earned') { dailyMap[dayKey].visits++; dailyMap[dayKey].pointsIssued += t.amount; }
                    if (t.type === 'redeemed') dailyMap[dayKey].pointsRedeemed += t.amount;
                }
                if (t.type === 'earned') {
                    customerPointsMap[c._id.toString()] = (customerPointsMap[c._id.toString()] || 0) + t.amount;
                }
            });
        });

        // Build sorted daily array for last 14 days
        const dailyActivity = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const key = d.toISOString().slice(0, 10);
            dailyActivity.push({
                date: key,
                label: d.toLocaleDateString('es-GT', { month: 'short', day: 'numeric' }),
                ...(dailyMap[key] || { visits: 0, pointsIssued: 0, pointsRedeemed: 0 }),
            });
        }

        const recentTransactions = dailyActivity.reduce((s, d) => s + d.visits, 0);

        // Top customers at this restaurant
        const topCustomers = Object.entries(customerPointsMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, pts]) => {
                const c = allCustomers.find(x => x._id.toString() === id);
                return { phone: c?.phone || '—', points: pts };
            });

        res.json({
            overview: {
                uniqueCustomers: uniqueCustomers.size,
                totalTransactions,
                totalPointsIssued,
                totalPointsRedeemed,
                recentTransactions,
                pointsPerQuetzal: req.restaurant.pointsPerQuetzal,
            },
            dailyActivity,
            topCustomers,
            restaurant: {
                name: req.restaurant.name,
                plan: req.restaurant.plan,
                rewardCount: req.restaurant.rewards.filter(r => r.isActive).length,
            },
        });
    } catch (err) {
        console.error('Merchant analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ─── POS API key endpoint (no login — just X-API-Key header) ─────────────────
// Exported separately and mounted at /api/pos in server.js

const posRouter = express.Router();

async function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey) return res.status(401).json({ error: 'API key required (X-API-Key header)' });

    const restaurant = await Restaurant.findOne({ apiKey, isActive: true });
    if (!restaurant) return res.status(403).json({ error: 'Invalid or inactive API key' });

    req.restaurant = restaurant;
    next();
}

posRouter.post('/purchase', authenticateApiKey, async (req, res) => {
    return recordPurchaseHandler(req, res, req.restaurant);
});

posRouter.get('/restaurant', authenticateApiKey, (req, res) => {
    res.json({
        name: req.restaurant.name,
        emoji: req.restaurant.emoji,
        pointsPerQuetzal: req.restaurant.pointsPerQuetzal,
        rewards: req.restaurant.rewards.filter(r => r.isActive),
    });
});

// ─── Shared purchase logic ────────────────────────────────────────────────────

async function recordPurchaseHandler(req, res, restaurant) {
    try {
        const { customerPhone, amountQuetzales, description } = req.body;

        if (!customerPhone || !amountQuetzales) {
            return res.status(400).json({ error: 'customerPhone and amountQuetzales required' });
        }

        const customer = await User.findOne({
            phone: { $regex: customerPhone, $options: 'i' },
            role: 'customer',
        });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Check for active campaign (point multiplier)
        const activeCampaign = await Campaign.findOne({
            restaurant: restaurant._id,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate:   { $gte: new Date() },
        });
        const multiplier = activeCampaign ? activeCampaign.multiplier : 1;
        const basePoints = Math.floor(parseFloat(amountQuetzales) * restaurant.pointsPerQuetzal);
        const pointsEarned = Math.floor(basePoints * multiplier);

        // ─── Streak logic ─────────────────────────────────────────────────────
        const now = new Date();
        const lastVisit = customer.lastVisit ? new Date(customer.lastVisit) : null;
        const daysSinceLast = lastVisit
            ? Math.floor((now - lastVisit) / 86400000)
            : null;

        if (daysSinceLast === null || daysSinceLast > 1) {
            customer.streakDays = 1;                   // first visit or streak broken
        } else if (daysSinceLast === 1) {
            customer.streakDays = (customer.streakDays || 0) + 1;  // consecutive day
        }
        // daysSinceLast === 0 → same day, don't change streak
        customer.lastVisit = now;

        // Tag the transaction with restaurantId for merchant analytics
        customer.transactions.push({
            type: 'earned',
            amount: pointsEarned,
            description: description || `Compra en ${restaurant.name} — Q${amountQuetzales}`,
            timestamp: now,
            transactionHash: null,
            restaurantId: restaurant._id,
        });
        customer.totalPoints += pointsEarned;
        customer.visitCount = (customer.visitCount || 0) + 1;

        // Streak milestone bonuses (only on the day the milestone is hit)
        const STREAK_MILESTONES = { 3: 25, 7: 100, 30: 500 };
        const milestoneBonus = STREAK_MILESTONES[customer.streakDays];
        if (milestoneBonus && daysSinceLast === 1) {
            customer.totalPoints += milestoneBonus;
            customer.transactions.push({
                type: 'earned',
                amount: milestoneBonus,
                description: `🔥 Streak ${customer.streakDays} días — bonus`,
                timestamp: now,
                restaurantId: restaurant._id,
            });
        }

        // Welcome bonus on first visit to this restaurant
        if (restaurant.welcomeBonus > 0) {
            const hasVisited = customer.transactions.some(
                t => t.restaurantId?.toString() === restaurant._id.toString() && t.type === 'earned'
            );
            if (!hasVisited) {
                customer.transactions.push({
                    type: 'earned',
                    amount: restaurant.welcomeBonus,
                    description: `Bienvenido a ${restaurant.name}`,
                    timestamp: new Date(),
                    restaurantId: restaurant._id,
                });
                customer.totalPoints += restaurant.welcomeBonus;
            }
        }

        // ─── Achievements ─────────────────────────────────────────────────────
        const uniqueRestaurantIds = new Set(
            (customer.transactions || [])
                .filter(t => t.type === 'earned' && t.restaurantId)
                .map(t => t.restaurantId.toString())
        );
        const newAchievements = checkAchievements(customer, {
            event: 'purchase',
            uniqueRestaurantCount: uniqueRestaurantIds.size,
        });

        // ─── Active challenges progress ───────────────────────────────────────
        const now2 = new Date();
        const activeChallenges = await Challenge.find({
            isActive: true,
            startDate: { $lte: now2 },
            endDate:   { $gte: now2 },
            $or: [{ restaurant: null }, { restaurant: restaurant._id }],
        }).lean();

        let challengeBonusTotal = 0;
        for (const ch of activeChallenges) {
            let existing = (customer.challengeProgress || []).find(
                p => p.challengeId?.toString() === ch._id.toString()
            );
            if (!existing) {
                if (!customer.challengeProgress) customer.challengeProgress = [];
                customer.challengeProgress.push({ challengeId: ch._id, progress: 0, completed: false });
                existing = customer.challengeProgress[customer.challengeProgress.length - 1];
            }
            if (existing.completed) continue;

            // Increment based on metric
            if (ch.metric === 'visits') existing.progress += 1;
            else if (ch.metric === 'points_earned') existing.progress += pointsEarned;
            else if (ch.metric === 'restaurants') existing.progress = uniqueRestaurantIds.size;

            if (existing.progress >= ch.target) {
                existing.completed = true;
                existing.completedAt = now2;
                if (ch.bonusPoints > 0) {
                    customer.totalPoints += ch.bonusPoints;
                    challengeBonusTotal += ch.bonusPoints;
                    customer.transactions.push({
                        type: 'earned',
                        amount: ch.bonusPoints,
                        description: `🎯 Reto completado: ${ch.name}`,
                        timestamp: now2,
                        restaurantId: restaurant._id,
                    });
                }
            }
        }

        await customer.save();

        // WhatsApp notification (best-effort, never blocks response)
        notifyPointsEarned({
            phone: customer.phone,
            pointsEarned,
            totalPoints: customer.totalPoints,
            restaurantName: restaurant.name,
            tier: customer.tier,
        }).catch(() => {});

        res.json({
            success: true,
            customer: {
                phone: customer.phone,
                totalPoints: customer.totalPoints,
                tier: customer.tier,
                streakDays: customer.streakDays,
            },
            pointsEarned,
            milestoneBonus: milestoneBonus || 0,
            challengeBonus: challengeBonusTotal || 0,
            newAchievements,
            multiplier,
            campaign: activeCampaign ? { name: activeCampaign.name, multiplier } : null,
            restaurant: restaurant.name,
            newBalance: customer.totalPoints,
        });
    } catch (err) {
        console.error('Record purchase error:', err);
        res.status(500).json({ error: 'Failed to record purchase' });
    }
}

// ─── Admin: manage merchants ──────────────────────────────────────────────────

const adminRouter = express.Router();

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// POST /api/admin/merchants — create restaurant + merchant user
adminRouter.post('/merchants', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { phone, pin, restaurantName, emoji, accentColor, pointsPerQuetzal, welcomeBonus, category, zone } = req.body;
        if (!phone || !pin || !restaurantName) {
            return res.status(400).json({ error: 'phone, pin, and restaurantName required' });
        }

        const crypto = require('crypto');
        const { ethers } = require('ethers');

        const normalizedPhone = phone.startsWith('+') ? phone : '+502' + phone;
        const pinHash = crypto.createHash('sha256').update(`${normalizedPhone}:${pin}`).digest('hex');

        // Create or promote merchant user
        let merchantUser = await User.findOne({ phone: normalizedPhone });
        if (merchantUser) {
            merchantUser.role = 'merchant';
            merchantUser.pinHash = pinHash;
            await merchantUser.save();
        } else {
            const wallet = ethers.Wallet.createRandom();
            const referralCode = 'REG' + crypto.randomBytes(3).toString('hex').toUpperCase();
            merchantUser = await User.create({
                phone: normalizedPhone,
                pinHash,
                role: 'merchant',
                walletAddress: wallet.address,
                encryptedPrivateKey: Buffer.from(wallet.privateKey).toString('base64'),
                encryptedMnemonic: Buffer.from(wallet.mnemonic.phrase).toString('base64'),
                referralCode,
            });
        }

        // Create restaurant
        const restaurant = await Restaurant.create({
            name: restaurantName,
            emoji: emoji || '🍽️',
            accentColor: accentColor || '#FFFF00',
            owner: merchantUser._id,
            pointsPerQuetzal: pointsPerQuetzal || 1,
            welcomeBonus: welcomeBonus || 0,
            category: category || '',
            zone: zone || '',
            rewards: [
                { name: 'DESCUENTO 10%', description: 'En tu próxima compra', points: 50, emoji: '🏷️' },
                { name: 'BEBIDA GRATIS', description: 'Bebida de tu elección', points: 100, emoji: '🥤' },
            ],
        });

        res.json({
            success: true,
            merchant: { phone: merchantUser.phone, role: merchantUser.role },
            restaurant: {
                id: restaurant._id,
                name: restaurant.name,
                slug: restaurant.slug,
                apiKey: restaurant.apiKey,
            },
            message: `Merchant created. API Key: ${restaurant.apiKey}`,
        });
    } catch (err) {
        console.error('Create merchant error:', err);
        if (err.code === 11000) return res.status(400).json({ error: 'Phone or restaurant name already exists' });
        res.status(500).json({ error: 'Failed to create merchant' });
    }
});

// GET /api/admin/merchants — list all restaurants
adminRouter.get('/merchants', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const restaurants = await Restaurant.find()
            .populate('owner', 'phone totalPoints')
            .sort({ createdAt: -1 });
        res.json({ restaurants });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch merchants' });
    }
});

module.exports = { merchantRouter: router, posRouter, adminMerchantRouter: adminRouter };
