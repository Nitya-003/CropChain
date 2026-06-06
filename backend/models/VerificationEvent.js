const mongoose = require('mongoose');

const verificationEventSchema = new mongoose.Schema({
    action: {
        type: String,
        required: [true, 'Action is required'],
        trim: true,
    },
    actorId: {
        type: String,
        trim: true,
    },
    userId: {
        type: String,
        trim: true,
    },
    walletAddress: {
        type: String,
        lowercase: true,
        trim: true,
    },
    idempotencyKey: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: ['attempt', 'success', 'failure', 'pending', 'unused'],
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Optimize query patterns for audit log lookups
verificationEventSchema.index({ userId: 1 });
verificationEventSchema.index({ actorId: 1 });
verificationEventSchema.index({ action: 1 });
verificationEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VerificationEvent', verificationEventSchema);
