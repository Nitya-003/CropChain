# CropChain API Documentation

## Overview

CropChain API is a comprehensive REST API for blockchain-based crop tracking and supply chain management. It provides real-time updates, farmer-to-consumer transparency, and immutable record-keeping.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: `https://api.cropchain.com/api`

## Interactive Documentation

Access the interactive Swagger/OpenAPI documentation at:
- `http://localhost:3001/api/docs`

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer {token}
```

## Response Format

All API responses follow a standardized format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "error": null,
  "code": "SUCCESS",
  "message": "Human readable message"
}
```

### Error Response

```json
{
  "success": false,
  "data": null,
  "error": "Error message",
  "code": "ERROR_CODE",
  "message": "Error message",
  "details": []  // Optional
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input or validation error |
| 401 | Unauthorized - Authentication required or failed |
| 403 | Forbidden - Authenticated but not authorized |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists or conflicts |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error - Internal server error |

## Rate Limiting

All endpoints are rate-limited to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General | 100 requests | 15 minutes |
| Authentication | 5 requests | 15 minutes |
| Batch Operations | 20 requests | 15 minutes |

When rate limit is exceeded, you'll receive:
- HTTP Status: **429**
- Response: Includes `Retry-After` header indicating when to retry

## Endpoints

### 1. Health Check

#### Get API Status

```
GET /api/status
```

Returns the current status of the API and database connection.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "online",
    "database": "connected",
    "timestamp": "2024-02-13T10:30:00.000Z"
  },
  "code": "SUCCESS",
  "message": "Server is running"
}
```

---

### 2. Authentication

#### Register User

```
POST /api/auth/register
```

Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "farmer"  // "farmer" or "transporter"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "farmer"
    }
  },
  "code": "SUCCESS",
  "message": "Registration successful"
}
```

**Errors:**
- **400**: Validation failed or user already exists
- **500**: Server error during registration

---

#### Login User

```
POST /api/auth/login
```

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "farmer"
    }
  },
  "code": "SUCCESS",
  "message": "Login successful"
}
```

**Errors:**
- **400**: Validation failed
- **401**: Invalid email or password
- **500**: Server error during login

---

### 3. Batch Management

#### Create Batch

```
POST /api/batches
Rate Limited: 20 requests per 15 minutes
```

Create a new crop batch.

**Request Body:**
```json
{
  "farmerId": "FARM123",
  "farmerName": "Rajesh Kumar",
  "farmerAddress": "Village Rampur, Meerut, UP",
  "cropType": "rice",
  "quantity": 1000,
  "harvestDate": "2024-01-15",
  "origin": "Rampur, Meerut",
  "certifications": "Organic, Fair Trade",
  "description": "High-quality Basmati rice"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "batch": {
      "batchId": "CROP-2024-001",
      "farmerName": "Rajesh Kumar",
      "cropType": "rice",
      "quantity": 1000,
      "currentStage": "farmer",
      "qrCode": "data:image/png;base64,...",
      "blockchainHash": "0x...",
      "updates": [...],
      "createdAt": "2024-02-13T10:30:00.000Z"
    }
  },
  "code": "SUCCESS",
  "message": "Batch created successfully"
}
```

**Errors:**
- **400**: Validation failed
- **429**: Rate limit exceeded
- **500**: Server error

---

#### Get Batch

```
GET /api/batches/:batchId
Rate Limited: 20 requests per 15 minutes
```

Retrieve details of a specific batch.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "batch": {
      "batchId": "CROP-2024-001",
      "farmerName": "Rajesh Kumar",
      "cropType": "rice",
      "quantity": 1000,
      "currentStage": "mandi",
      "updates": [
        {
          "stage": "farmer",
          "actor": "Rajesh Kumar",
          "location": "Rampur, Meerut",
          "timestamp": "2024-01-15T10:00:00.000Z",
          "notes": "Initial harvest recorded"
        }
      ]
    }
  },
  "code": "SUCCESS",
  "message": "Batch retrieved successfully"
}
```

**Errors:**
- **404**: Batch not found
- **429**: Rate limit exceeded
- **500**: Server error

---

#### Get All Batches

```
GET /api/batches
Rate Limited: 20 requests per 15 minutes
```

Retrieve all batches with statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalBatches": 25,
      "totalFarmers": 8,
      "totalQuantity": 15000,
      "recentBatches": 5
    },
    "batches": [...]
  },
  "code": "SUCCESS",
  "message": "Batches retrieved successfully"
}
```

---

#### Update Batch

```
PUT /api/batches/:batchId
Rate Limited: 20 requests per 15 minutes
```

Update batch status or add supply chain update.

**Request Body:**
```json
{
  "stage": "transport",
  "actor": "Express Logistics",
  "location": "Delhi Highway",
  "timestamp": "2024-01-17",
  "notes": "In transit to distribution center"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "batch": {
      "batchId": "CROP-2024-001",
      "currentStage": "transport",
      "updates": [...]
    }
  },
  "code": "SUCCESS",
  "message": "Batch updated successfully"
}
```

**Errors:**
- **400**: Batch is recalled or validation failed
- **404**: Batch not found
- **429**: Rate limit exceeded
- **500**: Server error

---

#### Recall Batch

```
POST /api/batches/:batchId/recall
Rate Limited: 20 requests per 15 minutes
```

Mark a batch as recalled (for quality issues, etc.).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "batch": {
      "batchId": "CROP-2024-001",
      "isRecalled": true
    }
  },
  "code": "SUCCESS",
  "message": "Batch recalled successfully"
}
```

---

### 4. Verification

#### Check Verification Status

```
GET /api/verification/check/:userId
```

Check if a user is verified (public endpoint).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "isVerified": true,
    "verifiedAt": "2024-02-10T10:00:00.000Z"
  },
  "code": "SUCCESS",
  "message": "Verification status retrieved"
}
```

---

#### Link Wallet

```
POST /api/verification/link-wallet
Auth Required: Yes
```

Link a blockchain wallet to user account.

**Request Body:**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  "signature": "0x542d35Cc6634C05..."
}
```

---

#### Issue Credential

```
POST /api/verification/issue
Auth Required: Yes (Admin Only)
```

Issue a verifiable credential to a user.

---

#### Revoke Credential

```
POST /api/verification/revoke
Auth Required: Yes (Admin Only)
```

Revoke a user's credential.

---

### 5. AI Chat

#### Send Chat Message

```
POST /api/ai/chat
Rate Limited: 20 requests per 15 minutes
```

Send a message to the AI chatbot for assistance.

**Request Body:**
```json
{
  "message": "How do I create a new batch?",
  "context": {
    "currentPage": "AddBatch",
    "batchId": "CROP-2024-001"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": "To create a new batch, navigate to the Add Batch page...",
    "timestamp": "2024-02-13T10:30:00.000Z"
  },
  "code": "SUCCESS",
  "message": "Chat response generated successfully"
}
```

---

## Error Codes Reference

| Code | Status | Meaning |
|------|--------|---------|
| SUCCESS | 200 | Operation succeeded |
| VALIDATION_ERROR | 400 | Input validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Not authorized for this action |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |

---

## Common Patterns

### Error Handling

Always check the `success` field:

```typescript
const response = await fetch('/api/batches');
const data = await response.json();

if (data.success) {
  // Handle success
  console.log(data.data);
} else {
  // Handle error
  console.error(data.message, data.error);
  if (data.details) {
    console.error('Details:', data.details);
  }
}
```

### Pagination

For large datasets, batches are returned in chunks. Use timestamps to implement cursor-based pagination:

```
GET /api/batches?createdBefore=2024-02-13T10:30:00.000Z&limit=50
```

### Filtering

Filter batches by farmer or crop type:

```
GET /api/batches?farmerName=Rajesh&cropType=rice
```

---

## Development

### Run Tests

```bash
npm test
```

### Check API Health

```bash
curl http://localhost:3001/api/status
```

### View OpenAPI Spec

```bash
GET /api/docs/swagger.json
```

---

## Support

For issues or questions:
- Email: support@cropchain.com
- GitHub Issues: https://github.com/NithinRegidi/CropChain-OSS/issues

---

## License

MIT License - See LICENSE file for details
