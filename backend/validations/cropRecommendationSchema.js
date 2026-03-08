'use strict';

const Joi = require('joi');

/**
 * Validation schema for POST /api/recommend
 *
 * All ranges are grounded in the Crop Recommendation Dataset and real-world
 * agricultural biology so that impossible inputs are rejected early.
 */
const cropRecommendationSchema = Joi.object({
  // Soil macronutrients (kg/ha)
  N: Joi.number().min(0).max(140).required()
    .messages({ 'number.base': 'N (Nitrogen) must be a number', 'any.required': 'N (Nitrogen) is required' }),

  P: Joi.number().min(5).max(145).required()
    .messages({ 'number.base': 'P (Phosphorous) must be a number', 'any.required': 'P (Phosphorous) is required' }),

  K: Joi.number().min(5).max(205).required()
    .messages({ 'number.base': 'K (Potassium) must be a number', 'any.required': 'K (Potassium) is required' }),

  // Soil chemistry
  pH: Joi.number().min(3.5).max(9.5).required()
    .messages({ 'number.base': 'pH must be a number', 'any.required': 'pH is required' }),

  // Environmental factors
  temperature: Joi.number().min(0).max(50).required()
    .messages({ 'number.base': 'temperature must be a number', 'any.required': 'temperature is required' }),

  humidity: Joi.number().min(10).max(100).required()
    .messages({ 'number.base': 'humidity must be a number (percentage)', 'any.required': 'humidity is required' }),

  rainfall: Joi.number().min(0).max(300).required()
    .messages({ 'number.base': 'rainfall must be a number (mm)', 'any.required': 'rainfall is required' }),
});

module.exports = { cropRecommendationSchema };
