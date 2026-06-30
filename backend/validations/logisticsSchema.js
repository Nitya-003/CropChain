const Joi = require("joi");

const waypointSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    "number.base": "Latitude must be a number",
    "number.min": "Latitude must be between -90 and 90",
    "number.max": "Latitude must be between -90 and 90",
    "any.required": "Latitude is required for all coordinates"
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    "number.base": "Longitude must be a number",
    "number.min": "Longitude must be between -180 and 180",
    "number.max": "Longitude must be between -180 and 180",
    "any.required": "Longitude is required for all coordinates"
  }),
  address: Joi.string().allow("").optional(),
  type: Joi.string().valid("start", "pickup", "dropoff").optional(),
  batchId: Joi.string().allow("").optional()
});

const optimizeRouteSchema = Joi.object({
  coordinates: Joi.array().items(waypointSchema).min(2).max(15).required().messages({
    "array.base": "Coordinates must be an array",
    "array.min": "At least 2 coordinates (e.g. start and destination) are required to optimize a route",
    "array.max": "Cannot optimize routes with more than 15 coordinates",
    "any.required": "Coordinates array is required"
  })
});

module.exports = { optimizeRouteSchema };
