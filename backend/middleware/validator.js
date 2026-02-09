const validateRequest = (schema) => {
  return (req, res, next) => {
    // We validate the request body against the provided schema
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      // If there's an error, we send a 400 Bad Request response
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((detail) => detail.message),
      });
    }

    // If validation passes, we move to the next step (the route handler)
    next();
  };
};

module.exports = validateRequest;
