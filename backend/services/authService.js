const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const crypto = require('crypto');
const User = require('../models/User');

// ─── PIN brute force protection ────────────────────────────────────────────────
// In-memory: { phone -> { count, firstAttempt } }
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(phone) {
    const now = Date.now();
    const entry = loginAttempts.get(phone);
    if (!entry) return { blocked: false };
    if (now - entry.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(phone);
        return { blocked: false };
    }
    if (entry.count >= MAX_ATTEMPTS) {
        const retryAfterMs = WINDOW_MS - (now - entry.firstAttempt);
        const retryMinutes = Math.ceil(retryAfterMs / 60000);
        return { blocked: true, retryMinutes };
    }
    return { blocked: false };
}

function recordFailedAttempt(phone) {
    const now = Date.now();
    const entry = loginAttempts.get(phone);
    if (!entry || now - entry.firstAttempt > WINDOW_MS) {
        loginAttempts.set(phone, { count: 1, firstAttempt: now });
    } else {
        entry.count += 1;
    }
}

function clearAttempts(phone) {
    loginAttempts.delete(phone);
}

// Clean up old entries every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [phone, entry] of loginAttempts.entries()) {
        if (now - entry.firstAttempt > WINDOW_MS) loginAttempts.delete(phone);
    }
}, 30 * 60 * 1000);

// Generate custodial wallet for user
function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase
    };
}

// Encrypt private key (simplified - use proper encryption in production)
function encryptPrivateKey(privateKey) {
    // In production, use proper encryption with a key management service
    const encrypted = Buffer.from(privateKey).toString('base64');
    return encrypted;
}

// Decrypt private key
function decryptPrivateKey(encryptedKey) {
    const decrypted = Buffer.from(encryptedKey, 'base64').toString();
    return decrypted;
}

// Hash PIN with phone number (SHA-256)
function hashPin(pin, phone) {
    return crypto.createHash('sha256').update(`${phone}:${pin}`).digest('hex');
}

// Validate Guatemala phone number format
function validatePhone(phone) {
    // Guatemala phone format: +502 XXXX-XXXX or 502XXXXXXXX
    const cleanPhone = phone.replace(/[\s\-]/g, '');
    return /^(\+502|502)?\d{8}$/.test(cleanPhone);
}

// Clean phone number to consistent format
function cleanPhone(phone) {
    let cleaned = phone.replace(/[\s\-]/g, '');
    // Ensure it starts with +502
    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('502')) {
            cleaned = '+' + cleaned;
        } else {
            cleaned = '+502' + cleaned;
        }
    }
    return cleaned;
}

// Validate 4-digit PIN
function validatePin(pin) {
    return /^\d{4}$/.test(pin);
}

// Generate short referral code e.g. "REG-A3K9"
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'REG';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// Signup with phone + PIN
router.post('/signup', async (req, res) => {
    try {
        const { phone, pin, email } = req.body;

        // Validate phone
        if (!phone || !validatePhone(phone)) {
            return res.status(400).json({ error: 'Valid phone number required (+502 format)' });
        }

        // Validate PIN
        if (!pin || !validatePin(pin)) {
            return res.status(400).json({ error: 'PIN must be 4 digits' });
        }

        const normalizedPhone = cleanPhone(phone);

        // Check if phone already exists
        const existingUser = await User.findOne({ phone: normalizedPhone });
        if (existingUser) {
            return res.status(409).json({ error: 'Phone number already registered. Please login.' });
        }

        // Hash PIN
        const pinHash = hashPin(pin, normalizedPhone);

        // Generate custodial wallet
        const wallet = generateWallet();

        // Generate unique referral code
        const referralCode = generateReferralCode();

        // Handle referrer (optional ?ref= in signup body)
        let referredBy = null;
        if (req.body.referralCode) {
            const referrer = await User.findOne({ referralCode: req.body.referralCode });
            if (referrer) {
                referredBy = referrer._id;
                // Award referral bonus points to the referrer
                await referrer.addTransaction('earned', 50, 'Bonus: referido nuevo', null);
                referrer.referralCount = (referrer.referralCount || 0) + 1;
                await referrer.save();
            }
        }

        // Create new user
        const user = new User({
            phone: normalizedPhone,
            pinHash,
            email: email || null,
            walletAddress: wallet.address,
            encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
            encryptedMnemonic: encryptPrivateKey(wallet.mnemonic),
            role: 'customer',
            phoneVerified: true,
            referralCode,
            referredBy,
            createdAt: new Date()
        });

        await user.save();

        // Generate JWT immediately
        const token = jwt.sign(
            {
                userId: user._id,
                phone: user.phone,
                walletAddress: user.walletAddress,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                phone: user.phone,
                walletAddress: user.walletAddress,
                role: user.role,
                totalPoints: user.totalPoints,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Login with phone + PIN
router.post('/login', async (req, res) => {
    try {
        const { phone, pin } = req.body;

        // Validate inputs
        if (!phone || !validatePhone(phone)) {
            return res.status(400).json({ error: 'Valid phone number required' });
        }

        if (!pin || !validatePin(pin)) {
            return res.status(400).json({ error: 'PIN must be 4 digits' });
        }

        const normalizedPhone = cleanPhone(phone);

        // Rate limit check
        const limit = checkRateLimit(normalizedPhone);
        if (limit.blocked) {
            return res.status(429).json({
                error: `Demasiados intentos fallidos. Intenta en ${limit.retryMinutes} minuto${limit.retryMinutes !== 1 ? 's' : ''}.`
            });
        }

        // Find user by phone
        const user = await User.findOne({ phone: normalizedPhone });
        if (!user) {
            recordFailedAttempt(normalizedPhone);
            return res.status(401).json({ error: 'Teléfono o PIN incorrecto' });
        }

        // Verify PIN
        const pinHash = hashPin(pin, normalizedPhone);
        if (pinHash !== user.pinHash) {
            recordFailedAttempt(normalizedPhone);
            const attempts = loginAttempts.get(normalizedPhone);
            const remaining = MAX_ATTEMPTS - (attempts?.count || 0);
            return res.status(401).json({
                error: `PIN incorrecto. ${remaining > 0 ? `${remaining} intentos restantes.` : 'Cuenta bloqueada temporalmente.'}`
            });
        }

        // Success — clear failed attempts
        clearAttempts(normalizedPhone);

        // Update last login
        user.lastLogin = new Date();

        // ─── Birthday bonus check ──────────────────────────────────────────────
        let birthdayBonus = 0;
        const today = new Date();
        if (
            user.birthDate?.month === today.getMonth() + 1 &&
            user.birthDate?.day   === today.getDate()       &&
            user.lastBirthdayBonusYear !== today.getFullYear() &&
            user.role === 'customer'
        ) {
            // Award 100 pts birthday bonus
            birthdayBonus = 100;
            user.totalPoints += birthdayBonus;
            user.lastBirthdayBonusYear = today.getFullYear();
            user.transactions.push({
                type: 'earned',
                amount: birthdayBonus,
                description: '🎂 ¡Feliz cumpleaños! Bonus de puntos',
                timestamp: today,
            });

            // WhatsApp birthday greeting (fire-and-forget)
            try {
                const { sendWhatsApp } = require('./notificationService');
                sendWhatsApp(user.phone, [
                    `🎂 *¡Feliz Cumpleaños!*`,
                    ``,
                    `De parte de todo el equipo REGUARDS, ¡te deseamos un día increíble!`,
                    ``,
                    `Como regalo, te hemos dado *${birthdayBonus} puntos* extra en tu cuenta. 🎁`,
                    ``,
                    `Abre la app: https://reguards.app`,
                ].join('\n')).catch(() => {});
            } catch {}
        }

        await user.save();

        // Generate JWT
        const token = jwt.sign(
            {
                userId: user._id,
                phone: user.phone,
                walletAddress: user.walletAddress,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            birthdayBonus: birthdayBonus || 0,
            user: {
                id: user._id,
                phone: user.phone,
                walletAddress: user.walletAddress,
                role: user.role,
                totalPoints: user.totalPoints,
                totalExperiences: user.totalExperiences,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-encryptedPrivateKey -encryptedMnemonic -pinHash');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user._id,
                phone: user.phone,
                email: user.email,
                role: user.role,
                totalPoints: user.totalPoints || 0,
                tier: user.tier,
                referralCode: user.referralCode,
                referralCount: user.referralCount || 0,
                visitCount: user.visitCount || 0,
                streakDays: user.streakDays || 0,
                lastVisit: user.lastVisit,
                birthDate: user.birthDate,
                transactions: user.transactions || [],
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// PUT /api/auth/profile — update birthday and email
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (req.body.email !== undefined) user.email = req.body.email || null;
        if (req.body.birthDate) {
            const { month, day } = req.body.birthDate;
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                user.birthDate = { month: parseInt(month), day: parseInt(day) };
            }
        }

        await user.save();
        res.json({ success: true, birthDate: user.birthDate });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Export wallet (optional - for users who want self-custody)
router.post('/export-wallet', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        
        // In production, verify password or additional authentication
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const privateKey = decryptPrivateKey(user.encryptedPrivateKey);
        const mnemonic = decryptPrivateKey(user.encryptedMnemonic);
        
        res.json({
            warning: 'Keep these credentials safe! Anyone with access can control your wallet.',
            walletAddress: user.walletAddress,
            privateKey,
            mnemonic
        });
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export wallet' });
    }
});

// Middleware to authenticate JWT
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

module.exports = router;