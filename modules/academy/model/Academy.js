const mongoose = require("mongoose");

const academySchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    name: {
      type: String,
      required: [true, "Academy name is required"],
      trim: true,
      maxlength: [150, "Name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      default: "",
    },
    ageGroup: {
      type: String,
      enum: ["SENIOR", "U8", "U10", "U12", "U14", "U16", "U18", "U21"],
      required: [true, "Age group is required"],
    },
    headCoach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
    photo: {
      type: String,
      default: "",
    },
    schedule: {
      trainingDays: [{ type: String }],
      trainingTime: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for player count
academySchema.virtual("playerCount", {
  ref: "Player",
  localField: "players",
  foreignField: "_id",
  count: true,
});

const Academy = mongoose.model("Academy", academySchema);

module.exports = Academy;
