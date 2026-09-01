const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./config/socket");

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`⚽ FClub Backend running on port ${PORT}`);
  console.log(`📌 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Initialize Socket.io
initSocket(server);
console.log(`🔌 Socket.io initialized`);

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥", err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION 💥", err.name, err.message);
  process.exit(1);
});
