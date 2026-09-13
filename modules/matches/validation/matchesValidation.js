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

/* Note: this middleware REPLACES req.body with the parsed object, and Zod drops
   keys that are not declared here. Anything the create form sends but this
   schema omits is silently thrown away — that is why `status`, `score` and
   `attendance` are declared explicitly. Without them a match created straight
   as "FT 4-1" was saved as SCHEDULED 0-0 and never appeared in the homepage
   results section. */
exports.createMatchSchema = z
  .object({
    club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
    competition: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    season: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    homeTeam: z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"),
    /* Either a real Team id, or null/omitted together with awayTeamName. */
    awayTeam: z
      .union([z.string().regex(/^[a-f\d]{24}$/i, "Invalid team ID"), z.null()])
      .optional(),
    awayTeamName: z.string().trim().max(120).optional(),
    matchDate: z.string().datetime("Invalid match date"),
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
    attendance: z.number().int().nonnegative().optional(),
    referee: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.awayTeam) || Boolean(data.awayTeamName && data.awayTeamName.trim()),
    {
      message: "Away team is required — pick a team or type an opponent name",
      path: ["awayTeamName"],
    }
  );

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
