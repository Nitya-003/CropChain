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

    // Target user for the mutation (privacy-safe identifier only)
    targetUserId: {
        type: String,
        trim: true,
    },

    // Backward compatible field name used by existing code/tests.
    // Prefer targetUserId in new code.
    userId: {
        type: String,
        trim: true,
    },

    walletAddress: {
        type: String,
        lowercase: true,
        trim: true,
    },

    // Idempotency key is sensitive-ish but not a raw signature; still keep it optional.
    idempotencyKey: {
        type: String,
        trim: true,
    },

    // For mutation outcome tracking.
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: ['attempt', 'success', 'failure', 'pending', 'unused'],
    },

    // Optional client details (no credentials/signatures)
    ip: {
        type: String,
        trim: true,
    },
    userAgent: {
        type: String,
        trim: true,
    },

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // Hash-chain fields for tamper evidence (append-only writes)
    previousHash: {
        type: String,
        trim: true,
    },
    eventHash: {
        type: String,
        index: true,
        trim: true,
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Optimize query patterns for audit log lookups
verificationEventSchema.index({ userId: 1 });
verificationEventSchema.index({ targetUserId: 1 });
verificationEventSchema.index({ actorId: 1 });
verificationEventSchema.index({ action: 1 });
verificationEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VerificationEvent', verificationEventSchema);

