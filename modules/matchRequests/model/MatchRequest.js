const mongoose = require("mongoose");
const { LIMITS } = require("../validation/matchRequestValidation");

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
      maxlength: [LIMITS.MAX_NAME, `Requester name cannot exceed ${LIMITS.MAX_NAME} characters`],
    },
    requesterEmail: {
      type: String,
      required: [true, "Requester email is required"],
      trim: true,
      lowercase: true,
      maxlength: [LIMITS.MAX_EMAIL, "Requester email is too long"],
    },
    requesterPhone: {
      type: String,
      trim: true,
      maxlength: [LIMITS.MAX_PHONE, `Phone cannot exceed ${LIMITS.MAX_PHONE} characters`],
    },
    teamName: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      maxlength: [LIMITS.MAX_TEAM, `Team name cannot exceed ${LIMITS.MAX_TEAM} characters`],
    },
    preferredDate: {
      type: Date,
    },
    preferredVenue: {
      type: String,
      trim: true,
      maxlength: [LIMITS.MAX_VENUE, `Preferred venue cannot exceed ${LIMITS.MAX_VENUE} characters`],
    },
    message: {
      type: String,
      trim: true,
      maxlength: [LIMITS.MAX_MESSAGE, `Message cannot exceed ${LIMITS.MAX_MESSAGE} characters`],
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [LIMITS.MAX_MESSAGE, `Admin notes cannot exceed ${LIMITS.MAX_MESSAGE} characters`],
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
