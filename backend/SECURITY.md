# CropChain API Security Implementation

## Overview

This document outlines the comprehensive security measures implemented in the CropChain Express API to protect against common web application vulnerabilities including brute-force attacks, NoSQL injection, and data integrity issues.

## Security Features Implemented

### 1. Rate Limiting Protection

**Implementation**: `express-rate-limit` middleware with tiered protection levels.

#### Rate Limiting Tiers:

- **General Limiter**: 100 requests per 15 minutes per IP
  - Applied to all routes
  - Prevents general abuse and DoS attacks

- **Authentication Limiter**: 5 requests per 15 minutes per IP
  - Applied to `/api/auth/*` routes
  - Prevents brute-force login attacks
  - Stricter limits for sensitive authentication endpoints

- **Batch Operations Limiter**: 20 requests per 15 minutes per IP
  - Applied to `/api/batches/*` routes
  - Prevents batch creation/update spam
  - Balances legitimate use with abuse prevention

#### Configuration Features:
- Standard headers for rate limit information
- Custom error messages with retry information
- IP-based tracking
- Automatic reset after time window

### 2. NoSQL Injection Protection

**Implementation**: `express-mongo-sanitize` middleware.

#### Protection Features:
- Removes/replaces MongoDB operators (`$where`, `$ne`, `$gt`, etc.)
- Sanitizes query parameters, request body, and URL parameters
- Configurable replacement character (`_`)
- Logging of sanitization events for security monitoring

#### Monitored Patterns:
```javascript
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
```

### 3. Input Validation with Zod

**Implementation**: Comprehensive validation schemas using Zod library.

#### Batch Creation Schema (`createBatchSchema`):
```javascript
{
    farmerName: 2-100 chars, letters/spaces/periods/hyphens only
    farmerAddress: 10-500 chars
    cropType: 2-50 chars, letters/spaces/hyphens only
    quantity: 1-1,000,000 (numeric validation)
    harvestDate: YYYY-MM-DD format, within last year, not future
    origin: 5-200 chars
    certifications: max 500 chars (optional)
    description: max 1000 chars (optional)
}
```

#### Batch Update Schema (`updateBatchSchema`):
```javascript
{
    actor: 2-100 chars, letters/spaces/periods/hyphens only
    stage: enum ['farmer', 'mandi', 'transport', 'retailer']
    location: 5-200 chars
    notes: max 1000 chars (optional)
    timestamp: ISO format with auto-generation
}
```

#### Batch ID Validation:
- Format: `CROP-YYYY-XXX` (e.g., `CROP-2024-001`)
- Regex validation for consistent format
- Prevents injection through URL parameters

### 4. Security Headers with Helmet

**Implementation**: `helmet` middleware for security headers.

#### Headers Applied:
- **Content Security Policy**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer-Policy**: Controls referrer information
- **X-DNS-Prefetch-Control**: Controls DNS prefetching

### 5. Request Logging and Monitoring

**Implementation**: Custom security logging middleware.

#### Logged Information:
- Timestamp of request
- HTTP method and path
- Client IP address
- User-Agent string
- Suspicious pattern detection
- Request success/failure status

#### Security Alerts:
- Automatic detection of suspicious patterns
- Warning logs for potential attacks
- IP tracking for forensic analysis

### 6. Enhanced Error Handling

**Implementation**: Production-grade error handling with information disclosure protection.

#### Features:
- Environment-aware error responses
- Detailed errors in development
- Generic errors in production
- Error logging with IP tracking
- Structured error responses

### 7. CORS Configuration

**Implementation**: Secure CORS setup with environment-based origins.

#### Configuration:
- Configurable allowed origins
- Credentials support
- Preflight handling
- Development/production environment awareness

### 8. Request Size Limits

**Implementation**: Body parsing limits to prevent DoS attacks.

#### Limits:
- JSON payload: 10MB maximum
- URL-encoded data: 10MB maximum
- JSON validation on parsing
- Automatic rejection of oversized requests

## Security Middleware Stack

The security middleware is applied in the following order:

1. **Helmet** - Security headers
2. **Rate Limiting** - Request throttling
3. **CORS** - Cross-origin protection
4. **Body Parsing** - Size-limited parsing
5. **Mongo Sanitize** - NoSQL injection protection
6. **Security Logging** - Request monitoring
7. **Route-specific validation** - Input validation

## API Endpoint Security

### Protected Endpoints:

#### Authentication Routes (Future Implementation)
- `POST /api/auth/login` - 5 req/15min limit
- `POST /api/auth/register` - 5 req/15min limit

#### Batch Management Routes
- `POST /api/batches` - 20 req/15min + full validation
- `GET /api/batches/:batchId` - 20 req/15min + ID validation
- `PUT /api/batches/:batchId` - 20 req/15min + full validation
- `GET /api/batches` - 20 req/15min

#### System Routes
- `GET /api/health` - General rate limit only

## Validation Error Responses

### Structure:
```json
{
    "error": "Validation failed",
    "details": [
        {
            "field": "farmerName",
            "message": "Farmer name must be at least 2 characters"
        }
    ]
}
```

### Rate Limit Error Response:
```json
{
    "error": "Too many requests from this IP, please try again later.",
    "retryAfter": "15 minutes"
}
```

## Security Best Practices Implemented

1. **Defense in Depth**: Multiple layers of security
2. **Fail Secure**: Secure defaults and error handling
3. **Least Privilege**: Minimal required permissions
4. **Input Validation**: Server-side validation for all inputs
5. **Output Encoding**: Structured JSON responses
6. **Security Logging**: Comprehensive audit trail
7. **Rate Limiting**: Protection against abuse
8. **Error Handling**: No information disclosure

## Monitoring and Alerting

### Security Events Logged:
- Rate limit violations
- Validation failures
- Suspicious pattern detection
- NoSQL injection attempts
- 404 errors (potential reconnaissance)
- Server errors with IP tracking

### Log Format:
```
[TIMESTAMP] METHOD PATH - IP: x.x.x.x - User-Agent: ...
[SECURITY WARNING] Suspicious pattern detected from IP x.x.x.x: pattern
[SUCCESS] Batch created: CROP-2024-001 by Farmer Name from IP: x.x.x.x
```

## Environment Variables

### Required Security Configuration:
```env
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
PORT=3001
```

### Optional Security Configuration:
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
BATCH_RATE_LIMIT_MAX=20
```

## Testing Security Features

### Rate Limiting Test:
```bash
# Test general rate limit
for i in {1..101}; do curl http://localhost:3001/api/health; done

# Test batch rate limit
for i in {1..21}; do curl http://localhost:3001/api/batches; done

# Test auth rate limit
for i in {1..6}; do curl -X POST http://localhost:3001/api/auth/login; done
```

### Validation Test:
```bash
# Test invalid batch creation
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"farmerName": "A", "quantity": "invalid"}'
```

### NoSQL Injection Test:
```bash
# Test injection attempt (should be sanitized)
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"farmerName": {"$ne": null}, "cropType": "rice"}'
```

## Future Security Enhancements

1. **JWT Authentication**: Implement proper user authentication
2. **API Key Management**: For service-to-service communication
3. **Request Signing**: Cryptographic request verification
4. **IP Whitelisting**: For admin endpoints
5. **Audit Logging**: Enhanced security event logging
6. **Intrusion Detection**: Automated threat detection
7. **SSL/TLS Enforcement**: HTTPS-only communication
8. **Database Encryption**: Encrypt sensitive data at rest

## Compliance Considerations

This implementation addresses several security compliance requirements:

- **OWASP Top 10**: Protection against injection, broken authentication, security misconfiguration
- **PCI DSS**: Input validation and secure coding practices
- **GDPR**: Data protection and privacy by design
- **SOC 2**: Security controls and monitoring

## Conclusion

The implemented security measures provide comprehensive protection against common web application vulnerabilities while maintaining API usability and performance. Regular security reviews and updates should be performed to address emerging threats and maintain security posture.