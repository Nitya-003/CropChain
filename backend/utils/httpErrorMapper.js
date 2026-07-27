const apiResponse = require("./apiResponse");

/**
 * Maps standard, CustomError, and database errors to standardized HTTP status codes and error responses.
 * @param {Error} error - The caught error object
 * @param {Object} [fallbackMeta] - Fallback message and error code if not mapped
 * @param {string} [fallbackMeta.code]
 * @param {string} [fallbackMeta.message]
 * @returns {Object} `{ statusCode, body }` where body is the apiResponse.errorResponse
 */
const mapHttpError = (error, fallbackMeta = {}) => {
  const fallbackCode = fallbackMeta.code || "SERVER_ERROR";
  const fallbackMessage =
    fallbackMeta.message || "An unexpected error occurred";

  let statusCode = 500;
  let errorCode = fallbackCode;
  let message = error?.message || fallbackMessage;

  if (error?.name === "CastError" || error?.name === "ValidationError") {
    statusCode = 400;
    errorCode = "INVALID_DATA";
  } else if (
    error?.name === "NotFoundError" ||
    error?.code === "NOT_FOUND" ||
    error?.statusCode === 404
  ) {
    statusCode = 404;
    errorCode = error?.code || "NOT_FOUND";
  } else if (error?.statusCode && error.statusCode < 500) {
    statusCode = error.statusCode;
    errorCode = error?.code || "CLIENT_ERROR";
  }

  const body = apiResponse.errorResponse(message, errorCode, statusCode);
  return { statusCode, body };
};

module.exports = {
  mapHttpError,
};
