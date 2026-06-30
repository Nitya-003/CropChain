require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');
const setupErrorHandling = require('./startup/errorHandling');
const { gracefulShutdown } = require('./utils/shutdown');
const { runStartupTasks } = require('./startup/bootstrap');

// ==================== GLOBAL EXCEPTION HANDLERS ====================
setupErrorHandling();

const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
socketService.initializeSocketIO(server);
logger.info('Socket.IO integration complete');

// ==================== GRACEFUL SHUTDOWN HANDLING ====================
process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

// ==================== SERVER STARTUP ====================
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, async () => {
        await runStartupTasks(PORT);
    });
}

module.exports = app;
