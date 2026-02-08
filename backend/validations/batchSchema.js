const Joi = require("joi");

const createBatchSchema = Joi.object({
  farmerName: Joi.string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z\s.-]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Farmer name can only contain letters, spaces, periods, and hyphens",
    }),

  farmerAddress: Joi.string().min(10).max(500).required(),

  cropType: Joi.string().valid("rice", "wheat", "corn", "tomato").required(),

  quantity: Joi.number().min(1).max(1000000).required(),

  harvestDate: Joi.date().iso().max("now").required(),

  origin: Joi.string().min(5).max(200).required(),

  certifications: Joi.string().max(500).allow(""),
  description: Joi.string().max(1000).allow(""),
});

module.exports = { createBatchSchema };
