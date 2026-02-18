const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true }, // restaurant, coffee, retail, etc
  location: {
    address: String,
    city: String,
    zone: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  settings: {
    pointsPerQuetzal: { type: Number, default: 1 },
    experienceBonus: { type: Number, default: 20 },
    minRedemption: { type: Number, default: 50 },
    welcomeBonus: { type: Number, default: 50 },
    isActive: { type: Boolean, default: true }
  },
  stats: {
    totalCustomers: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    totalPointsIssued: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

businessSchema.index({ ownerId: 1 });
businessSchema.index({ name: 1 });

module.exports = mongoose.model('Business', businessSchema);