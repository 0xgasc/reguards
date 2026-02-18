/**
 * Bootstrap a merchant account + restaurant via CLI
 *
 * Usage:
 *   node scripts/createMerchant.js
 *
 * Or with env overrides:
 *   MERCHANT_PHONE=+50299998888 MERCHANT_PIN=1234 RESTAURANT_NAME="El Rincón" node scripts/createMerchant.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { ethers } = require('ethers');

const MERCHANT_PHONE   = process.env.MERCHANT_PHONE   || '+50299998888';
const MERCHANT_PIN     = process.env.MERCHANT_PIN     || '1234';
const RESTAURANT_NAME  = process.env.RESTAURANT_NAME  || 'Mi Restaurante';
const RESTAURANT_EMOJI = process.env.RESTAURANT_EMOJI || '🍽️';
const ACCENT_COLOR     = process.env.ACCENT_COLOR     || '#FFFF00';
const POINTS_PER_Q     = parseInt(process.env.POINTS_PER_Q || '1', 10);
const WELCOME_BONUS    = parseInt(process.env.WELCOME_BONUS || '0', 10);

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/reguards';

async function main() {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Lazy-load models after connection
    const User       = require('../models/User');
    const Restaurant = require('../models/Restaurant');

    const normalizedPhone = MERCHANT_PHONE.startsWith('+') ? MERCHANT_PHONE : '+502' + MERCHANT_PHONE;
    const pinHash = crypto.createHash('sha256').update(`${normalizedPhone}:${MERCHANT_PIN}`).digest('hex');

    // ── 1. Create or update merchant user ──────────────────────────────────────
    let merchantUser = await User.findOne({ phone: normalizedPhone });

    if (merchantUser) {
        const wasCustomer = merchantUser.role === 'customer';
        merchantUser.role    = 'merchant';
        merchantUser.pinHash = pinHash;
        await merchantUser.save();
        console.log(`ℹ️  User ${normalizedPhone} already existed — promoted to merchant & PIN updated.`);
        if (wasCustomer) console.log('   (was customer → now merchant)');
    } else {
        const wallet       = ethers.Wallet.createRandom();
        const referralCode = 'REG' + crypto.randomBytes(3).toString('hex').toUpperCase();

        merchantUser = await User.create({
            phone:               normalizedPhone,
            pinHash,
            role:                'merchant',
            walletAddress:       wallet.address,
            encryptedPrivateKey: Buffer.from(wallet.privateKey).toString('base64'),
            encryptedMnemonic:   Buffer.from(wallet.mnemonic.phrase).toString('base64'),
            referralCode,
        });
        console.log(`✅ Merchant user created: ${normalizedPhone}`);
    }

    // ── 2. Create restaurant if none exists for this owner ─────────────────────
    let restaurant = await Restaurant.findOne({ owner: merchantUser._id });

    if (restaurant) {
        console.log(`ℹ️  Restaurant already exists: "${restaurant.name}" (slug: ${restaurant.slug})`);
        console.log(`   API Key: ${restaurant.apiKey}`);
    } else {
        restaurant = await Restaurant.create({
            name:            RESTAURANT_NAME,
            emoji:           RESTAURANT_EMOJI,
            accentColor:     ACCENT_COLOR,
            owner:           merchantUser._id,
            pointsPerQuetzal: POINTS_PER_Q,
            welcomeBonus:    WELCOME_BONUS,
            rewards: [
                { name: 'DESCUENTO 10%',  description: 'En tu próxima compra',  points: 50,  emoji: '🏷️' },
                { name: 'BEBIDA GRATIS',  description: 'Bebida de tu elección', points: 100, emoji: '🥤' },
            ],
        });
        console.log(`✅ Restaurant created: "${restaurant.name}" (slug: ${restaurant.slug})`);
        console.log(`   API Key: ${restaurant.apiKey}`);
    }

    // ── 3. Summary ─────────────────────────────────────────────────────────────
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MERCHANT ACCOUNT READY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Phone:       ${normalizedPhone}`);
    console.log(`PIN:         ${MERCHANT_PIN}`);
    console.log(`Restaurant:  ${restaurant.name}`);
    console.log(`Plan:        ${restaurant.plan}`);
    console.log(`API Key:     ${restaurant.apiKey}`);
    console.log('');
    console.log('POS Integration (no login required):');
    console.log('  POST /api/pos/purchase');
    console.log('  Header: X-API-Key:', restaurant.apiKey);
    console.log('  Body:   { "customerPhone": "+502XXXXXXXX", "amountQuetzales": 100 }');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
