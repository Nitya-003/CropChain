const mongoose = require('mongoose');

const bulkVerificationJobSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
    },
    totalRows: {
        type: Number,
        default: 0,
    },
    processedRows: {
        type: Number,
        default: 0,
    },
    successCount: {
        type: Number,
        default: 0,
    },
    failureCount: {
        type: Number,
        default: 0,
    },
    mode: {
        type: String,
        enum: ['bulk', 'dry-run'],
        default: 'bulk',
    },
    results: [{
        rowNumber: { type: Number, required: true },
        userId: { type: String, trim: true },
        walletAddress: { type: String, lowercase: true, trim: true },
        action: { type: String, trim: true },
        idempotencyKey: { type: String, trim: true },
        status: {
            type: String,
            enum: ['success', 'failure', 'skipped', 'dry-run-success', 'dry-run-failure', 'dry-run-skipped'],
            required: true,
        },
        error: { type: String },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
    }],
    actorId: {
        type: String,
        required: true,
    },
}, { timestamps: true });

bulkVerificationJobSchema.index({ actorId: 1 });
bulkVerificationJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BulkVerificationJob', bulkVerificationJobSchema);
