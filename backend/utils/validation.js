const apiResponse = require("./apiResponse");

const validateParams = (res, schema, params) => {
  const validationResult = schema.safeParse(params);

  if (!validationResult.success) {
    res.status(400).json(
      apiResponse.errorResponse("Validation failed", "VALIDATION_ERROR", 400, {
        errors: validationResult.error.issues.map((issue) => issue.message),
      }),
    );

    return null;
  }

  return validationResult.data;
};

module.exports = {
  validateParams,
};
