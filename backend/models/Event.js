const mongoose = require('mongoose');

const RsvpSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending_payment', 'pending_approval', 'confirmed', 'declined', 'waitlist'],
        default: 'confirmed'
    },
    // Bank transfer comprobante for paid events
    referenceCode: { type: String },       // e.g. "REGUARDS-A3K9"
    comprovanteUrl: { type: String },      // base64 or file path
    amountGTQ: { type: Number },
    adminNotes: { type: String },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Attendance
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    pointsAwarded: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    coverEmoji: { type: String, default: '🎉' },   // fallback when no image
    coverColor: { type: String, default: '#FFFF00' }, // neo-brutalist accent
    date: { type: Date, required: true },
    endDate: { type: Date },
    venue: { type: String, trim: true },
    address: { type: String, trim: true },
    maxAttendees: { type: Number, default: null },   // null = unlimited
    // Points economy
    pointsReward: { type: Number, default: 0 },     // points earned on confirmed attendance
    // Pricing
    isFree: { type: Boolean, default: true },
    priceGTQ: { type: Number, default: 0 },
    // Payment info (for paid events, bank transfer comprobante flow)
    bankName: { type: String, default: 'Banco Industrial' },
    bankAccount: { type: String, default: '123-456789-0 - Reguards S.A.' },
    // RSVPs
    rsvps: [RsvpSchema],
    // Meta
    status: {
        type: String,
        enum: ['draft', 'published', 'cancelled', 'completed'],
        default: 'published'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }],       // e.g. ['música', 'comida', 'exclusivo']
}, { timestamps: true });

// Virtual: confirmed attendee count
EventSchema.virtual('confirmedCount').get(function () {
    return this.rsvps.filter(r => r.status === 'confirmed').length;
});

// Virtual: spots left
EventSchema.virtual('spotsLeft').get(function () {
    if (!this.maxAttendees) return null;
    return Math.max(0, this.maxAttendees - this.confirmedCount);
});

EventSchema.set('toJSON', { virtuals: true });
EventSchema.set('toObject', { virtuals: true });

EventSchema.index({ date: 1, status: 1 });
EventSchema.index({ 'rsvps.user': 1 });

module.exports = mongoose.model('Event', EventSchema);
