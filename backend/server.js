const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const connectDB = require('./config/db');
require('dotenv').config();
const mainRoutes = require("./routes/index");
const validateRequest = require('./middleware/validator');
const { createBatchSchema,updateBatchSchema} = require("./validations/batchSchema");
const { chatSchema } = require("./validations/chatSchema");

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
// app.use(cors({
//     origin: (origin, callback) => {
//         // Allow requests with no origin (mobile apps, Postman, curl, etc.)
//         if (!origin) {
//             return callback(null, true);
//         }

//         if (allowedOrigins.includes(origin)) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true
// }));

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




// In-memory storage
const batches = new Map();
let batchCounter = 1;

const PROVIDER_URL = process.env.INFURA_URL || 'https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID ';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x...';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x...';

if (process.env.NODE_ENV === 'production' && (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY)) {
    console.warn('⚠️  Blockchain configuration incomplete. Running in demo mode.');
}

// Helper functions
function generateBatchId() {
    const id = `CROP-2024-${String(batchCounter).padStart(3, '0')}`;
    batchCounter++;
    return id;
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

// Initialize with sample data
const sampleBatch = {
    batchId: 'CROP-2024-001',
    farmerName: 'Rajesh Kumar',
    farmerAddress: 'Village Rampur, District Meerut, UP',
    cropType: 'rice',
    quantity: 1000,
    harvestDate: '2024-01-15',
    origin: 'Rampur, Meerut',
    certifications: 'Organic, Fair Trade',
    description: 'High-quality Basmati rice grown using traditional methods',
    createdAt: new Date().toISOString(),
    currentStage: 'mandi',
    updates: [
        {
            stage: 'farmer',
            actor: 'Rajesh Kumar',
            location: 'Rampur, Meerut',
            timestamp: '2024-01-15T10:00:00.000Z',
            notes: 'Initial harvest recorded'
        },
        {
            stage: 'mandi',
            actor: 'Punjab Mandi',
            location: 'Ludhiana Market',
            timestamp: '2024-01-16T14:30:00.000Z',
            notes: 'Quality checked and processed'
        }
    ],
    qrCode: 'data:image/png;base64,sample',
    blockchainHash: '0x123456789abcdef'
};

batches.set('CROP-2024-001', sampleBatch);
batchCounter = 2;

// Import Routes
const authRoutes = require('./routes/authRoutes');

// Mount Auth Routes (Refactored)
app.use('/api/auth', authLimiter, authRoutes);

// Batch routes
app.post('/api/batches', batchLimiter, validateRequest(createBatchSchema), async (req, res) => {
    try {
        const validatedData = req.body;
        const batchId = generateBatchId();
        const qrCode = await generateQRCode(batchId);

        const batch = {
            batchId,
            farmerName: validatedData.farmerName,
            farmerAddress: validatedData.farmerAddress,
            cropType: validatedData.cropType,
            quantity: validatedData.quantity,
            harvestDate: validatedData.harvestDate,
            origin: validatedData.origin,
            certifications: validatedData.certifications,
            description: validatedData.description,
            createdAt: new Date().toISOString(),
            currentStage: 'farmer',
            isRecalled: false,   // ADD THIS
            updates: [
                {
                    stage: 'farmer',
                    actor: validatedData.farmerName,
                    location: validatedData.origin,
                    timestamp: validatedData.harvestDate,
                    notes: validatedData.description || 'Initial harvest recorded'
                }
            ],
            qrCode,
            blockchainHash: simulateBlockchainHash()
        };

        batches.set(batchId, batch);
        console.log(`[SUCCESS] Batch created: ${batchId} by ${validatedData.farmerName} from IP: ${req.ip}`);

        res.status(201).json({
            success: true,
            batch,
            message: 'Batch created successfully'
        });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({
            error: 'Failed to create batch',
            message: 'An internal server error occurred'
        });
    }
});

app.get('/api/batches/:batchId', batchLimiter, async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = batches.get(batchId);

        if (!batch) {
            console.log(`[NOT FOUND] Batch lookup failed: ${batchId} from IP: ${req.ip}`);
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch ID does not exist'
            });
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Recalled batch viewed:", batchId);
        }

        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({
            error: 'Failed to fetch batch',
            message: 'An internal server error occurred'
        });
    }
});

app.put('/api/batches/:batchId', batchLimiter, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        const batch = batches.get(batchId);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Attempt to update recalled batch:", batchId);
            return res.status(400).json({ error: 'Batch is recalled and cannot be updated' });
        }

        if (!validatedData.actor || !validatedData.stage || !validatedData.location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const update = {
            stage: validatedData.stage,
            actor: validatedData.actor,
            location: validatedData.location,
            timestamp: validatedData.timestamp,
            notes: validatedData.notes
        };

        batch.updates.push(update);
        batch.currentStage = validatedData.stage;
        batch.blockchainHash = simulateBlockchainHash();
        batches.set(batchId, batch);

        console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${validatedData.stage} by ${validatedData.actor} from IP: ${req.ip}`);

        res.json({
            success: true,
            batch,
            message: 'Batch updated successfully'
        });
    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({
            error: 'Failed to update batch',
            message: 'An internal server error occurred'
        });
    }
});

// Recall a batch (admin simulation)
app.post('/api/batches/:batchId/recall', (req, res) => {
    const { batchId } = req.params;
    const batch = batches.get(batchId);

    if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
    }

    batch.isRecalled = true;
    batches.set(batchId, batch);

    console.log("🚨 RECALL ALERT 🚨 Batch recalled:", batchId, "Owner:", batch.farmerName);

    res.json({ success: true, message: 'Batch recalled successfully', batch });
});

app.get('/api/batches', async (req, res) => {
    try {
        const allBatches = Array.from(batches.values());
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

        const sortedBatches = allBatches.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        console.log(`[SUCCESS] Batches list retrieved from IP: ${req.ip}`);

        res.json({
            success: true,
            stats,
            batches: sortedBatches
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({
            error: 'Failed to fetch batches',
            message: 'An internal server error occurred'
        });
    }
});



const batchServiceForAI = {
    async getBatch(batchId) {
        return batches.get(batchId);
    },

    async getDashboardStats() {
        const allBatches = Array.from(batches.values());
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

        res.json({
            success: true,
            response: aiResponse.message,
            timestamp: new Date().toISOString(),
            ...(aiResponse.functionCalled && {
                functionCalled: aiResponse.functionCalled,
                functionResult: aiResponse.functionResult
            })
        });

    } catch (error) {
        console.error('AI Chat error:', error);

        res.status(500).json({
            success: false,
            response: "I'm sorry, I'm having trouble processing your request right now. Please try asking about batch tracking, QR codes, or supply chain processes.",
            error: 'AI service temporarily unavailable',
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    res.status(404).json({
        error: 'Route not found',
        message: 'The requested endpoint does not exist'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack} - IP: ${req.ip}`);

    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'Something went wrong!',
        ...(isDevelopment && { stack: err.stack })
    });
});

// Import createAdmin script
const createAdmin = require('./scripts/create-admin');

// Start server
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
});

module.exports = app;