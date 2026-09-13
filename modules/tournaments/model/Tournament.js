const mongoose = require("mongoose");

/* One thing that happened in a match, in the same shape the matches module uses
   so the public page can render both with one parser.
   `side` says which team it belongs to; the name fields carry a scorer who has no
   Player record (an opponent's player, or a side that was typed in by hand). */
const tournamentEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["GOAL", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION", "PENALTY_MISSED", "INJURY"],
      required: true,
    },
    minute: { type: Number, min: 0, max: 120 },
    side: { type: String, enum: ["HOME", "AWAY"], default: "HOME" },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    assist: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    playerName: { type: String, trim: true, maxlength: 80, default: "" },
    assistName: { type: String, trim: true, maxlength: 80, default: "" },
    description: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false }
);

const tournamentMatchSchema = new mongoose.Schema(
  {
    round: {
      type: String,
      enum: [
        "FINAL",
        "SEMI_FINAL",
        "QUARTER_FINAL",
        "ROUND_OF_16",
        "ROUND_OF_32",
        "GROUP_STAGE",
        "PLAYOFF",
      ],
      required: true,
    },
    position: { type: Number, required: true },
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    /* Name (and logo) snapshots, written when the bracket is generated and for
       every promoted winner.

       Two jobs: a side typed in by hand has no Team document at all, and a team
       that is later removed from the tournament must NOT erase the name it
       played under — its matches would otherwise show "TBD" for ever. The UI
       prefers the live Team name and falls back to this. */
    homeTeamName: { type: String, trim: true, maxlength: 120, default: "" },
    awayTeamName: { type: String, trim: true, maxlength: 120, default: "" },
    homeTeamLogo: { type: String, default: "" },
    awayTeamLogo: { type: String, default: "" },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    matchDate: { type: Date },
    venue: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "SCHEDULED", "LIVE", "COMPLETED", "BYE"],
      default: "PENDING",
    },
    winner: {
      type: String,
      enum: ["HOME", "AWAY", "DRAW", null],
      default: null,
    },
    group: {
      type: String,
      default: null,
    },
    nextMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament" },
    nextMatchPosition: { type: Number },
    events: [tournamentEventSchema],
  },
  { _id: true }
);

const tournamentSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    name: {
      type: String,
      required: [true, "Tournament name is required"],
      trim: true,
      maxlength: [150, "Tournament name cannot exceed 150 characters"],
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    format: {
      type: String,
      enum: ["SINGLE_KNOCKOUT", "DOUBLE_KNOCKOUT", "ROUND_ROBIN", "GROUP_AND_KNOCKOUT"],
      default: "SINGLE_KNOCKOUT",
    },
    teamCount: {
      type: Number,
      required: true,
      enum: [2, 4, 8, 16, 32],
    },
    startDate: { type: Date },
    endDate: { type: Date },
    venue: { type: String, default: "" },
    description: { type: String, default: "" },
    logo: { type: String, default: "" },
    status: {
      type: String,
      enum: ["DRAFT", "REGISTRATION", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },
    teams: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    ],
    /* Sides that only exist for this tournament, entered as free text. Nothing
       here ever becomes a Team document — mirrors Match.awayTeamName. */
    manualTeams: [{ type: String, trim: true, maxlength: 120 }],
    matches: [tournamentMatchSchema],
    currentRound: { type: String },
    champion: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    /* Set together with `champion`: a hand-typed side that wins has no Team
       document to point at, so the name is what the page can show. */
    championName: { type: String, trim: true, default: "" },
    matchIntervalDays: { type: Number, default: 7 },
    groups: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tournamentSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

const Tournament = mongoose.model("Tournament", tournamentSchema);

module.exports = Tournament;
