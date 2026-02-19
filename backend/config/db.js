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
        // Do not exit process in dev/test, just log error
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
