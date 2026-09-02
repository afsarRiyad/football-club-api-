const mongoose = require("mongoose");

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
    matches: [tournamentMatchSchema],
    currentRound: { type: String },
    champion: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
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
