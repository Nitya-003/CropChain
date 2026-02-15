/**
 * Global Error Handler Middleware
 * Catches all errors and returns standardized responses
 */

const apiResponse = require('../utils/apiResponse');
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
  const ip = req.ip || req.connection.remoteAddress;

  // Log error for debugging
  console.error(`[ERROR] ${new Date().toISOString()} - IP: ${ip}`);
  console.error(`[ERROR] Message: ${err.message}`);
  console.error(`[ERROR] Stack: ${err.stack}`);

  // Default error values
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle custom errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    details = err.details;
  } else if (err instanceof UnauthorizedError) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err instanceof ForbiddenError) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (err instanceof ConflictError) {
    statusCode = 409;
    errorCode = 'CONFLICT';
  } else if (err instanceof RateLimitError) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
  } else if (err instanceof DatabaseError) {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (err instanceof ServiceError) {
    statusCode = err.statusCode || 503;
    errorCode = 'SERVICE_ERROR';
  } else if (err instanceof ServerError) {
    statusCode = 500;
    errorCode = 'SERVER_ERROR';
  }

  // Handle MongoDB validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map(e => e.message);
    message = 'Validation failed';
  }

  // Handle MongoDB cast errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid ${err.kind}: ${err.value}`;
  }

  // Handle MongoDB duplicate key errors
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  }

  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid access token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Access token has expired';
  }

  // Handle syntax errors
  else if (err instanceof SyntaxError) {
    statusCode = 400;
    errorCode = 'INVALID_REQUEST';
    message = 'Invalid request format';
  }

  // Log with warning level if client error, error level if server error
  if (statusCode >= 500) {
    console.error(`[${errorCode}] Server error from IP: ${ip}`);
  } else {
    console.warn(`[${errorCode}] Client error from IP: ${ip}: ${message}`);
  }

  // Build error response
  const response = {
    success: false,
    data: null,
    error: message,
    code: errorCode,
    message,
    statusCode,
    ...(details && { details })
  };

  // Add timestamp for debugging
  response.timestamp = new Date().toISOString();

  // In production, don't expose stack trace or internal details
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
};

module.exports = errorHandlerMiddleware;
