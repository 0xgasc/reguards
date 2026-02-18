const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema({
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    emoji:       { type: String, default: '🎯' },

    // What the customer needs to do
    metric: {
        type: String,
        enum: ['visits', 'points_earned', 'restaurants', 'referrals', 'redeems'],
        required: true,
    },
    target:  { type: Number, required: true, min: 1 }, // e.g. 5 visits

    // Reward
    bonusPoints: { type: Number, default: 0 },
    bonusEmoji:  { type: String, default: '🎁' },
    bonusName:   { type: String },

    // Optional: restrict to a specific restaurant (null = global)
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },

    // Time window
    startDate: { type: Date, required: true, default: Date.now },
    endDate:   { type: Date, required: true },

    // Status
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

ChallengeSchema.index({ isActive: 1, endDate: 1 });
ChallengeSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Challenge', ChallengeSchema);
