const { z } = require("zod");

const statTypes = ["PLAYER_SEASON", "TEAM_SEASON", "TEAM_MATCH"];

exports.createStatisticSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  player: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  team: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  season: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  competition: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  type: z.enum(statTypes),
  matchesPlayed: z.number().int().min(0).optional(),
  goals: z.number().int().min(0).optional(),
  assists: z.number().int().min(0).optional(),
  cleanSheets: z.number().int().min(0).optional(),
  yellowCards: z.number().int().min(0).optional(),
  redCards: z.number().int().min(0).optional(),
  minutesPlayed: z.number().int().min(0).optional(),
  saves: z.number().int().min(0).optional(),
  winRate: z.number().min(0).max(100).optional(),
  draws: z.number().int().min(0).optional(),
  losses: z.number().int().min(0).optional(),
  goalsFor: z.number().int().min(0).optional(),
  goalsAgainst: z.number().int().min(0).optional(),
  points: z.number().int().min(0).optional(),
  position: z.number().int().positive().optional(),
  extra: z.record(z.any()).optional(),
});

exports.updateStatisticSchema = z.object({
  matchesPlayed: z.number().int().min(0).optional(),
  goals: z.number().int().min(0).optional(),
  assists: z.number().int().min(0).optional(),
  cleanSheets: z.number().int().min(0).optional(),
  yellowCards: z.number().int().min(0).optional(),
  redCards: z.number().int().min(0).optional(),
  minutesPlayed: z.number().int().min(0).optional(),
  saves: z.number().int().min(0).optional(),
  winRate: z.number().min(0).max(100).optional(),
  draws: z.number().int().min(0).optional(),
  losses: z.number().int().min(0).optional(),
  goalsFor: z.number().int().min(0).optional(),
  goalsAgainst: z.number().int().min(0).optional(),
  points: z.number().int().min(0).optional(),
  position: z.number().int().positive().optional(),
  extra: z.record(z.any()).optional(),
});

exports.statisticIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid statistic ID"),
});
