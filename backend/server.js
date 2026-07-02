require('dotenv').config();
const http = require('http');
const app = require('./app');
const express = require('express');
const notificationRoutes = require('./routes/notificationRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');
const setupErrorHandling = require('./startup/errorHandling');
const { gracefulShutdown } = require('./utils/shutdown');
const { runStartupTasks } = require('./startup/bootstrap');
const mainRoutes = require("./routes/index");
const oracleRoutes = require("./routes/oracle");
const validateRequest = require('./middleware/validator');
const createNoSqlSanitizer = require('./middleware/nosqlSanitizer');
const { chatSchema } = require("./validations/chatSchema");
const aiService = require('./services/aiService');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const { createBatchSchema, updateBatchSchema } = require("./validations/batchSchema");
const { protect, adminOnly, authorizeBatchOwner, authorizeRoles, authorizeStageTransition, authorizeBlockchainTransaction } = require('./middleware/auth');
const { generalLimiter, authLimiter, batchLimiter, aiLimiter, registerLimiter, rateLimitWindowMs, rateLimitMaxRequests } = require('./middleware/rateLimiters');
const { validateEnv } = require('./utils/envValidator');
const mongoose = require('mongoose');
const apiResponse = require('./utils/apiResponse');
const oracleService = require('./services/oracleService');
const { ethers } = require("ethers");
const helmet = require('helmet');
const cors = require('cors');

// Import Services
const blockchainService = require('./services/blockchainService');
const batchService = require('./services/batchService');
const pdfService = require('./services/pdfService');
const ccipService = require('./services/ccipService');
const notificationService = require('./services/notificationService');
const blockchainQueue = require('./services/blockchainQueue');
const blockchainWorker = require('./services/blockchainWorker');
const notificationQueue = require('./services/notificationQueue');
const notificationWorker = require('./services/notificationWorker');

// Import MongoDB Models
const Batch = require('./models/Batch');
const Counter = require('./models/Counter');

// Validate stage mapping on startup to prevent blockchain sync failures
const { validateStageMapping } = require('./constants/stages');
try {
    validateStageMapping();
} catch (error) {
    logger.error('CRITICAL ERROR: stage mapping validation failed', { error: error.message });
    process.exit(1);
}

// ==================== GLOBAL EXCEPTION HANDLERS ====================
setupErrorHandling();

const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// ==================== MIDDLEWARE FUNCTIONS ====================

// Authentication is handled by middleware imported from './middleware/auth':
// - protect: Verifies JWT and fetches full user from MongoDB
// - adminOnly: Checks if user has admin role
// - authorizeBatchOwner: Verifies user owns the batch
// - authorizeRoles: Role-based authorization

// Security logging middleware
const securityLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    logger.info('Incoming request', { timestamp, method: req.method, path: req.path, ip, userAgent });

    const suspiciousPatterns = [
        /\$where/i, /\$ne/i, /\$gt/i, /\$lt/i, /\$regex/i,
        /javascript:/i, /<script/i, /union.*select/i
    ];

    const requestString = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);

    suspiciousPatterns.forEach(pattern => {
        if (pattern.test(requestString)) {
            logger.warn('Suspicious pattern detected', { ip, pattern: pattern.toString(), path: req.path });
            notificationService.notifySecurityEvent('suspicious_pattern', {
                ip,
                pattern: pattern.toString(),
                path: req.path
            });
        }
    });

    next();
};

// ==================== SECURITY MIDDLEWARE SETUP ====================

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS: force HTTPS for 1 year, including subdomains
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Clickjacking protection via X-Frame-Options
    frameguard: {
        action: 'deny',
    },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Referrer leakage control
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
}));

// Permissions-Policy header (not natively supported by Helmet 7)
app.use((_req, res, next) => {
    res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    next();
});

app.use(generalLimiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');
}

// Deduplicate origins
const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) return callback(null, true);

        if (uniqueAllowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));

// Body parsing
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

app.use(express.json({
    limit: maxFileSize
}));

app.use(express.urlencoded({ extended: true, limit: maxFileSize }));

// NoSQL injection protection
app.use(createNoSqlSanitizer());
app.use(securityLogger);

// ==================== BLOCKCHAIN SERVICE INITIALIZATION ====================

// Validate blockchain environment
if (process.env.NODE_ENV !== 'test') {
    try {
        blockchainService.validateEnvironment();
    } catch (error) {
        logger.error('Blockchain configuration error', { error: error.message });
    }
}

// ==================== HOST HEADER VALIDATION ====================

const trustedHosts = (() => {
    const hosts = new Set(['localhost', '127.0.0.1']);
    if (process.env.FRONTEND_URL) {
        try {
            const hostname = new URL(process.env.FRONTEND_URL).hostname;
            if (hostname) hosts.add(hostname);
        } catch { }
    }
    if (process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS.split(',').forEach(origin => {
            try {
                const hostname = new URL(origin.trim()).hostname;
                if (hostname) hosts.add(hostname);
            } catch { }
        });
    }
    if (process.env.TRUSTED_HOSTS) {
        process.env.TRUSTED_HOSTS.split(',').forEach(h => {
            const trimmed = h.trim().toLowerCase();
            if (trimmed) hosts.add(trimmed);
        });
    }
    return hosts;
})();

app.use((req, res, next) => {
    const host = req.hostname?.toLowerCase();
    if (host && !trustedHosts.has(host)) {
        logger.warn('Host header blocked', { host });
        return res.status(400).json({
            error: 'Invalid request',
            code: 'INVALID_HOST'
        });
    }
    next();
});

// ==================== ROUTES ====================

// Mount health check main router
app.use("/api", mainRoutes);

// Mount Oracle routes
app.use('/api/oracle', oracleRoutes);

// Mount Notification routes
app.use('/api/notifications', notificationRoutes);

// Swagger/OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'CropChain API Documentation'
}));

// Blockchain configuration
const REQUIRED_ENV_VARS = [
    'INFURA_URL',
    'CONTRACT_ADDRESS',
    'PRIVATE_KEY',
    'JWT_SECRET',
    'MONGODB_URI'
];

if (process.env.NODE_ENV !== 'test') {
    REQUIRED_ENV_VARS.forEach((key) => {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
    });

    if (!/^0x[a-fA-F0-9]{64}$/.test(process.env.PRIVATE_KEY)) {
        throw new Error('Invalid PRIVATE_KEY format');
    }

    // Validate environment variables at startup
    validateEnv();
}

const PROVIDER_URL = process.env.INFURA_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Initialize blockchain provider and contract (reused for listener)
let provider;
let contractInstance;
let wallet;

if (PROVIDER_URL && CONTRACT_ADDRESS && PRIVATE_KEY) {
    try {
        provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, blockchainService.getContractABI(), wallet);
        logger.info('Blockchain contract instance initialized');
    } catch (error) {
        logger.error('Failed to initialize blockchain connection', { error: error.message });
        contractInstance = null;
    }
}

// Import Routes
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verification');
const approvalRoutes = require('./routes/approvalRoutes');
const recommendRoutes = require('./routes/recommendRoutes');
const activityRoutes = require('./routes/activityRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const lifecycleRoutes = require('./routes/lifecycleRoutes');
const logisticsRoutes = require('./routes/logisticsRoutes');

// Mount Auth Routes with per-endpoint rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password/:token', authLimiter);
app.use('/api/auth', authRoutes);

// Log rate limit violations (reached after a rate limiter sends 429)
app.use((err, req, res, next) => {
    if (res.statusCode === 429) {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
    }
    next(err);
});

// Mount Verification Routes
app.use('/api/verification', generalLimiter, verificationRoutes);

// Mount Recommendation Routes
app.use('/api/recommend', aiLimiter, recommendRoutes);

// Mount Activity Routes
app.use('/api/activities', generalLimiter, activityRoutes);

// Mount Approval Routes (Multi-signature for high-stakes actions)
app.use('/api/approvals', batchLimiter, approvalRoutes);

// Mount Auction Routes
app.use('/api/auctions', auctionRoutes);
// Mount Lifecycle Routes
app.use('/api/batches', generalLimiter, lifecycleRoutes);
// Mount Logistics Routes
app.use('/api/logistics', generalLimiter, logisticsRoutes);

// Batch routes - ALL USING MONGODB ONLY

// ==================== BATCH ROUTES ====================

// CREATE batch - requires farmer role and blockchain authorization
// Uses MongoDB transaction to prevent race conditions in batch ID generation (CVSS 7.5 fix)
app.post('/api/batches', batchLimiter, protect, authorizeRoles('farmer'), validateRequest(createBatchSchema), async (req, res) => {
    try {
        const result = await batchService.createBatch(req.body, req.user);

        logger.info('Batch created', { batchId: result.batch.batchId, userId: req.user.id, email: req.user.email, ip: req.ip });

        // Notify about batch creation
        notificationService.notifyBatchCreated(result.batch.batchId, req.user);

        const response = apiResponse.successResponse(
            { batch: result.batch },
            'Batch created successfully',
            201
        );
        res.status(201).json(response);
    } catch (error) {
        // Handle duplicate key error specifically
        if (error.code === 11000) {
            const response = apiResponse.errorResponse(
                'Batch with this ID already exists',
                'DUPLICATE_BATCH_ERROR',
                409
            );
            return res.status(409).json(response);
        }

        notificationService.notifyError('batch creation', error);

        logger.error('Error creating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to create batch',
            'BATCH_CREATION_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// GET one batch - requires authentication
app.get('/api/batches/:batchId', batchLimiter, protect, async (req, res) => {
    try {
        const { batchId } = req.params;


        const result = await batchService.getBatch(batchId);

        if (!result.success) {
            logger.warn('Batch not found', { batchId, ip: req.ip });
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode).json(response);
        }

        const response = apiResponse.successResponse({ batch: result.batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch fetch', error);
        logger.error('Error fetching batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to fetch batch',
            'BATCH_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// GET batch journey PDF - requires authentication
app.get('/api/batches/:batchId/pdf', batchLimiter, protect, async (req, res) => {
    try {
        const { batchId } = req.params;

        const result = await batchService.getBatch(batchId);

        if (!result.success) {
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode).json(response);
        }

        const pdfBuffer = await pdfService.generateBatchJourneyPDF(result.batch);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}-journey.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    } catch (error) {
        notificationService.notifyError('batch pdf generation', error);
        logger.error('Error generating batch PDF', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to generate batch PDF',
            'PDF_GENERATION_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// UPDATE batch - requires authentication, ownership, and stage transition authorization
app.put('/api/batches/:batchId', batchLimiter, protect, authorizeBatchOwner, authorizeStageTransition, authorizeBlockchainTransaction, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        const result = await batchService.updateBatch(batchId, validatedData, req.user);

        if (!result.success) {
            const statusCode = result.statusCode || 500;
            const response = statusCode === 404
                ? apiResponse.notFoundResponse('Batch', `ID: ${batchId}`)
                : apiResponse.errorResponse(result.error, 'BATCH_UPDATE_ERROR', statusCode);
            return res.status(statusCode).json(response);
        }

        logger.info('Batch updated', { batchId, stage: validatedData.stage, actor: validatedData.actor, ip: req.ip });

        // Notify about batch update
        notificationService.notifyBatchUpdated(batchId, validatedData.stage, req.user, result.batch);

        const response = apiResponse.successResponse(
            { batch: result.batch },
            'Batch updated successfully'
        );
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch update', error);
        logger.error('Error updating batch', { error: error.message, stack: error.stack });
        const response = apiResponse.errorResponse(
            'Failed to update batch',
            'BATCH_UPDATE_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// ==================== SECURED RECALL ENDPOINT ====================

app.post(
    '/api/batches/:batchId/recall',
    batchLimiter,
    protect,
    adminOnly,
    async (req, res) => {
        try {
            const { batchId } = req.params;

            const result = await batchService.recallBatch(batchId, req.user);

            if (!result.success) {
                return res.status(result.statusCode).json({ error: result.error });
            }

            res.json({
                success: true,
                message: result.message,
                recalledBy: result.recalledBy,
                recalledAt: result.recalledAt,
                batch: result.batch
            });
        } catch (error) {
            notificationService.notifyError('batch recall', error);
            logger.error('Error recalling batch', { error: error.message, stack: error.stack });
            res.status(500).json({ error: 'Failed to recall batch' });
        }
    }
);

// ==================== AI SERVICE ====================

// Create batch service interface for AI service
const batchServiceForAI = {
    async getBatch(batchId) {
        const result = await batchService.getBatch(batchId);
        return result.success ? result.batch : null;
    },

    async getDashboardStats() {
        return await batchService.getDashboardStats();
    }
};

// AI Chat endpoint
app.post('/api/ai/chat', batchLimiter, protect, validateRequest(chatSchema), async (req, res) => {
    try {
        const { message } = req.body;

        logger.info('AI chat request', { ip: req.ip, messagePreview: message.substring(0, 50) });

        const acceptsEventStream = req.headers.accept?.includes('text/event-stream');

        if (acceptsEventStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();

            const sendEvent = (event, data) => {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            const aiResponse = await aiService.chatStream(message, batchServiceForAI, (token) => {
                sendEvent('token', { token });
            });

            sendEvent('done', {
                response: aiResponse.message,
                timestamp: new Date().toISOString(),
                ...(aiResponse.functionCalled && {
                    functionCalled: aiResponse.functionCalled,
                    functionResult: aiResponse.functionResult
                })
            });

            res.end();
            logger.info('AI chat streamed response generated', { ip: req.ip });
            return;
        }

        const aiResponse = await aiService.chat(message, batchServiceForAI);

        logger.info('AI chat response generated', { ip: req.ip });

        const response = apiResponse.successResponse(
            {
                response: aiResponse.message,
                timestamp: new Date().toISOString(),
                ...(aiResponse.functionCalled && {
                    functionCalled: aiResponse.functionCalled,
                    functionResult: aiResponse.functionResult
                })
            },
            'Chat response generated successfully'
        );
        res.json(response);

    } catch (error) {
        notificationService.notifyError('AI chat', error);
        logger.error('AI chat error', { error: error.message, stack: error.stack });

        if (res.headersSent) {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({
                error: "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes."
            })}\n\n`);
            res.end();
            return;
        }

        // Always return CropChain-aware fallback on errors (validation/auth/rate-limit/LLM failures).
        // This prevents the frontend from showing a generic "connection" style error.
        let fallbackPayload;
        try {
            const fallback = aiService?.getFallbackResponse?.(req?.body?.message || '');
            fallbackPayload = fallback || null;
        } catch (_) {
            fallbackPayload = null;
        }

        const message = fallbackPayload?.message ||
            "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.";

        const response = apiResponse.successResponse(
            { response: message, timestamp: new Date().toISOString() },
            'Chat response generated successfully (fallback)'
        );

        // Return 503 so clients can detect AI service degradation programmatically.
        res.status(503).json(response);
    }
});


// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            blockchain: blockchainService.isAvailable() ? 'connected' : 'demo mode',
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        }
    });
});

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use('*', (req, res) => {
    logger.warn('Route not found', { method: req.method, url: req.originalUrl, ip: req.ip });
    const response = apiResponse.notFoundResponse('Endpoint', `${req.method} ${req.originalUrl}`);
    res.status(404).json(response);
});

// Comprehensive Error Handler - Must be last middleware
app.use(errorHandlerMiddleware);

// ==================== SOCKET.IO INITIALIZATION ====================

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
        logger.info(`CropChain API server running on port ${PORT}`);
        logger.info(`Health check: http://localhost:${PORT}/api/health`);
        logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);

        // Create admin user on startup
        await createAdmin();

        logger.info('Admin user created successfully');
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info('Security features enabled', {
            rateLimit: `${rateLimitMaxRequests} req/window`,
            nosqlInjectionProtection: true,
            inputValidation: true,
            securityHeaders: true,
            requestLogging: true,
            jwtAuth: true,
            adminRoleAuth: true,
            websockets: true,
        });
        logger.info('Configuration', {
            corsOrigins: uniqueAllowedOrigins.length > 0 ? uniqueAllowedOrigins : 'None configured',
            maxFileSizeMB: Math.round(maxFileSize / 1024 / 1024),
            rateLimitWindowMinutes: Math.ceil(rateLimitWindowMs / 60000),
        });

        if (process.env.NODE_ENV === 'production') {
            if (!process.env.MONGODB_URI) {
                logger.warn('MONGODB_URI not set - using in-memory storage');
            }
            if (!process.env.JWT_SECRET) {
                logger.warn('JWT_SECRET not set - authentication will not work');
            }
            if (!blockchainService.isAvailable()) {
                logger.warn('Blockchain configuration incomplete - running in demo mode');
            }
        }

        logger.info('Server startup complete');

        // Initialize BullMQ for blockchain transaction background jobs
        try {
            blockchainQueue.initializeQueue();
            blockchainWorker.initializeWorker();
            logger.info('BullMQ Queue and Worker initialized for blockchain transactions');
        } catch (error) {
            logger.error('Failed to initialize BullMQ for blockchain jobs', { error: error.message });
        }

        // Initialize BullMQ for notification background jobs
        try {
            notificationQueue.initializeQueue();
            notificationWorker.initializeWorker();
            logger.info('BullMQ Queue and Worker initialized for notifications');
        } catch (error) {
            logger.error('Failed to initialize BullMQ for notifications', { error: error.message });
        }

        // Start background auction settlement check
        setInterval(settleExpiredAuctions, 10000); // Check every 10 seconds

        // Start blockchain event listener
        const contract = blockchainService.getContract();
        if (contract) {
            try {
                startListener(contract);
                logger.info('Blockchain event listener started');
            } catch (error) {
                logger.error('Failed to start blockchain listener', { error: error.message });
            }
        } else {
            logger.info('Skipping blockchain listener: no contract instance available');
        }

        // Initialize CCIP dispatch service.
        if (ccipService.initialize()) {
            logger.info('CCIP service initialized');
        } else {
            logger.info('CCIP service not configured - cross-chain dispatch disabled');
        }

        // Start Oracle service for IoT data verification if blockchain is active
        // WARNING: ORACLE_ENABLED must be explicitly set to 'true' in production
        if (process.env.ORACLE_ENABLED === 'true' && blockchainService.isAvailable() && process.env.ORACLE_PRIVATE_KEY) {
            try {
                await oracleService.initialize();
                logger.info('Oracle service started successfully');
            } catch (error) {
                logger.error('Failed to start Oracle service', { error: error.message });
                logger.warn('Continuing without Oracle service');
            }
        } else {
            logger.info('Oracle service disabled: set ORACLE_ENABLED=true to enable');
        }
    });
}

module.exports = app;
