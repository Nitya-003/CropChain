const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
    enum: ['farmer', 'Mandi', 'Transport', 'Retailer']
  },
  actor: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: 500
  }
}, { _id: true });

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  farmerId: {
    type: String,
    required: true,
    trim: true
  },
  farmerName: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100,
    trim: true
  },
  farmerAddress: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500,
    trim: true
  },
  cropType: {
    type: String,
    required: true,
    enum: ['rice', 'wheat', 'corn', 'tomato']
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 1000000
  },
  harvestDate: {
    type: Date,
    required: true
  },
  origin: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 200,
    trim: true
  },
  certifications: {
    type: String,
    maxlength: 500,
    default: '',
    trim: true
  },
  description: {
    type: String,
    maxlength: 1000,
    default: '',
    trim: true
  },
  currentStage: {
    type: String,
    required: true,
    enum: ['farmer', 'Mandi', 'Transport', 'Retailer'],
    default: 'farmer'
  },
  isRecalled: {
    type: Boolean,
    default: false
  },
  qrCode: {
    type: String,
    required: true
  },
  blockchainHash: {
    type: String,
    required: true
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'error'],
    default: 'pending'
  },
  updates: [updateSchema]
}, {
  timestamps: true
});

// Add indexes for performance
batchSchema.index({ batchId: 1 });
batchSchema.index({ farmerId: 1 });
batchSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Batch', batchSchema);
