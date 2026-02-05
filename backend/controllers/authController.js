const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
require('dotenv').config();



const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        console.log("name", name);
        console.log("email", email);
        console.log("password", password);
        console.log("role", role);
        //data validation could be added here or in middleware


        if (password.length > 12 || password.length < 6) {
            return res.status(400).json({
                error: 'Registration failed',
                message: 'Password must be at least 6 characters long and at most 12 characters long'
            });
        }

        if (role != "farmer" || role != "transporter") {
            return res.status(400).json({ error: 'Registration failed', message: 'Invalid role' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({
                error: 'Registration failed',
                message: 'User already exists with this email'
            });
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
            res.status(201).json({
                success: true,
                message: 'Registration successful',
                token: generateToken(user._id, user.role, user.name),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } else {
            res.status(400).json({
                error: 'Registration failed',
                message: 'Invalid user data'
            });
        }
    } catch (error) {
        res.status(500).json({
            error: 'Registration failed',
            message: error.message || 'An internal server error occurred'
        });
    }
};


const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                success: true,
                message: 'Login successful',
                token: generateToken(user._id, user.role, user.name),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }

    } catch (error) {
        res.status(500).json({
            error: 'Login failed',
            message: 'An internal server error occurred'
        });
    }
};



module.exports = {
    registerUser,
    loginUser,
};
