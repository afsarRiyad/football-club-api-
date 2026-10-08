const { z } = require("zod");
const {
  NAME_CHARSET,
  TEAM_CHARSET,
  VENUE_CHARSET,
  sanitizePlainText,
  sanitizeMultiline,
  plainTextViolation,
  markupViolation,
} = require("../../../utils/textGuards");



const MIN_NAME = 2;
const MAX_NAME = 80;
const MIN_TEAM = 2;
const MAX_TEAM = 100;
const MAX_VENUE = 120;
const MAX_PHONE = 25;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 1000;

const blankToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/**
 * A single-line field that must read as a plain name, team or venue.
 * @param {object} opts
 * @param {string} opts.label   human name used in error messages
 * @param {number} opts.min
 * @param {number} opts.max
 * @param {RegExp} opts.charset
 * @param {string} opts.allowed description of the allowed characters
 */
const plainText = ({ label, min, max, charset, allowed }) =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`,
    })
    .transform(sanitizePlainText)
    .superRefine((value, ctx) => {
      const fail = (message) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });

      if (value.length < min) {
        fail(`${label} must be at least ${min} characters`);
        return;
      }
      if (value.length > max) {
        fail(`${label} cannot exceed ${max} characters`);
        return;
      }
      /* A link is reported before the character set, because "no links" is the
         rule a human needs to hear — the charset is only the backstop. */
      const violation = plainTextViolation(value);
      if (violation) {
        fail(`${label} ${violation}`);
        return;
      }
      if (!charset.test(value)) {
        fail(`${label} may only contain ${allowed}`);
      }
    });

/** Same rules, but the field may be omitted or sent empty. */
const optionalPlainText = (opts) =>
  z.preprocess(blankToUndefined, plainText(opts).optional());

const requesterName = plainText({
  label: "Requester name",
  min: MIN_NAME,
  max: MAX_NAME,
  charset: NAME_CHARSET,
  allowed: "letters, spaces and . ' - ( )",
});

const teamName = plainText({
  label: "Team name",
  min: MIN_TEAM,
  max: MAX_TEAM,
  charset: TEAM_CHARSET,
  allowed: "letters, numbers, spaces and . ' - ( ) & / +",
});

const requesterPhone = optionalPlainText({
  label: "Phone",
  min: 6,
  max: MAX_PHONE,
  charset: /^\+?[0-9 ()\-.]+$/,
  allowed: "digits, spaces and + - ( )",
}).refine(
  (value) => {
    if (value === undefined) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 6 && digits.length <= 15;
  },
  { message: "Phone must contain between 6 and 15 digits" }
);

const preferredVenue = optionalPlainText({
  label: "Preferred venue",
  min: 2,
  max: MAX_VENUE,
  charset: VENUE_CHARSET,
  allowed: "letters, numbers, spaces and . ' - ( ) / + :",
});

/* The date arrives as an ISO string (`new Date(value).toISOString()`), so an
   unparseable value must be a validation error rather than an `Invalid Date`
   that Mongo silently stores as null. */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const SIX_YEARS_MS = 6 * 365 * 24 * 60 * 60 * 1000;

const preferredDate = z.preprocess(
  blankToUndefined,
  z
    .string({
      required_error: "Preferred date is required",
      invalid_type_error: "Preferred date must be a date",
    })
    .datetime({ offset: true, message: "Preferred date must be a valid date" })
    .refine(
      (value) => {
        const t = Date.parse(value);
        return t >= Date.now() - ONE_YEAR_MS && t <= Date.now() + SIX_YEARS_MS;
      },
      { message: "Preferred date must be between one year ago and six years from now" }
    )
    .optional()
);

/* Free-form: links allowed, markup not, capped length. */
const message = z.preprocess(
  blankToUndefined,
  z
    .string()
    .transform(sanitizeMultiline)
    .superRefine((value, ctx) => {
      const fail = (m) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
      if (value.length > MAX_MESSAGE) {
        fail(`Message cannot exceed ${MAX_MESSAGE} characters`);
        return;
      }
      const violation = markupViolation(value);
      if (violation) fail(`Message ${violation}`);
    })
    .optional()
);

exports.createMatchRequestSchema = z.object({
  club: z
    .string({
      required_error: "Club is required",
      invalid_type_error: "Club must be an id",
    })
    .regex(/^[a-f\d]{24}$/i, "Invalid club ID"),
  requesterName,
  requesterEmail: z
    .string({
      required_error: "Requester email is required",
      invalid_type_error: "Requester email must be text",
    })
    .trim()
    .toLowerCase()
    .min(1, "Requester email is required")
    .max(MAX_EMAIL, "Requester email is too long")
    .email("Enter a valid email address"),
  requesterPhone,
  teamName,
  preferredDate,
  preferredVenue,
  message,
});

/* Admin-only status change; kept here so both writes on this resource are
   validated in one place. */
exports.updateMatchRequestSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"], {
    invalid_type_error: "Status must be PENDING, APPROVED or REJECTED",
  }).optional(),
  adminNotes: z
    .string()
    .transform(sanitizePlainText)
    .refine((value) => value.length <= MAX_MESSAGE, {
      message: `Admin notes cannot exceed ${MAX_MESSAGE} characters`,
    })
    .optional(),
});

exports.LIMITS = { MAX_NAME, MAX_TEAM, MAX_VENUE, MAX_PHONE, MAX_EMAIL, MAX_MESSAGE };
