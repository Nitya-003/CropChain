/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized responses
 */

const logger = require('../utils/logger');
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
  ServiceError
} = require('../utils/errorHandler');

/**
 * Global Error Handler Middleware
 * Must be registered after all other middleware and routes
 */
const errorHandlerMiddleware = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred';
  let errors = [];

  // Handle custom errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.details || [];
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
    message = 'Unauthorized access';
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
    message = 'Access forbidden';
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    message = 'Resource not found';
  } else if (err instanceof ConflictError) {
    statusCode = 409;
    message = 'Resource conflict';
  } else if (err instanceof RateLimitError) {
    statusCode = 429;
    message = 'Rate limit exceeded';
  } else if (err instanceof DatabaseError) {
    statusCode = 500;
    message = 'Database operation failed';
  } else if (err instanceof ServiceError) {
    statusCode = err.statusCode || 503;
    message = err.message || 'Service unavailable';
  } else if (err instanceof ServerError) {
    statusCode = 500;
    message = 'Internal server error';
  }

  // Handle MongoDB validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
  }

  // Handle MongoDB cast errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.kind}: ${err.value}`;
  }

  // Handle MongoDB duplicate key errors
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  }

  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid access token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Access token has expired';
  }

  // Handle syntax errors
  else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = 'Invalid request format';
  }

  // Logging logic
  if (statusCode >= 500) {
    // Internal Server Errors - log with error level
    logger.error(`Internal Server Error: ${err.message}`, {
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode
    });
  } else {
    // Client Errors - log with warn level
    logger.warn(`Client Error: ${message}`, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      statusCode,
      ...(errors.length > 0 && { errors })
    });
  }

  // Build standardized error response
  const response = {
    success: false,
    message: message
  };

  // Add errors array only if it's not empty
  if (errors.length > 0) {
    response.errors = errors;
  }

  // In development, add additional debugging info
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.statusCode = statusCode;
  }

  // Send response
  res.status(statusCode).json(response);
};

module.exports = errorHandlerMiddleware;
