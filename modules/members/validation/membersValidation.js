const { z } = require("zod");

const membershipTypes = ["FREE", "BASIC", "PREMIUM", "VIP"];

exports.createMemberSchema = z.object({
  user: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID"),
  club: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  membershipType: z.enum(membershipTypes).optional(),
  expiryDate: z.string().datetime().optional(),
  preferences: z
    .object({
      notifications: z.boolean().optional(),
      newsletter: z.boolean().optional(),
    })
    .optional(),
});

exports.updateMemberSchema = z.object({
  membershipType: z.enum(membershipTypes).optional(),
  expiryDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  preferences: z
    .object({
      notifications: z.boolean().optional(),
      newsletter: z.boolean().optional(),
    })
    .optional(),
});

exports.upgradeMembershipSchema = z.object({
  membershipType: z.enum(membershipTypes),
  expiryDate: z.string().datetime().optional(),
});

exports.memberIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid member ID"),
});
