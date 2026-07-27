/**
 * Custom Error classes for standardized error handling.
 *
 * Any of these can be thrown (or passed to next(err)) from a controller or
 * service and the global error handler middleware (middleware/errorHandler.js)
 * will translate it into the same response shape produced by
 * utils/apiResponse.js's errorResponse(), so there is exactly one response
 * shape in the codebase, not two parallel ones.
 */

class AppError extends Error {
    constructor(message, statusCode, code, details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true; // expected/handled error, vs a programming bug
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource', identifier) {
        const message = identifier ? `${resource} not found: ${identifier}` : `${resource} not found`;
        super(message, 404, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409, 'CONFLICT');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMITED');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', details) {
        super(message, 500, 'DATABASE_ERROR', details);
    }
}

class ServiceError extends AppError {
    constructor(message = 'Service unavailable', statusCode = 503) {
        super(message, statusCode, 'SERVICE_ERROR');
    }
}

class ServerError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'SERVER_ERROR');
    }
}

module.exports = {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ServiceError,
    ServerError,
};