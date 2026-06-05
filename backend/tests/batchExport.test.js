process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mongoose = require('mongoose');

// Mock storage
const inMemoryBatches = [];

class MockBatchDoc {
    constructor(data) {
        Object.assign(this, data);
    }
    toObject() { return this; }
}

const mockBatch = {
    findOne: jest.fn().mockImplementation((query) => {
        const batch = inMemoryBatches.find(b => b.batchId === query.batchId);
        return {
            lean: jest.fn().mockResolvedValue(batch),
            exec: jest.fn().mockResolvedValue(batch)
        };
    }),
    create: jest.fn().mockImplementation(async (data) => {
        const batch = new MockBatchDoc(data);
        inMemoryBatches.push(batch);
        return batch;
    })
};

// Mock Mongoose module
jest.mock('mongoose', () => {
    const originalMongoose = jest.requireActual('mongoose');
    const Schema = jest.fn().mockImplementation(() => {
        return {
            index: jest.fn(),
            virtual: jest.fn().mockReturnValue({ get: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() }),
            set: jest.fn(),
            pre: jest.fn(),
 post: jest.fn(),
            methods: {},
            statics: {}
        };
    });
    Schema.Types = {
        ObjectId: 'ObjectId',
        String: 'String',
        Number: 'Number',
        Date: 'Date',
        Boolean: 'Boolean'
    };

    return {
        ...originalMongoose,
        Schema,
        model: jest.fn((name) => {
            if (name === 'Batch') return mockBatch;
            return {
                findOne: jest.fn(),
                create: jest.fn(),
                find: jest.fn()
            };
        }),
        connect: jest.fn(),
        connection: {
            host: 'localhost',
            readyState: 1,
            close: jest.fn()
        }
    };
});

jest.mock('../models/Batch', () => mockBatch);
jest.mock('../models/Counter', () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 })
}));

// Mock middleware auth so we can access protected routes
jest.mock('../middleware/auth', () => ({
    protect: jest.fn((req, res, next) => {
        req.user = { id: 'USER123', email: 'test@example.com', role: 'admin' };
        next();
    }),
    adminOnly: jest.fn((req, res, next) => next()),
    verifiedOnly: jest.fn((req, res, next) => next()),
    authorizeBatchOwner: jest.fn((req, res, next) => next()),
    authorizeRoles: jest.fn(() => (req, res, next) => next()),
    authorizeStageTransition: jest.fn((req, res, next) => next()),
    authorizeBlockchainTransaction: jest.fn((req, res, next) => next()),
    requirePermissions: jest.fn(() => (req, res, next) => next()),
    requireAllPermissions: jest.fn(() => (req, res, next) => next()),
    inspectorOnly: jest.fn((req, res, next) => next()),
    requireMultisigOrAdmin: jest.fn(() => (req, res, next) => next()),
    checkBatchSafetyStatus: jest.fn((req, res, next) => next())
}));

// Mock pdfService
const mockPdfService = {
    generateBatchJourneyPDF: jest.fn().mockResolvedValue(Buffer.from('PDF_DUMMY_DATA'))
};
jest.mock('../services/pdfService', () => mockPdfService);

const app = require('../server');

describe('Batch Journey Export Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        inMemoryBatches.length = 0;
    });

    test('should return CSV data when format is csv', async () => {
        const testBatch = {
            batchId: 'BATCH000001',
            cropType: 'rice',
            quantity: 1000,
            harvestDate: '2024-01-15',
            origin: 'Punjab',
            farmerName: 'John Farmer',
            currentStage: 'farmer',
            isSpoiled: false,
            updates: [
                { stage: 'farmer', actor: 'John Farmer', location: 'Punjab', timestamp: '2024-01-15', notes: 'Harvested' }
            ]
        };
        inMemoryBatches.push(testBatch);

        const response = await request(app)
            .get('/api/batches/BATCH000001/export?format=csv')
            .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('attachment; filename="batch-BATCH000001.csv"');
        expect(response.text).toContain('Field,Value');
        expect(response.text).toContain('Batch ID,BATCH000001');
        expect(response.text).toContain('Crop Type,rice');
        expect(response.text).toContain('Quantity,1000 kg');
    });

    test('should return PDF data when format is pdf or default', async () => {
        const testBatch = {
            batchId: 'BATCH000001',
            cropType: 'rice',
            quantity: 1000,
            harvestDate: '2024-01-15',
            origin: 'Punjab',
            farmerName: 'John Farmer',
            currentStage: 'farmer',
            isSpoiled: false
        };
        inMemoryBatches.push(testBatch);

        const response = await request(app)
            .get('/api/batches/BATCH000001/export')
            .expect(200);

        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['content-disposition']).toContain('attachment; filename="batch-BATCH000001-journey.pdf"');
        expect(response.body).toEqual(Buffer.from('PDF_DUMMY_DATA'));
        expect(mockPdfService.generateBatchJourneyPDF).toHaveBeenCalled();
    });

    test('should return 404 if batch is not found', async () => {
        const response = await request(app)
            .get('/api/batches/NONEXISTENT/export')
            .expect(404);

        expect(response.body.success).toBe(false);
    });
});
