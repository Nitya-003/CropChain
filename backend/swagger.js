/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation from JSDoc comments
 */

const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CropChain Decentralized Agriculture API",
      version: "1.0.0",
      description:
        "Blockchain-based agricultural supply chain provenance tracking system API with real-time IoT cold-chain telemetry, AI quality prediction, Chainlink CCIP attestations, and gasless meta-transactions.",
      contact: {
        name: "CropChain Team",
        email: "support@cropchain.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Development server",
      },
      {
        url: "https://api.cropchain.com",
        description: "Production server",
      },
    ],
    components: {
      schemas: {
        Batch: {
          type: "object",
          properties: {
            batchId: { type: "string", example: "CROP-2024-001" },
            farmerName: { type: "string", example: "Rajesh Kumar" },
            farmerAddress: {
              type: "string",
              example: "Village Rampur, Meerut",
            },
            cropType: {
              type: "string",
              enum: ["rice", "wheat", "corn", "tomato"],
            },
            quantity: { type: "number", example: 1000 },
            harvestDate: { type: "string", format: "date-time" },
            origin: { type: "string", example: "Rampur, Meerut" },
            currentStage: {
              type: "string",
              enum: ["farmer", "mandi", "transport", "retailer"],
            },
            qrCode: { type: "string" },
            blockchainHash: { type: "string" },
            isRecalled: { type: "boolean", default: false },
            updates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stage: { type: "string" },
                  actor: { type: "string" },
                  location: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "usr_98765" },
            name: { type: "string", example: "Amit Patel" },
            email: { type: "string", example: "farmer@cropchain.io" },
            role: {
              type: "string",
              enum: ["farmer", "mandi", "transporter", "retailer", "admin"],
            },
            walletAddress: { type: "string", example: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
          },
        },
        LoginCredentials: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "farmer@cropchain.io" },
            password: { type: "string", example: "secretpassword123" },
          },
        },
        ImageDiagnosisResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            diagnosis: { type: "string", example: "Healthy" },
            freshness_score: { type: "number", example: 94.5 },
            quality_grade: { type: "string", example: "A+" },
            exg_index: { type: "number", example: 0.35 },
            brown_spot_ratio: { type: "number", example: 0.02 },
          },
        },
        TelemetryData: {
          type: "object",
          properties: {
            batchId: { type: "string", example: "CROP-2024-001" },
            temperature: { type: "number", example: 4.2 },
            humidity: { type: "number", example: 65.0 },
            location: { type: "string", example: "Highway NH-44, Cold Truck #12" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        AuctionItem: {
          type: "object",
          properties: {
            id: { type: "string", example: "auc_123" },
            batchId: { type: "string", example: "CROP-2024-001" },
            reservePrice: { type: "number", example: 500 },
            currentHighestBid: { type: "number", example: 750 },
            status: { type: "string", enum: ["active", "closed", "cancelled"] },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
            error: { type: "string", nullable: true },
            code: { type: "string" },
            message: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            data: { type: "null" },
            error: { type: "string" },
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
      securitySchemes: {
        Bearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      {
        name: "Batches",
        description: "Crop batch provenance lifecycle & supply chain management endpoints",
      },
      {
        name: "Authentication",
        description: "User registration, login, and token context endpoints",
      },
      {
        name: "AI ML Service",
        description: "RandomForest soil prediction, Computer Vision leaf quality diagnosis, and AI assistant",
      },
      {
        name: "IoT Telemetry",
        description: "Cold-chain temperature/humidity telemetry streaming and automated dispute triggers",
      },
      {
        name: "Logistics",
        description: "Route optimization, Leaflet GIS mapping, and transport telemetry",
      },
      {
        name: "Auctions",
        description: "Mandi produce bidding & auction market endpoints",
      },
      {
        name: "Verification",
        description: "Decentralized Identifier (DID) verification and on-chain attestations",
      },
      {
        name: "Oracle",
        description: "Chainlink CCIP cross-chain attestations and price oracle integrations",
      },
      {
        name: "Health",
        description: "API system health checks and metrics",
      },
    ],
  },
  apis: ["./server.js", "./routes/*.js"], // Files containing JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
