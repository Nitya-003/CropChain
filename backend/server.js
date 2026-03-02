const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // Required for transactions
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const connectDB = require('./config/db');
require('dotenv').config();
const mainRoutes = require("./routes/index");
const validateRequest = require('./middleware/validator');
const { chatSchema } = require("./validations/chatSchema");
const aiService = require('./services/aiService');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const { createBatchSchema, updateBatchSchema } = require("./validations/batchSchema");
const { protect, adminOnly, authorizeBatchOwner, authorizeRoles } = require('./middleware/auth');
const apiResponse = require('./utils/apiResponse');
const crypto = require('crypto');

// Import MongoDB Model
const Batch = require('./models/Batch');
const Counter = require('./models/Counter');

// ==================== GLOBAL EXCEPTION HANDLERS ====================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
    console.error('Promise:', promise);
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
        // In production, you might want to send to a logging service
        // sendToLoggingService({ type: 'unhandledRejection', reason, promise });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', error);
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
        // In production, you might want to send to a logging service
        // sendToLoggingService({ type: 'uncaughtException', error });
    }
    // Exit with non-zero code to indicate failure
    process.exit(1);
});

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE FUNCTIONS ====================

// JWT Authentication Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin Role Middleware
const admin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

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

// ==================== ROUTES ====================

// Mount health check main router
app.use("/api", mainRoutes);

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

        const contractABI = [
            "event BatchCreated(bytes32 indexed batchId, address indexed farmer, uint256 quantity)",
            "event BatchUpdated(bytes32 indexed batchId, string stage, address indexed actor)",
            "function getBatch(bytes32 batchId) view returns (tuple(address farmer, uint256 quantity, string stage, bool exists))",
            "function createBatch(bytes32 batchId, uint256 quantity, string memory metadata) returns (bool)"
        ];

        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
        console.log('✓ Blockchain contract instance initialized');
    } catch (error) {
        console.error('Failed to initialize blockchain connection:', error.message);
        contractInstance = null;
    }
} else {
    console.log('ℹ️  Blockchain not configured - running without contract instance');
}

// Helper functions
/**
 * Generate batch ID with optional session support for transaction safety
 * @param {mongoose.ClientSession} session - MongoDB session for transaction
 * @returns {string} - Generated batch ID
 */
async function generateBatchId(session = null) {
    const options = { new: true, upsert: true };
    if (session) {
        options.session = session;
    }

    const counter = await Counter.findOneAndUpdate(
        { name: 'batchId' },
        { $inc: { seq: 1 } },
        options
    );
    
    const currentYear = new Date().getFullYear();
    return `CROP-${currentYear}-${String(counter.seq).padStart(3, '0')}`;
}

async function generateQRCode(batchId) {
    try {
        return await QRCode.toDataURL(batchId, {
            width: 200,
            margin: 2,
            color: {
                dark: '#22c55e',
                light: '#ffffff'
            }
        });
    } catch (error) {
        console.error('Failed to generate QR code:', error);
        return '';
    }
}

function simulateBlockchainHash(data) {
    return '0x' + crypto
        .createHash('sha256')
        .update(JSON.stringify(data) + Date.now().toString())
        .digest('hex');
}

// Import Routes
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verification');

// Mount Auth Routes
app.use('/api/auth', authLimiter, authRoutes);

// Mount Verification Routes
app.use('/api/verification', generalLimiter, verificationRoutes);

// Batch routes - ALL USING MONGODB ONLY

// CREATE batch - requires authentication
// Uses MongoDB transaction to prevent race conditions in batch ID generation (CVSS 7.5 fix)
app.post('/api/batches', batchLimiter, protect, validateRequest(createBatchSchema), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
        const validatedData = req.body;

        // Generate batch ID within transaction for atomicity
        const batchId = await generateBatchId(session);
        const qrCode = await generateQRCode(batchId);

        const batch = await Batch.create([{
            batchId,
            farmerId: req.user.farmerId || req.user.id, // Use authenticated user's ID
            farmerName: validatedData.farmerName || req.user.name,
            farmerAddress: validatedData.farmerAddress || req.user.address || '',
            cropType: validatedData.cropType,
            quantity: validatedData.quantity,
            harvestDate: validatedData.harvestDate,
            origin: validatedData.origin,
            certifications: validatedData.certifications,
            description: validatedData.description,
            currentStage: "farmer",
            isRecalled: false,
            qrCode,
            blockchainHash: simulateBlockchainHash(validatedData),
            syncStatus: 'pending',
            updates: [{
                stage: "farmer",
                actor: validatedData.farmerName || req.user.name,
                location: validatedData.origin,
                timestamp: validatedData.harvestDate,
                notes: validatedData.description || "Initial harvest recorded"
            }]
        }], { session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        console.log(`[SUCCESS] Batch created: ${batchId} by user ${req.user.id} (${req.user.email}) from IP: ${req.ip}`);

        const response = apiResponse.successResponse(
            { batch: batch[0] },
            'Batch created successfully',
            201
        );
        res.status(201).json(response);
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();

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
        const batch = await Batch.findOne({ batchId });

        if (!batch) {
            console.log(`[NOT FOUND] Batch lookup failed: ${batchId} from IP: ${req.ip}`);
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(404).json(response);
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Recalled batch viewed:", batchId);
        }

        const response = apiResponse.successResponse({ batch }, 'Batch retrieved successfully');
        res.json(response);
    } catch (error) {
        console.error('Error fetching batch:', error);
        const response = apiResponse.errorResponse(
            'Failed to fetch batch',
            'BATCH_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// UPDATE batch - requires authentication and ownership
app.put('/api/batches/:batchId', batchLimiter, protect, authorizeBatchOwner, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        // Normalize stage to lowercase for consistency
        const normalizedStage = validatedData.stage.toLowerCase();

        // Note: authorizeBatchOwner middleware already checks if batch exists
        // and verifies ownership, so we can proceed directly to update

        const update = {
            stage: normalizedStage,
            actor: validatedData.actor,
            location: validatedData.location,
            timestamp: validatedData.timestamp,
            notes: validatedData.notes
        };

        const batch = await Batch.findOneAndUpdate(
            { batchId },
            {
                $push: { updates: update },
                currentStage: normalizedStage,
                blockchainHash: simulateBlockchainHash(update),
                syncStatus: 'pending'
            },
            { new: true }
        );

        console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${normalizedStage} by ${validatedData.actor} from IP: ${req.ip}`);

        const response = apiResponse.successResponse(
            { batch },
            'Batch updated successfully'
        );
        res.json(response);
    } catch (error) {
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

            const batch = await Batch.findOne({ batchId });

            if (!batch) {
                return res.status(404).json({ error: 'Batch not found' });
            }

            if (batch.isRecalled) {
                return res.status(400).json({ error: 'Batch already recalled' });
            }

            batch.isRecalled = true;
            await batch.save();

            console.log(`🚨 RECALL by admin ${req.user?.email || 'unknown'} for batch ${batchId}`);

            res.json({
                success: true,
                message: 'Batch recalled successfully',
                recalledBy: req.user?.email,
                recalledAt: new Date().toISOString(),
                batch
            });
        } catch (error) {
            console.error('Error recalling batch:', error);
            res.status(500).json({ error: 'Failed to recall batch' });
        }
    }
);

// GET all batches
app.get('/api/batches', batchLimiter, async (req, res) => {
    try {
        const allBatches = await Batch.find().sort({ createdAt: -1 });

        const uniqueFarmers = new Set(allBatches.map(b => b.farmerName)).size;
        const totalQuantity = allBatches.reduce((sum, batch) => sum + batch.quantity, 0);

        const stats = {
            totalBatches: allBatches.length,
            totalFarmers: uniqueFarmers,
            totalQuantity,
            recentBatches: allBatches.filter(batch => {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                return new Date(batch.createdAt) > monthAgo;
            }).length
        };

        console.log(`[SUCCESS] Batches list retrieved from IP: ${req.ip}`);

        const response = apiResponse.successResponse(
            { stats, batches: allBatches },
            'Batches retrieved successfully'
        );
        res.json(response);
    } catch (error) {
        console.error('Error fetching batches:', error);
        const response = apiResponse.errorResponse(
            'Failed to fetch batches',
            'BATCHES_FETCH_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// AI Service - MongoDB only
const batchServiceForAI = {
    async getBatch(batchId) {
        return await Batch.findOne({ batchId });
    },

    async getDashboardStats() {
        const allBatches = await Batch.find();
        const uniqueFarmers = new Set(allBatches.map(b => b.farmerName)).size;
        const totalQuantity = allBatches.reduce((sum, batch) => sum + batch.quantity, 0);

        return {
            stats: {
                totalBatches: allBatches.length,
                totalFarmers: uniqueFarmers,
                totalQuantity,
                recentBatches: allBatches.filter(batch => {
                    const monthAgo = new Date();
                    monthAgo.setDate(monthAgo.getDate() - 30);
                    return new Date(batch.createdAt) > monthAgo;
                }).length
            }
        };
    }
};

// AI Service import (ADD THIS if missing)
// AI Service import (Already imported at initialization)

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
        console.error('AI Chat error:', error);

        const response = apiResponse.errorResponse(
            "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.",
            'AI_SERVICE_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

// Serve Frontend in Production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/build")));

    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
    });
}

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    const response = apiResponse.notFoundResponse('Endpoint', `${req.method} ${req.originalUrl}`);
    res.status(404).json(response);
});

// Comprehensive Error Handler - Must be last middleware
app.use(errorHandlerMiddleware);

// ==================== SERVER STARTUP ====================

// Import createAdmin script
const createAdmin = require('./scripts/create-admin');

// Import blockchain listener
const startListener = require('./services/blockchainListener');

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, async () => {
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
                console.warn('  ⚠️  JWT_SECRET not set - a390
 
uthentication will not work');
            }
            if (!PROVIDER_URL || !CONTRACT_ADDRESS) {
                console.warn('  ⚠️  Blockchain configuration incomplete - running in demo mode');
            }
        }

        console.log('\n✅ Server startup complete\n');

        // Start blockchain event listener
        if (contractInstance) {
            try {
                startListener(contractInstance);
                console.log('🔗 Blockchain event listener started');
            } catch (error) {
                console.error('❌ Failed to start blockchain listener:', error.message);
            }
        } else {
            console.log('ℹ️  Skipping blockchain listener (no contract instance available)');
        }
    });
}

module.exports = app;
