const mongoose = require('mongoose');

const connectDB = async () => {
    if (process.env.NODE_ENV === 'test') {
        console.log('MongoDB connection skipped for tests');
        return;
    }

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cropchain', {
             serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // In production, throw error for proper handling instead of unsafe process.exit()
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Database connection failed: ${error.message}`);
        }
        // In development, just log the error and continue
        console.warn('Running in development mode - server will continue without database');
    }
};

module.exports = connectDB;
