const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  
  // Reward details
  title: { type: String, required: true },
  description: { type: String, required: true },
  cost: { type: Number, required: true }, // Points needed to redeem
  
  // Reward type and value
  type: { type: String, enum: ['discount', 'free_item', 'cashback', 'experience'], default: 'discount' },
  value: { type: Number, required: true }, // Percentage for discount, fixed amount for cashback, etc
  
  // Availability
  isActive: { type: Boolean, default: true },
  maxRedemptions: { type: Number, default: null }, // null = unlimited
  currentRedemptions: { type: Number, default: 0 },
  
  // Validity
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null }, // null = no expiry
  
  // Usage rules
  minPurchaseAmount: { type: Number, default: 0 },
  maxPerCustomer: { type: Number, default: null }, // null = unlimited per customer
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

rewardSchema.index({ businessId: 1, isActive: 1 });

module.exports = mongoose.model('Reward', rewardSchema);