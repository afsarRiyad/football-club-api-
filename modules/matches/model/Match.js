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
    /* The opponent is usually one of the club's own Team documents, but it can
       also be a one-off side that only exists for this fixture (a friendly
       against a village XI, say). Those are stored as plain text and never
       create a Team document, so awayTeam is optional and awayTeamName carries
       the name instead. Exactly one of the two is expected to be set. */
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    awayTeamName: {
      type: String,
      trim: true,
      maxlength: [120, "Away team name cannot exceed 120 characters"],
      default: "",
    },
    /* ─── Name/logo snapshots ───
       Both sides keep a copy of their name and logo. Two reasons, and both are
       about not losing history: a fixture whose opponent was typed in by hand has
       no Team document at all, and a Team that gets deleted later would otherwise
       turn a played result into "TBD". The live Team is preferred when it still
       exists (see the displayName virtuals), so a rename still shows through. */
    homeTeamName: {
      type: String,
      trim: true,
      maxlength: [120, "Home team name cannot exceed 120 characters"],
      default: "",
    },
    homeTeamLogo: {
      type: String,
      default: "",
    },
    awayTeamLogo: {
      type: String,
      default: "",
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

/* Display name for either side: the populated Team's name when this match
   references a real team, otherwise the free-text opponent name. Exposed so the
   public site and the admin never render "TBD" for a typed opponent. */
matchSchema.virtual("awayTeamDisplayName").get(function () {
  if (this.awayTeam && typeof this.awayTeam === "object" && this.awayTeam.name) {
    return this.awayTeam.name;
  }
  return this.awayTeamName || "";
});

/* Same idea for the home side. The home team is still a required Team reference,
   so this only falls back to the snapshot once that Team is gone. */
matchSchema.virtual("homeTeamDisplayName").get(function () {
  if (this.homeTeam && typeof this.homeTeam === "object" && this.homeTeam.name) {
    return this.homeTeam.name;
  }
  return this.homeTeamName || "";
});

// Virtual for match title
matchSchema.virtual("title").get(function () {
  return `Match ${this.score.home} - ${this.score.away}`;
});

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;
