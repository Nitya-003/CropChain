const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const apiResponse = require('../utils/apiResponse');
require('dotenv').config();

// Validation Schemas
const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please provide a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(12, 'Password must be less than 12 characters'),
    role: z.enum(['farmer', 'transporter'], {
        errorMap: () => ({ message: 'Invalid role. Only farmer and transporter are allowed.' })
    })
});

const loginSchema = z.object({
    email: z.string().email('Please provide a valid email'),
    password: z.string().min(1, 'Password is required')
});


const registerUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json(
                apiResponse.validationErrorResponse(
                    validationResult.error.errors.map(err => err.message)
                )
            );
        }

        const { name, email, password, role } = validationResult.data;

        // Check if user exists
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json(
                apiResponse.conflictResponse('User already exists with this email')
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
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
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                },
                'Registration successful',
                201
            );
            res.status(201).json(response);

        } else {
            res.status(400).json(
                apiResponse.errorResponse('Invalid user data', 'REGISTRATION_ERROR', 400)
            );
        }

    } catch (error) {
        res.status(500).json(
            apiResponse.errorResponse('Registration failed', 'REGISTRATION_FAILED', 500)
        );
    }
};


const loginUser = async (req, res) => {
    try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json(
                apiResponse.validationErrorResponse(
                    validationResult.error.errors.map(err => err.message)
                )
            );
        }

        const { email, password } = validationResult.data;

        const user = await User.findOne({ email }).select('+password');

        if (user && (await bcrypt.compare(password, user.password))) {
            const response = apiResponse.successResponse(
                {
                    token: generateToken(user._id, user.role, user.name),
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                },
                'Login successful'
            );
            res.json(response);
        } else {
            res.status(401).json(
                apiResponse.unauthorizedResponse('Invalid email or password')
            );
        }

    } catch (error) {
        res.status(500).json(
            apiResponse.errorResponse('Login failed', 'LOGIN_FAILED', 500)
        );
    }
};



module.exports = {
    registerUser,
    loginUser,
};
