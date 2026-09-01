const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");
const { connectRedis } = require("./utils/cache");

// Connect to MongoDB
connectDB();

// Connect to Redis (optional)
connectRedis();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`⚽ FClub Backend running on port ${PORT}`);
  console.log(`📌 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
});

// Initialize Socket.io
initSocket(server);
console.log(`🔌 Socket.io initialized`);

// ─── Graceful Shutdown ─────────────────────────────────────────────
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log(" HTTP server closed");

    try {
      // Close Socket.io connections
      const { getIO } = require("./config/socket");
      const io = getIO();
      io.close(() => {
        console.log(" Socket.io closed");
      });
    } catch (e) {
      // Socket.io may not be initialized
    }

    try {
      // Close MongoDB connection
      const mongoose = require("mongoose");
      await mongoose.connection.close();
      console.log(" MongoDB connection closed");
    } catch (e) {
      console.error("Error closing MongoDB:", e.message);
    }

    try {
      // Close Redis connection
      const { cacheFlush } = require("./utils/cache");
      // Redis auto-closes on process exit
    } catch (e) {
      // Redis may not be available
    }

    console.log("✅ Graceful shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥", err.name, err.message);
  gracefulShutdown("unhandledRejection");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥", err.name, err.message);
  process.exit(1);
});
