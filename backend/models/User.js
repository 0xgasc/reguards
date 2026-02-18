const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        trim: true
    },
    pinHash: {
        type: String,
        required: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        default: null
    },
    walletAddress: {
        type: String,
        required: true
    },
    encryptedPrivateKey: {
        type: String,
        required: true
    },
    encryptedMnemonic: {
        type: String,
        required: true
    },
    phoneVerified: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['customer', 'admin', 'merchant'],
        default: 'customer'
    },
    permissions: {
        canViewAllUsers: { type: Boolean, default: false },
        canEditUsers: { type: Boolean, default: false },
        canViewAnalytics: { type: Boolean, default: false },
        canManagePrograms: { type: Boolean, default: false }
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    totalExperiences: {
        type: Number,
        default: 0
    },
    lifetimeValue: {
        type: Number,
        default: 0
    },
    experiences: [{
        tokenId: Number,
        metadataURI: String,
        createdAt: Date,
        purchaseId: String
    }],
    transactions: [{
        type: {
            type: String,
            enum: ['earned', 'redeemed', 'transferred']
        },
        amount: Number,
        description: String,
        timestamp: Date,
        transactionHash: String,
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null }
    }],
    preferences: {
        language: {
            type: String,
            enum: ['en', 'es'],
            default: 'es'
        },
        notifications: {
            email: { type: Boolean, default: true },
            whatsapp: { type: Boolean, default: false }
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Social / referral
    referralCode: { type: String },  // unique sparse index defined below
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralCount: {
        type: Number,
        default: 0
    },
    // Engagement
    visitCount: {
        type: Number,
        default: 0
    },
    streakDays: {
        type: Number,
        default: 0
    },
    lastVisit: {
        type: Date,
        default: null
    },
    // Birthday bonus
    birthDate: {
        month: { type: Number, min: 1, max: 12, default: null },
        day:   { type: Number, min: 1, max: 31, default: null },
    },
    lastBirthdayBonusYear: { type: Number, default: null },

    // Achievements (unlocked badges)
    achievements: [{
        id:         { type: String, required: true },  // e.g. "STREAK_7"
        name:       String,
        emoji:      String,
        unlockedAt: { type: Date, default: Date.now },
    }],

    // Monthly challenge progress
    challengeProgress: [{
        challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' },
        progress:    { type: Number, default: 0 },
        completed:   { type: Boolean, default: false },
        completedAt: Date,
    }],

    // Redemption codes — one-time codes generated when customer redeems a reward
    pendingRedemptions: [{
        code:           { type: String, required: true },   // e.g. "A3F9B2"
        rewardName:     String,
        rewardEmoji:    String,
        pointsCost:     Number,
        restaurantId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
        restaurantName: String,
        status:         { type: String, enum: ['pending', 'fulfilled', 'expired'], default: 'pending' },
        createdAt:      { type: Date, default: Date.now },
        expiresAt:      Date,
        fulfilledAt:    Date,
    }]
});

// Indexes for performance (unique indexes)
UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index({ walletAddress: 1 }, { unique: true });
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

// Virtual for display name
UserSchema.virtual('displayName').get(function() {
    return this.phone || 'User';
});

// Virtual: tier based on totalPoints
UserSchema.virtual('tier').get(function() {
    if (this.totalPoints >= 2000) return 'PLATINO';
    if (this.totalPoints >= 750)  return 'ORO';
    if (this.totalPoints >= 250)  return 'PLATA';
    return 'BRONCE';
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Method to add experience
UserSchema.methods.addExperience = function(tokenId, metadataURI, purchaseId) {
    this.experiences.push({
        tokenId,
        metadataURI,
        createdAt: new Date(),
        purchaseId
    });
    this.totalExperiences = this.experiences.length;
    return this.save();
};

// Method to add transaction
UserSchema.methods.addTransaction = function(type, amount, description, transactionHash) {
    this.transactions.push({
        type,
        amount,
        description,
        timestamp: new Date(),
        transactionHash
    });
    
    if (type === 'earned') {
        this.totalPoints += amount;
    } else if (type === 'redeemed') {
        this.totalPoints -= amount;
    }
    
    return this.save();
};

module.exports = mongoose.model('User', UserSchema);