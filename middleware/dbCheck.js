const mongoose = require("mongoose");

/**
 * Middleware to ensure MongoDB connection is alive.
 * Render free tier drops connections when the service wakes from sleep.
 * This checks the connection state and reconnects if needed.
 */
const ensureDB = async (req, res, next) => {
  // If Mongoose is connected, proceed
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  console.log("⚠️ MongoDB not connected (state:", mongoose.connection.readyState, "). Reconnecting...");

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    console.log("✅ MongoDB reconnected");
    next();
  } catch (error) {
    console.error("❌ MongoDB reconnect failed:", error.message);
    res.status(503).json({
      success: false,
      message: "Database temporarily unavailable. Please try again.",
    });
  }
};

module.exports = ensureDB;
