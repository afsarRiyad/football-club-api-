const { z } = require("zod");

const galleryCategories = ["MATCH", "TRAINING", "EVENT", "CELEBRATION", "OTHER"];
const mediaTypes = ["IMAGE", "VIDEO"];

exports.createGallerySchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  title: z.string().min(1).max(150),
  description: z.string().optional(),
  category: z.enum(galleryCategories).optional(),
  coverImage: z.string().url().optional(),
  media: z
    .array(
      z.object({
        url: z.string().url("Invalid media URL"),
        type: z.enum(mediaTypes).optional(),
        caption: z.string().optional(),
      })
    )
    .optional(),
  isPublished: z.boolean().optional(),
});

exports.updateGallerySchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  category: z.enum(galleryCategories).optional(),
  coverImage: z.string().url().optional(),
  isPublished: z.boolean().optional(),
});

exports.addMediaSchema = z.object({
  url: z.string().url("Invalid media URL"),
  type: z.enum(mediaTypes).optional(),
  caption: z.string().optional(),
});

exports.galleryIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid gallery ID"),
});
