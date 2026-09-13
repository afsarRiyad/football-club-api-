const { z } = require("zod");

const categories = ["Transfer", "Match Report", "Interview", "Analysis", "Club News", "General"];

exports.createNewsSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1, "Content is required"),
  cover: z.string().optional(),
  category: z.enum(categories).optional(),
  tags: z.array(z.string().trim()).optional(),
  isPublished: z.boolean().optional(),
  /* Declared, or the validate middleware would strip it before the controller
     ever sees it (Zod drops keys the schema does not mention). */
  isFeatured: z.boolean().optional(),
});

exports.updateNewsSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1).optional(),
  cover: z.string().optional(),
  category: z.enum(categories).optional(),
  tags: z.array(z.string().trim()).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

exports.newsIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid news ID"),
});
