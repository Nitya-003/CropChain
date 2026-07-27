const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("../utils/logger");
const createNoSqlSanitizer = require("../middleware/nosqlSanitizer");
const { generalLimiter } = require("../middleware/rateLimiters");
const notificationService = require("../services/notificationService");

module.exports = (app) => {
  // Security logging middleware
  const securityLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent") || "Unknown";

    logger.info("Incoming request", {
      timestamp,
      method: req.method,
      path: req.path,
      ip,
      userAgent,
    });

    const suspiciousPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$regex/i,
      /javascript:/i,
      /<script/i,
      /union.*select/i,
    ];

    const requestString =
      JSON.stringify(req.body) +
      JSON.stringify(req.query) +
      JSON.stringify(req.params);

    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(requestString)) {
        logger.warn("Suspicious pattern detected", {
          ip,
          pattern: pattern.toString(),
          path: req.path,
        });
        notificationService.notifySecurityEvent("suspicious_pattern", {
          ip,
          pattern: pattern.toString(),
          path: req.path,
        });
      }
    });

    next();
  };

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      noSniff: true,
      frameguard: { action: "deny" },
      hidePoweredBy: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    next();
  });

  app.use(generalLimiter);

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : [];
  if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
  if (process.env.NODE_ENV === "development")
    allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
  const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (uniqueAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS blocked", { origin });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  };
  app.use(cors(corsOptions));

  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
  app.use(express.json({ limit: maxFileSize }));
  app.use(express.urlencoded({ extended: true, limit: maxFileSize }));

  app.use(createNoSqlSanitizer());
  app.use(securityLogger);

  const trustedHosts = (() => {
    const hosts = new Set(["localhost", "127.0.0.1"]);
    if (process.env.FRONTEND_URL) {
      try {
        const hostname = new URL(process.env.FRONTEND_URL).hostname;
        if (hostname) hosts.add(hostname);
      } catch {}
    }
    if (process.env.ALLOWED_ORIGINS) {
      process.env.ALLOWED_ORIGINS.split(",").forEach((origin) => {
        try {
          const hostname = new URL(origin.trim()).hostname;
          if (hostname) hosts.add(hostname);
        } catch {}
      });
    }
    if (process.env.TRUSTED_HOSTS) {
      process.env.TRUSTED_HOSTS.split(",").forEach((h) => {
        const trimmed = h.trim().toLowerCase();
        if (trimmed) hosts.add(trimmed);
      });
    }
    return hosts;
  })();

  app.use((req, res, next) => {
    const host = req.hostname?.toLowerCase();
    if (host && !trustedHosts.has(host)) {
      logger.warn("Host header blocked", { host });
      return res
        .status(400)
        .json({ error: "Invalid request", code: "INVALID_HOST" });
    }
    next();
  });
};
