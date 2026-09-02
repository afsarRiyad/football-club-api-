const { z } = require("zod");

const matchStatuses = ["SCHEDULED", "LIVE", "HT", "FT", "POSTPONED", "CANCELLED"];
const eventTypes = [
  "GOAL",
  "OWN_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "PENALTY_MISSED",
  "INJURY",
];

const matchEventSchema = z.object({
  type: z.enum(eventTypes),
  minute: z.number().int().min(0).max(120).optional(),
  player: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  assist: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  description: z.string().optional(),
});

exports.createMatchSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  competition: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  season: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  homeTeam: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
  awayTeam: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
  matchDate: z.string().datetime("Invalid match date"),
  kickoff: z.string().optional(),
  venue: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  referee: z.string().optional(),
  notes: z.string().optional(),
});

exports.updateMatchSchema = z.object({
  matchDate: z.preprocess((val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    return val;
  }, z.string().datetime().optional()),
  kickoff: z.string().optional(),
  venue: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  status: z.enum(matchStatuses).optional(),
  score: z
    .object({
      home: z.number().int().min(0),
      away: z.number().int().min(0),
    })
    .optional(),
  attendance: z.number().int().positive().optional(),
  referee: z.string().optional(),
  notes: z.string().optional(),
}).partial();

exports.addEventSchema = matchEventSchema;

exports.matchIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid match ID"),
});
