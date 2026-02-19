const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Checks for MONGODB_URI, then MONGO_URI, and defaults to the Docker 'db' container
        const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://db:27017/cropchain';
        
        const conn = await mongoose.connect(dbURI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Do not crash the whole app if DB fails to connect initially, 
        // just log it so Nodemon can keep watching files.
    }
};

module.exports = connectDB;