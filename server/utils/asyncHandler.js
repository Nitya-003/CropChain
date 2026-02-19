/**
 * Async Route Handler Wrapper
 * Catches errors from async route handlers and passes them to error middleware
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
