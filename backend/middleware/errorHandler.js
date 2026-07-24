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

<<<<<<< HEAD
const logger = require("../utils/logger");
const {
  CustomError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
  DatabaseError,
  ServiceError,
} = require("../utils/errorHandler");
=======
const logger = require('../utils/logger');
const apiResponse = require('../utils/apiResponse');
const { AppError, ValidationError } = require('../utils/errors');
>>>>>>> 4fff4ff5a54bc38bcfd2a4d1f9a2796f49cacbbd

const errorHandlerMiddleware = (err, req, res, next) => {
<<<<<<< HEAD
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || "An unexpected error occurred";
  let errors = [];

  // Handle custom errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    errors = err.details || [];
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
    message = "Unauthorized access";
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
    message = "Access forbidden";
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    message = "Resource not found";
  } else if (err instanceof ConflictError) {
    statusCode = 409;
    message = "Resource conflict";
  } else if (err instanceof RateLimitError) {
    statusCode = 429;
    message = "Rate limit exceeded";
  } else if (err instanceof DatabaseError) {
    statusCode = 500;
    message = "Database operation failed";
  } else if (err instanceof ServiceError) {
    statusCode = err.statusCode || 503;
    message = err.message || "Service unavailable";
  } else if (err instanceof ServerError) {
    statusCode = 500;
    message = "Internal server error";
  }

  // Handle MongoDB validation errors
  else if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }

  // Handle MongoDB cast errors
  else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.kind}: ${err.value}`;
  }
=======
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
>>>>>>> 4fff4ff5a54bc38bcfd2a4d1f9a2796f49cacbbd

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

<<<<<<< HEAD
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid access token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Access token has expired";
  }

  // Handle syntax errors
  else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = "Invalid request format";
  }

  // Logging logic
  if (statusCode >= 500) {
    // Internal Server Errors - log with error level
    logger.error(`Internal Server Error: ${err.message}`, {
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      statusCode,
    });
  } else {
    // Client Errors - log with warn level
    logger.warn(`Client Error: ${message}`, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      statusCode,
      ...(errors.length > 0 && { errors }),
    });
  }

  // Build standardized error response
  const response = {
    success: false,
    message: message,
  };

  // Add errors array only if it's not empty
  if (errors.length > 0) {
    response.errors = errors;
  }

  // In development, add additional debugging info
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
    response.statusCode = statusCode;
  }

  // Send response
  res.status(statusCode).json(response);
=======
    res.status(statusCode).json(response);
>>>>>>> 4fff4ff5a54bc38bcfd2a4d1f9a2796f49cacbbd
};

module.exports = errorHandlerMiddleware;