const Joi = require("joi");
const STAGES = require("../constants/stages");

const createBatchSchema = Joi.object({
  // farmerId is not sent by the frontend — the backend trusts req.user for this.
  // Kept optional here only in case a caller supplies it explicitly.
  farmerId: Joi.string().alphanum().min(5).max(50).optional(),

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

  harvestDate: Joi.date().iso().max("now").required().messages({
    "date.max": "Harvest date cannot be in the future",
  }),

  origin: Joi.string().min(5).max(200).required(),

  certifications: Joi.string().max(500).allow(""),
  description: Joi.string().max(1000).allow(""),
  blockchainHash: Joi.string().allow("").optional(),
});

const updateBatchSchema = Joi.object({
  // batchId is in URL, so not required in body
  batchId: Joi.string().optional(),

  stage: Joi.string()
    .valid(...STAGES)
    .required()
    .lowercase() // Normalize to lowercase before validation
    .messages({
      "any.only": `Stage must be one of: ${STAGES.join(', ')}`,
    }),

  actor: Joi.string().min(2).max(100).required(),
  location: Joi.string().min(2).max(200).required(),
  notes: Joi.string().max(500).allow(""),
  timestamp: Joi.date()
    .iso()
    .max("now")
    .default(() => new Date()),
  blockchainHash: Joi.string().allow("").optional(),
});


module.exports = { createBatchSchema, updateBatchSchema };