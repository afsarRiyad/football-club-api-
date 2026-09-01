const { z } = require("zod");

const categories = [
  "GENERAL",
  "MATCH_REPORT",
  "TRANSFER",
  "INJURY",
  "EVENT",
  "ANNOUNCEMENT",
];

exports.createNewsSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1, "Content is required"),
  coverImage: z.string().url().optional(),
  category: z.enum(categories).optional(),
  tags: z.array(z.string().trim()).optional(),
  isPublished: z.boolean().optional(),
});

exports.updateNewsSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1).optional(),
  coverImage: z.string().url().optional(),
  category: z.enum(categories).optional(),
  tags: z.array(z.string().trim()).optional(),
  isPublished: z.boolean().optional(),
});

exports.newsIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid news ID"),
});
