/**
 * One-time admin bootstrap script.
 * Run once to create the first admin user:
 *
 *   ADMIN_PHONE=+50212345678 ADMIN_PIN=1234 node scripts/createAdmin.js
 *
 * Or with the defaults set in .env:
 *
 *   node scripts/createAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const crypto = require('crypto');
const { ethers } = require('ethers');
const User = require('../models/User');

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_PIN = process.env.ADMIN_PIN;

if (!ADMIN_PHONE || !ADMIN_PIN) {
    console.error('ERROR: Set ADMIN_PHONE and ADMIN_PIN in .env or as env vars before running.');
    process.exit(1);
}

if (!/^\d{4}$/.test(ADMIN_PIN)) {
    console.error('ERROR: ADMIN_PIN must be exactly 4 digits.');
    process.exit(1);
}

function hashPin(pin, phone) {
    return crypto.createHash('sha256').update(`${phone}:${pin}`).digest('hex');
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('ERROR: MONGODB_URI or MONGO_URI not set in .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ phone: ADMIN_PHONE });
    if (existing) {
        if (existing.role === 'admin') {
            console.log(`Admin already exists for phone ${ADMIN_PHONE}. Updating PIN...`);
            existing.pinHash = hashPin(ADMIN_PIN, ADMIN_PHONE);
            await existing.save();
            console.log('PIN updated.');
        } else {
            console.log(`User ${ADMIN_PHONE} exists but is a ${existing.role}. Promoting to admin...`);
            existing.role = 'admin';
            existing.pinHash = hashPin(ADMIN_PIN, ADMIN_PHONE);
            await existing.save();
            console.log('Promoted to admin.');
        }
    } else {
        const wallet = ethers.Wallet.createRandom();
        const admin = new User({
            phone: ADMIN_PHONE,
            pinHash: hashPin(ADMIN_PIN, ADMIN_PHONE),
            role: 'admin',
            walletAddress: wallet.address,
            encryptedPrivateKey: Buffer.from(wallet.privateKey).toString('base64'),
            encryptedMnemonic: Buffer.from(wallet.mnemonic.phrase).toString('base64'),
            totalPoints: 0,
        });
        await admin.save();
        console.log(`Admin created: ${ADMIN_PHONE}`);
        console.log(`Wallet address: ${wallet.address}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
