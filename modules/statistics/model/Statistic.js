const mongoose = require("mongoose");

const statisticSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    type: {
      type: String,
      enum: [
        "GOALS",
        "ASSISTS",
        "CLEAN_SHEETS",
        "YELLOW_CARDS",
        "RED_CARDS",
        "APPEARANCES",
        "MINUTES_PLAYED",
      ],
      required: [true, "Statistic type is required"],
    },
    value: {
      type: Number,
      required: [true, "Value is required"],
      min: [0, "Value cannot be negative"],
    },
    season: {
      type: String,
    },
    competition: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
statisticSchema.index({ club: 1, type: 1, season: 1 });
statisticSchema.index({ player: 1, type: 1 });
statisticSchema.index({ team: 1, type: 1 });

const Statistic = mongoose.model("Statistic", statisticSchema);

module.exports = Statistic;
