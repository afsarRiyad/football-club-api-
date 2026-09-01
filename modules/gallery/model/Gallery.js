const mongoose = require("mongoose");

const mediaItemSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["IMAGE", "VIDEO"],
      default: "IMAGE",
    },
    caption: {
      type: String,
      default: "",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: true, timestamps: true }
);

const gallerySchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Club is required"],
    },
    title: {
      type: String,
      required: [true, "Gallery title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: ["MATCH", "TRAINING", "EVENT", "CELEBRATION", "OTHER"],
      default: "OTHER",
    },
    coverImage: {
      type: String,
      default: "",
    },
    media: [mediaItemSchema],
    isPublished: {
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

// Virtual for media count
gallerySchema.virtual("mediaCount").get(function () {
  return this.media.length;
});

const Gallery = mongoose.model("Gallery", gallerySchema);

module.exports = Gallery;
