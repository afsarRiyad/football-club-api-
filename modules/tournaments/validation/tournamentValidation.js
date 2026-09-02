const { z } = require("zod");

const tournamentFormats = ["SINGLE_KNOCKOUT", "DOUBLE_KNOCKOUT", "ROUND_ROBIN", "GROUP_AND_KNOCKOUT"];
const teamCounts = [2, 4, 8, 16, 32];

exports.createTournamentSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID").optional(),
  name: z.string().min(1).max(150),
  format: z.enum(tournamentFormats).optional(),
  teamCount: z.enum(teamCounts.map(String)).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  matchIntervalDays: z.number().int().min(1).max(30).optional(),
});

exports.updateTournamentSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  status: z.enum(["DRAFT", "REGISTRATION", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  matchIntervalDays: z.number().int().min(1).max(30).optional(),
});

exports.recordResultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});
