const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - verify JWT token
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

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
    }

    if (!token) {
        return res.status(401).json({
            error: 'Not authorized',
            message: 'No token provided',
        });
    }
};

/**
 * Admin only middleware
 */
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({
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
        next();
    } else {
        res.status(403).json({
            error: 'Access denied',
            message: 'Verified credential required',
        });
    }
};

module.exports = { protect, adminOnly, verifiedOnly };
