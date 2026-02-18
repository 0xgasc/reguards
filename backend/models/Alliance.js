/**
 * Alliance — cross-restaurant loyalty collaborations.
 *
 * When two or more restaurants form an alliance, customers who have points
 * from any member restaurant can spend them at any other member restaurant.
 *
 * Alliances can be:
 *  - Time-limited (endDate set) — e.g., "Circuito del Sabor — solo este mes"
 *  - Permanent (endDate null)  — long-term partnerships
 */
const mongoose = require('mongoose');

const AllianceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    emoji: {
        type: String,
        default: '🤝',
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    // 2 to 5 member restaurants
    restaurants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
    }],
    // Point exchange rate: 1 pt at Restaurant A = conversionRate pts at Restaurant B
    // Default 1.0 = 1:1. Set below 1 to make cross-restaurant redemptions less valuable.
    conversionRate: {
        type: Number,
        default: 1.0,
        min: 0.1,
        max: 10,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    // null = permanent alliance
    endDate: {
        type: Date,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

// Virtual: is the alliance currently valid (active + within dates)?
AllianceSchema.virtual('isLive').get(function () {
    if (!this.isActive) return false;
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;
    return true;
});

// Virtual: days remaining (null = permanent)
AllianceSchema.virtual('daysRemaining').get(function () {
    if (!this.endDate) return null;
    const diff = new Date(this.endDate) - new Date();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

AllianceSchema.set('toJSON', { virtuals: true });
AllianceSchema.set('toObject', { virtuals: true });

AllianceSchema.index({ restaurants: 1 });
AllianceSchema.index({ isActive: 1, endDate: 1 });

module.exports = mongoose.model('Alliance', AllianceSchema);
