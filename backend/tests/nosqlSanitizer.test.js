const express = require('express');
const request = require('supertest');

jest.mock('../utils/logger', () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../services/notificationService', () => ({
    notifySecurityEvent: jest.fn()
}));

const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const createNoSqlSanitizer = require('../middleware/nosqlSanitizer');

describe('NoSQL Sanitizer Middleware', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(createNoSqlSanitizer());

        app.post('/inspect', (req, res) => {
            res.json({
                body: req.body,
                query: req.query
            });
        });
    });

    test('replaces MongoDB operators and logs sanitization events', async () => {
        const response = await request(app)
            .post('/inspect?%24where=return%20true')
            .send({
                crop: {
                    '$regex': '.*',
                    'owner.name': 'Test Farmer'
                }
            })
            .expect(200);

        expect(response.body.body).toEqual({
            crop: {
                _regex: '.*',
                owner_name: 'Test Farmer'
            }
        });

        expect(response.body.query).toEqual({
            _where: 'return true'
        });

        expect(logger.warn).toHaveBeenCalled();
        expect(notificationService.notifySecurityEvent).toHaveBeenCalledWith(
            'nosql_injection_sanitized',
            expect.objectContaining({
                requestPart: expect.any(String),
                method: 'POST',
                url: '/inspect?%24where=return%20true'
            })
        );
    });
});