const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    number: {
      type: Number,
      min: [1, "Number must be at least 1"],
      max: [99, "Number cannot exceed 99"],
    },
    position: {
      type: String,
      enum: [
        "GOALKEEPER",
        "DEFENDER",
        "MIDFIELDER",
        "FORWARD",
      ],
      required: [true, "Position is required"],
    },
    subPosition: {
      type: String,
      enum: [
        "CENTRE_BACK",
        "LEFT_BACK",
        "RIGHT_BACK",
        "DEFENSIVE_MIDFIELDER",
        "CENTRAL_MIDFIELDER",
        "ATTACKING_MIDFIELDER",
        "LEFT_WINGER",
        "RIGHT_WINGER",
        "STRIKER",
        "SECOND_STRIKER",
      ],
    },
    dateOfBirth: {
      type: Date,
    },
    nationality: {
      type: String,
      default: "",
    },
    height: {
      type: Number, // in cm
    },
    weight: {
      type: Number, // in kg
    },
    preferredFoot: {
      type: String,
      enum: ["LEFT", "RIGHT", "BOTH"],
      default: "RIGHT",
    },
    photo: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    // Player attributes (0–99 scale)
    pac: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    sho: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    pas: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    dri: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    def: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    phy: {
      type: Number,
      min: 0,
      max: 99,
      default: 50,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    contractEnd: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INJURED", "SUSPENDED", "LOANED", "INACTIVE"],
      default: "ACTIVE",
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

// Virtual for full name
playerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
playerSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

// Compound index to prevent duplicate player numbers per club
playerSchema.index({ club: 1, number: 1 }, { unique: true, sparse: true });

/**
 * Cascade cleanup: whenever a Player is removed through ANY delete path
 * (findByIdAndDelete, deleteOne, or document.remove()), pull them out of
 * teams / match formations and delete their statistics. This guarantees a
 * Statistic can never outlive the player it references, even if a future
 * controller forgets to clean up — the refs that previously surfaced as
 * `player: null` and crashed lineup/stat pages simply can't be created.
 *
 * Idempotent on purpose: the controller also cleans up, so running both is safe.
 */
const cleanupPlayerReferences = async (playerId) => {
  if (!playerId) return;
  const Team = require("../../teams/model/Team");
  const MatchFormation = require("../../matches/model/MatchFormation");
  const Statistic = require("../../statistics/model/Statistic");
  await Promise.all([
    Team.updateMany(
      {
        $or: [
          { players: playerId },
          { bench: playerId },
          { "startingXI.player": playerId },
          { captain: playerId },
          { viceCaptain: playerId },
        ],
      },
      {
        $pull: { players: playerId, bench: playerId, startingXI: { player: playerId } },
        $unset: { captain: 1, viceCaptain: 1 },
      }
    ),
    MatchFormation.updateMany(
      {
        $or: [{ bench: playerId }, { "startingXI.player": playerId }, { captain: playerId }],
      },
      {
        $pull: { bench: playerId, startingXI: { player: playerId } },
        $unset: { captain: 1 },
      }
    ),
    Statistic.deleteMany({ player: playerId }),
  ]);
};

const getIdFromFilter = (filter) => {
  const id = filter && filter._id;
  if (!id) return null;
  // Accept a plain ObjectId/string, or a query object like { $in: [...] }.
  if (typeof id === "object" && !(id instanceof mongoose.Types.ObjectId)) {
    return null; // complex multi-delete — leave those to explicit cleanup
  }
  return id;
};

playerSchema.pre("findOneAndDelete", async function () {
  await cleanupPlayerReferences(getIdFromFilter(this.getFilter()));
});

playerSchema.pre("deleteOne", async function () {
  await cleanupPlayerReferences(getIdFromFilter(this.getFilter()));
});

playerSchema.pre("remove", async function () {
  await cleanupPlayerReferences(this._id);
});

const Player = mongoose.model("Player", playerSchema);

module.exports = Player;
