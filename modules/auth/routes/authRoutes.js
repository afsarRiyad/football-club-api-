const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const { protect } = require("../../../middleware/auth");
const { authLimiter } = require("../../../middleware/rateLimiter");

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/logout", authController.logout);

// Protected routes
router.get("/me", protect, authController.getMe);

module.exports = router;
