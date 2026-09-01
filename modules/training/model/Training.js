const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
      default: "ABSENT",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const trainingSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team is required"],
    },
    title: {
      type: String,
      required: [true, "Training title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    date: {
      type: Date,
      required: [true, "Training date is required"],
    },
    startTime: {
      type: String,
      default: "10:00",
    },
    endTime: {
      type: String,
      default: "12:00",
    },
    location: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["TACTICAL", "PHYSICAL", "TECHNICAL", "RECOVERY", "MIXED"],
      default: "MIXED",
    },
    description: {
      type: String,
      default: "",
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    attendance: [attendanceSchema],
    status: {
      type: String,
      enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
  },
  {
    timestamps: true,
  }
);

const Training = mongoose.model("Training", trainingSchema);

module.exports = Training;
