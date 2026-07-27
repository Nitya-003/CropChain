const winston = require("winston");
const path = require("path");
const fs = require("fs");

const isServerless =
  process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || false;

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
];

const exceptionHandlers = [];
const rejectionHandlers = [];

if (!isServerless) {
  try {
    const logsDir = path.join(__dirname, "../logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // File transport for error logs only
    transports.push(
      new winston.transports.File({
        filename: path.join(__dirname, "../logs/error.log"),
        level: "error",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    // File transport for all logs
    transports.push(
      new winston.transports.File({
        filename: path.join(__dirname, "../logs/combined.log"),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    exceptionHandlers.push(
      new winston.transports.File({
        filename: path.join(__dirname, "../logs/exceptions.log"),
      }),
    );

    rejectionHandlers.push(
      new winston.transports.File({
        filename: path.join(__dirname, "../logs/rejections.log"),
      }),
    );
  } catch (err) {
    console.warn(
      "Winston file transports initialization failed (filesystem might be read-only):",
      err.message,
    );
  }
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "cropchain-backend" },
  transports,
  exceptionHandlers:
    exceptionHandlers.length > 0 ? exceptionHandlers : undefined,
  rejectionHandlers:
    rejectionHandlers.length > 0 ? rejectionHandlers : undefined,
});

// If we're not in production and not serverless, log to the console with a simple format
if (process.env.NODE_ENV !== "production" && !isServerless) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
      ),
    }),
  );
}

module.exports = logger;
