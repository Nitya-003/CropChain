const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

/**
 * Generate a secure random password
 * @param {number} length - Password length
 * @returns {string} - Secure random password
 */
function generateSecurePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    return password;
}

async function createAdmin() {
    try {
        // If not connected, connect to DB
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cropchain');
            console.log("MongoDB Connected for Admin Creation");
        }

        const adminExists = await User.findOne({ role: "admin" });

        if (adminExists) {
            console.log("❌ Admin already exists");
            if (require.main === module) process.exit(1);
            return;
        }

        // Generate secure random password
        const plainPassword = generateSecurePassword(16);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const adminRole = { 
            name: "Admin User", 
            email: "admin@cropchain.com", 
            password: hashedPassword, 
            role: "admin",
            requirePasswordReset: true // Flag to force password reset on first login
        };

        await User.create(adminRole);

        console.log("✅ Admin created successfully");
        console.log(`Email: ${adminRole.email}`);
        console.log(`Temporary Password: ${plainPassword}`);
        console.log("⚠️  IMPORTANT: Please change this password immediately after first login.");

        if (require.main === module) process.exit(0);
    } catch (error) {
        console.error("Error creating admin:", error);

        if (require.main === module) process.exit(1);
    }
}

// Execute if running directly
if (require.main === module) {
    createAdmin();
}

module.exports = createAdmin;
