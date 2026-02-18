const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating:     { type: Number, required: true, min: 1, max: 5 },
    text:       { type: String, trim: true, maxlength: 500 },
    emoji:      { type: String, default: '⭐' },   // customer picks an emoji reaction
    isVisible:  { type: Boolean, default: true },   // merchant can flag to hide
    visitDate:  { type: Date, default: Date.now },   // approximate visit date
}, { timestamps: true });

// One review per user per restaurant
ReviewSchema.index({ restaurant: 1, user: 1 }, { unique: true });
ReviewSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('Review', ReviewSchema);
