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
      // e.g. "GK", "LB", "CB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"
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

const teamSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      maxlength: [100, "Team name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["SENIOR", "JUNIOR", "WOMEN", "ACADEMY", "RESERVE"],
      default: "SENIOR",
    },
    division: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    viceCaptain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    formation: {
      type: String,
      default: "4-3-3",
      // e.g. "4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "3-4-3", "5-3-2"
    },
    startingXI: [startingXIEntrySchema],
    bench: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
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

// Auto-generate slug
teamSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Virtual for squad size
teamSchema.virtual("squadSize", {
  ref: "Player",
  localField: "players",
  foreignField: "_id",
  count: true,
});

/**
 * Cascade cleanup: whenever a Team is removed through ANY delete path
 * (findByIdAndDelete, deleteOne, or document.remove()).
 *
 * Results are history. This used to run `Match.deleteMany(...)` for every fixture
 * the team played, so cleaning up a retired or mistyped team silently destroyed
 * scores, scorers and whole seasons of results. Instead the team's name and logo
 * are now frozen onto those fixtures, and the fixtures stay: their Team reference
 * goes dangling, which every read path already tolerates via the snapshot.
 *
 * What genuinely belongs to the team — its saved match formations and its own
 * statistics rows — still goes with it. Idempotent, and the controller may also
 * clean up, so running both is safe.
 *
 * @param {{id: any, name?: string, logo?: string}} team - identity to freeze onto matches
 */
const cleanupTeamReferences = async ({ id, name, logo }) => {
  if (!id) return;
  const Match = require("../../matches/model/Match");
  const MatchFormation = require("../../matches/model/MatchFormation");
  const Statistic = require("../../statistics/model/Statistic");

  const work = [
    MatchFormation.deleteMany({ team: id }),
    Statistic.deleteMany({ team: id }),
  ];

  /* Only freeze when the name is actually known — an unknown name must not
     overwrite a snapshot that is already stored on the match. */
  if (name !== undefined) {
    work.push(
      Match.updateMany({ homeTeam: id }, { homeTeamName: name || "", homeTeamLogo: logo || "" }),
      Match.updateMany({ awayTeam: id }, { awayTeamName: name || "", awayTeamLogo: logo || "" })
    );
  }

  await Promise.all(work);
};

const getIdFromFilter = (filter) => {
  const id = filter && filter._id;
  if (!id) return null;
  if (typeof id === "object" && !(id instanceof mongoose.Types.ObjectId)) {
    return null; // complex multi-delete — leave those to explicit cleanup
  }
  return id;
};

/* The team's own name/logo are needed to freeze them onto its fixtures, so read
   them before the delete runs. `this.model` is the Team model on a query hook. */
const loadIdentity = async (model, id) => {
  if (!id) return null;
  try {
    return await model.findById(id).select("name logo").lean();
  } catch {
    return null;
  }
};

teamSchema.pre("findOneAndDelete", async function () {
  const id = getIdFromFilter(this.getFilter());
  const team = await loadIdentity(this.model, id);
  await cleanupTeamReferences({ id, name: team?.name, logo: team?.logo });
});

teamSchema.pre("deleteOne", async function () {
  const id = getIdFromFilter(this.getFilter());
  const team = await loadIdentity(this.model, id);
  await cleanupTeamReferences({ id, name: team?.name, logo: team?.logo });
});

teamSchema.pre("remove", async function () {
  await cleanupTeamReferences({ id: this._id, name: this.name, logo: this.logo });
});

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
