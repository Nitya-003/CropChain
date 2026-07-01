const validateRegistration = (req, res, next) => {
    const { role } = req.body;

    // Restrict role creation
    const allowedRoles = ['farmer', 'transporter', 'mandi', 'retailer'];
    if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({
            error: 'Registration failed',
            message: 'Invalid role selected. Only farmer, transporter, mandi and retailer accounts can be created publicly.'
        });
    }

    next();
};

module.exports = validateRegistration;
