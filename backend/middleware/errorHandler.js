/**
 * Global Error Handler Middleware
 *
 * Catches anything passed to next(err), plus anything Express catches on its
 * own (e.g. malformed JSON bodies), and maps it to the SAME response shape
 * that utils/apiResponse.js's errorResponse() produces everywhere else in
 * the app. This is deliberately built on top of apiResponse rather than a
 * new hand-rolled shape, so "the shape errorHandler emits" and "the shape
 * controllers emit" can never drift apart.
 *
 * Must be registered LAST, after all routes:
 *   app.use(errorHandlerMiddleware);
 *
 * Note: most existing controller code already catches its own errors and
 * responds directly via apiResponse (see batchController.js / authController.js),
 * so this middleware is the backstop for anything that isn't — async code
 * that forgets a try/catch, body-parser syntax errors, JWT errors thrown
 * outside a try block, unexpected Mongo errors, etc.
 */

const logger = require('../utils/logger');
const apiResponse = require('../utils/apiResponse');
const { AppError, ValidationError } = require('../utils/errors');

const errorHandlerMiddleware = (err, req, res, next) => {
    // Express requires 4-arg error middleware; `next` is intentionally unused.
    let statusCode = 500;
    let code = 'SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    } else if (err.name === 'ValidationError' && err.errors) {
        // Mongoose validation error
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        details = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
            value: e.value,
        }));
    } else if (err.name === 'CastError') {
        statusCode = 400;
        code = 'INVALID_ID';
        message = `Invalid ${err.kind}: ${err.value}`;
    } else if (err.code === 11000) {
        statusCode = 409;
        code = 'DUPLICATE_KEY';
        const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field';
        message = `${field} already exists`;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'INVALID_TOKEN';
        message = 'Invalid access token';
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'TOKEN_EXPIRED';
        message = 'Access token has expired';
    } else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        statusCode = 400;
        code = 'INVALID_REQUEST_FORMAT';
        message = 'Invalid request format';
    } else if (err.statusCode) {
        // Anything else that already carries an intentional statusCode/message
        statusCode = err.statusCode;
        message = err.message || message;
    }

    if (statusCode >= 500) {
        logger.error(`Internal Server Error: ${err.message}`, {
            stack: err.stack,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            statusCode,
        });
    } else {
        logger.warn(`Client Error: ${message}`, {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection?.remoteAddress,
            statusCode,
            ...(details ? { details } : {}),
        });
    }

    const response = apiResponse.errorResponse(message, code, statusCode, details);

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

module.exports = errorHandlerMiddleware;