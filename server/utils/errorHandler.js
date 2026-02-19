/**
 * Custom Error Classes for API
 * Provides structured error handling throughout the application
 */

/**
 * Base Custom Error Class
 */
class CustomError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error - 400
 */
class ValidationError extends CustomError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * Unauthorized Error - 401
 * When authentication fails
 */
class UnauthorizedError extends CustomError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden Error - 403
 * When authenticated but not authorized
 */
class ForbiddenError extends CustomError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Not Found Error - 404
 */
class NotFoundError extends CustomError {
  constructor(resource, identifier) {
    super(`${resource} with ${identifier} not found`, 404, 'NOT_FOUND');
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Conflict Error - 409
 * When request conflicts with existing data
 */
class ConflictError extends CustomError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Rate Limit Error - 429
 */
class RateLimitError extends CustomError {
  constructor(message = 'Too many requests', retryAfter = 900) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Server Error - 500
 * When an unexpected server error occurs
 */
class ServerError extends CustomError {
  constructor(message = 'Internal server error', originalError = null) {
    super(message, 500, 'SERVER_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Database Error - 500
 * When database operations fail
 */
class DatabaseError extends CustomError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Service Error - 503
 * When external service is unavailable
 */
class ServiceError extends CustomError {
  constructor(serviceName, message = 'Service temporarily unavailable', statusCode = 503) {
    super(`${serviceName}: ${message}`, statusCode, 'SERVICE_ERROR');
    this.serviceName = serviceName;
  }
}

module.exports = {
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
};
