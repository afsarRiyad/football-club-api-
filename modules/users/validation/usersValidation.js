const { z } = require("zod");

const userRoles = [
  "SUPER_ADMIN",
  "CLUB_ADMIN",
  "TEAM_MANAGER",
  "COACH",
  "SCORER",
  "PLAYER",
  "MEMBER",
];

exports.updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  photo: z.string().url().optional(),
});

exports.updateUserRoleSchema = z.object({
  role: z.enum(userRoles, {
    errorMap: () => ({ message: "Invalid role" }),
  }),
});

exports.userIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),
});
