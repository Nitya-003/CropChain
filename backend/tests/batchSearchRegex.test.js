process.env.NODE_ENV = 'test';

const mockCounter = {
  findOneAndUpdate: jest.fn()
};

const mockBatch = {
  create: jest.fn(),
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn()
};

jest.mock('mongoose', () => {
  const Schema = jest.fn().mockImplementation(() => {
    return {
      index: jest.fn(),
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
    Schema,
    model: jest.fn((name) => {
      if (name === 'Counter') return mockCounter;
      if (name === 'Batch') return mockBatch;
      return {
        findOne: jest.fn(),
        create: jest.fn(),
        find: jest.fn(),
        findOneAndUpdate: jest.fn()
      };
    }),
    connect: jest.fn(),
    startSession: jest.fn(),
    connection: {
      host: 'localhost',
      readyState: 1
    }
  };
});

jest.mock('../models/Counter', () => mockCounter);
jest.mock('../models/Batch', () => mockBatch);

const { getBatches } = require('../controllers/batchController');

describe('batch search regex safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('escapes regex metacharacters in search query params before querying MongoDB', async () => {
    const queryChain = {
      lean: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([])
    };

    mockBatch.find.mockReturnValue(queryChain);
    mockBatch.countDocuments.mockResolvedValue(0);

    const req = {
      query: {
        batchId: 'BATCH(1).*',
        farmerName: 'A+B',
        cropType: '[rice]',
        status: 'Active'
      }
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await getBatches(req, res);

    expect(mockBatch.find).toHaveBeenCalledWith({
      batchId: { $regex: 'BATCH\\(1\\)\\.\\*', $options: 'i' },
      farmerName: { $regex: 'A\\+B', $options: 'i' },
      cropType: '[rice]',
      status: 'Active'
    });

    expect(mockBatch.countDocuments).toHaveBeenCalledWith({
      batchId: { $regex: 'BATCH\\(1\\)\\.\\*', $options: 'i' },
      farmerName: { $regex: 'A\\+B', $options: 'i' },
      cropType: '[rice]',
      status: 'Active'
    });
  });
});