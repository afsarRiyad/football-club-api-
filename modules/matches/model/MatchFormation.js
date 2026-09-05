const mongoose = require("mongoose");

const startingXIEntrySchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    slotIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
  },
  { _id: false }
);

const matchFormationSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: [true, "Match is required"],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team is required"],
    },
    formation: {
      type: String,
      default: "4-3-3",
    },
    playerCount: {
      type: Number,
      enum: [5, 7, 9, 11],
      default: 11,
    },
    startingXI: [startingXIEntrySchema],
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    bench: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Player",
        },
      ],
      default: [],
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

// One formation per match per team
matchFormationSchema.index({ match: 1, team: 1 }, { unique: true });

const MatchFormation = mongoose.model("MatchFormation", matchFormationSchema);

module.exports = MatchFormation;
