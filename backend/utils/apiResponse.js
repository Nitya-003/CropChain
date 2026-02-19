/**
 * API Response Utilities
 * Standardizes all API responses across the application
 */

/**
 * Success Response
 * @param {*} data - The data to return
 * @param {string} message - Human readable message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized success response
 */
const successResponse = (data, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    data,
    error: null,
    code: 'SUCCESS',
    message,
    statusCode
  };
};

/**
 * Error Response
 * @param {string} errorMessage - Error message
 * @param {string} errorCode - Error code for categorization
 * @param {number} statusCode - HTTP status code
 * @param {*} details - Additional error details
 * @returns {Object} Standardized error response
 */
const errorResponse = (errorMessage, errorCode = 'SERVER_ERROR', statusCode = 500, details = null) => {
  return {
    success: false,
    data: null,
    error: errorMessage,
    code: errorCode,
    message: errorMessage,
    statusCode,
    ...(details && { details })
  };
};

/**
 * Validation Error Response
 * @param {Array} errors - Array of validation errors
 * @param {number} statusCode - HTTP status code (default 400)
 * @returns {Object} Standardized validation error response
 */
const validationErrorResponse = (errors, statusCode = 400) => {
  return {
    success: false,
    data: null,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    message: 'One or more validation errors occurred',
    statusCode,
    details: Array.isArray(errors) ? errors : [errors]
  };
};

/**
 * Not Found Response
 * @param {string} resource - Resource name
 * @param {string} identifier - Resource identifier
 * @returns {Object} Standardized not found response
 */
const notFoundResponse = (resource, identifier) => {
  return errorResponse(
    `${resource} with ${identifier} not found`,
    'NOT_FOUND',
    404
  );
};

/**
 * Unauthorized Response
 * @param {string} message - Error message
 * @returns {Object} Standardized unauthorized response
 */
const unauthorizedResponse = (message = 'Authentication required') => {
  return errorResponse(message, 'UNAUTHORIZED', 401);
};

/**
 * Forbidden Response
 * @param {string} message - Error message
 * @returns {Object} Standardized forbidden response
 */
const forbiddenResponse = (message = 'Access forbidden') => {
  return errorResponse(message, 'FORBIDDEN', 403);
};

/**
 * Conflict Response
 * @param {string} message - Error message
 * @returns {Object} Standardized conflict response
 */
const conflictResponse = (message) => {
  return errorResponse(message, 'CONFLICT', 409);
};

/**
 * Rate Limit Response
 * @param {number} retryAfter - Seconds to retry after
 * @returns {Object} Standardized rate limit response
 */
const rateLimitResponse = (retryAfter = 900) => {
  return errorResponse(
    'Too many requests, please try again later',
    'RATE_LIMIT_EXCEEDED',
    429,
    { retryAfter }
  );
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
  rateLimitResponse
};
