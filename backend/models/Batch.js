const mongoose = require('mongoose');

/**
 * @typedef {Object} BatchUpdate
 * @property {string} stage - Supply chain stage
 * @property {string} actor - Person/entity performing update
 * @property {string} location - Location of update
 * @property {Date} timestamp - When update occurred
 * @property {string} [notes] - Optional notes
 */

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

/**
 * @typedef {Object} Batch
 * @property {string} batchId - Unique batch identifier (CROP-YYYY-XXX)
 * @property {string} farmerId - Farmer identifier
 * @property {string} farmerName - Farmer's full name
 * @property {string} farmerAddress - Farmer's address
 * @property {string} cropType - Type of crop (rice/wheat/corn/tomato)
 * @property {number} quantity - Quantity in kg/tons
 * @property {Date} harvestDate - Date of harvest
 * @property {string} origin - Origin location
 * @property {string} [certifications] - Optional certifications
 * @property {string} [description] - Optional description
 * @property {string} currentStage - Current supply chain stage
 * @property {boolean} isRecalled - Whether batch is recalled
 * @property {string} qrCode - QR code data URL
 * @property {string} blockchainHash - Blockchain transaction hash
 * @property {string} syncStatus - Sync status (pending/synced/error)
 * @property {BatchUpdate[]} updates - Array of supply chain updates
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

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
    enum: {
      values: ['rice', 'wheat', 'corn', 'tomato'],
      message: 'Invalid crop type. Must be one of: rice, wheat, corn, tomato'
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    max: [1000000, 'Quantity cannot exceed 1,000,000']
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
    enum: {
      values: ['farmer', 'Mandi', 'Transport', 'Retailer'],
      message: 'Invalid stage. Must be one of: farmer, Mandi, Transport, Retailer'
    },
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
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Add indexes for performance optimization
batchSchema.index({ batchId: 1 });
batchSchema.index({ farmerId: 1 });
batchSchema.index({ createdAt: -1 });
batchSchema.index({ currentStage: 1 });
batchSchema.index({ syncStatus: 1 });
batchSchema.index({ isRecalled: 1 });

// Pre-save validation
batchSchema.pre('save', function(next) {
  // Ensure batchId is not empty
  if (!this.batchId || this.batchId.trim() === '') {
    throw new Error('Batch ID cannot be empty');
  }
  
  // Ensure quantity is positive
  if (this.quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  
  // Ensure harvestDate is not in the future
  if (new Date(this.harvestDate) > new Date()) {
    throw new Error('Harvest date cannot be in the future');
  }
  
  next();
});

// Instance methods
batchSchema.methods.getSupplyChainTimeline = function() {
  /**
   * Get formatted supply chain timeline
   * @returns {Array} Array of timeline entries
   */
  return this.updates.map(update => ({
    stage: update.stage,
    actor: update.actor,
    location: update.location,
    timestamp: update.timestamp,
    notes: update.notes
  }));
};

batchSchema.methods.isRecalledBatch = function() {
  /**
   * Check if batch is recalled
   * @returns {boolean} True if batch is recalled
   */
  return this.isRecalled;
};

batchSchema.methods.canBeUpdated = function() {
  /**
   * Check if batch can be updated
   * @returns {boolean} True if batch is not recalled and can be updated
   */
  return !this.isRecalled;
};

// Static methods
batchSchema.statics.findByBatchId = function(batchId) {
  /**
   * Find batch by batch ID
   * @param {string} batchId - The batch ID to search for
   * @returns {Promise} Promise resolving to batch document
   */
  return this.findOne({ batchId });
};

batchSchema.statics.findByFarmerId = function(farmerId) {
  /**
   * Find all batches by farmer ID
   * @param {string} farmerId - The farmer ID to search for
   * @returns {Promise} Promise resolving to array of batch documents
   */
  return this.find({ farmerId }).sort({ createdAt: -1 });
};

batchSchema.statics.getStats = function() {
  /**
   * Get overall batch statistics
   * @returns {Promise} Promise resolving to statistics object
   */
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        uniqueFarmers: { $addToSet: '$farmerId' },
        recalledBatches: {
          $sum: { $cond: ['$isRecalled', 1, 0] }
        }
      }
    },
    {
      $project: {
        totalBatches: 1,
        totalQuantity: 1,
        uniqueFarmers: { $size: '$uniqueFarmers' },
        recalledBatches: 1
      }
    }
  ]).then(result => result[0] || { totalBatches: 0, totalQuantity: 0, uniqueFarmers: 0, recalledBatches: 0 });
};

module.exports = mongoose.model('Batch', batchSchema);
