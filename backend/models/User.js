const mongoose = require('mongoose');
const { ROLES, VALID_ROLES } = require('../constants/permissions');

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
        minlength: 8,
        select: false,
    },
    role: {
        type: String,
        enum: VALID_ROLES,
        default: ROLES.FARMER,
    },
    permissions: [{
        type: String,
        trim: true
    }],
    walletAddress: {
        type: String,
        sparse: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    inspectorCredentials: {
        isCertified: { type: Boolean, default: false },
        certificationId: { type: String, sparse: true, trim: true },
        certifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        certifiedAt: { type: Date },
        expiresAt: { type: Date },
        specializations: [{ type: String, enum: ['contamination', 'quality', 'safety', 'organic', 'all'] }],
        jurisdiction: { region: String, country: String },
        isActive: { type: Boolean, default: true },
        suspendedAt: { type: Date },
        suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        suspensionReason: { type: String }
    },
    verification: {
        isVerified: { type: Boolean, default: false },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: { type: Date },
        credentialHash: { type: String },
        signature: { type: String },
        revokedAt: { type: Date },
        revocationReason: { type: String },
    },
    approvalStats: {
        totalApprovals: { type: Number, default: 0 },
        totalRejections: { type: Number, default: 0 },
        lastApprovalAt: { type: Date }
    },
    profile: {
        phone: { type: String, trim: true },
        organization: { type: String, trim: true },
        address: { street: String, city: String, state: String, postalCode: String, country: String },
        avatar: { type: String, default: '' }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'pending'
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 100000
    },
    lastLogin: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ 'inspectorCredentials.certificationId': 1 }, { sparse: true });
userSchema.index({ walletAddress: 1 }, { sparse: true });
userSchema.index({ 'verification.isVerified': 1 });
userSchema.index({ 'verification.isVerified': 1, role: 1 });

userSchema.virtual('canApproveMultisig').get(function() {
    if (this.role !== ROLES.QUALITY_INSPECTOR) return false;
    if (!this.inspectorCredentials || !this.inspectorCredentials.isCertified) return false;
    if (!this.inspectorCredentials.isActive) return false;
    if (this.inspectorCredentials.expiresAt && new Date() > this.inspectorCredentials.expiresAt) return false;
    return true;
});

userSchema.methods.hasPermission = function(permission) {
    const { hasPermission: checkRolePermission } = require('../constants/permissions');
    if (checkRolePermission(this.role, permission)) return true;
    if (this.permissions && this.permissions.includes(permission)) return true;
    return false;
};

userSchema.methods.canApproveAction = function(actionType) {
    if (!this.canApproveMultisig) return false;
    const { PERMISSIONS } = require('../constants/permissions');
    const actionPermissionMap = {
        'batch_recall': PERMISSIONS.INSPECTOR_APPROVE_RECALL,
        'batch_contaminated': PERMISSIONS.INSPECTOR_APPROVE_CONTAMINATED,
        'batch_destroy': PERMISSIONS.INSPECTOR_APPROVE_DESTROY
    };
    const requiredPermission = actionPermissionMap[actionType];
    if (!requiredPermission) return false;
    return this.hasPermission(requiredPermission);
};

userSchema.statics.findActiveInspectors = function() {
    return this.find({
        role: ROLES.QUALITY_INSPECTOR,
        'inspectorCredentials.isCertified': true,
        'inspectorCredentials.isActive': true,
        status: 'active'
    });
};

userSchema.statics.findBySpecialization = function(specialization) {
    return this.find({
        role: ROLES.QUALITY_INSPECTOR,
        'inspectorCredentials.isCertified': true,
        'inspectorCredentials.isActive': true,
        'inspectorCredentials.specializations': { $in: [specialization, 'all'] },
        status: 'active'
    });
};

module.exports = mongoose.model('User', userSchema);
