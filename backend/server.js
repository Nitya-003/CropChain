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
const crypto = require('crypto');

// Import Services
const blockchainService = require('./services/blockchainService');
const batchService = require('./services/batchService');
const ccipService = require('./services/ccipService');
const notificationService = require('./services/notificationService');

// Import MongoDB Models
const Batch = require('./models/Batch');
const Counter = require('./models/Counter');

// Validate stage mapping on startup to prevent blockchain sync failures
const { validateStageMapping } = require('./constants/stages');
try {
    validateStageMapping();
} catch (error) {
    console.error('❌ CRITICAL ERROR:', error.message);
    process.exit(1);
}

// ==================== GLOBAL EXCEPTION HANDLERS ====================

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
    console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', error);
    process.exit(1);
});

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const http = require('http');
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


// Blockchain configuration
const REQUIRED_ENV_VARS = [
    'INFURA_URL',
    'CONTRACT_ADDRESS',
    'PRIVATE_KEY'
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
        console.log('✓ Blockchain contract instance initialized');
    } catch (error) {
        console.error('Failed to initialize blockchain connection:', error.message);
        contractInstance = null;
    }
} else {
    console.log('ℹ️  Blockchain not configured - running without contract instance');
}

async function generateBatchId(session = null) {
    return await batchService.generateBatchId(session);
}

async function generateQRCode(batchId) {
    return await batchService.generateQRCode(batchId);
}

function simulateBlockchainHash(data) {
    return blockchainService.simulateHash(data);
}


// Import Routes
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verification');
const approvalRoutes = require('./routes/approvalRoutes');

// Mount Auth Routes
app.use('/api/auth', authLimiter, authRoutes);

// Mount Verification Routes
app.use('/api/verification', generalLimiter, verificationRoutes);


// Mount Approval Routes (Multi-signature for high-stakes actions)
app.use('/api/approvals', batchLimiter, approvalRoutes);

// Batch routes - ALL USING MONGODB ONLY

// Mount Approval Routes (Multi-signature for high-stakes actions)
app.use('/api/approvals', batchLimiter, approvalRoutes);

// ==================== BATCH ROUTES ====================

// CREATE batch - requires farmer role and blockchain authorization
// Uses MongoDB transaction to prevent race conditions in batch ID generation (CVSS 7.5 fix)
app.post('/api/batches', batchLimiter, protect, authorizeRoles('farmer'), validateRequest(createBatchSchema), async (req, res) => {
    try {
        const result = await batchService.createBatch(req.body, req.user);

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

// GET one batch - requires authentication
app.get('/api/batches/:batchId', batchLimiter, protect, async (req, res) => {
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

// GET all batches - requires authentication
// NOTE: This endpoint uses .lean() and compound indexes for optimal performance.
// The new { currentStage: 1, createdAt: -1 } compound index handles pagination and sorting efficiently.
app.get('/api/batches', batchLimiter, protect, async (req, res) => {
    try {
        const result = await batchService.getAllBatches();

        console.log(`[SUCCESS] Batches list retrieved from IP: ${req.ip}`);
        console.log(`[SUCCESS] Batches list retrieved by user: ${req.user?.id} from IP: ${req.ip}`);

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
            console.log(`[AI CHAT SUCCESS] Streamed response generated for IP: ${req.ip}`);
            return;
        }

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

        if (res.headersSent) {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({
                error: "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes."
            })}\n\n`);
            res.end();
            return;
        }

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

// ==================== SOCKET.IO INITIALIZATION ====================

const socketService = require('./services/socketService');

// Initialize Socket.IO on the HTTP server
socketService.initializeSocketIO(server);

console.log('🔌 Socket.IO integration complete');

// ==================== GRACEFUL SHUTDOWN HANDLING ====================

// Graceful shutdown function (server already defined above)
const gracefulShutdown = (signal) => {
    console.log(`\n[${signal}] Received shutdown signal. Starting graceful shutdown...`);
    
    if (server) {
        server.close(async () => {
            console.log('✓ HTTP server closed - no longer accepting new connections');
            
            // Close all Socket.IO connections
            const io = socketService.getIO();
            if (io) {
                await io.close();
                console.log('✓ Socket.IO server closed');
            }
            
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

// ==================== SERVER STARTUP ====================

// Import createAdmin script
const createAdmin = require('./scripts/create-admin');

// Import blockchain listener
const startListener = require('./services/blockchainListener');

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server using HTTP server (with Socket.IO attached)
// Start server
if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, async () => {
        console.log(`🚀 CropChain API server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);

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
        console.log(`  ✓ Real-time WebSocket updates`);

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

        // Initialize CCIP dispatch service.
        if (ccipService.initialize()) {
            console.log('🌉 CCIP service initialized');
        } else {
            console.log('ℹ️  CCIP service not configured - cross-chain dispatch disabled');
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
