const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const { z } = require('zod');
require('dotenv').config();

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

// Rate limiting configurations - All configurable via environment variables
const parseEnvInt = (envVar, defaultValue) => {
    const parsed = parseInt(envVar);
    return isNaN(parsed) ? defaultValue : parsed;
};

const rateLimitWindowMs = parseEnvInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const rateLimitMaxRequests = parseEnvInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100);

const generalLimiter = rateLimit({
    windowMs: rateLimitWindowMs, // Default: 15 minutes
    max: rateLimitMaxRequests, // Default: 100 requests
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks in production monitoring
        return req.path === '/api/health' && process.env.NODE_ENV === 'production';
    }
});

const authLimiter = rateLimit({
    windowMs: rateLimitWindowMs, // Default: 15 minutes
    max: parseEnvInt(process.env.AUTH_RATE_LIMIT_MAX, 5), // Default: 5 requests
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const batchLimiter = rateLimit({
    windowMs: rateLimitWindowMs, // Default: 15 minutes
    max: parseEnvInt(process.env.BATCH_RATE_LIMIT_MAX, 20), // Default: 20 requests
    message: {
        error: 'Too many batch operations from this IP, please try again later.',
        retryAfter: `${Math.ceil(rateLimitWindowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// CORS configuration - Production ready with environment-based origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

// Add FRONTEND_URL if specified
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

// Only allow localhost in development
if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');
}

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parsing with configurable size limits
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // Default: 10MB

app.use(express.json({ 
    limit: maxFileSize,
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ error: 'Invalid JSON payload' });
            throw new Error('Invalid JSON');
        }
    }
}));

app.use(express.urlencoded({ extended: true, limit: maxFileSize }));

// NoSQL injection protection
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`Sanitized key: ${key} in request from IP: ${req.ip}`);
    }
}));

// Validation schemas using Zod
const createBatchSchema = z.object({
    farmerName: z.string()
        .min(2, 'Farmer name must be at least 2 characters')
        .max(100, 'Farmer name must be less than 100 characters')
        .regex(/^[a-zA-Z\s.'-]+$/, 'Farmer name contains invalid characters'),
    
    farmerAddress: z.string()
        .min(10, 'Farmer address must be at least 10 characters')
        .max(500, 'Farmer address must be less than 500 characters'),
    
    cropType: z.string()
        .min(2, 'Crop type must be at least 2 characters')
        .max(50, 'Crop type must be less than 50 characters')
        .regex(/^[a-zA-Z\s-]+$/, 'Crop type contains invalid characters'),
    
    quantity: z.union([
        z.string()
            .regex(/^\d+$/, 'Quantity must be a valid number')
            .refine(val => val.length <= 7, 'Quantity must be between 1 and 1,000,000')
            .refine(val => !/^0\d+$/.test(val), 'Quantity must not contain leading zeros')
            .transform(Number),
        z.number()
    ]).refine(val => val > 0 && val <= 1000000, 'Quantity must be between 1 and 1,000,000'),
    
    harvestDate: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Harvest date must be in YYYY-MM-DD format')
        .refine(date => {
            const parsed = new Date(date + 'T00:00:00.000Z'); // Parse as UTC
            const now = new Date();
            
            // Normalize comparison bounds to UTC date-only values
            const todayUtc = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ));
            const oneYearAgoUtc = new Date(Date.UTC(
                todayUtc.getUTCFullYear() - 1,
                todayUtc.getUTCMonth(),
                todayUtc.getUTCDate()
            ));
            
            return parsed <= todayUtc && parsed >= oneYearAgoUtc;
        }, 'Harvest date must be within the last year and not in the future'),
    
    origin: z.string()
        .min(5, 'Origin must be at least 5 characters')
        .max(200, 'Origin must be less than 200 characters'),
    
    certifications: z.string()
        .max(500, 'Certifications must be less than 500 characters')
        .optional()
        .default(''),
    
    description: z.string()
        .max(1000, 'Description must be less than 1000 characters')
        .optional()
        .default('')
});

const updateBatchSchema = z.object({
    actor: z.string()
        .min(2, 'Actor name must be at least 2 characters')
        .max(100, 'Actor name must be less than 100 characters')
        .regex(/^[a-zA-Z\s.'-]+$/, 'Actor name contains invalid characters'),
    
    stage: z.enum(['farmer', 'mandi', 'transport', 'retailer'], {
        errorMap: () => ({ message: 'Stage must be one of: farmer, mandi, transport, retailer' })
    }),
    
    location: z.string()
        .min(5, 'Location must be at least 5 characters')
        .max(200, 'Location must be less than 200 characters'),
    
    notes: z.string()
        .max(1000, 'Notes must be less than 1000 characters')
        .optional()
        .default(''),
    
    timestamp: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Invalid timestamp format')
        .optional()
        .default(() => new Date().toISOString())
});

const batchIdSchema = z.string()
    .min(1, 'Batch ID is required')
    .regex(/^CROP-\d{4}-\d{3}$/, 'Invalid batch ID format');

// Validation middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req.body);
            req.validatedBody = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorMessages = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errorMessages
                });
            }
            
            console.error('Validation error:', error);
            return res.status(500).json({ error: 'Internal validation error' });
        }
    };
};

const validateBatchId = (req, res, next) => {
    try {
        const { batchId } = req.params;
        batchIdSchema.parse(batchId);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Invalid batch ID format',
                details: error.errors.map(err => err.message)
            });
        }
        
        console.error('Batch ID validation error:', error);
        return res.status(500).json({ error: 'Internal validation error' });
    }
};

// Environment validation - Ensure required variables are set
const requiredEnvVars = [
    'NODE_ENV'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
}

// Warn about missing optional but recommended variables
const recommendedEnvVars = [
    'FRONTEND_URL',
    'MONGODB_URI',
    'JWT_SECRET'
];

const missingRecommended = recommendedEnvVars.filter(envVar => !process.env[envVar]);
if (missingRecommended.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Missing recommended environment variables for production:', missingRecommended.join(', '));
}

const batches = new Map();
let batchCounter = 1;

// Blockchain configuration - All from environment variables
const PROVIDER_URL = process.env.INFURA_URL || process.env.ALCHEMY_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate blockchain configuration if needed
if (process.env.NODE_ENV === 'production' && (!PROVIDER_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY)) {
    console.warn('⚠️  Blockchain configuration incomplete. Running in demo mode.');
}

const CONTRACT_ABI = [
    "function createBatch(string batchId, string farmerName, string farmerAddress, string cropType, uint256 quantity, string harvestDate, string origin, string certifications, string description) public",
    "function updateBatch(string batchId, string stage, string actor, string location, string notes) public",
    "function getBatch(string batchId) public view returns (tuple(string batchId, string farmerName, string farmerAddress, string cropType, uint256 quantity, string harvestDate, string origin, string certifications, string description, uint256 createdAt, address creator, bool exists))",
    "function getBatchUpdates(string batchId) public view returns (tuple(string stage, string actor, string location, uint256 timestamp, string notes, address updatedBy)[])"
];

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
    
    // Log suspicious patterns
    const suspiciousPatterns = [
        /\$where/i,
        /\$ne/i,
        /\$gt/i,
        /\$lt/i,
        /\$regex/i,
        /javascript:/i,
        /<script/i,
        /union.*select/i
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

// Routes with security middleware

// Auth routes (placeholder for future authentication)
app.post('/api/auth/login', authLimiter, (req, res) => {
    res.status(501).json({ 
        error: 'Authentication not implemented yet',
        message: 'This endpoint is reserved for future authentication implementation'
    });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
    res.status(501).json({ 
        error: 'Authentication not implemented yet',
        message: 'This endpoint is reserved for future authentication implementation'
    });
});

// Batch routes with rate limiting and validation
app.post('/api/batches', batchLimiter, validateRequest(createBatchSchema), async (req, res) => {
    try {
        const validatedData = req.validatedBody;

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

        // Log successful batch creation
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

app.get('/api/batches/:batchId', batchLimiter, validateBatchId, async (req, res) => {
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

        console.log(`[SUCCESS] Batch retrieved: ${batchId} from IP: ${req.ip}`);
        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({ 
            error: 'Failed to fetch batch',
            message: 'An internal server error occurred'
        });
    }
});

app.put('/api/batches/:batchId', batchLimiter, validateBatchId, validateRequest(updateBatchSchema), async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.validatedBody;

        const batch = batches.get(batchId);
        if (!batch) {
            console.log(`[NOT FOUND] Batch update failed: ${batchId} from IP: ${req.ip}`);
            return res.status(404).json({ 
                error: 'Batch not found',
                message: 'The requested batch ID does not exist'
            });
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

app.get('/api/batches', batchLimiter, async (req, res) => {
    try {
        const allBatches = Array.from(batches.values());
        const uniqueFarmers = new Set(allBatches.map(b => b.farmerName)).size;
        const totalQuantity = allBatches.reduce((sum, batch) => sum + batch.quantity, 0);
        
        const stats = {
            totalBatches: allBatches.length,
            totalFarmers: uniqueFarmers,
            totalQuantity,
            recentBatches: allBatches.filter(batch => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 30);
                return new Date(batch.createdAt) > weekAgo;
            })
        };

        const sortedBatches = allBatches.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'CropChain API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        security: {
            rateLimiting: 'enabled',
            mongoSanitize: 'enabled',
            helmet: 'enabled',
            validation: 'enabled'
        }
    });
});

// Handle 404 routes (must come before error handler)
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    res.status(404).json({
        error: 'Route not found',
        message: 'The requested endpoint does not exist'
    });
});

// Global error handler (must be last middleware)
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.stack} - IP: ${req.ip}`);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'Something went wrong!',
        ...(isDevelopment && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`🚀 CropChain API server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    
    // Security features status
    console.log('\n🔒 Security features enabled:');
    console.log(`  ✓ Rate limiting (${process.env.RATE_LIMIT_MAX_REQUESTS || 100} req/window)`);
    console.log(`  ✓ NoSQL injection protection`);
    console.log(`  ✓ Input validation with Zod`);
    console.log(`  ✓ Security headers with Helmet`);
    console.log(`  ✓ Request logging and monitoring`);
    
    // Configuration status
    console.log('\n⚙️  Configuration:');
    console.log(`  • CORS origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'None configured'}`);
    console.log(`  • Max file size: ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    console.log(`  • Rate limit window: ${Math.ceil(rateLimitWindowMs / 60000)} minutes`);
    
    // Warnings for production
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