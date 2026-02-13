const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const connectDB = require('./config/db');
require('dotenv').config();
const mainRoutes = require("./routes/index");
const validateRequest = require('./middleware/validator');
const errorHandlerMiddleware = require('./middleware/errorHandler');
const { createBatchSchema, updateBatchSchema } = require("./validations/batchSchema");
const { chatSchema } = require("./validations/chatSchema");
const apiResponse = require('./utils/apiResponse');

// Import MongoDB Model
const Batch = require('./models/Batch');

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
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

app.use(cors());

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

// mount health check main router
app.use("/api", mainRoutes);

// Swagger/OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CropChain API Documentation'
}));

// Blockchain configuration
const PROVIDER_URL = process.env.INFURA_URL || 'https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x...';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x...';

if (process.env.NODE_ENV === 'production' && (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY)) {
    console.warn('⚠️  Blockchain configuration incomplete. Running in demo mode.');
}

// Initialize blockchain provider and contract (reused for listener)
let provider;
let contractInstance;
let wallet;

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
    const count = await Batch.countDocuments();
    return `CROP-2024-${String(count + 1).padStart(3, '0')}`;
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

function simulateBlockchainHash() {
    return '0x' + Math.random().toString(16).substr(2, 64);
}

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

app.use(securityLogger);

// Import Routes
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verification');

// Mount Auth Routes
app.use('/api/auth', authLimiter, authRoutes);

// Mount Verification Routes
app.use('/api/verification', generalLimiter, verificationRoutes);

// Batch routes - ALL USING MONGODB ONLY

// CREATE batch
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
            updates: [{
                stage: "farmer",
                actor: validatedData.farmerName,
                location: validatedData.origin,
                timestamp: validatedData.harvestDate,
                notes: validatedData.description || "Initial harvest recorded"
            }]
        });

        console.log(`[SUCCESS] Batch created: ${batchId} by ${validatedData.farmerName} from IP: ${req.ip}`);

        const response = apiResponse.successResponse(
            { batch },
            'Batch created successfully',
            201
        );
        res.status(201).json(response);
    } catch (error) {
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

// UPDATE batch
app.put('/api/batches/:batchId', batchLimiter, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        const existingBatch = await Batch.findOne({ batchId });
        if (!existingBatch) {
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(404).json(response);
        }

        if (existingBatch.isRecalled) {
            console.log("🚨 ALERT: Attempt to update recalled batch:", batchId);
            const response = apiResponse.errorResponse(
                'Batch is recalled and cannot be updated',
                'BATCH_RECALLED',
                400
            );
            return res.status(400).json(response);
        }

        const update = {
            stage: validatedData.stage,
            actor: validatedData.actor,
            location: validatedData.location,
            timestamp: validatedData.timestamp,
            notes: validatedData.notes
        };

        const batch = await Batch.findOneAndUpdate(
            { batchId },
            {
                $push: { updates: update },
                currentStage: validatedData.stage,
                blockchainHash: simulateBlockchainHash(),
                syncStatus: 'pending'
            },
            { new: true }
        );

        console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${validatedData.stage} by ${validatedData.actor} from IP: ${req.ip}`);

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

// RECALL batch
app.post('/api/batches/:batchId/recall', batchLimiter, async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findOneAndUpdate(
            { batchId },
            { isRecalled: true },
            { new: true }
        );

        if (!batch) {
            const response = apiResponse.notFoundResponse('Batch', `ID: ${batchId}`);
            return res.status(404).json(response);
        }

        console.log("🚨 RECALL ALERT 🚨 Batch recalled:", batchId, "Owner:", batch.farmerName);

        const response = apiResponse.successResponse(
            { batch },
            'Batch recalled successfully'
        );
        res.json(response);
    } catch (error) {
        console.error('Error recalling batch:', error);
        const response = apiResponse.errorResponse(
            'Failed to recall batch',
            'BATCH_RECALL_ERROR',
            500
        );
        res.status(500).json(response);
    }
});

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

// 404 handler
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    const response = apiResponse.notFoundResponse('Endpoint', `${req.method} ${req.originalUrl}`);
    res.status(404).json(response);
});

// Comprehensive Error Handler - Must be last middleware
app.use(errorHandlerMiddleware);

// Import createAdmin script
const createAdmin = require('./scripts/create-admin');

// Import blockchain listener
const startListener = require('./services/blockchainListener');

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 CropChain API server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

    // Create admin user on startup
    if (process.env.NODE_ENV !== 'test') {
        await createAdmin();
    }

    console.log(`Admin user created successfully`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);

    console.log('\n🔒 Security features enabled:');
    console.log(`  ✓ Rate limiting (${rateLimitMaxRequests} req/window)`);
    console.log(`  ✓ NoSQL injection protection`);
    console.log(`  ✓ Input validation with Joi`);
    console.log(`  ✓ Security headers with Helmet`);
    console.log(`  ✓ Request logging and monitoring`);

    console.log('\n⚙️  Configuration:');
    console.log(`  • CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'None configured'}`);
    console.log(`  • Max file size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    console.log(`  • Rate limit window: ${Math.ceil(rateLimitWindowMs / 60000)} minutes`);

    if (process.env.NODE_ENV === 'production') {
        console.log('\n🏭 Production mode warnings:');
        if (!process.env.MONGODB_URI) {
            console.warn('  ⚠️  MONGODB_URI not set - using in-memory storage');
        }
        if (!PROVIDER_URL || !CONTRACT_ADDRESS) {
            console.warn('  ⚠️  Blockchain configuration incomplete - running in demo mode');
        }
        if (!process.env.JWT_SECRET) {
            console.warn('  ⚠️  JWT_SECRET not set - authentication will not work');
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

module.exports = app;