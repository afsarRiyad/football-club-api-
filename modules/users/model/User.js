const mongoose = require("mongoose");

// Reuse the existing User model from auth module
const User = require("../../auth/model/User");

module.exports = User;
