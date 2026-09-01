const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const { v4: uuidv4 } = require("uuid");

/**
 * Apply all security middleware to the Express app.
 * @param {import("express").Express} app
 */
const applySecurity = (app) => {
  // ─── Request ID ─────────────────────────────────────────────────
  // Adds a unique X-Request-Id header to every request/response
  app.use((req, res, next) => {
    const requestId = req.headers["x-request-id"] || uuidv4();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });

  // ─── Helmet (Security Headers) ──────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow Cloudinary embeds
    })
  );

  // ─── Compression ────────────────────────────────────────────────
  app.use(
    compression({
      level: 6, // Balance between speed and compression
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    })
  );

  // ─── NoSQL Injection Sanitization ───────────────────────────────
  // Removes $ and . from req.body, req.query, req.params
  app.use(
    mongoSanitize({
      replaceWith: "_",
      onSanitize: ({ req, key }) => {
        console.warn(`⚠️ Sanitized key: ${key} in ${req.method} ${req.originalUrl}`);
      },
    })
  );

  // ─── HTTP Parameter Pollution Protection ────────────────────────
  // Prevents duplicate query parameters (e.g., ?role=admin&role=user)
  app.use(
    hpp({
      whitelist: [
        "club",
        "position",
        "status",
        "category",
        "type",
        "season",
        "competition",
        "team",
        "page",
        "limit",
        "sort",
        "fields",
      ],
    })
  );

  // ─── Additional Security Headers ────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    next();
  });
};

module.exports = { applySecurity };
