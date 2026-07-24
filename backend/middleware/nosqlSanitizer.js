const mongoSanitize = require("express-mongo-sanitize");
const logger = require("../utils/logger");
const notificationService = require("../services/notificationService");

module.exports = function createNoSqlSanitizer() {
  return mongoSanitize({
    replaceWith: "_",
    onSanitize: ({ req, key }) => {
      const details = {
        requestPart: key,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent") || "Unknown",
      };

      logger.warn("NoSQL injection payload sanitized", details);
      notificationService.notifySecurityEvent(
        "nosql_injection_sanitized",
        details,
      );
    },
  });
};
