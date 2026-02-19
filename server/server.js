const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/db');
require('dotenv').config();

// ==========================================
// 🛡️ CRASH-PROOF IMPORTS
// ==========================================
const loadSafely = (modulePath, moduleName = 'Module', isRoute = false) => {
    try {
        return require(modulePath);
    } catch (error) {
        console.error(`\n❌ ERROR LOADING ${moduleName.toUpperCase()}:`);
        console.error(`   Path: ${modulePath}`);
        console.error(`   Reason: ${error.message}\n`);
        
        if (isRoute) {
            const fallbackRouter = express.Router();
            fallbackRouter.all('*', (req, res) => {
                res.status(500).json({ error: `${moduleName} is temporarily down due to a server error.` });
            });
            return fallbackRouter;
        }
        return null;
    }
};

// Safely load Routes
const mainRoutes = loadSafely('./routes/index', 'Main Routes', true);
const authRoutes = loadSafely('./routes/authRoutes', 'Auth Routes', true);
const verificationRoutes = loadSafely('./routes/verification', 'Verification Routes', true);

// Safely load Validations
const { createBatchSchema, updateBatchSchema } = loadSafely('./validations/batchSchema', 'Batch Schema') || {};
const { chatSchema } = loadSafely('./validations/chatSchema', 'Chat Schema') || {};

// Safely load Middleware & Utils
const validateRequest = loadSafely('./middleware/validator', 'Validator Middleware');
const errorHandlerMiddleware = loadSafely('./middleware/errorHandler', 'Error Handler');
const apiResponse = loadSafely('./utils/apiResponse', 'API Response Utils');
const Batch = loadSafely('./models/Batch', 'Batch Model');
const swaggerSpec = loadSafely('./swagger', 'Swagger Spec');

// Connect to Database
connectDB();

const app = express();
// Priority: Use Docker Env Port, fallback to 3001
const PORT = process.env.PORT || 5000; 

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
    
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);

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
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20, 
    message: { error: 'Too many authentication attempts' }
});

const batchLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: parseInt(process.env.BATCH_RATE_LIMIT_MAX) || 100,
    message: { error: 'Too many batch operations' }
});

app.use(generalLimiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

// Add Docker/Localhost origins
allowedOrigins.push('http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173');

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            if(process.env.NODE_ENV === 'development') return callback(null, true);
            return callback(null, true); // Temporarily allow all for debugging
        }
        return callback(null, true);
    }
}));

// Body parsing
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

app.use(express.json({
    limit: maxFileSize,
    verify: (req, res, buf) => {
        try { JSON.parse(buf); } catch (e) { res.status(400).json({ error: 'Invalid JSON' }); }
    }
}));

app.use(express.urlencoded({ extended: true, limit: maxFileSize }));
app.use(mongoSanitize());
app.use(securityLogger);

// ==================== ROUTES ====================

app.use("/api", mainRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/verification', generalLimiter, verificationRoutes);

if (swaggerSpec) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'CropChain API Documentation'
    }));
}

// Blockchain configuration
const PROVIDER_URL = process.env.INFURA_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

let provider, contractInstance, wallet;

if (PROVIDER_URL && CONTRACT_ADDRESS && PRIVATE_KEY && PRIVATE_KEY !== '0x...') {
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
async function generateBatchId() {
    if(!Batch) return `CROP-2024-${Date.now()}`;
    const count = await Batch.countDocuments();
    return `CROP-2024-${String(count + 1).padStart(3, '0')}`;
}

async function generateQRCode(batchId) {
    try {
        return await QRCode.toDataURL(batchId, { width: 200, margin: 2, color: { dark: '#22c55e', light: '#ffffff' } });
    } catch (error) { return ''; }
}

function simulateBlockchainHash() {
    return '0x' + Math.random().toString(16).substr(2, 64);
}

// CREATE batch
if (createBatchSchema && validateRequest && Batch && apiResponse) {
    app.post('/api/batches', batchLimiter, validateRequest(createBatchSchema), async (req, res) => {
        try {
            const validatedData = req.body;
            const batchId = await generateBatchId();
            const qrCode = await generateQRCode(batchId);

            const batch = await Batch.create({
                batchId,
                farmerId: validatedData.farmerId,
                farmerName: validatedData.farmerName,
                farmerAddress: validatedData.farmerAddress,
                cropType: validatedData.cropType,
                quantity: validatedData.quantity,
                harvestDate: validatedData.harvestDate,
                origin: validatedData.origin,
                certifications: validatedData.certifications,
                description: validatedData.description,
                currentStage: "farmer",
                isRecalled: false,
                qrCode,
                blockchainHash: simulateBlockchainHash(),
                syncStatus: 'pending',
                updates: [{ stage: "farmer", actor: validatedData.farmerName, location: validatedData.origin, timestamp: validatedData.harvestDate, notes: validatedData.description || "Initial harvest recorded" }]
            });

            res.status(201).json(apiResponse.successResponse({ batch }, 'Batch created successfully', 201));
        } catch (error) {
            res.status(500).json(apiResponse.errorResponse('Failed to create batch', 'BATCH_CREATION_ERROR', 500));
        }
    });
}

// GET one batch
if (Batch && apiResponse) {
    app.get('/api/batches/:batchId', batchLimiter, async (req, res) => {
        try {
            const batch = await Batch.findOne({ batchId: req.params.batchId });
            if (!batch) return res.status(404).json(apiResponse.notFoundResponse('Batch', `ID: ${req.params.batchId}`));
            res.json(apiResponse.successResponse({ batch }, 'Batch retrieved successfully'));
        } catch (error) {
            res.status(500).json(apiResponse.errorResponse('Failed to fetch batch'));
        }
    });
}

// UPDATE batch
if (updateBatchSchema && validateRequest && Batch && apiResponse) {
    app.put('/api/batches/:batchId', batchLimiter, validateRequest(updateBatchSchema), async (req, res) => {
        try {
            const { batchId } = req.params;
            const existingBatch = await Batch.findOne({ batchId });
            if (!existingBatch) return res.status(404).json(apiResponse.notFoundResponse('Batch', `ID: ${batchId}`));
            if (existingBatch.isRecalled) return res.status(400).json(apiResponse.errorResponse('Batch is recalled and cannot be updated', 'BATCH_RECALLED', 400));

            const update = { stage: req.body.stage, actor: req.body.actor, location: req.body.location, timestamp: req.body.timestamp, notes: req.body.notes };
            const batch = await Batch.findOneAndUpdate(
                { batchId },
                { $push: { updates: update }, currentStage: req.body.stage, blockchainHash: simulateBlockchainHash(), syncStatus: 'pending' },
                { new: true }
            );

            res.json(apiResponse.successResponse({ batch }, 'Batch updated successfully'));
        } catch (error) {
            res.status(500).json(apiResponse.errorResponse('Failed to update batch'));
        }
    });
}

// RECALL ENDPOINT
if (Batch) {
    app.post('/api/batches/:batchId/recall', batchLimiter, auth, admin, async (req, res) => {
        try {
            const batch = await Batch.findOne({ batchId: req.params.batchId });
            if (!batch) return res.status(404).json({ error: 'Batch not found' });
            if (batch.isRecalled) return res.status(400).json({ error: 'Batch already recalled' });

            batch.isRecalled = true;
            await batch.save();
            res.json({ success: true, message: 'Batch recalled successfully', batch });
        } catch (error) {
            res.status(500).json({ error: 'Failed to recall batch' });
        }
    });
}

// GET all batches
if (Batch && apiResponse) {
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

            res.json(apiResponse.successResponse({ stats, batches: allBatches }, 'Batches retrieved successfully'));
        } catch (error) {
            res.status(500).json(apiResponse.errorResponse('Failed to fetch batches'));
        }
    });
}

// AI Service Setup
const batchServiceForAI = {
    async getBatch(batchId) { return Batch ? await Batch.findOne({ batchId }) : null; },
    async getDashboardStats() {
        const allBatches = Batch ? await Batch.find() : [];
        return { stats: { totalBatches: allBatches.length } };
    }
};

const aiService = loadSafely('./services/aiService', 'AI Service');

if (chatSchema && validateRequest && apiResponse) {
    app.post('/api/ai/chat', batchLimiter, validateRequest(chatSchema), async (req, res) => {
        if (!aiService) return res.status(503).json(apiResponse.errorResponse("AI Service Unavailable", "SERVICE_UNAVAILABLE", 503));
        try {
            const aiResponse = await aiService.chat(req.body.message, batchServiceForAI);
            res.json(apiResponse.successResponse({
                response: aiResponse.message,
                timestamp: new Date().toISOString(),
                ...(aiResponse.functionCalled && { functionCalled: aiResponse.functionCalled, functionResult: aiResponse.functionResult })
            }, 'Chat response generated successfully'));
        } catch (error) {
            res.status(500).json(apiResponse.errorResponse("AI processing failed", 'AI_SERVICE_ERROR', 500));
        }
    });
}

// ==================== ERROR HANDLERS ====================

app.use('*', (req, res) => {
    if(apiResponse) res.status(404).json(apiResponse.notFoundResponse('Endpoint', `${req.method} ${req.originalUrl}`));
    else res.status(404).json({ error: 'Endpoint not found' });
});

if (errorHandlerMiddleware) app.use(errorHandlerMiddleware);

// ==================== SERVER STARTUP ====================

app.listen(PORT, async () => {
    console.log(`🚀 CropChain API server running on port ${PORT}`);
    
    if (process.env.NODE_ENV !== 'test') {
        const createAdmin = loadSafely('./scripts/create-admin', 'Create Admin Script');
        if (typeof createAdmin === 'function') await createAdmin();
    }

    if (contractInstance) {
        const startListener = loadSafely('./services/blockchainListener', 'Blockchain Listener');
        if (typeof startListener === 'function') {
            startListener(contractInstance);
            console.log('🔗 Blockchain event listener started');
        }
    }
});

module.exports = app;