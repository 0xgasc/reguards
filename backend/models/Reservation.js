const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true }, // "19:30"
    partySize: { type: Number, required: true, min: 1, max: 20 },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected', 'completed', 'cancelled', 'no_show'],
        default: 'pending',
    },
    notes: { type: String, maxlength: 500 },
    merchantNotes: { type: String, maxlength: 500 },
    bonusPoints: { type: Number, default: 0 },
}, { timestamps: true });

reservationSchema.index({ restaurant: 1, date: 1 });
reservationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
