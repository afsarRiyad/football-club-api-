const { z } = require("zod");

const categories = ["SENIOR", "JUNIOR", "WOMEN", "ACADEMY", "RESERVE"];

const formations = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "3-4-3", "5-3-2"];

const startingXIEntry = z.object({
  player: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID"),
  position: z.string().min(1, "Position is required"),
  slotIndex: z.number().int().min(0).max(10),
});

exports.createTeamSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  name: z.string().min(1).max(100),
  category: z.enum(categories).optional(),
  division: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  manager: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID").optional(),
  coach: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID").optional(),
  captain: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID").optional(),
  formation: z.enum(formations).optional(),
  startingXI: z.array(startingXIEntry).max(11).optional(),
});

exports.updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(categories).optional(),
  division: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
  manager: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID").optional(),
  coach: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID").optional(),
  captain: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID").optional(),
  formation: z.enum(formations).optional(),
  startingXI: z.array(startingXIEntry).max(11).optional(),
  isActive: z.boolean().optional(),
});

exports.addPlayerSchema = z.object({
  playerId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID"),
});

exports.teamIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
});
