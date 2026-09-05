const mongoose = require("mongoose");

const matchRequestSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    requesterName: {
      type: String,
      required: [true, "Requester name is required"],
      trim: true,
    },
    requesterEmail: {
      type: String,
      required: [true, "Requester email is required"],
      trim: true,
      lowercase: true,
    },
    requesterPhone: {
      type: String,
      trim: true,
    },
    teamName: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
    },
    preferredDate: {
      type: Date,
    },
    preferredVenue: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries by club and status
matchRequestSchema.index({ club: 1, status: 1 });
matchRequestSchema.index({ club: 1, createdAt: -1 });

const MatchRequest = mongoose.model("MatchRequest", matchRequestSchema);

module.exports = MatchRequest;
