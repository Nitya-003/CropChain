const validateRegistration = (req, res, next) => {
    const { role } = req.body;

    // Restrict role creation
    const allowedRoles = ['farmer', 'transporter'];
    if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({
            error: 'Registration failed',
            message: 'Invalid role selected. Only farmer and transporter accounts can be created publicly.'
        });
    }

    next();
};

module.exports = validateRegistration;
