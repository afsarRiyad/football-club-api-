const mongoose = require("mongoose");
const path = require("path");

// Load .env from project root (ensures correct values override system env)
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
