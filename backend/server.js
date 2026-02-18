require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authService = require('./services/authService');
const sponsorService = require('./services/sponsorService');
const adminService = require('./services/adminService');
const rewardsService = require('./services/rewardsService');
const eventService = require('./services/eventService');
const { merchantRouter, posRouter, adminMerchantRouter } = require('./services/merchantService');
const { adminRouter: allianceAdminRouter, publicRouter: alliancePublicRouter } = require('./services/allianceService');
const Restaurant = require('./models/Restaurant');
const Alliance = require('./models/Alliance');
const Campaign = require('./models/Campaign');
const Challenge = require('./models/Challenge');
const Review = require('./models/Review');
const User = require('./models/User');
const reviewService = require('./services/reviewService');
const { ACHIEVEMENTS } = require('./services/achievementService');
const { whatsappWebhookHandler } = require('./services/whatsappBotService');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20
});
app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// MongoDB connection — supports MONGO_URI or MONGODB_URI
console.log('🔍 ENV check:');
console.log('  MONGO_URI:', !!process.env.MONGO_URI);
console.log('  MONGODB_URI:', !!process.env.MONGODB_URI);
console.log('  JWT_SECRET:', !!process.env.JWT_SECRET);

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/reguards';
console.log('📍 MongoDB URI:', mongoUri ? '✅ Found' : '❌ Missing');

mongoose.connect(mongoUri)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('⚠️  Server will continue — check your MONGO_URI or MONGODB_URI in .env');
    });

// Routes
app.use('/api/auth', authService);
app.use('/api/sponsor', sponsorService);
app.use('/api/admin', adminService);
app.use('/api/admin', adminMerchantRouter);    // merchant management under admin
app.use('/api/merchant', merchantRouter);       // merchant self-service portal
app.use('/api/pos', posRouter);                 // API-key POS endpoint (no login)
app.use('/api/rewards', rewardsService);
app.use('/api/events', eventService);
app.use('/api/admin/alliances', allianceAdminRouter);   // admin: create/manage alliances
app.use('/api/alliances', alliancePublicRouter);         // public: live alliance info
app.use('/api/reviews', reviewService);                  // customer reviews

// ─── WhatsApp Bot Webhook ──────────────────────────────────────────────────────
// Twilio sends POST with x-www-form-urlencoded body — express.urlencoded handles it
// No rate-limit on this route (Twilio has its own retry logic)
app.post('/api/webhooks/whatsapp', whatsappWebhookHandler);

// ─── Public Explore / Marketplace ─────────────────────────────────────────────
// GET /api/restaurants/explore — no auth required
app.get('/api/restaurants/explore', async (req, res) => {
    try {
        const { category, zone } = req.query;
        const filter = { isActive: true };
        if (category) filter.category = { $regex: category, $options: 'i' };
        if (zone) filter.zone = { $regex: zone, $options: 'i' };

        const restaurants = await Restaurant.find(filter)
            .select('name slug emoji accentColor description address category zone pointsPerQuetzal welcomeBonus rewards isFeatured plan')
            .sort({ isFeatured: -1, createdAt: -1 })
            .lean();

        // Attach live alliance info to each restaurant
        const now = new Date();
        const alliances = await Alliance.find({
            isActive: true,
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        }).select('name emoji restaurants').lean();

        const alliancesByRestaurant = {};
        alliances.forEach(a => {
            (a.restaurants || []).forEach(rid => {
                const key = rid.toString();
                if (!alliancesByRestaurant[key]) alliancesByRestaurant[key] = [];
                alliancesByRestaurant[key].push({ name: a.name, emoji: a.emoji });
            });
        });

        const result = restaurants.map(r => ({
            ...r,
            rewardCount: (r.rewards || []).filter(rw => rw.isActive).length,
            rewards: undefined, // don't expose full rewards on explore
            alliances: alliancesByRestaurant[r._id.toString()] || [],
        }));

        res.json({ restaurants: result });
    } catch (err) {
        console.error('Explore error:', err);
        res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
});

// PATCH /api/admin/restaurants/:id/feature — toggle isFeatured (admin only)
app.patch('/api/admin/restaurants/:id/feature', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Auth required' });
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin required' });

        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            { isFeatured: req.body.isFeatured },
            { new: true }
        );
        res.json({ success: true, isFeatured: restaurant.isFeatured });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

// ─── Campaigns (Double Points) ────────────────────────────────────────────────

function requireAdminToken(req, res, next) {
    const jwt = require('jsonwebtoken');
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Auth required' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
        req.adminUser = decoded;
        next();
    } catch {
        res.status(403).json({ error: 'Invalid token' });
    }
}

// POST /api/admin/campaigns
app.post('/api/admin/campaigns', requireAdminToken, async (req, res) => {
    try {
        const { restaurantId, name, multiplier, startDate, endDate } = req.body;
        if (!restaurantId || !name || !multiplier || !endDate) {
            return res.status(400).json({ error: 'restaurantId, name, multiplier, endDate required' });
        }
        const campaign = await Campaign.create({
            restaurant: restaurantId,
            name,
            multiplier: parseFloat(multiplier),
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: new Date(endDate),
            createdBy: req.adminUser.userId,
        });
        res.json({ success: true, campaign });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create campaign' });
    }
});

// GET /api/admin/campaigns
app.get('/api/admin/campaigns', requireAdminToken, async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate('restaurant', 'name emoji accentColor')
            .sort({ createdAt: -1 });
        res.json({ campaigns });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
});

// PATCH /api/admin/campaigns/:id
app.patch('/api/admin/campaigns/:id', requireAdminToken, async (req, res) => {
    try {
        const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json({ success: true, campaign });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update campaign' });
    }
});

// DELETE /api/admin/campaigns/:id
app.delete('/api/admin/campaigns/:id', requireAdminToken, async (req, res) => {
    try {
        await Campaign.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
});

// GET /api/campaigns/active/:restaurantId — public, used by POS to show active campaign
app.get('/api/campaigns/active/:restaurantId', async (req, res) => {
    try {
        const now = new Date();
        const campaign = await Campaign.findOne({
            restaurant: req.params.restaurantId,
            isActive: true,
            startDate: { $lte: now },
            endDate:   { $gte: now },
        });
        res.json({ campaign });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
});

// ─── Achievements ──────────────────────────────────────────────────────────────
// GET /api/achievements/catalogue — list all possible achievements (public)
app.get('/api/achievements/catalogue', (req, res) => {
    res.json({ achievements: Object.values(ACHIEVEMENTS) });
});

// GET /api/achievements/mine — user's unlocked achievements (auth required)
app.get('/api/achievements/mine', async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const token = (req.headers['authorization'] || '').split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Auth required' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.userId).select('achievements');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ achievements: user.achievements || [] });
    } catch {
        res.status(403).json({ error: 'Invalid token' });
    }
});

// ─── Challenges ────────────────────────────────────────────────────────────────
// POST/GET/PATCH/DELETE /api/admin/challenges
app.post('/api/admin/challenges', requireAdminToken, async (req, res) => {
    try {
        const { name, description, emoji, metric, target, bonusPoints, bonusName, bonusEmoji, restaurant, startDate, endDate } = req.body;
        if (!name || !metric || !target || !endDate) {
            return res.status(400).json({ error: 'name, metric, target, endDate required' });
        }
        const ch = await Challenge.create({
            name, description, emoji: emoji || '🎯', metric, target: parseInt(target),
            bonusPoints: parseInt(bonusPoints) || 0, bonusName, bonusEmoji,
            restaurant: restaurant || null,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: new Date(endDate),
            createdBy: req.adminUser.userId,
        });
        res.json({ success: true, challenge: ch });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

app.get('/api/admin/challenges', requireAdminToken, async (req, res) => {
    try {
        const challenges = await Challenge.find()
            .populate('restaurant', 'name emoji')
            .sort({ createdAt: -1 });
        res.json({ challenges });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

app.patch('/api/admin/challenges/:id', requireAdminToken, async (req, res) => {
    try {
        const ch = await Challenge.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!ch) return res.status(404).json({ error: 'Challenge not found' });
        res.json({ success: true, challenge: ch });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update challenge' });
    }
});

app.delete('/api/admin/challenges/:id', requireAdminToken, async (req, res) => {
    try {
        await Challenge.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

// GET /api/challenges/active — public: currently active challenges + user progress if auth
app.get('/api/challenges/active', async (req, res) => {
    try {
        const now = new Date();
        const challenges = await Challenge.find({
            isActive: true,
            startDate: { $lte: now },
            endDate:   { $gte: now },
        }).populate('restaurant', 'name emoji').sort({ endDate: 1 }).lean();

        // Attach user progress if token provided
        let progress = {};
        try {
            const jwt = require('jsonwebtoken');
            const token = (req.headers['authorization'] || '').split(' ')[1];
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = await User.findById(decoded.userId).select('challengeProgress');
                (user?.challengeProgress || []).forEach(p => {
                    progress[p.challengeId?.toString()] = { progress: p.progress, completed: p.completed };
                });
            }
        } catch {}

        res.json({ challenges, progress });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch challenges' });
    }
});

// ─── Bulk WhatsApp Broadcast ────────────────────────────────────────────────────
// POST /api/admin/broadcast — send WhatsApp message to a customer segment
app.post('/api/admin/broadcast', requireAdminToken, async (req, res) => {
    try {
        const { message, segment, tier, restaurantId } = req.body;
        if (!message || message.trim().length < 5) {
            return res.status(400).json({ error: 'message required (min 5 chars)' });
        }

        let query = { role: 'customer', isActive: true };
        if (segment === 'tier' && tier) {
            // filter by tier (computed from totalPoints)
            const tierRanges = {
                BRONCE:  { $lt: 250 },
                PLATA:   { $gte: 250, $lt: 750 },
                ORO:     { $gte: 750, $lt: 2000 },
                PLATINO: { $gte: 2000 },
            };
            if (tierRanges[tier]) query.totalPoints = tierRanges[tier];
        }

        const customers = await User.find(query).select('phone').lean();

        const twilio = (() => {
            try { return require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); }
            catch { return null; }
        })();

        const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
        let sent = 0, failed = 0;

        if (!twilio) {
            // Dry-run mode — return preview
            return res.json({
                success: true,
                dryRun: true,
                recipientCount: customers.length,
                message: message.trim(),
                note: 'Twilio not configured — message not actually sent',
            });
        }

        // Send in batches to avoid rate limits (Twilio: ~1/sec on sandbox)
        for (const c of customers) {
            if (!c.phone) continue;
            try {
                await twilio.messages.create({
                    body: message.trim(),
                    from,
                    to: `whatsapp:${c.phone}`,
                });
                sent++;
                await new Promise(r => setTimeout(r, 1100)); // 1.1s delay
            } catch { failed++; }
        }

        res.json({ success: true, sent, failed, total: customers.length });
    } catch (err) {
        console.error('Broadcast error:', err);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// ─── Customer Self Check-In ─────────────────────────────────────────────────────
// GET /api/checkin/:slug — get restaurant info for customer check-in page (public)
app.get('/api/checkin/:slug', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ slug: req.params.slug, isActive: true })
            .select('name slug emoji accentColor description pointsPerQuetzal welcomeBonus rewards')
            .lean();
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
        restaurant.rewards = (restaurant.rewards || []).filter(r => r.isActive).slice(0, 5);

        // Check active campaign
        const now = new Date();
        const campaign = await Campaign.findOne({
            restaurant: restaurant._id,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        }).select('name multiplier').lean();

        res.json({ restaurant, campaign });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load restaurant' });
    }
});

// POST /api/checkin/:slug — customer self-records a visit (auth required)
app.post('/api/checkin/:slug', async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const token = (req.headers['authorization'] || '').split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Auth required' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        const restaurant = await Restaurant.findOne({ slug: req.params.slug, isActive: true });
        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        const user = await User.findById(decoded.userId);
        if (!user || user.role !== 'customer') return res.status(404).json({ error: 'User not found' });

        // Anti-spam: one self-check-in per restaurant per 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const recentCheckin = (user.transactions || []).find(
            t => t.restaurantId?.toString() === restaurant._id.toString()
                && t.type === 'earned'
                && t.description?.includes('Check-in')
                && new Date(t.timestamp) > sixHoursAgo
        );
        if (recentCheckin) {
            return res.status(429).json({ error: 'Ya registraste una visita aquí en las últimas 6 horas' });
        }

        // Award minimum points (1/3 of pointsPerQuetzal × 50 GTQ baseline, minimum 5)
        const checkinPoints = Math.max(5, Math.floor(restaurant.pointsPerQuetzal * 20));
        const now = new Date();

        user.transactions.push({
            type: 'earned',
            amount: checkinPoints,
            description: `Check-in: ${restaurant.name}`,
            timestamp: now,
            restaurantId: restaurant._id,
        });
        user.totalPoints += checkinPoints;
        user.visitCount = (user.visitCount || 0) + 1;

        // Streak
        const lastVisit = user.lastVisit ? new Date(user.lastVisit) : null;
        const daysSinceLast = lastVisit ? Math.floor((now - lastVisit) / 86400000) : null;
        if (daysSinceLast === null || daysSinceLast > 1) user.streakDays = 1;
        else if (daysSinceLast === 1) user.streakDays = (user.streakDays || 0) + 1;
        user.lastVisit = now;

        // Welcome bonus
        if (restaurant.welcomeBonus > 0) {
            const hasVisited = user.transactions.some(
                t => t.restaurantId?.toString() === restaurant._id.toString() && t.type === 'earned' && !t.description?.includes('Check-in')
            );
            if (!hasVisited) {
                user.transactions.push({
                    type: 'earned', amount: restaurant.welcomeBonus,
                    description: `Bienvenido a ${restaurant.name}`,
                    timestamp: now, restaurantId: restaurant._id,
                });
                user.totalPoints += restaurant.welcomeBonus;
            }
        }

        const { checkAchievements } = require('./services/achievementService');
        const uniqueIds = new Set(user.transactions.filter(t => t.restaurantId).map(t => t.restaurantId.toString()));
        const newAch = checkAchievements(user, { event: 'purchase', uniqueRestaurantCount: uniqueIds.size });

        await user.save();

        res.json({
            success: true,
            checkinPoints,
            newBalance: user.totalPoints,
            tier: user.tier,
            streakDays: user.streakDays,
            newAchievements: newAch,
        });
    } catch (err) {
        console.error('Checkin error:', err);
        res.status(500).json({ error: 'Check-in failed' });
    }
});

// ─── Public Restaurant Profile ─────────────────────────────────────────────────
// GET /api/restaurants/:slug — public restaurant profile page data
app.get('/api/restaurants/:slug', async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ slug: req.params.slug, isActive: true })
            .select('name slug emoji accentColor description address phone website pointsPerQuetzal welcomeBonus birthdayBonus rewards category zone isFeatured plan')
            .lean();

        if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

        // Active rewards only
        restaurant.rewards = (restaurant.rewards || []).filter(r => r.isActive);

        // Active alliances
        const now = new Date();
        const alliances = await Alliance.find({
            restaurants: restaurant._id,
            isActive: true,
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        }).select('name emoji description conversionRate endDate').lean();

        // Active campaign
        const activeCampaign = await Campaign.findOne({
            restaurant: restaurant._id,
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        }).select('name multiplier endDate').lean();

        // Upcoming events (optional model)
        let events = [];
        try {
            const Event = require('./models/Event');
            events = await Event.find({
                restaurant: restaurant._id,
                date: { $gte: now },
                isPublished: true,
            }).sort({ date: 1 }).limit(3).select('title date venue coverEmoji pointsReward isFree priceGTQ').lean();
        } catch {}

        res.json({ restaurant, alliances, activeCampaign, events });
    } catch (err) {
        console.error('Restaurant profile error:', err);
        res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 REGUARDS backend running on port', PORT);
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔗 Frontend:', process.env.FRONTEND_URL || 'http://localhost:5173');
    console.log('');
});

module.exports = app;