const rateLimit = require("express-rate-limit");

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  validate: { trustProxy: false }, // trust proxy configured in app.js
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // allow admin refresh-token churn (was 20 — locked users out behind proxy)
  validate: { trustProxy: false }, // trust proxy configured in app.js
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public "Request a Match" submissions — unauthenticated, so a single IP gets a
// generous human quota rather than an open firehose into the admin's inbox.
const matchRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  validate: { trustProxy: false }, // trust proxy configured in app.js
  message: {
    success: false,
    message: "Too many match requests from this address. Please try again in an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, matchRequestLimiter };
