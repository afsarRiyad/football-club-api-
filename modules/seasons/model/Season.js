const mongoose = require("mongoose");

const seasonSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    name: {
      type: String,
      required: [true, "Season name is required"],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique season per club per year
seasonSchema.index({ club: 1, year: 1 }, { unique: true });

const Season = mongoose.model("Season", seasonSchema);

module.exports = Season;
