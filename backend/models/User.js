const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ],
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false, // Don't return password by default
    },
    role: {
        type: String,
        enum: ['farmer', 'transporter', 'admin'],
        default: 'farmer',
    },
    walletAddress: {
        type: String,
        sparse: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    verification: {
        isVerified: {
            type: Boolean,
            default: false,
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        verifiedAt: {
            type: Date,
        },
        credentialHash: {
            type: String,
        },
        signature: {
            type: String,
        },
        revokedAt: {
            type: Date,
        },
        revocationReason: {
            type: String,
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});



module.exports = mongoose.model('User', userSchema);
