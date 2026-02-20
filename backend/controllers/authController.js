const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const apiResponse = require('../utils/apiResponse');
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
            console.error('Validation Error Details:', JSON.stringify(validationResult.error, null, 2));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data provided. Please check your fields.',
                details: validationResult.error
            });
        }

        const { name, email, password, role } = validationResult.data;

        // Check if user exists (case-insensitive)
        const userExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (userExists) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists with this email')
            );
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
            const response = apiResponse.successResponse(
                {
                    token: generateToken(user._id, user.role, user.name),
                    user: sanitizeUser(user)
                },
                'Registration successful',
                201
            );
            return res.status(201).json(response);

        } else {
            return res.status(400).json(
                apiResponse.errorResponse('Invalid user data', 'REGISTRATION_ERROR', 400)
            );
        }

    } catch (error) {
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(409).json(
                apiResponse.conflictResponse('User already exists with this email')
            );
        }

        return res.status(500).json(
            apiResponse.errorResponse('Registration failed', 'REGISTRATION_FAILED', 500)
        );
    }
};

const loginUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
            console.error('Validation Error Details:', JSON.stringify(validationResult.error, null, 2));
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: 'Invalid email or password format.',
                details: validationResult.error
            });
        }

        const { email, password } = validationResult.data;

        // Find user with password
        const user = await User.findOne({ email }).select('+password');

        if (user && (await bcrypt.compare(password, user.password))) {
            const response = apiResponse.successResponse(
                {
                    token: generateToken(user._id, user.role, user.name),
                    user: sanitizeUser(user)
                },
                'Login successful'
            );
            return res.json(response);
        } else {
            return res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid email or password')
            );
        }

    } catch (error) {
        return res.status(500).json(
            apiResponse.errorResponse('Login failed', 'LOGIN_FAILED', 500)
        );
    }
};

module.exports = {
    registerUser,
    loginUser,
};
