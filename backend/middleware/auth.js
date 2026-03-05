const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Batch = require('../models/Batch');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
    try {
        // Check if authorization header exists and starts with Bearer
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
            return res.status(401).json({
                error: 'Not authorized',
                message: 'No token provided',
            });
        }

        // Get token from header
        const token = req.headers.authorization.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Not authorized',
                message: 'Token is empty',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({
                error: 'Not authorized',
                message: 'User not found',
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Not authorized',
            message: 'Invalid token',
        });
    }
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    } else {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin access required',
        });
    }
};

/**
 * Verified users only middleware
 */
const verifiedOnly = (req, res, next) => {
    if (req.user && req.user.verification?.isVerified) {
        return next();
    } else {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Verified credential required',
        });
    }
};

/**
 * Authorize batch owner - verify user owns the batch
 */
const authorizeBatchOwner = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        
        if (!batchId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Batch ID is required',
            });
        }

        const batch = await Batch.findOne({ batchId });

        if (!batch) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Batch not found',
            });
        }

        // Check if user is the owner (farmerId matches user's _id or custom farmerId)
        // The batch uses farmerId as string, user might have _id or custom id
        const userId = req.user.id || req.user._id;
        const userFarmerId = req.user.farmerId || userId;
        
        // Also check if user has admin role - admins can update any batch
        if (req.user.role === 'admin') {
            req.batch = batch; // Store batch for potential use in controller
            return next();
        }

        // Normalize IDs to strings for comparison (handles ObjectId vs string mismatch)
        // Using optional chaining for safety in case toString is not available
        const batchFarmerIdStr = batch.farmerId?.toString?.() || String(batch.farmerId || '');
        const userFarmerIdStr = userFarmerId?.toString?.() || String(userFarmerId || '');
        const userIdStr = userId?.toString?.() || String(userId || '');

        if (batchFarmerIdStr !== userFarmerIdStr && batchFarmerIdStr !== userIdStr) {
            console.log(`[AUTH FAIL] User ${userId} attempted to update batch ${batchId} owned by ${batch.farmerId}`);
            return res.status(403).json({
                error: 'Access denied',
                message: 'Not authorized to update this batch',
            });
        }

        // Store batch in request for potential use
        req.batch = batch;
        next();
    } catch (error) {
        console.error('Authorization error:', error);
        return res.status(500).json({
            error: 'Server Error',
            message: 'Authorization check failed',
        });
    }
};

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not authorized',
                message: 'Authentication required',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied',
                message: `Role '${req.user.role}' is not authorized. Required roles: ${roles.join(', ')}`,
            });
        }

        next();
    };
};

module.exports = { protect, adminOnly, verifiedOnly, authorizeBatchOwner, authorizeRoles };
