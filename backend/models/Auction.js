const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  cropId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },
  batchId: {
    type: String,
    required: true,
    index: true
  },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startPrice: {
    type: Number,
    required: true,
    min: [0, 'Start price cannot be negative']
  },
  currentHighestBid: {
    type: Number,
    required: true,
    min: [0, 'Current bid cannot be negative']
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled'],
    default: 'active',
    index: true
  },
  settledAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Add compound indexes for pagination and state checks
auctionSchema.index({ status: 1, endTime: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
