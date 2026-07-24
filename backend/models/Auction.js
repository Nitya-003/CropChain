const mongoose = require('mongoose');
const { fromString } = require('../utils/decimalHelpers');

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
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    min: [0, 'Start price cannot be negative']
  },
  currentHighestBid: {
    type: mongoose.Schema.Types.Decimal128,
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
}, { timestamps: true, toJSON: { getters: false, virtuals: false } });

auctionSchema.index({ status: 1, endTime: 1 });

auctionSchema.set('toJSON', {
  transform: function (doc, ret) {
    if (ret.startPrice && ret.startPrice._bsontype === 'Decimal128') {
      ret.startPrice = parseFloat(ret.startPrice.toString());
    }
    if (ret.currentHighestBid && ret.currentHighestBid._bsontype === 'Decimal128') {
      ret.currentHighestBid = parseFloat(ret.currentHighestBid.toString());
    }
    return ret;
  }
});

module.exports = mongoose.model('Auction', auctionSchema);
