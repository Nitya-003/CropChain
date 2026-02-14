const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
require('dotenv').config();
const mainRoutes = require("./routes/index");
const validateRequest = require('./middleware/validator');
const { chatSchema } = require("./validations/chatSchema");
const { batches } = require('./models/BatchStore');
const aiService = require('./services/aiService');

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
const batchRoutes = require('./routes/batchRoutes');

// Mount Auth Routes
app.use('/api/auth', authLimiter, authRoutes);

// Mount Batch Routes
app.use('/api/batches', batchLimiter, batchRoutes);

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

// Start server only if run directly
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`🚀 CropChain API server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

        // Create admin user on startup
        if(process.env.NODE_ENV !== 'test') {
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
            if (!process.env.JWT_SECRET) {
                console.warn('  ⚠️  JWT_SECRET not set - authentication will not work');
            }
        }

        console.log('\n✅ Server startup complete\n');
    });
}

module.exports = app;
