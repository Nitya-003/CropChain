const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    eventType: {
        type: String,
        required: [true, 'Event type is required'],
        enum: [
            'crop_registered',
            'harvest_completed',
            'ownership_transferred',
            'shipment_created',
            'shipment_status_updated',
            'delivery_confirmed',
            'batch_verified',
            'batch_recalled',
            'batch_status_updated',
            'iot_data_recorded',
            'verification_attempt',
            'verification_success',
            'verification_failure'
        ],
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        index: true
    },
    userRole: {
        type: String,
        required: [true, 'User role is required'],
        index: true
    },
    batchId: {
        type: String,
        index: true,
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// Optimize query patterns with compound indexes
activitySchema.index({ userRole: 1, createdAt: -1 });
activitySchema.index({ batchId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
