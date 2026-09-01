const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
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

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
