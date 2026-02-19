const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function createAdmin() {
    try {
        // Only connect if there is absolutely NO active or pending connection (readyState 0)
        if (mongoose.connection.readyState === 0) {
            const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://db:27017/cropchain';
            await mongoose.connect(dbURI);
            console.log("MongoDB Connected for Admin Creation");
        }

        const adminExists = await User.findOne({ role: "admin" });

        if (adminExists) {
            console.log("ℹ️ Admin user check: Admin already exists");
            // Exit normally if run standalone, otherwise just return to server.js
            if (require.main === module) process.exit(0);
            return;
        }

        const hashedPassword = await bcrypt.hash("Admin@123", 10);
        const adminRole = { 
            name: "Admin User", 
            email: "admin@cropchain.com", 
            password: hashedPassword, 
            role: "admin" 
        };

        await User.create(adminRole);

        console.log("✅ Admin created successfully");
        console.log(`🔑 Admin credentials: ${adminRole.email} | Admin@123`);

        if (require.main === module) process.exit(0);
    } catch (error) {
        console.error("❌ Error creating admin:", error.message);
        if (require.main === module) process.exit(1);
    }
}

// Execute if running directly
if (require.main === module) {
    createAdmin();
}

module.exports = createAdmin;