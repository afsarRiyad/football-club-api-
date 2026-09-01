const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    membershipType: {
      type: String,
      enum: ["FREE", "BASIC", "PREMIUM", "VIP"],
      default: "FREE",
    },
    memberNumber: {
      type: String,
      unique: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    preferences: {
      notifications: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Unique membership per user per club
memberSchema.index({ user: 1, club: 1 }, { unique: true });

// Auto-generate member number
memberSchema.pre("save", async function (next) {
  if (!this.memberNumber) {
    const count = await mongoose.model("Member").countDocuments({ club: this.club });
    this.memberNumber = `MEM-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Member = mongoose.model("Member", memberSchema);

module.exports = Member;
