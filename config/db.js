const mongoose = require("mongoose");
const path = require("path");

// Load .env from project root (ensures correct values override system env)
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });

const connectDB = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 15000,
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) {
        console.error("⚠️ Could not connect to MongoDB. The server will start anyway and retry on requests.");
        // Don't exit — let the server start so the health check works
        // The ensureDB middleware will reconnect on actual requests
        return;
      }
      // Wait before retrying
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
};

module.exports = connectDB;
