const { z } = require("zod");

const positions = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"];
const subPositions = [
  "CENTRE_BACK",
  "LEFT_BACK",
  "RIGHT_BACK",
  "DEFENSIVE_MIDFIELDER",
  "CENTRAL_MIDFIELDER",
  "ATTACKING_MIDFIELDER",
  "LEFT_WINGER",
  "RIGHT_WINGER",
  "STRIKER",
  "SECOND_STRIKER",
];
const statuses = ["ACTIVE", "INJURED", "SUSPENDED", "LOANED", "INACTIVE"];
const feet = ["LEFT", "RIGHT", "BOTH"];

exports.createPlayerSchema = z.object({
  user: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID").optional(),
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  number: z.number().int().min(1).max(99).optional(),
  position: z.enum(positions),
  subPosition: z.enum(subPositions).optional(),
  dateOfBirth: z.string().datetime().optional(),
  nationality: z.string().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  preferredFoot: z.enum(feet).optional(),
  photo: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  joinDate: z.string().datetime().optional(),
  contractEnd: z.string().datetime().optional(),
  status: z.enum(statuses).optional(),
});

exports.updatePlayerSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  number: z.number().int().min(1).max(99).optional(),
  position: z.enum(positions).optional(),
  subPosition: z.enum(subPositions).optional(),
  nationality: z.string().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  preferredFoot: z.enum(feet).optional(),
  photo: z.string().url().optional(),
  bio: z.string().max(1000).optional(),
  contractEnd: z.string().datetime().optional(),
  status: z.enum(statuses).optional(),
  isActive: z.boolean().optional(),
});

exports.playerIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid player ID"),
});

exports.bulkImportSchema = z.object({
  players: z
    .array(
      z.object({
        club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        number: z.number().int().min(1).max(99).optional(),
        position: z.enum(positions),
        subPosition: z.enum(subPositions).optional(),
        dateOfBirth: z.string().datetime().optional(),
        nationality: z.string().optional(),
        height: z.number().positive().optional(),
        weight: z.number().positive().optional(),
        preferredFoot: z.enum(feet).optional(),
        bio: z.string().max(1000).optional(),
      })
    )
    .min(1, "At least one player is required")
    .max(50, "Cannot import more than 50 players at once"),
});

exports.transferPlayerSchema = z.object({
  toClubId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  newNumber: z.number().int().min(1).max(99).optional(),
  transferNotes: z.string().max(500).optional(),
});

exports.linkToUserSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),
});
