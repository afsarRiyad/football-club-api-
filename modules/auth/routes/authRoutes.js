const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const { protect } = require("../../../middleware/auth");
const { authLimiter } = require("../../../middleware/rateLimiter");
const validate = require("../../../middleware/validate");
const {
  registerSchema,
  loginSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validation/authValidation");

// Public routes
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.get("/me", protect, authController.getMe);
router.patch("/update-password", protect, validate(updatePasswordSchema), authController.updatePassword);

module.exports = router;
