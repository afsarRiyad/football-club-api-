const { z } = require("zod");

const compTypes = ["LEAGUE", "CUP", "TOURNAMENT", "FRIENDLY"];
const formats = ["ROUND_ROBIN", "KNOCKOUT", "GROUP_STAGE", "PLAYOFF"];

exports.createCompetitionSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  name: z.string().min(1).max(150),
  type: z.enum(compTypes).optional(),
  logo: z.string().url().optional(),
  country: z.string().optional(),
  description: z.string().optional(),
  season: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  format: z.enum(formats).optional(),
});

exports.updateCompetitionSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  type: z.enum(compTypes).optional(),
  logo: z.string().url().optional(),
  country: z.string().optional(),
  description: z.string().optional(),
  format: z.enum(formats).optional(),
  isActive: z.boolean().optional(),
});

exports.addTeamSchema = z.object({
  teamId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
});

exports.competitionIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid competition ID"),
});
