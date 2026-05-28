const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (id, role, name) => {
    return jwt.sign({ id, role, name }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });
};

const generateRefreshToken = (id) => {
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not configured. Please set it in your .env file.');
    }

    return jwt.sign({ id, type: 'refresh' }, refreshSecret, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
};

module.exports = generateToken;
module.exports.generateRefreshToken = generateRefreshToken;
