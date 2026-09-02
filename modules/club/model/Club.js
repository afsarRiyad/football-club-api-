const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Club name is required"],
      trim: true,
      maxlength: [150, "Club name cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    founded: {
      type: Number,
    },
    logo: {
      type: String,
      default: "",
    },
    cover: {
      type: String,
      default: "",
    },
    primaryColor: {
      type: String,
      default: "#1a1a2e",
    },
    secondaryColor: {
      type: String,
      default: "#e94560",
    },
    stadium: {
      name: { type: String, default: "" },
      capacity: { type: Number },
      address: { type: String, default: "" },
    },
    contact: {
      email: { type: String },
      phone: { type: String },
      website: { type: String },
      social: {
        facebook: { type: String, default: "" },
        twitter: { type: String, default: "" },
        instagram: { type: String, default: "" },
        youtube: { type: String, default: "" },
      },
    },
    location: {
      city: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug from name
clubSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Virtual: teams count
clubSchema.virtual("teamsCount", {
  ref: "Team",
  localField: "_id",
  foreignField: "club",
  count: true,
});

// Virtual: players count
clubSchema.virtual("playersCount", {
  ref: "Player",
  localField: "_id",
  foreignField: "club",
  count: true,
});

const Club = mongoose.model("Club", clubSchema);

module.exports = Club;
