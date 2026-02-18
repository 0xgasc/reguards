const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Event = require('../models/Event');

// ─── Auth middleware ──────────────────────────────────────────────────────────

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

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReferenceCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'REG-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Format event for public consumption (hide full RSVP details)
function publicEvent(event, currentUserId) {
    const obj = event.toJSON ? event.toJSON() : { ...event };
    const confirmedRsvps = (obj.rsvps || []).filter(r => r.status === 'confirmed');

    // Only return first names + initials for privacy
    const attendees = confirmedRsvps.slice(0, 8).map(r => ({
        id: r.user?._id || r.user,
        initials: r.user?.phone
            ? r.user.phone.slice(-4)
            : '??',
    }));

    const myRsvp = currentUserId
        ? (obj.rsvps || []).find(r =>
            String(r.user?._id || r.user) === String(currentUserId)
          )
        : null;

    return {
        ...obj,
        rsvps: undefined,           // strip full list from public response
        confirmedCount: confirmedRsvps.length,
        attendees,                  // obfuscated preview
        myRsvp: myRsvp ? {
            status: myRsvp.status,
            referenceCode: myRsvp.referenceCode,
            checkedIn: myRsvp.checkedIn,
            pointsAwarded: myRsvp.pointsAwarded,
        } : null,
    };
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

// GET /api/events — browse upcoming published events
router.get('/', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        const events = await Event.find({
            status: 'published',
            date: { $gte: now },
        })
        .sort({ date: 1 })
        .limit(20)
        .lean();

        // Enrich with friend RSVP counts (who from your contacts also joined)
        // For now: just return public shape
        const result = events.map(e => {
            const confirmed = (e.rsvps || []).filter(r => r.status === 'confirmed');
            return {
                ...e,
                rsvps: undefined,
                confirmedCount: confirmed.length,
                spotsLeft: e.maxAttendees ? Math.max(0, e.maxAttendees - confirmed.length) : null,
                myRsvp: req.user
                    ? (e.rsvps || []).find(r => String(r.user) === String(req.user.userId))
                      ? { status: (e.rsvps || []).find(r => String(r.user) === String(req.user.userId)).status }
                      : null
                    : null,
            };
        });

        res.json({ events: result });
    } catch (err) {
        console.error('Get events error:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// GET /api/events/:id — event detail + obfuscated attendees list
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('rsvps.user', 'phone totalPoints');

        if (!event || event.status === 'draft') {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ event: publicEvent(event, req.user?.userId) });
    } catch (err) {
        console.error('Get event error:', err);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// POST /api/events/:id/rsvp — RSVP to an event
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event || event.status !== 'published') {
            return res.status(404).json({ error: 'Event not found' });
        }

        const userId = req.user.userId;

        // Check if already RSVP'd
        const existing = event.rsvps.find(r => String(r.user) === String(userId));
        if (existing) {
            return res.status(400).json({
                error: 'Ya tienes un RSVP para este evento',
                rsvp: { status: existing.status, referenceCode: existing.referenceCode },
            });
        }

        // Check capacity
        const confirmed = event.rsvps.filter(r => r.status === 'confirmed').length;
        if (event.maxAttendees && confirmed >= event.maxAttendees) {
            // Add to waitlist instead
            event.rsvps.push({ user: userId, status: 'waitlist' });
            await event.save();
            return res.json({ success: true, status: 'waitlist', message: 'Estás en lista de espera' });
        }

        if (event.isFree) {
            // Free event → confirmed immediately
            event.rsvps.push({ user: userId, status: 'confirmed' });
            await event.save();
            return res.json({
                success: true,
                status: 'confirmed',
                message: '¡Confirmado! Te vemos ahí.',
                event: { title: event.title, date: event.date, venue: event.venue },
            });
        } else {
            // Paid event → generate reference code, pending payment
            const referenceCode = generateReferenceCode();
            event.rsvps.push({
                user: userId,
                status: 'pending_payment',
                referenceCode,
                amountGTQ: event.priceGTQ,
            });
            await event.save();
            return res.json({
                success: true,
                status: 'pending_payment',
                referenceCode,
                paymentInstructions: {
                    amount: event.priceGTQ,
                    bankName: event.bankName,
                    bankAccount: event.bankAccount,
                    memo: referenceCode,
                    message: `Transfiere Q${event.priceGTQ} a ${event.bankName} — escribe "${referenceCode}" en el concepto`,
                },
            });
        }
    } catch (err) {
        console.error('RSVP error:', err);
        res.status(500).json({ error: 'Failed to RSVP' });
    }
});

// POST /api/events/:id/comprobante — upload payment proof
router.post('/:id/comprobante', authenticateToken, async (req, res) => {
    try {
        const { comprovanteData } = req.body; // base64 image string
        if (!comprovanteData) {
            return res.status(400).json({ error: 'Comprobante image required' });
        }

        // Limit base64 size (~5MB max)
        if (comprovanteData.length > 7 * 1024 * 1024) {
            return res.status(400).json({ error: 'Imagen demasiado grande (máx 5MB)' });
        }

        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const userId = req.user.userId;
        const rsvp = event.rsvps.find(r => String(r.user) === String(userId));
        if (!rsvp) {
            return res.status(400).json({ error: 'No tienes RSVP para este evento' });
        }
        if (rsvp.status !== 'pending_payment') {
            return res.status(400).json({ error: 'Tu RSVP no está pendiente de pago' });
        }

        rsvp.comprovanteUrl = comprovanteData;
        rsvp.status = 'pending_approval';
        await event.save();

        res.json({
            success: true,
            message: 'Comprobante recibido. El admin verificará tu pago pronto.',
            status: 'pending_approval',
        });
    } catch (err) {
        console.error('Comprobante error:', err);
        res.status(500).json({ error: 'Failed to upload comprobante' });
    }
});

// ─── Social: leaderboard ──────────────────────────────────────────────────────

// GET /api/events/social/leaderboard — top point earners (public)
router.get('/social/leaderboard', authenticateToken, async (req, res) => {
    try {
        const top = await User.find({ role: 'customer', totalPoints: { $gt: 0 } })
            .select('phone totalPoints createdAt')
            .sort({ totalPoints: -1 })
            .limit(20);

        const leaderboard = top.map((u, i) => ({
            rank: i + 1,
            displayName: `+502 ••••${u.phone.slice(-4)}`,
            totalPoints: u.totalPoints,
            tier: computeTier(u.totalPoints),
            isMe: String(u._id) === String(req.user?.userId),
        }));

        res.json({ leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

function computeTier(points) {
    if (points >= 2000) return 'PLATINO';
    if (points >= 750) return 'ORO';
    if (points >= 250) return 'PLATA';
    return 'BRONCE';
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// POST /api/events (admin) — create event
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            title, description, date, endDate, venue, address,
            maxAttendees, pointsReward, isFree, priceGTQ,
            bankName, bankAccount, coverEmoji, coverColor, tags,
        } = req.body;

        if (!title || !date) {
            return res.status(400).json({ error: 'Title and date are required' });
        }

        const event = new Event({
            title,
            description,
            date: new Date(date),
            endDate: endDate ? new Date(endDate) : undefined,
            venue,
            address,
            maxAttendees: maxAttendees || null,
            pointsReward: pointsReward || 0,
            isFree: isFree !== false,
            priceGTQ: priceGTQ || 0,
            bankName: bankName || 'Banco Industrial',
            bankAccount: bankAccount || '123-456789-0 - Reguards S.A.',
            coverEmoji: coverEmoji || '🎉',
            coverColor: coverColor || '#FFFF00',
            tags: tags || [],
            status: 'published',
            createdBy: req.user.userId,
        });

        await event.save();
        res.json({ success: true, event });
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// PATCH /api/events/:id (admin) — update/cancel event
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const allowed = ['title', 'description', 'date', 'venue', 'address',
            'maxAttendees', 'pointsReward', 'status', 'coverEmoji', 'coverColor', 'tags'];
        const updates = {};
        allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

        const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ success: true, event });
    } catch (err) {
        console.error('Update event error:', err);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// GET /api/events/admin/all (admin) — all events including drafts
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const events = await Event.find()
            .sort({ date: -1 })
            .lean();

        const result = events.map(e => ({
            ...e,
            confirmedCount: (e.rsvps || []).filter(r => r.status === 'confirmed').length,
            pendingCount: (e.rsvps || []).filter(r =>
                r.status === 'pending_payment' || r.status === 'pending_approval'
            ).length,
            rsvps: undefined,
        }));

        res.json({ events: result });
    } catch (err) {
        console.error('Admin get events error:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// GET /api/events/:id/rsvps (admin) — full RSVP list
router.get('/:id/rsvps', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('rsvps.user', 'phone totalPoints');
        if (!event) return res.status(404).json({ error: 'Event not found' });

        res.json({
            event: { title: event.title, date: event.date, venue: event.venue },
            rsvps: event.rsvps,
        });
    } catch (err) {
        console.error('Get RSVPs error:', err);
        res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
});

// POST /api/events/:id/rsvps/:rsvpId/approve (admin) — approve comprobante
router.post('/:id/rsvps/:rsvpId/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const rsvp = event.rsvps.id(req.params.rsvpId);
        if (!rsvp) return res.status(404).json({ error: 'RSVP not found' });

        rsvp.status = 'confirmed';
        rsvp.approvedAt = new Date();
        rsvp.approvedBy = req.user.userId;
        rsvp.adminNotes = req.body.notes || '';
        await event.save();

        res.json({ success: true, message: 'RSVP confirmed' });
    } catch (err) {
        console.error('Approve RSVP error:', err);
        res.status(500).json({ error: 'Failed to approve RSVP' });
    }
});

// POST /api/events/:id/rsvps/:rsvpId/reject (admin) — reject comprobante
router.post('/:id/rsvps/:rsvpId/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const rsvp = event.rsvps.id(req.params.rsvpId);
        if (!rsvp) return res.status(404).json({ error: 'RSVP not found' });

        rsvp.status = 'declined';
        rsvp.adminNotes = req.body.reason || '';
        await event.save();

        res.json({ success: true, message: 'RSVP rejected' });
    } catch (err) {
        console.error('Reject RSVP error:', err);
        res.status(500).json({ error: 'Failed to reject RSVP' });
    }
});

// POST /api/events/:id/check-in (admin) — scan QR at door, award points
router.post('/:id/check-in', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { customerPhone } = req.body;
        if (!customerPhone) {
            return res.status(400).json({ error: 'Customer phone required' });
        }

        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const customer = await User.findOne({
            phone: { $regex: customerPhone, $options: 'i' },
            role: 'customer',
        });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const rsvp = event.rsvps.find(r => String(r.user) === String(customer._id));
        if (!rsvp || rsvp.status !== 'confirmed') {
            return res.status(400).json({
                error: 'No confirmed RSVP found',
                rsvpStatus: rsvp?.status || 'none',
            });
        }

        if (rsvp.checkedIn) {
            return res.status(400).json({ error: 'Already checked in' });
        }

        rsvp.checkedIn = true;
        rsvp.checkedInAt = new Date();
        await event.save();

        // Award points if set
        if (event.pointsReward > 0 && !rsvp.pointsAwarded) {
            await customer.addTransaction(
                'earned',
                event.pointsReward,
                `Asistencia: ${event.title}`,
                null
            );
            rsvp.pointsAwarded = true;
            await event.save();
        }

        res.json({
            success: true,
            customer: { phone: customer.phone, totalPoints: customer.totalPoints },
            pointsAwarded: event.pointsReward,
            message: `✓ Check-in exitoso${event.pointsReward ? ` (+${event.pointsReward} puntos)` : ''}`,
        });
    } catch (err) {
        console.error('Check-in error:', err);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// GET /api/events/my/rsvps — current user's RSVP list
router.get('/my/rsvps', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        // Find events where this user has an RSVP
        const events = await Event.find({ 'rsvps.user': userId })
            .sort({ date: 1 });

        const result = events.map(ev => {
            const myRsvp = ev.rsvps.find(r => String(r.user) === String(userId));
            return {
                _id: ev._id,
                title: ev.title,
                coverEmoji: ev.coverEmoji,
                coverColor: ev.coverColor,
                date: ev.date,
                venue: ev.venue,
                pointsReward: ev.pointsReward,
                isFree: ev.isFree,
                priceGTQ: ev.priceGTQ,
                status: ev.status,
                myRsvp: myRsvp ? {
                    _id: myRsvp._id,
                    status: myRsvp.status,
                    referenceCode: myRsvp.referenceCode,
                    checkedIn: myRsvp.checkedIn,
                    pointsAwarded: myRsvp.pointsAwarded,
                } : null,
            };
        });

        res.json({ events: result });
    } catch (err) {
        console.error('My RSVPs error:', err);
        res.status(500).json({ error: 'Failed to fetch your RSVPs' });
    }
});

module.exports = router;
