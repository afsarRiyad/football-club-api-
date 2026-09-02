const mongoose = require("mongoose");

const matchEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["GOAL", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION", "PENALTY_MISSED", "INJURY"],
      required: true,
    },
    minute: {
      type: Number,
      min: 0,
      max: 120,
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    assist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    description: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
    },
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
    },
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Home team is required"],
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Away team is required"],
    },
    matchDate: {
      type: Date,
      required: [true, "Match date is required"],
    },
    kickoff: {
      type: String, // HH:MM
      default: "15:00",
    },
    venue: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "LIVE", "HT", "FT", "POSTPONED", "CANCELLED"],
      default: "SCHEDULED",
    },
    score: {
      home: { type: Number, default: 0 },
      away: { type: Number, default: 0 },
    },
    events: [matchEventSchema],
    stats: {
      possession: { home: { type: Number, default: 50 }, away: { type: Number, default: 50 } },
      shots: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      shotsOnTarget: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      corners: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      fouls: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      offsides: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      yellowCards: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      redCards: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
      saves: { home: { type: Number, default: 0 }, away: { type: Number, default: 0 } },
    },
    attendance: {
      type: Number,
    },
    referee: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for match title
matchSchema.virtual("title").get(function () {
  return `Match ${this.score.home} - ${this.score.away}`;
});

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
