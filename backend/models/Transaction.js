const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  
  // Transaction details
  type: { type: String, enum: ['purchase', 'reward', 'redemption'], default: 'purchase' },
  amount: { type: Number, required: true }, // In quetzales
  description: { type: String, required: true },
  
  // Points
  pointsEarned: { type: Number, default: 0 },
  pointsRedeemed: { type: Number, default: 0 },
  
  // Experience
  experienceCreated: { type: Boolean, default: false },
  experienceBonus: { type: Number, default: 0 },
  experiencePhoto: String,
  experienceDescription: String,
  
  // Status
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
  
  // Metadata
  receiptNumber: String,
  paymentMethod: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

transactionSchema.index({ customerId: 1, businessId: 1 });
transactionSchema.index({ businessId: 1, createdAt: -1 });
transactionSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);