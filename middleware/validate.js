const AppError = require("../utils/AppError");

/**
 * Creates Express middleware that validates req.body, req.params, or req.query
 * against a Zod schema.
 * @param {import("zod").ZodSchema} schema - Zod schema to validate against
 * @param {"body" | "params" | "query"} source - Which part of req to validate
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return next(new AppError(`Validation failed: ${errors.map((e) => e.message).join("; ")}`, 400));
    }

    // Replace with parsed (and stripped) values
    req[source] = result.data;
    next();
  };
};

module.exports = validate;
