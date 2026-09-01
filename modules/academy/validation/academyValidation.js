const { z } = require("zod");

const ageGroups = ["U8", "U10", "U12", "U14", "U16", "U18", "U21"];

exports.createAcademySchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  ageGroup: z.enum(ageGroups),
  headCoach: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  schedule: z
    .object({
      trainingDays: z.array(z.string()).optional(),
      trainingTime: z.string().optional(),
    })
    .optional(),
});

exports.updateAcademySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  ageGroup: z.enum(ageGroups).optional(),
  headCoach: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  schedule: z
    .object({
      trainingDays: z.array(z.string()).optional(),
      trainingTime: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

exports.addPlayerSchema = z.object({
  playerId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID"),
});

exports.academyIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid academy ID"),
});
