const { ValidationError } = require('../utils/errorHandler');

const validateRequest = (schema) => {
  return (req, res, next) => {
    // We validate the request body against the provided schema
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      // If there's an error, throw ValidationError to be caught by error handler
      const details = error.details.map((detail) => detail.message);
      const validationError = new ValidationError('Validation failed', details);
      return next(validationError);
    }

    // If validation passes, we move to the next step (the route handler)
    next();
  };
};

module.exports = validateRequest;

