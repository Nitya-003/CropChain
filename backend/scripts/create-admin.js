const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

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
            console.log("##### admin credentials:  | Admin@123")
            if (require.main === module) process.exit(1);
            return;
        }

        const hashedPassword = await bcrypt.hash("Admin@123", 10);
        const adminRole = { name: "Admin User", email: "admin@cropchain.com", password: hashedPassword, role: "admin" }

        await User.create(adminRole);

        console.log("✅ Admin created successfully");
        console.log(`##### admin credentials: ${adminRole.email} |  ${adminRole.password} `);

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
