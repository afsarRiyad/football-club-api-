const mongoose = require("mongoose");

const competitionSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    name: {
      type: String,
      required: [true, "Competition name is required"],
      trim: true,
      maxlength: [150, "Competition name cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["LEAGUE", "CUP", "TOURNAMENT", "FRIENDLY"],
      default: "LEAGUE",
    },
    logo: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
    ],
    format: {
      type: String,
      enum: ["ROUND_ROBIN", "KNOCKOUT", "GROUP_STAGE", "PLAYOFF"],
      default: "ROUND_ROBIN",
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

competitionSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

const Competition = mongoose.model("Competition", competitionSchema);

module.exports = Competition;
