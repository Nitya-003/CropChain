/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation from JSDoc comments
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CropChain API',
      version: '1.0.0',
      description: 'Blockchain-based crop tracking system API with real-time supply chain updates',
      contact: {
        name: 'CropChain Team',
        email: 'support@cropchain.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.cropchain.com',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Batch: {
          type: 'object',
          properties: {
            batchId: { type: 'string', example: 'CROP-2024-001' },
            farmerName: { type: 'string', example: 'Rajesh Kumar' },
            farmerAddress: { type: 'string', example: 'Village Rampur, Meerut' },
            cropType: { type: 'string', enum: ['rice', 'wheat', 'corn', 'tomato'] },
            quantity: { type: 'number', example: 1000 },
            harvestDate: { type: 'string', format: 'date-time' },
            origin: { type: 'string', example: 'Rampur, Meerut' },
            currentStage: { type: 'string', enum: ['farmer', 'mandi', 'transport', 'retailer'] },
            qrCode: { type: 'string' },
            blockchainHash: { type: 'string' },
            isRecalled: { type: 'boolean', default: false },
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  stage: { type: 'string' },
                  actor: { type: 'string' },
                  location: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
            code: { type: 'string' },
            message: { type: 'string' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            data: { type: 'null' },
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
      securitySchemes: {
        Bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      {
        name: 'Batches',
        description: 'Crop batch management endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication endpoints'
      },
      {
        name: 'Verification',
        description: 'User verification and DID endpoints'
      },
      {
        name: 'AI Chat',
        description: 'AI chatbot endpoints'
      },
      {
        name: 'Health',
        description: 'API health checks'
      }
    ]
  },
  apis: ['./server.js', './routes/*.js'] // Files containing JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
