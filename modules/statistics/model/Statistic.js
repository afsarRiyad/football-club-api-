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
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
    },
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
    },
    type: {
      type: String,
      enum: ["PLAYER_SEASON", "TEAM_SEASON", "TEAM_MATCH"],
      required: [true, "Statistic type is required"],
    },
    matchesPlayed: {
      type: Number,
      default: 0,
    },
    goals: {
      type: Number,
      default: 0,
    },
    assists: {
      type: Number,
      default: 0,
    },
    cleanSheets: {
      type: Number,
      default: 0,
    },
    yellowCards: {
      type: Number,
      default: 0,
    },
    redCards: {
      type: Number,
      default: 0,
    },
    minutesPlayed: {
      type: Number,
      default: 0,
    },
    saves: {
      type: Number,
      default: 0,
    },
    winRate: {
      type: Number,
      default: 0, // percentage
    },
    draws: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    goalsFor: {
      type: Number,
      default: 0,
    },
    goalsAgainst: {
      type: Number,
      default: 0,
    },
    points: {
      type: Number,
      default: 0,
    },
    position: {
      type: Number,
    },
    extra: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
statisticSchema.index({ club: 1, type: 1, season: 1 });
statisticSchema.index({ player: 1, season: 1 });
statisticSchema.index({ team: 1, season: 1 });

const Statistic = mongoose.model("Statistic", statisticSchema);

module.exports = Statistic;
