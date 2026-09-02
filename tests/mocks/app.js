const express = require("express");
const request = require("supertest");
const path = require("path");

// Create a simplified Express app for testing
const createTestApp = () => {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "FClub Backend is running 🏟️",
      timestamp: new Date().toISOString(),
    });
  });
  
  // Mock the auth routes directly - using project root based paths
  const projectRoot = path.join(__dirname, "../..");
  const authController = require(path.join(projectRoot, "modules/auth/controller/authController"));
  const { protect } = require(path.join(projectRoot, "middleware/auth"));
  const validate = require(path.join(projectRoot, "middleware/validate"));
  const {
    registerSchema,
    loginSchema,
    updatePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
  } = require(path.join(projectRoot, "modules/auth/validation/authValidation"));
  
  const router = express.Router();
  
  // Public routes (without rate limiting for tests)
  router.post("/register", validate(registerSchema), authController.register);
  router.post("/login", validate(loginSchema), authController.login);
  router.post("/logout", authController.logout);
  router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
  router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);
  
  // Protected routes
  router.get("/me", protect, authController.getMe);
  router.patch("/update-password", protect, validate(updatePasswordSchema), authController.updatePassword);
  
  app.use("/api/auth", router);
  
  // 404 handler
  app.all("*", (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
    });
  });
  
  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error"
    });
  });
  
  return app;
};

module.exports = createTestApp;
