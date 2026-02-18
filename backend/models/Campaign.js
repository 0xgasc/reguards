const mongoose = require('mongoose');

/**
 * Campaign — time-limited point multiplier for a restaurant.
 * Admin creates campaigns; applied automatically in recordPurchaseHandler.
 */
const CampaignSchema = new mongoose.Schema({
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name:        { type: String, required: true, trim: true }, // "Fin de semana doble"
    multiplier:  { type: Number, required: true, min: 1.1, default: 2 }, // 2 = double, 3 = triple
    startDate:   { type: Date, required: true, default: Date.now },
    endDate:     { type: Date, required: true },
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CampaignSchema.index({ restaurant: 1, isActive: 1, endDate: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
