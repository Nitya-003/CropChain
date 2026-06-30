const logger = require('./logger');
const mongoose = require('mongoose');
const socketService = require('../services/socketService');

const gracefulShutdown = (server, signal) => {
    logger.info(`Received ${signal} signal, starting graceful shutdown`);

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');

            // Close all Socket.IO connections
            const io = socketService.getIO();
            if (io) {
                await io.close();
                logger.info('Socket.IO server closed');
            }

            // Close MongoDB connection
            if (mongoose.connection.readyState === 1) {
                try {
                    await mongoose.connection.close();
                    logger.info('MongoDB connection closed');
                } catch (err) {
                    logger.error('Error closing MongoDB connection', { error: err.message });
                }
            }

            logger.info('Graceful shutdown complete');
            process.exit(0);
        });

        // Force exit after 10 seconds if graceful shutdown fails
        setTimeout(() => {
            logger.error('Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
};

module.exports = { gracefulShutdown };
