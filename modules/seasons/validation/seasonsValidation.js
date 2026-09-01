const { z } = require("zod");

exports.createSeasonSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  name: z.string().min(1).max(50),
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

exports.updateSeasonSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

exports.seasonIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid season ID"),
});
