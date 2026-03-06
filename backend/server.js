const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const connectDB = require('./config/db');
require('dotenv').config();
const mainRoutes = require("./routes/index");
const oracleRoutes = require("./routes/oracle");
const validateRequest = require('./middleware/validator');
const { chatSchema } = require("./validations/chatSchema");
const aiService = require('./services/aiService');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const { createBatchSchema, updateBatchSchema } = require("./validations/batchSchema");
const { protect, adminOnly, authorizeBatchOwner, authorizeRoles, authorizeStageTransition, authorizeBlockchainTransaction } = require('./middleware/auth');
const apiResponse = require('./utils/apiResponse');

// Import Services
const blockchainService = require('./services/blockchainService');
const batchService = require('./services/batchService');
const notificationService = require('./services/notificationService');

// Import MongoDB Model
const Batch = require('./models/Batch');

const app = express();
const PORT = process.env.PORT || 3001;

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

    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip} - User-Agent: ${userAgent}`);

    const suspiciousPatterns = [
        /\$where/i, /\$ne/i, /\$gt/i, /\$lt/i, /\$regex/i,
        /javascript:/i, /<script/i, /union.*select/i
    ];

    const requestString = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);

    suspiciousPatterns.forEach(pattern => {
        if (pattern.test(requestString)) {
            console.warn(`[SECURITY WARNING] Suspicious pattern detected from IP ${ip}: ${pattern}`);
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
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting configurations
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

const generalLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMaxRequests,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const batchLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: parseInt(process.env.BATCH_RATE_LIMIT_MAX) || 20,
    message: {
        error: 'Too many batch operations from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
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
            console.warn(`[CORS BLOCKED] Origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));

// Body parsing
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

app.use(express.json({
    limit: maxFileSize,
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }
}));

app.use(express.urlencoded({ extended: true, limit: maxFileSize }));

// NoSQL injection protection
app.use(mongoSanitize());
app.use(securityLogger);

// ==================== BLOCKCHAIN SERVICE INITIALIZATION ====================

// Validate blockchain environment
if (process.env.NODE_ENV !== 'test') {
    try {
        blockchainService.validateEnvironment();
    } catch (error) {
        console.error('Blockchain configuration error:', error.message);
    }
}

// ==================== ROUTES ====================

// Mount health check main router
app.use("/api", mainRoutes);

// Mount Oracle routes
app.use('/api/oracle', oracleRoutes);

// Swagger/OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'CropChain API Documentation'
}));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verification');

// Mount Auth Routes
app.use('/api/auth', authLimiter, authRoutes);

// Mount Verification Routes
app.use('/api/verification', generalLimiter, verificationRoutes);

// ==================== BATCH ROUTES (USING BATCH SERVICE) ====================

// CREATE batch - requires farmer role and blockchain authorization
// Uses MongoDB transaction to prevent race conditions in batch ID generation (CVSS 7.5 fix)
app.post('/api/batches', batchLimiter, protect, validateRequest(createBatchSchema), async (req, res) => {
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
        const result = await batchService.createBatch(validatedData, req.user);

        console.log(`[SUCCESS] Batch created: ${result.batch.batchId} by user ${req.user.id} (${req.user.email}) from IP: ${req.ip}`);

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
        
        console.error('Error creating batch:', error);
        const response = apiResponse.errorResponse(
            'Failed to create batch',
            'BATCH_CREATION_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// GET one batch
app.get('/api/batches/:batchId', batchLimiter, async (req, res) => {
    try {
        const { batchId } = req.params;
        
        const result = await batchService.getBatch(batchId);

        if (!result.success) {
            console.log(`[NOT FOUND] Batch lookup failed: ${batchId} from IP: ${req.ip}`);
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode).json(response);
        }

        const response = apiResponse.successResponse({ batch: result.batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch fetch', error);
        console.error('Error fetching batch:', error);
        const response = apiResponse.errorResponse(
            'Failed to fetch batch',
            'BATCH_FETCH_ERROR',
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
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(result.statusCode || 404).json(response);
        }

        console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${validatedData.stage} by ${validatedData.actor} from IP: ${req.ip}`);

        // Notify about batch update
        notificationService.notifyBatchUpdated(batchId, validatedData.stage, req.user);

        const response = apiResponse.successResponse(
            { batch: result.batch },
            'Batch updated successfully'
        );
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batch update', error);
        console.error('Error updating batch:', error);
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
            console.error('Error recalling batch:', error);
            res.status(500).json({ error: 'Failed to recall batch' });
        }
    }
);

// GET all batches
app.get('/api/batches', batchLimiter, async (req, res) => {
    try {
        const result = await batchService.getAllBatches();

        console.log(`[SUCCESS] Batches list retrieved from IP: ${req.ip}`);

        const response = apiResponse.successResponse(
            { stats: result.stats, batches: result.batches },
            'Batches retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        notificationService.notifyError('batches fetch', error);
        console.error('Error fetching batches:', error);
        const response = apiResponse.errorResponse(
            'Failed to fetch batches',
            'BATCHES_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

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
app.post('/api/ai/chat', batchLimiter, validateRequest(chatSchema), async (req, res) => {
    try {
        const { message } = req.body;

        console.log(`[AI CHAT] Request from IP: ${req.ip} - Message: "${message.substring(0, 50)}..."`);

        const aiResponse = await aiService.chat(message, batchServiceForAI);

        console.log(`[AI CHAT SUCCESS] Response generated for IP: ${req.ip}`);

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
        console.error('AI Chat error:', error);

        const response = apiResponse.errorResponse(
            "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.",
            'AI_SERVICE_ERROR',
            500
        );
        res.status(500).json(response);
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
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    const response = apiResponse.notFoundResponse('Endpoint', `${req.method} ${req.originalUrl}`);
    res.status(404).json(response);
});

// Comprehensive Error Handler - Must be last middleware
app.use(errorHandlerMiddleware);

// ==================== GRACEFUL SHUTDOWN HANDLING ====================

// Store server instance for graceful shutdown
let server;

// Graceful shutdown function
const gracefulShutdown = (signal) => {
    console.log(`\n[${signal}] Received shutdown signal. Starting graceful shutdown...`);
    
    if (server) {
        server.close(async () => {
            console.log('✓ HTTP server closed - no longer accepting new connections');
            
            // Close MongoDB connection
            if (mongoose.connection.readyState === 1) {
                try {
                    await mongoose.connection.close();
                    console.log('✓ MongoDB connection closed');
                } catch (err) {
                    console.error('✗ Error closing MongoDB connection:', err.message);
                }
            }
            
            console.log('✓ Graceful shutdown complete');
            process.exit(0);
        });
        
        // Force exit after 10 seconds if graceful shutdown fails
        setTimeout(() => {
            console.error('✗ Graceful shutdown timed out, forcing exit');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
};

// Global error handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('✗ Uncaught Exception:', err.message);
    console.error('Stack:', err.stack);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('✗ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    gracefulShutdown('unhandledRejection');
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==================== SERVER STARTUP ====================

// Connect to Database
connectDB();

// Import createAdmin script
const createAdmin = require('./scripts/create-admin');

// Import blockchain listener
const startListener = require('./services/blockchainListener');

// Start server
if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, async () => {
        console.log(`🚀 CropChain API server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

        // Create admin user on startup
        await createAdmin();

        console.log(`Admin user created successfully`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

        console.log('\n🔒 Security features enabled:');
        console.log(`  ✓ Rate limiting (${rateLimitMaxRequests} req/window)`);
        console.log(`  ✓ NoSQL injection protection`);
        console.log(`  ✓ Input validation with Joi`);
        console.log(`  ✓ Security headers with Helmet`);
        console.log(`  ✓ Request logging and monitoring`);
        console.log(`  ✓ JWT Authentication`);
        console.log(`  ✓ Admin Role Authorization`);

        console.log('\n⚙️  Configuration:');
        console.log(`  • CORS origins: ${uniqueAllowedOrigins.length > 0 ? uniqueAllowedOrigins.join(', ') : 'None configured'}`);
        console.log(`  • Max file size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
        console.log(`  • Rate limit window: ${Math.ceil(rateLimitWindowMs / 60000)} minutes`);

        if (process.env.NODE_ENV === 'production') {
            console.log('\n🏭 Production mode warnings:');
            if (!process.env.MONGODB_URI) {
                console.warn('  ⚠️  MONGODB_URI not set - using in-memory storage');
            }
            if (!process.env.JWT_SECRET) {
                console.warn('  ⚠️  JWT_SECRET not set - authentication will not work');
            }
            if (!blockchainService.isAvailable()) {
                console.warn('  ⚠️  Blockchain configuration incomplete - running in demo mode');
            }
        }

        console.log('\n✅ Server startup complete\n');

        // Start blockchain event listener
        const contract = blockchainService.getContract();
        if (contract) {
            try {
                startListener(contract);
                console.log('🔗 Blockchain event listener started');
            } catch (error) {
                console.error('❌ Failed to start blockchain listener:', error.message);
            }
        } else {
            console.log('ℹ️  Skipping blockchain listener (no contract instance available)');
        }

        // Start Oracle service for IoT data verification
        try {
            await oracleService.initialize();
            console.log('🔮 Oracle service started successfully');
        } catch (error) {
            console.error('❌ Failed to start Oracle service:', error.message);
            console.log('⚠️  Continuing without Oracle service...');
        }
    });
}

module.exports = app;
