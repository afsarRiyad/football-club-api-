const { z } = require("zod");

const statTypes = [
  "GOALS",
  "ASSISTS",
  "CLEAN_SHEETS",
  "YELLOW_CARDS",
  "RED_CARDS",
  "APPEARANCES",
  "MINUTES_PLAYED",
];

exports.createStatisticSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  player: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID").optional(),
  team: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID").optional(),
  type: z.enum(statTypes),
  value: z.number().min(0, "Value cannot be negative"),
  season: z.string().optional(),
  competition: z.string().optional(),
});

exports.updateStatisticSchema = z.object({
  player: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  team: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  type: z.enum(statTypes).optional(),
  value: z.number().min(0).optional(),
  season: z.string().optional(),
  competition: z.string().optional(),
});

exports.statisticIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid statistic ID"),
});
