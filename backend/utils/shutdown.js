const logger = require('./logger');
const mongoose = require('mongoose');
const socketService = require('../services/socketService');
const blockchainQueue = require('../services/blockchainQueue');
const blockchainWorker = require('../services/blockchainWorker');
const notificationQueue = require('../services/notificationQueue');
const notificationWorker = require('../services/notificationWorker');
const { closeRedisConnection } = require('../config/redis');

const SHUTDOWN_TIMEOUT_MS = 10000;

const gracefulShutdown = async (server, signal) => {
    logger.info(`Received ${signal} signal, starting graceful shutdown`);

    if (!server) {
        process.exit(0);
    }

    let shutdownTimer;

    const forceExitTimer = new Promise((_, reject) => {
        shutdownTimer = setTimeout(() => {
            logger.error('Graceful shutdown timed out, forcing exit');
            reject(new Error('Shutdown timed out'));
        }, SHUTDOWN_TIMEOUT_MS);
    });

    try {
        await Promise.race([
            (async () => {
                await new Promise((resolve) => {
                    server.close(resolve);
                });
                logger.info('HTTP server closed');

                const io = socketService.getIO();
                if (io) {
                    await io.close();
                    logger.info('Socket.IO server closed');
                }

                if (mongoose.connection.readyState === 1) {
                    try {
                        await mongoose.connection.close();
                        logger.info('MongoDB connection closed');
                    } catch (err) {
                        logger.error('Error closing MongoDB connection', { error: err.message });
                    }
                }

                try {
                    await blockchainWorker.stopWorker();
                    await blockchainQueue.closeQueue();
                    await notificationWorker.stopWorker();
                    await notificationQueue.closeQueue();
                    logger.info('BullMQ Queues and Workers closed');
                } catch (err) {
                    logger.error('Error closing BullMQ components', { error: err.message });
                }

                try {
                    await closeRedisConnection();
                    logger.info('Redis connection closed');
                } catch (err) {
                    logger.error('Error closing Redis connection', { error: err.message });
                }

                logger.info('Graceful shutdown complete');
            })(),
            forceExitTimer,
        ]);

        clearTimeout(shutdownTimer);
        process.exit(0);
    } catch (err) {
        if (err.message === 'Shutdown timed out') {
            process.exit(1);
        }
        logger.error('Error during graceful shutdown', { error: err.message });
        process.exit(1);
    }
};

module.exports = { gracefulShutdown };