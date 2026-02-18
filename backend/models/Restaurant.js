const mongoose = require('mongoose');
const crypto = require('crypto');

const RewardItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    points: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    emoji: { type: String, default: '🎁' },
}, { _id: true });

const RestaurantSchema = new mongoose.Schema({
    // Identity
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    emoji: { type: String, default: '🍽️' },
    accentColor: { type: String, default: '#FFFF00' },
    description: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },      // restaurant contact phone
    website: { type: String, trim: true },

    // Owner (the merchant user)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Points economy
    pointsPerQuetzal: { type: Number, default: 1 },    // 1 pt per Q spent
    welcomeBonus: { type: Number, default: 0 },         // pts on first visit
    birthdayBonus: { type: Number, default: 50 },

    // Custom rewards catalog (overrides global catalog for this restaurant)
    rewards: [RewardItemSchema],

    // API key for POS integration (no login required, just the key)
    apiKey: {
        type: String,
        unique: true,
        default: () => 'reguards_mk_' + crypto.randomBytes(16).toString('hex')
    },

    // Marketplace / Explore
    isFeatured: { type: Boolean, default: false },   // admin toggles — paid plan
    category: { type: String, default: '' },          // e.g. "comida chapina", "café", "mariscos"
    zone: { type: String, default: '' },              // e.g. "Zona 10", "Miraflores"

    // Status
    isActive: { type: Boolean, default: true },
    plan: {
        type: String,
        enum: ['free', 'starter', 'pro'],
        default: 'free',
    },
    // Free plan: basic POS + up to 3 custom rewards
    // Starter: analytics + unlimited rewards
    // Pro: API access + whatsapp notifications + branded page

}, { timestamps: true });

RestaurantSchema.index({ owner: 1 });
RestaurantSchema.index({ apiKey: 1 }, { unique: true });
RestaurantSchema.index({ slug: 1 }, { unique: true });

// Auto-generate slug from name if not set
RestaurantSchema.pre('save', function(next) {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);
