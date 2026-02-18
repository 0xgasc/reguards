const mongoose = require('mongoose');

const customerPointsSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  
  // Points balance
  totalEarned: { type: Number, default: 0 },
  totalRedeemed: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  
  // Customer stats
  totalVisits: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastVisit: { type: Date, default: null },
  
  // Loyalty tier
  tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for fast lookups
customerPointsSchema.index({ customerId: 1, businessId: 1 }, { unique: true });
customerPointsSchema.index({ businessId: 1, currentBalance: -1 });

module.exports = mongoose.model('CustomerPoints', customerPointsSchema);