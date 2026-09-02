const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Generate access token
 * @param {string} userId - User ID
 * @returns {string} JWT access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

/**
 * Generate refresh token
 * @returns {string} Random refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Hash refresh token for storage
 * @param {string} token - Plain refresh token
 * @returns {string} Hashed refresh token
 */
const hashRefreshToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Calculate refresh token expiration date
 * @returns {Date} Expiration date
 */
const calculateRefreshTokenExpiry = () => {
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || "7");
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Generate token pair (access + refresh)
 * @param {string} userId - User ID
 * @returns {object} Object containing accessToken and refreshToken
 */
const generateTokenPair = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  calculateRefreshTokenExpiry,
  verifyAccessToken,
  generateTokenPair,
};
