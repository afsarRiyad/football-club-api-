const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../modules/auth/model/User");

async function createAdmin() {
  try {
    await connectDB();
    console.log("📦 Connected to MongoDB\n");

    // Delete existing admin user if exists
    await User.deleteOne({ email: "admin@fclub.com" });
    console.log("🗑️  Deleted existing admin user\n");

    // Create new admin user
    const admin = await User.create({
      name: "Admin Super",
      email: "admin@fclub.com",
      password: "password123",
      role: "SUPER_ADMIN",
    });

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email:", admin.email);
    console.log("🔑 Password: password123");
    console.log("👤 Role:", admin.role);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();