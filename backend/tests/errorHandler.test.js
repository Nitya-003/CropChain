const request = require('supertest');
const express = require('express');
const errorHandlerMiddleware = require('../middleware/errorHandler');
const { ValidationError } = require('../utils/errorHandler');

// Create a dummy Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Route that throws a 400 error
  app.get('/error-400', (req, res, next) => {
    const error = new ValidationError('Bad Request');
    error.details = [
      { field: 'email', message: 'Email is required', value: '' },
      { field: 'password', message: 'Password must be at least 8 characters', value: '123' }
    ];
    next(error);
  });

  // Route that throws a 500 error
  app.get('/error-500', (req, res, next) => {
    const error = new Error('Database failure');
    error.statusCode = 500;
    next(error);
  });

  // Route that throws a generic error without statusCode
  app.get('/error-generic', (req, res, next) => {
    const error = new Error('Generic error without status code');
    next(error);
  });

  // Route that throws a Mongoose validation error
  app.get('/error-mongoose-validation', (req, res, next) => {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = {
      email: { message: 'Email is required', path: 'email', value: '' },
      password: { message: 'Password too short', path: 'password', value: '123' }
    };
    next(error);
  });

  // Route that throws a Mongoose cast error
  app.get('/error-mongoose-cast', (req, res, next) => {
    const error = new Error('Cast to ObjectId failed');
    error.name = 'CastError';
    error.kind = 'ObjectId';
    error.value = 'invalid-id';
    next(error);
  });

  // Route that throws a Mongoose duplicate key error
  app.get('/error-duplicate-key', (req, res, next) => {
    const error = new Error('Duplicate key');
    error.code = 11000;
    error.keyPattern = { email: 1 };
    next(error);
  });

  // Apply error handler middleware
  app.use(errorHandlerMiddleware);

  return app;
};

describe('Error Handler Middleware', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('400 Level Errors', () => {
    test('should return 400 with validation errors and proper structure', async () => {
      const response = await request(app)
        .get('/error-400')
        .expect(400);

      // Assert response structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors).toHaveLength(2);

      // Assert no duplicate fields
      expect(response.body).not.toHaveProperty('error');
      expect(response.body).not.toHaveProperty('code');
      expect(response.body).not.toHaveProperty('statusCode');
      expect(response.body).not.toHaveProperty('data');
      expect(response.body).not.toHaveProperty('timestamp');

      // Assert error details structure
      expect(response.body.errors[0]).toHaveProperty('field', 'email');
      expect(response.body.errors[0]).toHaveProperty('message', 'Email is required');
      expect(response.body.errors[0]).toHaveProperty('value', '');
    });

    test('should handle Mongoose validation errors correctly', async () => {
      const response = await request(app)
        .get('/error-mongoose-validation')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
      expect(response.body.errors).toHaveLength(2);

      expect(response.body.errors[0]).toHaveProperty('field', 'email');
      expect(response.body.errors[0]).toHaveProperty('message', 'Email is required');
      expect(response.body.errors[0]).toHaveProperty('value', '');
    });

    test('should handle Mongoose cast errors correctly', async () => {
      const response = await request(app)
        .get('/error-mongoose-cast')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid ObjectId: invalid-id');
      expect(response.body).not.toHaveProperty('errors');
    });

    test('should handle duplicate key errors correctly', async () => {
      const response = await request(app)
        .get('/error-duplicate-key')
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'email already exists');
      expect(response.body).not.toHaveProperty('errors');
    });
  });

  describe('500 Level Errors', () => {
    test('should return 500 with proper structure and no stack trace', async () => {
      const response = await request(app)
        .get('/error-500')
        .expect(500);

      // Assert response structure
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Database failure');

      // Assert no duplicate fields
      expect(response.body).not.toHaveProperty('error');
      expect(response.body).not.toHaveProperty('code');
      expect(response.body).not.toHaveProperty('statusCode');
      expect(response.body).not.toHaveProperty('data');
      expect(response.body).not.toHaveProperty('timestamp');

      // Assert no stack trace in production
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('errors');
    });

    test('should handle generic errors without status code as 500', async () => {
      const response = await request(app)
        .get('/error-generic')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Generic error without status code');
      expect(response.body).not.toHaveProperty('errors');
      expect(response.body).not.toHaveProperty('stack');
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('should include stack trace and statusCode in development mode', async () => {
      // Set development mode
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/error-500')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Database failure');
      expect(response.body).toHaveProperty('stack');
      expect(response.body).toHaveProperty('statusCode', 500);
    });
  });

  describe('Error Response Format Consistency', () => {
    test('should always have success: false', async () => {
      const endpoints = ['/error-400', '/error-500', '/error-generic'];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.body).toHaveProperty('success', false);
      }
    });

    test('should always have a message field', async () => {
      const endpoints = ['/error-400', '/error-500', '/error-generic'];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
      }
    });

    test('should only include errors array when there are validation errors', async () => {
      const validationResponse = await request(app).get('/error-400');
      const serverErrorResponse = await request(app).get('/error-500');

      expect(validationResponse.body).toHaveProperty('errors');
      expect(serverErrorResponse.body).not.toHaveProperty('errors');
    });
  });
});
