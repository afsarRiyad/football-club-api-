const { z } = require("zod");

const tournamentFormats = ["SINGLE_KNOCKOUT", "DOUBLE_KNOCKOUT", "ROUND_ROBIN", "GROUP_AND_KNOCKOUT"];
const teamCounts = [2, 4, 8, 16, 32];

exports.createTournamentSchema = z.object({
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID").optional(),
  name: z.string().min(1).max(150),
  format: z.enum(tournamentFormats).optional(),
  teamCount: z.coerce
    .number()
    .int()
    .refine((v) => teamCounts.includes(v), "Team count must be 2, 4, 8, 16, or 32")
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  matchIntervalDays: z.coerce.number().int().min(1).max(30).optional(),
  /* Sides that only exist for this tournament, typed in by hand. Never Team
     documents — the same rule as a match's free-text opponent. */
  manualTeams: z.array(z.string().trim().min(1).max(120)).max(32).optional(),
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

/* `validate()` REPLACES req.body with the parsed object, so anything the admin
   sends that is not declared here is silently dropped — that is how a match
   created as "FT 4-1" used to be stored as SCHEDULED 0-0. Goal scorers and
   assists are part of the result dialog, so they must be declared. */
const eventSchema = z.object({
  type: z.enum([
    "GOAL",
    "OWN_GOAL",
    "YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "PENALTY_MISSED",
    "INJURY",
  ]),
  minute: z.coerce.number().int().min(0).max(120).optional(),
  side: z.enum(["HOME", "AWAY"]).optional(),
  player: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID").optional(),
  assist: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID").optional(),
  playerName: z.string().trim().max(80).optional(),
  assistName: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
});

exports.recordResultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  events: z.array(eventSchema).max(60).optional(),
});
