const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
require('dotenv').config();

// Validation Schemas
const registerSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .trim(),
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    role: z.enum(['farmer', 'transporter'], {
        errorMap: () => ({ message: 'Invalid role. Only farmer and transporter are allowed.' })
    })
});

const loginSchema = z.object({
    email: z.string()
        .email('Please provide a valid email')
        .toLowerCase()
        .trim(),
    password: z.string()
        .min(1, 'Password is required')
});

// Sanitization helper
const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
});

const registerUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);

        if (!validationResult.success) {
            const formattedErrors = validationResult.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: validationResult.error.errors[0].message,
                details: formattedErrors
            });
        }

        const { name, email, password, role } = validationResult.data;

        // Check if user exists (case-insensitive)
        const userExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (userExists) {
            return res.status(409).json({
                success: false,
                error: 'Registration failed',
                message: 'User already exists with this email'
            });
        }

        // Hash password with higher cost factor
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role
        });

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Registration successful',
                token: generateToken(user._id, user.role, user.name),
                user: sanitizeUser(user)
            });

        } else {
            res.status(400).json({
                success: false,
                error: 'Registration failed',
                message: 'Invalid user data'
            });
        }

    } catch (error) {
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Registration failed',
                message: 'User already exists with this email'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed',
            message: process.env.NODE_ENV === 'production' 
                ? 'An internal server error occurred' 
                : error.message
        });
    }
};

const loginUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: validationResult.error.errors[0].message,
                details: validationResult.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }

        const { email, password } = validationResult.data;

        // Find user with password
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }

        // Update last login timestamp (if your schema supports it)
        if (user.updateLastLogin) {
            await user.updateLastLogin();
        }

        res.json({
            success: true,
            message: 'Login successful',
            token: generateToken(user._id, user.role, user.name),
            user: sanitizeUser(user)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: process.env.NODE_ENV === 'production' 
                ? 'An internal server error occurred' 
                : error.message
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
};