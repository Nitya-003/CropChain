const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (id, role, name) => {
    return jwt.sign({ id, role, name }, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });
};

module.exports = generateToken;
