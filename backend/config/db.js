const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    if (process.env.NODE_ENV === 'test') {
        logger.info('MongoDB connection skipped for tests');
        return;
    }
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cropchain', {
             serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
        });
        logger.info('MongoDB Connected', { host: conn.connection.host });
    } catch (error) {
        logger.error('MongoDB connection error', { error: error.message });
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
        logger.warn('Running in development mode - server will continue without database');
    }
};

module.exports = connectDB;
