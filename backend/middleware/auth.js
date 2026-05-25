const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Batch = require('../models/Batch');
const { PERMISSIONS, ROLES, isAdminRole } = require('../constants/permissions');
const RBACService = require('../services/rbacService');

const protect = async (req, res, next) => {
    try {
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
            return res.status(401).json({ error: 'Not authorized', message: 'No token provided' });
        }
        const token = req.headers.authorization.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Not authorized', message: 'Token is empty' });
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) return res.status(401).json({ error: 'Not authorized', message: 'User not found' });

        const normalizedUser = user.toObject({ virtuals: true });
        normalizedUser._id = normalizedUser._id.toString();
        normalizedUser.id = normalizedUser._id;
        normalizedUser.farmerId = normalizedUser.farmerId || normalizedUser.id;

        req.user = normalizedUser;

        if (req.user.status !== 'active' && req.user.role !== ROLES.SUPER_ADMIN) {
            return res.status(403).json({ error: 'Access denied', message: 'User account is not active' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Not authorized', message: 'Invalid token' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && isAdminRole(req.user.role)) {
        return next();
    }
    return res.status(403).json({ error: 'Access denied', message: 'Admin access required' });
};

const verifiedOnly = (req, res, next) => {
    if (req.user && req.user.verification?.isVerified) return next();
    return res.status(403).json({ error: 'Access denied', message: 'Verified credential required' });
};

const authorizeBatchOwner = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        if (!batchId) return res.status(400).json({ error: 'Bad Request', message: 'Batch ID is required' });

        const batch = await Batch.findOne({ batchId });
        if (!batch) return res.status(404).json({ error: 'Not Found', message: 'Batch not found' });

        const userId = req.user.id || req.user._id;
        const userFarmerId = req.user.farmerId || userId;
        
        if (isAdminRole(req.user.role)) {
            req.batch = batch;
            return next();
        }

        // Bypassed for non-farmer roles who are updating stages
        if (req.user.role !== ROLES.FARMER) {
            req.batch = batch;
            return next();
        }

        const batchFarmerIdStr = batch.farmerId?.toString?.() || String(batch.farmerId || '');
        const userFarmerIdStr = userFarmerId?.toString?.() || String(userFarmerId || '');
        const userIdStr = userId?.toString?.() || String(userId || '');

        if (batchFarmerIdStr !== userFarmerIdStr && batchFarmerIdStr !== userIdStr) {
            console.log(`[AUTH FAIL] User ${userId} attempted to update batch ${batchId} owned by ${batch.farmerId}`);
            return res.status(403).json({ error: 'Access denied', message: 'Not authorized to update this batch' });
        }

        req.batch = batch;
        next();
    } catch (error) {
        console.error('Authorization error:', error);
        return res.status(500).json({ error: 'Server Error', message: 'Authorization check failed' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
        if (!roles.includes(req.user.role)) {
            console.log(`[RBAC VIOLATION] User ${req.user.email} (${req.user.role}) attempted to access endpoint requiring roles: ${roles.join(', ')}`);
            return res.status(403).json({ error: 'Access denied', message: `Role '${req.user.role}' is not authorized. Required roles: ${roles.join(', ')}` });
        }
        next();
    };
};

const authorizeStageTransition = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });

    const { stage } = req.body;
    const userRole = req.user.role;

    if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) return next();

    const stagePermissions = {
        [ROLES.FARMER]: ['farmer'],
        [ROLES.MANDI]: ['mandi'],
        [ROLES.TRANSPORTER]: ['transport'],
        [ROLES.RETAILER]: ['retailer']
    };

    const allowedStages = stagePermissions[userRole];
    if (!allowedStages || !allowedStages.includes(stage)) {
        console.log(`[STAGE VIOLATION] User ${req.user.email} (${userRole}) attempted to update stage '${stage}'`);
        return res.status(403).json({ error: 'Access denied', message: `Role '${userRole}' is not authorized to update stage '${stage}'` });
    }
    next();
};

const authorizeBlockchainTransaction = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
    
    const blockchainAllowedRoles = [ROLES.FARMER, ROLES.MANDI, ROLES.TRANSPORTER, ROLES.RETAILER, ROLES.ADMIN, ROLES.SUPER_ADMIN];
    if (!blockchainAllowedRoles.includes(req.user.role)) {
        console.log(`[BLOCKCHAIN VIOLATION] User ${req.user.email} (${req.user.role}) attempted blockchain transaction`);
        return res.status(403).json({ error: 'Access denied', message: `Role '${req.user.role}' is not authorized to perform blockchain transactions` });
    }
    next();
};

// New granular RBAC middlewares
const requirePermissions = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
        if (!RBACService.checkAnyPermission(req.user, permissions)) {
            console.log(`[PERMISSION DENIED] User ${req.user.email} requires: ${permissions.join(', ')}`);
            return res.status(403).json({ error: 'Access denied', message: `Missing required permission: ${permissions.join(' or ')}`, requiredPermissions: permissions });
        }
        next();
    };
};

const requireAllPermissions = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
        if (!RBACService.checkAllPermissions(req.user, permissions)) {
            return res.status(403).json({ error: 'Access denied', message: `Missing required permissions: ${permissions.join(', ')}` });
        }
        next();
    };
};

const inspectorOnly = async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
    if (req.user.role !== ROLES.QUALITY_INSPECTOR && req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ error: 'Access denied', message: 'Quality Inspector access required' });
    }
    if (req.user.role === ROLES.QUALITY_INSPECTOR && !req.user.canApproveMultisig) {
        return res.status(403).json({ error: 'Access denied', message: 'Inspector certification is not valid, active, or has expired' });
    }
    next();
};

const requireMultisigOrAdmin = (actionType) => {
    return async (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authorized', message: 'Authentication required' });
        if (req.user.role === ROLES.SUPER_ADMIN) {
            req.bypassMultisig = true;
            return next();
        }
        if (!RBACService.requiresMultisigApproval(actionType)) {
            return res.status(400).json({ error: 'Invalid action', message: 'Action does not require multisig approval' });
        }
        const { canInitiate, reason } = RBACService.canInitiateMultisigAction(req.user, actionType);
        if (!canInitiate) {
            return res.status(403).json({ error: 'Access denied', message: `Not authorized to initiate this action: ${reason}` });
        }
        next();
    };
};

const checkBatchSafetyStatus = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        if (!batchId) return next();

        const batch = await Batch.findOne({ batchId });
        if (!batch) return res.status(404).json({ error: 'Not found', message: 'Batch not found' });

        if (batch.safetyStatus && batch.safetyStatus !== 'safe') {
            if (!isAdminRole(req.user.role)) {
                return res.status(403).json({ error: 'Access denied', message: `Batch is currently ${batch.safetyStatus} and cannot be modified` });
            }
        }

        if (batch.hasPendingApproval && batch.hasPendingApproval()) {
            return res.status(403).json({ error: 'Access denied', message: 'Batch has a pending approval request' });
        }

        req.batch = batch;
        next();
    } catch (error) {
        console.error('Safety status check error:', error);
        return res.status(500).json({ error: 'Server error', message: 'Failed to check batch status' });
    }
};

module.exports = { 
    protect, 
    adminOnly, 
    verifiedOnly, 
    authorizeBatchOwner, 
    authorizeRoles,
    authorizeStageTransition,
    authorizeBlockchainTransaction,
    requirePermissions,
    requireAllPermissions,
    inspectorOnly,
    requireMultisigOrAdmin,
    checkBatchSafetyStatus
};
