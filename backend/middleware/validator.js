const { ValidationError } = require("../utils/errorHandler");

const validateRequest = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();

    // Support Zod schemas (safeParse)
    if (typeof schema.safeParse === 'function') {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues || result.error.errors || [];
        const details = issues.map((err) => err.message);
        const validationError = new ValidationError('Validation failed', details);
        return next(validationError);
      }
      req.body = result.data;
      return next();
    }

    // Support Joi schemas (validate)
    if (typeof schema.validate === 'function') {
      const { error } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        const details = error.details.map((detail) => detail.message);
        const validationError = new ValidationError('Validation failed', details);
        return next(validationError);
      }
      return next();
    }

    next();
  };
};

module.exports = validateRequest;

