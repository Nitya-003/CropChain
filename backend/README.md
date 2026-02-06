# CropChain Backend API

Production-ready Express.js API server for the CropChain blockchain crop tracking system with comprehensive security features.

## 🔒 Security Features

- **Rate Limiting**: Configurable protection against brute-force attacks
- **NoSQL Injection Protection**: Automatic sanitization of MongoDB operators
- **Input Validation**: Comprehensive Zod schemas for data integrity
- **Security Headers**: Helmet middleware for XSS and clickjacking protection
- **Request Logging**: Security monitoring and audit trails
- **CORS Protection**: Environment-based origin validation

## 🚀 Quick Start

### Prerequisites

- Node.js (v14+)
- npm or yarn
- MongoDB (for production)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

3. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## ⚙️ Environment Configuration

### Required Variables

```env
NODE_ENV=development|production      # REQUIRED - Application environment
```

### Core Security Configuration (Used by the application)

```env
# Rate Limiting (requests per window)
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100          # General rate limit
AUTH_RATE_LIMIT_MAX=5                # Auth endpoint limit
BATCH_RATE_LIMIT_MAX=20              # Batch endpoint limit

# CORS Configuration
FRONTEND_URL=http://localhost:5173   # Primary frontend URL
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173  # Comma-separated origins

# File Upload
MAX_FILE_SIZE=10485760               # 10MB in bytes (default)
```

### Blockchain Configuration (Optional - Demo mode if not provided)

```env
INFURA_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID     # Ethereum provider
ALCHEMY_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY  # Alternative provider
CONTRACT_ADDRESS=0x...                                      # Smart contract address
PRIVATE_KEY=0x...                                          # Wallet private key
```

### Database Configuration (Optional - Uses in-memory storage if not provided)

```env
MONGODB_URI=mongodb://localhost:27017/cropchain            # Production database
MONGODB_TEST_URI=mongodb://localhost:27017/cropchain_test  # Test database
```

### Authentication Configuration (Optional - For future features)

```env
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters  # JWT signing key
JWT_EXPIRES_IN=7d                                          # Token expiration
BCRYPT_ROUNDS=12                                           # Password hashing rounds
```

## 📡 API Endpoints

### Batch Management

```
POST   /api/batches              - Create new batch (rate limited: 20/15min)
GET    /api/batches              - Get all batches with stats
GET    /api/batches/:batchId     - Get specific batch
PUT    /api/batches/:batchId     - Update batch with new stage
```

### Authentication (Placeholder)

```
POST   /api/auth/login           - User login (rate limited: 5/15min)
POST   /api/auth/register        - User registration (rate limited: 5/15min)
```

### System

```
GET    /api/health               - Health check endpoint
```

## 🛡️ Security Implementation

### Rate Limiting

- **General**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **Batch Operations**: 20 requests per 15 minutes per IP

### Input Validation

All POST/PUT endpoints use Zod schemas for validation:

```javascript
// Batch creation validation
{
    farmerName: 2-100 chars, letters/spaces/periods/hyphens only
    farmerAddress: 10-500 chars
    cropType: 2-50 chars, letters/spaces/hyphens only
    quantity: 1-1,000,000 (numeric)
    harvestDate: YYYY-MM-DD format, within last year
    origin: 5-200 chars
    certifications: max 500 chars (optional)
    description: max 1000 chars (optional)
}
```

### NoSQL Injection Protection

Automatic sanitization of dangerous MongoDB operators:
- `$where`, `$ne`, `$gt`, `$lt`, `$regex`
- JavaScript injection attempts
- Script tag injection

## 🧪 Testing

### Security Tests

Run the comprehensive security test suite:

```bash
# Ensure server is running on localhost:3001
npm run dev

# In another terminal, run security tests
node security-tests.js
```

### Manual Testing

```bash
# Test rate limiting
for i in {1..101}; do curl http://localhost:3001/api/health; done

# Test validation
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"farmerName": "A", "quantity": "invalid"}'

# Test NoSQL injection protection
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"farmerName": {"$ne": null}, "cropType": "rice"}'
```

## 📊 Monitoring

### Security Events Logged

- Rate limit violations
- Validation failures
- Suspicious pattern detection
- NoSQL injection attempts
- CORS violations
- Server errors with IP tracking

### Log Format

```
[TIMESTAMP] METHOD PATH - IP: x.x.x.x - User-Agent: ...
[SECURITY WARNING] Suspicious pattern detected from IP x.x.x.x
[SUCCESS] Batch created: CROP-2024-001 by Farmer Name from IP: x.x.x.x
```

## 🏭 Production Deployment

### Environment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `MONGODB_URI` for production database
- [ ] Set secure `JWT_SECRET` (minimum 32 characters)
- [ ] Configure `ALLOWED_ORIGINS` for your frontend domain
- [ ] Set up proper blockchain provider URLs
- [ ] Configure rate limiting for your expected traffic
- [ ] Set up log aggregation and monitoring
- [ ] Enable HTTPS/SSL termination at load balancer

### Security Checklist

- [ ] All environment variables properly set
- [ ] No hardcoded secrets in code
- [ ] Rate limiting configured for expected traffic
- [ ] CORS origins restricted to your domains
- [ ] Security headers enabled
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't leak sensitive information
- [ ] Logging configured for security monitoring

## 🔧 Development

### Adding New Endpoints

1. **Create validation schema**:
   ```javascript
   const newEndpointSchema = z.object({
       field: z.string().min(1, 'Field is required')
   });
   ```

2. **Apply security middleware**:
   ```javascript
   app.post('/api/new-endpoint', 
       rateLimiter, 
       validateRequest(newEndpointSchema), 
       async (req, res) => {
           // Implementation
       }
   );
   ```

3. **Add security tests** in `security-tests.js`

### Code Standards

- All environment variables must be configurable
- No hardcoded values in production code
- Comprehensive input validation for all endpoints
- Proper error handling with security considerations
- Security logging for all sensitive operations

## 📚 Documentation

- [Security Implementation Details](./SECURITY.md)
- [API Testing Guide](./security-tests.js)
- [Environment Configuration](./.env.example)

## 🤝 Contributing

Please ensure all contributions follow the security standards:

1. No hardcoded values
2. Environment variable configuration for all settings
3. Comprehensive input validation
4. Security tests for new features
5. Proper error handling

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.