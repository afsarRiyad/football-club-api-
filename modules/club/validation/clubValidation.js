const { z } = require("zod");

exports.createClubSchema = z.object({
  name: z
    .string()
    .min(1, "Club name is required")
    .max(150, "Club name cannot exceed 150 characters"),
  description: z.string().optional(),
  founded: z.number().int().min(1800).max(2100).optional(),
  logo: z.string().url().optional(),
  cover: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  stadium: z
    .object({
      name: z.string().optional(),
      capacity: z.number().int().positive().optional(),
      address: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      social: z
        .object({
          facebook: z.string().url().optional(),
          twitter: z.string().url().optional(),
          instagram: z.string().url().optional(),
          youtube: z.string().url().optional(),
        })
        .optional(),
    })
    .optional(),
  location: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});

exports.updateClubSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  founded: z.number().int().min(1800).max(2100).optional(),
  logo: z.string().url().optional(),
  cover: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  stadium: z
    .object({
      name: z.string().optional(),
      capacity: z.number().int().positive().optional(),
      address: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      social: z
        .object({
          facebook: z.string().url().optional(),
          twitter: z.string().url().optional(),
          instagram: z.string().url().optional(),
          youtube: z.string().url().optional(),
        })
        .optional(),
    })
    .optional(),
  location: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

exports.clubIdParam = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
});

exports.clubSlugParam = z.object({
  slug: z.string().min(1, "Slug is required"),
});
